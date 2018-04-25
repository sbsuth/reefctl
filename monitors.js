
// Shared settings for all topup monitors.
var topup_settings = {
	label:						"TOPUP",
	init_data:					initTopupData,
	exec_task:					topupTask,
	active_interval_sec:		10,
	watching_interval_sec:		5 * 60,
	post_timeout_interval_sec:	1 * 60,
	num_retries:				5,
	ro_min_level:				20,
	debug:						2,
	daytime_only:				true
};

// Settings for all dosing monitors
var dosing_settings = {
	label:						"DOSING",
	init_data:					initDosingData,
	exec_task:					dosingTask,
	active_interval_sec:		30, // Glitch in pump with every check so do infrequently.
	watching_interval_sec:		5 * 60,
	post_timeout_interval_sec:	1 * 60,
	inter_interval_sec:			0,
	num_retries:				5,
	debug:						2,
	daytime_only:				true
};

function startup( utils ) {
	
	var instrs = utils.default_instruments; // INCOMPLETE! Hard coded.

	//
	// ATO
	//
	// sump level topup monitor enabled by default.
	var sump_level_instr = utils.get_instr_by_type( instrs, "sump_level" );
	var ro_res_instr = utils.get_instr_by_type( instrs, "ro_res" );
	sump_level_instr.topupData = { 
		name: "ATO",
		utils: utils,
		instrs:  instrs,
		enabled: true,
		target_instr_name: sump_level_instr.name,
		//pump_num: 0, // peristaltic
		pump_num: 1,   // pond
		target_fill_ok: function(data,status) {
			return Boolean(status.sump_sw && (status.sump_lev > 8));
		},
		ro_fill_ok: ro_fill_ok,
		ro_res_instr_name: ro_res_instr.name
	};

	scheduleIter(sump_level_instr.topupData, topup_settings);

	//
	// SALTWATER RES REFILL
	//
	// saltwater res topup monitor, off by default.
	var salt_res_instr = utils.get_instr_by_type( instrs, "salt_res" );
	salt_res_instr.topupData = { 
		name: "Salt Res Refill",
		utils: utils,
		instrs:  instrs,
		enabled: false,
		target_instr_name: salt_res_instr.name,
		pump_num: 1,
		target_fill_ok: function(data,status) {
			return Boolean(!status.float_sw && (status.dist > 5));
		},
		ro_fill_ok: ro_fill_ok,
		ro_res_instr_name: ro_res_instr.name
	};

	scheduleIter(salt_res_instr.topupData, topup_settings);

	//
	// MANUAL TANK FILL with RO WATER
	//
	// sump fill from RO.  Must be manually terminated by watching sump!
	sump_level_instr.fillData = { 
		name: "Manual tank fill",
		utils: utils,
		instrs:  instrs,
		enabled: false,
		target_instr_name: sump_level_instr.name,
		pump_num: 1,
		target_fill_ok: function(data,status) {
			// Always OK.  Must watch!
			return true;
		},
		ro_fill_ok: ro_fill_ok,
		ro_res_instr_name: ro_res_instr.name
	};

	//scheduleIter(sump_level_instr.fillData, topup_settings);

	//
	// DAILY WATER CHANGE
	//
	// Salt water change.
	var dosing_instr = utils.get_instr_by_type( instrs, "dosing" );
	dosing_instr.wcData = { 
		name: "Water change",
		utils: utils,
		instrs:  instrs,
		enabled: false,
		stand_instr_name: sump_level_instr.name,
		target_instr_name: dosing_instr.name,
		num_phases: 2,
		pump_num: [3,4],
		start_time: [12,0], // hour, mins.
		phase: 0,
		started: false,
		dosed: [0,0],
		ml_per_iter: 100,
		ml_per_day: 2500,
		stand_ok_for_dosing: function(data,status) {
			// Always OK for now.
			return true;
		},
		dosing_ok: function(data,status) {
			// OK if there is water in the res.
			if ((status.dist > 2) && (status.dist < 63)) {
				return true;
			} else {
				return false;
			}
		},
	};

	scheduleIter(dosing_instr.wcData, dosing_settings);

}


// Initialize missing fields common to all settings.
// Returns true if init was done.
function initData(data, settings) {
	if (data.initialized) {
		return false;
	}
	data.initialized = true;
	data.is_active = 0;
	data.waiting = true; // So first iter will avoid interlock.
	data.retries_left = settings.num_retries;
	return true;
}

