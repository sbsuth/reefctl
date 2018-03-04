
// Shared settings for all topup monitors.
var topup_settings = {
	filling_interval_sec:		10,
	watching_interval_sec:		5 * 60,
	post_timeout_interval_sec:	1 * 60,
	num_retries:				5,
	ro_min_level:				20,
	debug:						2,
	daytime_only:				true
};

// Initialize missing fields in topup data.
function initTopupData(data) {
	if (data.is_filling == undefined) {
		data.is_filling = 0;
		data.waiting = true; // So first iter will avoid interlock.
		data.retries_left = topup_settings.num_retries;
		data.time_filling = 0;
		data.res_recovering = false; // Hit low, refilling.
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

	var timedOut = false;
	if (isRetry == true) {
		data.retries_left--;
		if (data.retries_left <= 0) {
			data.retries_left = topup_settings.num_retries;
			data.is_filling = false;
			if (topup_settings.debug) {
				console.log("TOPUP: "+data.target_instr_name+": Exhausted "+topup_settings.num_retries+" retries.");
			}
			timedOut = true;
		}
	}
	var interval = (data.enabled && (data.is_filling || isFirst))
		? topup_settings.filling_interval_sec 
		: (timedOut) 
			? topup_settings.post_timeout_interval_sec
			: topup_settings.watching_interval_sec;
		
	if (topup_settings.debug > 1) {
		console.log("TOPUP: "+data.target_instr_name+": enabled="+data.enabled+", filling="+data.is_filling+", wait for "+interval+" sec");
	}
	setTimeout( function() {topupTask(data);}, interval*1000 );
}

function timestamp() {
	var now = new Date;
	return now.toLocaleString();
}

function logFilling( data, error ) {
	var startStop = data.is_filling?"Started ":"Stopped ";
	var msg = "TOPUP: "+data.target_instr_name+": "+timestamp()+": "+startStop;
	if (data.time_filling > 0) {
		msg += ": "+data.time_filling+" sec";
	}
	if (error!=undefined) {
		msg += ": ERROR: "+error;
	}
	console.log( msg );
}

// If failure to send command to either unit, reschedule, and possibly end as exhausted.
function commsFailure(data,error) {
	var wasFilling = data.is_filling;
	scheduleTopup(data,true);
	if (wasFilling && !data.is_filling) {
		logFilling( data, error ); // retries exhausted.
	}
}

function topupTask( data ) {

	var utils = data.utils;
	var instrs = data.instrs;

	var target = utils.get_instr_by_name( instrs, data.target_instr_name );
	var ro_res = utils.get_instr_by_name( instrs, data.ro_res_instr_name );
	if (target == undefined || ro_res == undefined) {
		console.log("ERROR: Cant find instruments ("+data.target_instr_name+","+data.ro_res_instr_name+")");
		return;
	}

	if (data.waiting) {
		// In an async chain.  Don't restart on timer.
		return;
	}

	// If disabled, do nothing, but check if enabled in a while.
	if (!data.enabled) {
		scheduleTopup(data,false);
		return;
	}

			
	// Get the target status, and if not full, run the fill pump
	data.waiting = true;
	utils.queue_and_send_instr_cmd( target, "stat", 
		function(target_status) { // Success
			utils.queue_and_send_instr_cmd( ro_res, "stat", 
				function(ro_status) { // Success
					if (   data.target_fill_ok(data,target_status)
						&& data.ro_fill_ok(data,ro_status)) {
						// Turn on the pump for twice our interval, so we will refresh until its filled.
						if (!data.is_filling) {
							data.is_filling = true;
							data.time_filling = 0;
							logFilling( data );
						}
						var pon_cmd = "pon "+data.pump_num+" "+(topup_settings.filling_interval_sec*2);
						utils.queue_and_send_instr_cmd( ro_res, pon_cmd, 
							function(ro_status) { // Success
								data.time_filling = ro_status.ton;
								data.retries_left = topup_settings.num_retries; // Reset retries on success.
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
				}, function(error) {commsFailure( data, error );} 
			);
		}, function(error) {commsFailure( data, error );}
	);
}

// True if its OK to fill from the RO res given a status.
// Goes into 'ro_recovering' mode when level>ro_min_level,
// then returns false until the float sw closes again.
// Also requires that it be daytime if daytime_only is set.
function ro_fill_ok(data,status) {
	if (topup_settings.daytime_only && !data.utils.is_daytime()) {
		return false;
	}

	if (data.res_recovering) {
		if (status.res_sw) {
			data.res_recovering = false;
			return true;
		} else {
			return false;
		}
	} else {
		if (status.res_lev < 3) {
			// Something's wrong.  No data.
			return false;
		}
		if (status.res_lev >= topup_settings.ro_min_level) {
			data.res_recovering = true;
			return false;
		} else {
			return true;
		}
	}
}


function startup( utils ) {
	
	var instrs = utils.default_instruments; // INCOMPLETE! Hard coded.

	// Start the sump level topup monitor enabled by default.
	var sump_level_instr = utils.get_instr_by_type( instrs, "sump_level" );
	var ro_res_instr = utils.get_instr_by_type( instrs, "ro_res" );
	sump_level_instr.topupData = { 
		utils: utils,
		instrs:  instrs,
		enabled: true,
		target_instr_name: sump_level_instr.name,
		pump_num: 1,
		target_fill_ok: function(data,status) {
			return Boolean(status.sump_sw && (status.sump_lev > 10));
		},
		ro_fill_ok: ro_fill_ok,
		ro_res_instr_name: ro_res_instr.name
	};

	scheduleTopup(sump_level_instr.topupData);

	// Setup the saltwater res topup monitor, off by default.
	var salt_res_instr = utils.get_instr_by_type( instrs, "salt_res" );
	salt_res_instr.topupData = { 
		utils: utils,
		instrs:  instrs,
		enabled: true,
		target_instr_name: salt_res_instr.name,
		pump_num: 2,
		target_fill_ok: function(data,status) {
			return Boolean(!status.float_sw && (status.dist > 5));
		},
		ro_fill_ok: ro_fill_ok,
		ro_res_instr_name: ro_res_instr.name
	};

	scheduleTopup(salt_res_instr.topupData);

	// Setup sump fill from RO.  Must be manually terminated by watching sump!
	sump_level_instr.fillData = { 
		utils: utils,
		instrs:  instrs,
		enabled: false,
		target_instr_name: sump_level_instr.name,
		pump_num: 2,
		target_fill_ok: function(data,status) {
			// Always OK.  Must watch!
			return true;
		},
		ro_fill_ok: ro_fill_ok,
		ro_res_instr_name: ro_res_instr.name
	};

	scheduleTopup(sump_level_instr.fillData);
}

module.exports = {
	startup: startup
}
