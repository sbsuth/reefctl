
var topup_settings = {
	filling_interval_sec:	10,
	watching_interval_sec:	5 * 60,
	//watching_interval_sec:	20,
	num_retries:			5,
	debug:					2
};

// Initialize missing fields in topup data.
function initTopupData(data) {
	if (data.is_filling == undefined) {
		data.is_filling = 0;
	}
	if (data.waiting == undefined) {
		data.waiting = true; // So first iter will avoid interlock.
	}
	if (data.retries_left == undefined) {
		data.retries_left = topup_settings.num_retries;
	}
	if (data.time_filling == undefined) {
		data.time_filling = 0;
	}
}
	
// Schedule a topup iteration.
// If there is an active fill, use the filling interval.  Otherwise, use the watching interval.
// If this is a retry after an error, if there are retries remaining, schedule for filling.
// If retries have been used up, clear filling, and go to watching.
function scheduleTopup( data, isRetry ) {

	var isFirst = Boolean(data.is_filling == undefined);

	initTopupData(data);

	if (!data.waiting) {
		// Interlock against double-dispatch.
		return;
	}

	data.waiting = false;

	if (isRetry == true) {
		data.retries_left--;
		if (data.retries_left <= 0) {
			data.retries_left = topup_settings.num_retries;
			data.is_filling = false;
			if (topup_settings.debug) {
				console.log("TOPUP: Exhausted "+topup_settings.num_retries+" retries.");
			}
		}
	}
	var interval = (data.is_filling || isFirst) 
		? topup_settings.filling_interval_sec 
		: topup_settings.watching_interval_sec;
		
	if (topup_settings.debug > 1) {
		console.log("TOPUP: Schedule topup after "+interval+" sec");
	}
	setTimeout( function() {topupTask(data);}, interval*1000 );
}

function timestamp() {
	var now = new Date;
	return now.toLocaleString();
}

function logFilling( data, error ) {
	var startStop = data.is_filling?"Started ":"Stopped ";
	var msg = "TOPUP: "+timestamp()+": "+startStop;
	if (data.time_filling > 0) {
		msg += ": "+data.time_filling+" sec";
	}
	if (error!=undefined) {
		msg += ": ERROR: "+error;
	}
	console.log( msg );
}

function topupTask( data ) {

	var utils = data.utils;
	var instrs = utils.default_instruments; // INCOMPLETE! Hard coded.

	var sump = utils.get_instr_by_name( instrs, data.sump_instr_name );
	var ro_res = utils.get_instr_by_name( instrs, data.ro_res_instr_name );
	if (sump == undefined || ro_res == undefined) {
		console.log("ERROR: Cant find instruments ("+data.sump_instr_name+","+data.ro_res_instr_name+")");
		return;
	}

	if (data.waiting) {
		// In an async chain.  Don't restart on timer.
		return;
	}
			
	// Get the sump status, and if not full, run the fill pump
	data.waiting = true;
	var stat_cmd = "stat";
	utils.queue_and_send_instr_cmd( sump, stat_cmd, 
		function(stand_status) { // Success
			if (stand_status.sump_sw && (stand_status.sump_lev > 5)) {
				// Turn on the pump for twice our interval, so we will refresh until its filled.
				if (!data.is_filling) {
					data.is_filling = true;
					data.time_filling = 0;
					logFilling( data );
				}
				var pon_cmd = "pon 0 "+(topup_settings.filling_interval_sec*2);
				utils.queue_and_send_instr_cmd( ro_res, pon_cmd, 
					function(ro_status) { // Success
						data.time_filling = ro_status.ton;
						scheduleTopup(data);
					},
					function(error) { // Failure
						scheduleTopup(data,true);
						if (!data.is_filling) {
							logFilling( data, error );
						}
					}
				);
			} else {
				scheduleTopup(data,false);
				if (data.is_filling) {
					data.is_filling = false;
					logFilling( data );
				}
			}
		},
		function(error) { // Failure
			var wasFilling = data.is_filling;
			scheduleTopup(data,true);
			if (wasFilling && !data.is_filling) {
				logFilling( data, error ); // retries exhausted.
			}
		}
	);
}

function startup( utils ) {
	
	var instrs = utils.default_instruments; // INCOMPLETE! Hard coded.

	var topupData = { 
		utils: utils,
		sump_instr_name: utils.get_instr_by_type( instrs, "sump_level" ).name,
		ro_res_instr_name: utils.get_instr_by_type( instrs, "ro_res" ).name
	};

	scheduleTopup(topupData);
}

module.exports = {
	startup: startup
}