// Initialize missing fields in topup data.
function initTopupData(data) {
	if (!initData(data,topup_settings)) {
		return;
	}
	data.time_filling = 0;
	data.res_recovering = false; // Hit low, refilling.
}

// Initialize missing fields in dosing data.
function initDosingData(data) {
	if (!initData(data,dosing_settings)) {
		return;
	}
}
	
function topupTask( data ) {

	var utils = data.utils;
	var instrs = data.instrs;
	var settings = topup_settings;

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

	// Set waiting to indicate that all pre-return scheduleIter()'s are valid.
	data.waiting = true; 

	// If disabled, do nothing, but check if enabled in a while.
	if (!data.enabled) {
		scheduleIter(data,settings,false);
		return;
	}

	// Get the target status, and if not full, run the fill pump
	utils.queue_and_send_instr_cmd( target, "stat", 
		function(target_status) { // Success
			utils.queue_and_send_instr_cmd( ro_res, "stat", 
				function(ro_status) { // Success
					if (   data.target_fill_ok(data,target_status)
						&& data.ro_fill_ok(data,ro_status)) {
						// Turn on the pump for twice our interval, so we will refresh until its filled.
						if (!data.is_active) {
							data.is_active = true;
							data.time_filling = 0;
							logFilling( data );
						}
						var pon_cmd = "pon "+data.pump_num+" "+(topup_settings.active_interval_sec*2);
						utils.queue_and_send_instr_cmd( ro_res, pon_cmd, 
							function(ro_status) { // Success
								data.time_filling = ro_status.ton;
								data.retries_left = topup_settings.num_retries; // Reset retries on success.
								scheduleIter(data,settings);
							},
							function(error) { // Failure
								scheduleIter(data,settings,true);
								if (!data.is_active) {
									logFilling( data, error );
								}
							}
						);
					} else {
						scheduleIter(data,settings,false);
						if (data.is_active) {
							data.is_active = false;
							logFilling( data );
						}
					}
				}, function(error) {topupCommsFailure( data, settings, error );} 
			);
		}, function(error) {topupCommsFailure( data, settings, error );}
	);
}

function dosingTask( data ) {

	var utils = data.utils;
	var instrs = data.instrs;
	var settings = dosing_settings;

	var stand = utils.get_instr_by_name( instrs, data.stand_instr_name );
	var dosing = utils.get_instr_by_name( instrs, data.target_instr_name );
	if (stand == undefined || dosing == undefined) {
		console.log("ERROR: Cant find instruments ("+data.stand_instr_name+","+data.target_instr_name+")");
		return;
	}

	if (data.waiting) {
		// In an async chain.  Don't restart on timer.
		if (settings.debug) {
			console.log(settings.label+": "+data.target_instr_name+": Ignoring event because not waiting.");
		}
		return;
	}
	// Set waiting to indicate that all pre-return scheduleIter()'s are valid.
	data.waiting = true; 

	// If disabled, do nothing, but check if enabled in a while.
	if (!data.enabled) {
		scheduleIter(data,settings,false);
		return;
	}

	var i;
    var d = new Date();
	var hour = d.getHours(); // Midnight is 0.
	var min = d.getMinutes();

	if (hour == 0) {
		// Reset for the day.
		for ( i=0; i < data.num_phases; i++ ) {
			data.dosed[i] = 0;
		}
		data.phase = 0;
		data.started = false;
		data.is_active = false;
		scheduleIter(data,settings,false);
		return;
	}

	if (   (!data.started && ((hour < data.start_time[0]) || (min < data.start_time[1])))
		|| (data.dosed[data.num_phases-1] >= data.ml_per_day) ) {
		// Either not time to start, or already done.
		data.is_active = false;
		scheduleIter(data,settings,false);
		return;
	}
	data.started = true;

	// If we get here, its time to start, and we're not yet done.
	// Get the dosing status, judge if we can start the next phase,
	// then get the stand status, and if OK, do a dose.
	utils.queue_and_send_instr_cmd( dosing, "stat", 
		function(dosing_status) { // Success

			// If currently dosing, or in an interval,
			//  or dosing_ok() is false, come back.
			if (     (dosing_status.num_active > 0)
				  || (data.interval_remaining > 0)
				  || !data.dosing_ok(data,dosing_status)) {
				if (dosing_status.num_active == 0) {
					if (data.interval_remaining < settings.active_interval_sec) {
						data.is_active = false; // Go to inactive if already past interval.
					} else {
						data.interval_remaining -= settings.active_interval_sec;
					}
				}
				scheduleIter(data,settings,false);
			} else {

				// Get stand status 
				utils.queue_and_send_instr_cmd( stand, "stat", 
					function(stand_status) { // Success
						if ( data.stand_ok_for_dosing(data,stand_status)) {
							if (data.dosed[0] == 0) {
								data.is_active = true;
								logDosing(data);
							}
							// Send command to dose.
							var disp_cmd = "disp " + data.pump_num[data.phase] + " " + data.ml_per_iter;
							utils.queue_and_send_instr_cmd( dosing, disp_cmd, 
								function(dosing_status) { // Success
									data.is_active = true;
									data.interval_remaining = settings.inter_interval_sec;
									data.dosed[data.phase] += data.ml_per_iter;
									data.phase++;
									if (data.phase >= data.num_phases) {
										data.phase = 0;
									}
									if (data.dosed[data.num_phases-1] >= data.ml_per_day) {
										// Done.
										data.is_active = false;
										logDosing(data);
									} else if (settings.debug) {
										console.log("DOSING: Finished "+data.dosed+" of "+data.ml_per_day+"ml");
									}
									scheduleIter(data,settings);
								},
								function(error) { // Failure
									scheduleIter(data,settings,true);
									if (!data.is_active) {
										logDosing( data, error );
									}
								}
							);


						} else {
							scheduleIter(data,settings,false);
							if (data.is_active) {
								data.is_active = false;
								// INCOMPLETE: log.
							}
						}
					}, function(error) {dosingCommsFailure( data, settings, error );} 
				);
			}
		}, function(error) {dosingCommsFailure( data, settings, error );}
	);
}


	
// Schedule an iteration of a task.
// If the task it active, use the active interval.  
// Otherwise, use the watching interval.
// If this is a retry after an error, if there are retries remaining, schedule for active.
// If retries have been used up, clear active, and go to watching.
//
// Initializes data on first call, utilizing knowledge that its the first time to reset.
//
function scheduleIter( data, settings, isRetry ) {

	var isFirst = Boolean(!data.initialized);

	settings.init_data(data);

	if (!data.waiting) {
		// Interlock against double-dispatch.
		if (settings.debug) {
			console.log(settings.label+": "+data.target_instr_name+": Ignoring event because not waiting.");
		}
		return;
	}

	data.waiting = false;

	var timedOut = false;
	if (isRetry == true) {
		data.retries_left--;
		if (data.retries_left <= 0) {
			data.retries_left = settings.num_retries;
			data.is_active = false;
			if (settings.debug) {
				console.log(settings.label+": "+data.target_instr_name+": Exhausted "+settings.num_retries+" retries.");
			}
			timedOut = true;
		}
	}
	var interval = (data.enabled && (data.is_active || isFirst))
		? settings.active_interval_sec 
		: (timedOut) 
			? settings.post_timeout_interval_sec
			: settings.watching_interval_sec;
		
	if (settings.debug > 1) {
		console.log(settings.label+": "+data.target_instr_name+": enabled="+data.enabled+", active="+data.is_active+", wait for "+interval+" sec");
	}
	setTimeout( function() {settings.exec_task(data);}, interval*1000 );
}

function timestamp() {
	var now = new Date;
	return now.toLocaleString();
}

function logFilling( data, error ) {
	var startStop = data.is_active?"Started ":"Stopped ";
	var msg = "TOPUP: "+data.target_instr_name+": "+timestamp()+": "+startStop;
	if (data.time_filling > 0) {
		msg += ": "+data.time_filling+" sec";
	}
	if (error!=undefined) {
		msg += ": ERROR: "+error;
	}
	console.log( msg );
}

function logDosing( data, error ) {
	var startStop = data.is_active?"Started ":"Stopped ";
	var msg = "DOSING: "+data.name+": "+timestamp()+": "+data.phase+" "+ startStop+" total_ml: "+data.dosed+" "+startStop;
	if (error!=undefined) {
		msg += ": ERROR: "+error;
	}
	console.log( msg );
}


// If failure to send command to either unit, reschedule, and possibly end as exhausted.
function topupCommsFailure(data,settings,error) {
	var wasActive = data.is_active;
	scheduleIter(data,settings,true);
	if (wasActive && !data.is_active) {
		logFilling( data, error ); // retries exhausted.
	}
}

// If failure to send command to either unit, reschedule, and possibly end as exhausted.
function dosingCommsFailure(data,settings,error) {
	var wasActive = data.is_active;
	scheduleIter(data,settings,true);
	if (wasActive && !data.is_active) {
		logDosing( data, error ); // retries exhausted.
	}
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


module.exports = {
	startup: startup
}
