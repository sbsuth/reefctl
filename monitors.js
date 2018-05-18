
// Shared settings for all topup monitors.
var topup_settings = {
	init_data:					initTopupData,
	exec_task:					topupTask,
	active_interval_sec:		10,
	watching_interval_sec:		5 * 60,
	post_timeout_interval_sec:	1 * 60,
	num_retries:				5,
	ro_min_level:				20,
	debug:						2,
	daytime_only:				true,
	ro_res_instr_type:			"ro_res",
	ro_fill_ok:					ro_fill_ok
};

// Settings for all dosing monitors
var dosing_settings = {
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

// Shared settings for all server task monitors
var server_task_settings = {
	init_data:					initServerTaskData,
	exec_task:					serverTask,
	active_interval_sec:		1,
	watching_interval_sec:		10,
	post_timeout_interval_sec:	10,
	debug:						2,
	daytime_only:				false
};

// Un-instances monitor types.
var monitor_types = {};

// Initializes non-instances monitor records and returns an object containing them.
function create_monitor_types() 
{
	var monitors = {};


	//
	// ATO
	//
	// sump level topup monitor enabled by default.
	monitors.ato = { 
		name: "ato",
		label: "ATO",
		target_instr_type: "sump_level",
		target_fill_ok: function(data,status) {
			data.target_lev = status.sump_lev;
			data.target_full = !status.sump_sw;
			return Boolean(status.sump_sw && (status.sump_lev > 8));
		},
	};
	Object.assign( monitors.ato, topup_settings );

	//
	// SALTWATER RES REFILL
	//
	// saltwater res topup monitor, off by default.
	monitors.salt_res_fill = { 
		name: "salt_res_fill",
		label: "Salt Res Fill",
		target_instr_type: "salt_res",
		target_fill_ok: function(data,status) {
			data.target_lev = status.dist;
			data.target_full = status.float_sw;
			return Boolean(!status.float_sw && (status.dist > 5));
		},
	};
	Object.assign( monitors.salt_res_fill, topup_settings );

	//
	// MANUAL TANK FILL with RO WATER
	//
	// sump fill from RO.  Must be manually terminated by watching sump!
	monitors.manual_tank_fill = { 
		name: "manual_tank_fill",
		label: "Manual Tank Fill",
		target_instr_type: "sump_level",
		target_fill_ok: function(data,status) {
			data.target_lev = data.ro_lev;  // How source level instead.
			data.target_full = false;
			// Always OK.  Must watch!
			return true;
		},
	};
	Object.assign( monitors.manual_tank_fill, {daytime_only: false}, topup_settings );

	//
	// DAILY WATER CHANGE
	//
	// Salt water change.
	monitors.water_change = { 
		name: "water_change",
		label: "Water Change",
		stand_instr_type: "sump_level",
		target_instr_type: "dosing",
		num_phases: 2,
		pump_num: [3,4],
		phase: 0,
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
	Object.assign( monitors.water_change, dosing_settings );

	//
	// Scheduled shutdown
	//
	monitors.scheduled_shutdown = {
		name: "scheduled_shutdown",
		label: "Schedule Shutdown",
		stand_instr_type: "powerheads",
		start_task: startScheduledShutdown,
		end_task: endScheduledShutdown,
		req_task: reqShutdownTask,
		cancel_task: cancelCurShutdownTask
	};

	Object.assign( monitors.scheduled_shutdown, server_task_settings );

	return monitors;
}

// Start a monitor given its record from the database, 
// the associated system, and the global utils.
function start_monitor( monitor, system, utils ) {

	var sys_info = {
		utils: utils,
		system_name: system.name,
		instrs:  system.instruments,
	};

	// Expect to find a member of the monitor_types object with the
	// same name as the monitor.  
	var monitor_type = monitor_types[monitor.name];
	if (!monitor_type) {
		console.log("ERROR: MON: No monitor type \'"+monitor.name+"\'")
		return;
	}
	Object.assign( monitor, monitor_type, sys_info );

	if (monitor.debug) {
		console.log("MON: "+monitor.label+": Starting");
	}

	// Register the monitor.
	utils.register_monitor( monitor );

	scheduleIter(monitor);

}

function startup( utils ) {
	

	// Initialize global monitor types.
	monitor_types = create_monitor_types();

	var systems = utils.db.get("systems");
	var monitors = utils.db.get("monitors");

	systems.find({}).then( (system_objs) => {
		for ( var isys=0; isys < system_objs.length; isys++ ) {
			var system = system_objs[isys];
			if (system.auto_start_monitors) {
				monitors.find( {name: {$in: system.monitors}, system: system.name}, {}, function( err, monitor_objs ) {
					if (err) {
						console.log("ERROR: reading monitors for system "+system.name);
					}
					if (monitor_objs) {
						for ( var imon=0; imon < monitor_objs.length; imon++ ) {
							start_monitor( monitor_objs[imon], system, utils );
						}
					}
				});
			}
		}
	});
}


// Initialize missing fields common to all settings.
// Returns true if init was done.
function initData(data) {
	if (data.initialized) {
		return false;
	}
	data.initialized = true;
	data.is_active = 0;
	data.waiting = true; // So first iter will avoid interlock.
	data.retries_left = data.num_retries;
	return true;
}

// Initialize missing fields in topup data.
function initTopupData() {
	var data = this;
	if (!initData(data)) {
		return;
	}
	data.time_filling = 0;
	data.res_recovering = false; // Hit low, refilling.
	data.target_lev = -1;
	data.target_full = false;
}

// Initialize missing fields in dosing data.
function initDosingData() {
	var data = this;
	if (!initData(data)) {
		return;
	}
	data.dosed = [0,0];
}
	
// Initialize missing fields in server task data.
function initServerTaskData() {
	var data = this;
	if (!initData(data)) {
		return;
	}
	data.times = []; // Each one is {start: [hour,min], duration: [hour,min]}
	data.active_task = undefined; // start, duration, and settings for currently active task.
}
	
function topupTask( data ) {

	var utils = data.utils;
	var instrs = data.instrs;

	var target = utils.get_instr_by_type( instrs, data.target_instr_type );
	var ro_res = utils.get_instr_by_type( instrs, data.ro_res_instr_type );
	if (target == undefined || ro_res == undefined) {
		console.log("ERROR: Cant find instruments ("+data.target_instr_type+","+data.ro_res_instr_type+")");
		return;
	}

	if (data.waiting) {
		// In an async chain.  Don't restart on timer.
		return;
	}

	// Set waiting to indicate that all pre-return scheduleIter()'s are valid.
	data.waiting = true; 

	// Refresh data.
	data.utils.db.get('monitors').find( 
		{name: data.name, system: data.system_name}, 
		'-_id', 
		function( err, monitor_obj ) {

		if (err) {
			console.log("MON: ERROR: Failed reading settings for \'"+data.name+"\' during iter.");
		}
		if (monitor_obj && (monitor_obj.length > 0)) {
			Object.assign( data, monitor_obj[0] );
		}

		// If disabled, do nothing, but check if enabled in a while.
		if (!data.enabled) {
			scheduleIter(data,false);
			return;
		}

		// Get the target status, and if not full, run the fill pump
		utils.queue_and_send_instr_cmd( target, "stat", 
			function(target_status) { // Success
				utils.queue_and_send_instr_cmd( ro_res, "stat", 
					function(ro_status) { // Success
						data.ro_lev = ro_status.res_lev;
						if (   data.target_fill_ok(data,target_status)
							&& data.ro_fill_ok(data,ro_status)) {
							// Turn on the pump for twice our interval, so we will refresh until its filled.
							if (!data.is_active) {
								data.is_active = true;
								data.time_filling = 0;
								logFilling( data );
							}
							var pon_cmd = "pon "+data.pump_num+" "+(data.active_interval_sec*2);
							utils.queue_and_send_instr_cmd( ro_res, pon_cmd, 
								function(ro_status) { // Success
									data.time_filling = ro_status.ton;
									data.retries_left = data.num_retries; // Reset retries on success.
									scheduleIter(data);
								},
								function(error) { // Failure
									scheduleIter(data,true);
									if (!data.is_active) {
										logFilling( data, error );
									}
								}
							);
						} else {
							scheduleIter(data,false);
							if (data.is_active) {
								data.is_active = false;
								logFilling( data );
							}
						}
					}, function(error) {topupCommsFailure( data, error );} 
				);
			}, function(error) {topupCommsFailure( data, error );}
		);
	});
}

// Store the fields that record current status.
// This will be re-read every time we take up so its OK to go down and back up again.
function writeDosingData( data ) {
	var monitors = data.utils.db.get('monitors');
	monitors.update( {system: data.system_name, name: data.name} , 
					 {$set: {	started: data.started,
								dosed:	 data.dosed }},
					 function( err ) {
						if (err) {
							console.log("MON: ERROR: Failed writing status for \'"+data.name+"\' during iter.");
						}
					 } );
}

function dosingTask( data ) {

	var utils = data.utils;
	var instrs = data.instrs;

	var stand = utils.get_instr_by_type( instrs, data.stand_instr_type );
	var dosing = utils.get_instr_by_type( instrs, data.target_instr_type );
	if (stand == undefined || dosing == undefined) {
		console.log("ERROR: Cant find instruments ("+data.stand_instr_type+","+data.target_instr_type+")");
		return;
	}

	if (data.waiting) {
		// In an async chain.  Don't restart on timer.
		if (data.debug) {
			console.log("MON: "+data.label+": "+data.target_instr_type+": Ignoring event because not waiting.");
		}
		return;
	}
	// Set waiting to indicate that all pre-return scheduleIter()'s are valid.
	data.waiting = true; 

	// Refresh data.
	data.utils.db.get('monitors').find( 
		{name: data.name, system: data.system_name}, 
		"-_id", 
		function( err, monitor_obj ) {

		if (err) {
			console.log("MON: ERROR: Failed reading settings for \'"+data.name+"\' during iter.");
		}
		if (monitor_obj && (monitor_obj.length > 0)) {
			Object.assign( data, monitor_obj[0] );
		}

		var i;
		var d = new Date();
		var hour = d.getHours(); // Midnight is 0.
		var min = d.getMinutes();

		if ((hour == 0) && (data.started || (data.dosed[0] > 0))) {
			// Reset for the day.
			for ( i=0; i < data.num_phases; i++ ) {
				data.dosed[i] = 0;
			}
			data.phase = 0;
			data.started = false;
			data.is_active = false;
			writeDosingData(data);
			scheduleIter(data,false);
			return;
		}

		// If disabled, do nothing, but check if enabled in a while.
		if (!data.enabled) {
			scheduleIter(data,false);
			return;
		}


		if (   (!data.started && ((hour < data.start_time[0]) || (min < data.start_time[1])))
			|| (data.dosed[data.num_phases-1] >= data.ml_per_day) ) {
			// Either not time to start, or already done.
			data.is_active = false;
			scheduleIter(data,false);
			return;
		}
		data.started = true;

		// If we get here, its time to start, and we're not yet done.
		// Get the dosing status, judge if we can start the next phase,
		// then get the stand status, and if OK, do a dose.
		utils.queue_and_send_instr_cmd( dosing, "stat", 
			function(dosing_status) { // Success

				data.res_lev = dosing_status.dist;

				// If currently dosing, or in an interval,
				//  or dosing_ok() is false, come back.
				if (     (dosing_status.num_active > 0)
					  || (data.interval_remaining > 0)
					  || !data.dosing_ok(data,dosing_status)) {
					if (dosing_status.num_active == 0) {
						if (data.interval_remaining < data.active_interval_sec) {
							data.is_active = false; // Go to inactive if already past interval.
						} else {
							data.interval_remaining -= data.active_interval_sec;
						}
					}
					scheduleIter(data,false);
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
										data.interval_remaining = data.inter_interval_sec;
										data.dosed[data.phase] += data.ml_per_iter;
										data.phase++;
										if (data.phase >= data.num_phases) {
											data.phase = 0;
										}
										if (data.dosed[data.num_phases-1] >= data.ml_per_day) {
											// Done.
											data.is_active = false;
											logDosing(data);
										} else if (data.debug) {
											console.log("DOSING: Finished "+data.dosed+" of "+data.ml_per_day+"ml");
										}
										writeDosingData(data);
										scheduleIter(data);
									},
									function(error) { // Failure
										scheduleIter(data,true);
										if (!data.is_active) {
											logDosing( data, error );
										}
									}
								);


							} else {
								scheduleIter(data,false);
								if (data.is_active) {
									data.is_active = false;
									// INCOMPLETE: log.
								}
							}
						}, function(error) {dosingCommsFailure( data, error );} 
					);
				}
			}, function(error) {dosingCommsFailure( data, error );}
		);
	});
}

// Store the fields that record current status.
// This will be re-read every time we take up so its OK to go down and back up again.
function writeServerTaskData( data ) {
	var monitors = data.utils.db.get('monitors');
	monitors.update( {system: data.system_name, name: data.name} , 
					 {$set: {	times: data.times }},
					 function( err ) {
						if (err) {
							console.log("MON: ERROR: Failed writing status for \'"+data.name+"\' during iter.");
						}
					 } );
}


// Execute tasks scheduled at specific times.
function serverTask( data ) {

	var utils = data.utils;

	if (data.waiting) {
		// In an async chain.  Don't restart on timer.
		return;
	}

	// Set waiting to indicate that all pre-return scheduleIter()'s are valid.
	data.waiting = true; 

	// Refresh data.
	data.utils.db.get('monitors').find( 
		{name: data.name, system: data.system_name}, 
		'-_id', 
		function( err, monitor_obj ) {

		if (err) {
			console.log("MON: ERROR: Failed reading settings for \'"+data.name+"\' during iter.");
		}
		if (monitor_obj && (monitor_obj.length > 0)) {
			Object.assign( data, monitor_obj[0] );
		}

		var i;
		var d = new Date();
		var hour = d.getHours(); // Midnight is 0.
		var min = d.getMinutes();

		if ((hour == 0) && (min < 10)) {
			// Reset for the day.
			for ( var itime=0; itime < data.times.length; itime++ ) {
				var time = data.times[itime];
				time.done_today = false;
			}
			writeServerTaskData(data);
			scheduleIter(data,false);
			return;
		}

		// If disabled, do nothing, but check if enabled in a while.
		if (!data.enabled) {
			scheduleIter(data,false);
			return;
		}

		// Search scheduled times and determine if we're entering an active period,
		// within an active period, or leaving an active period.
		var handled = false;
		var now = [hour,min];
		for ( var itime=-1; itime < data.times.length; itime++ ) {
			var time = (itime >= 0) ? data.times[itime] : data.active_task;
			if (!time) {continue;}
			if (time.done_today) {continue;}
			var start = time.start;
			var end = [time.start[0] + time.duration[0],time.start[1] + time.duration[1]];
			end[0] += Math.floor(end[1]/60);
			end[1] = Math.floor(end[1]%60);
			var option = time.option;
			var duration = (time.duration[0] * 60) | time.duration[1];

			if ((itime < 0) && data.is_active) {
				// 'time' is the active task.  Check if it should stop.
				if ( utils.compare_times( now, end ) >= 0) {
					data.end_task( data, 
						function() {
							// Successfully ended.
							data.active_task = undefined;
							data.is_active = false;
							time.done_today = true;
							scheduleIter(data,false);
						}, 
						function (error) {
							// Error ending.
							scheduleIter(data,true);
							if (!data.is_active) {
								time.done_today = true;
								data.active_task = undefined; // Retries exhausted.
							}
						}
					);
					handled = true;
					break;
				}
			} else if (!data.is_active) {
				// Nothing is active. Check if this time should start.
				// Until a successful start, we don't set is_active, so 
				// we'll come back here to retry until those are exhausted.
				if (   (utils.compare_times( now, start ) >= 0)
				    && (utils.compare_times( now, end ) < 0)) {
					data.start_task( data, option, duration,
						function() {
							// Successfully started.  Copy into active_task.
							data.active_task = Object.assign( {}, time );
							data.is_active = true;
							scheduleIter(data,false);
						}, 
						function (err) {
							// Error starting.
							scheduleIter(data,true);
							if (!data.is_active) {
								time.done_today = true;
								data.active_task = undefined; // Retries exhausted.
							}
						}
					);
					handled = true;
					break;
				}
			}
		}
		if (!handled) {
			scheduleIter(data,false);
		}
	});
}

// Function to begin an scheduled pump shutdown.
// Options:
// 
// option[1:0] : main
// option[3:2] : ph
//
//  0 : unset
//  1 : cancel
//  2 : off
//  3 : slow
//  
function startScheduledShutdown( data, option, duration_min, successFunc, errorFunc ) {
	var utils = data.utils;
	var instrs = data.instrs;
	var stand = utils.get_instr_by_type( instrs, data.stand_instr_type );

	var main_opt = (option & 3);
	var ph_opt = (option >> 2);
	var duration_sec = (duration_min * 60);
	var cmd = "tshut "+duration_sec+" "+main_opt+" "+ph_opt;
	utils.queue_and_send_instr_cmd( stand, cmd,
		function(status) { // Success
			data.is_active = false;
			successFunc();
		},
		errorFunc );
}

// Function to restore the non-shutdown pump speeds.
function endScheduledShutdown( data, successFunc, errorFunc ) {
	console.log("HEY: Restoring pumps to normal speeds.");
	successFunc();
}


// 
// Function to request a shutdown task to start now with a specified duration.
// Set the active_task member with 'now' as a start time so it will be retried if 
// this attempt fails.
function reqShutdownTask( option, duration, successFunc, errorFunc ) {
	var d = new Date();
	var data = this;
	data.active_task = { option: option,
						 done_today: false,
						 start: [d.getHours(), d.getMinutes()],
						 duration: duration };
	startScheduledShutdown( data, option, duration,
		function() {
			data.is_active = false;
			data.active_task = undefined;
			successFunc();
		},
		function (error) {
			// Leave active task in place, and let it retry next time serverTask fires.
			errorFunc(error);
		});
}

// Function to cancel any active task.
function cancelCurShutdownTask( data, successFunc, errorFunc ) {
	var was_active = Boolean(data.active_task != undefined);
	if (was_active) {
		// Set duration of active task to 0 so if we fail, it will retry the stop.
		data.active_task.duration = [0,0];
		endScheduledScheduledTask( data, 
			function() {
				// Clear active task here.
				data.active_task = undefined;
				data.is_active = false;
				successFunc();
			},
			errorFunc );
	} else {
		successFunc();
	}
}



	
// Schedule an iteration of a task.
// If the task it active, use the active interval.  
// Otherwise, use the watching interval.
// If this is a retry after an error, if there are retries remaining, schedule for active.
// If retries have been used up, clear active, and go to watching.
//
// Initializes data on first call, utilizing knowledge that its the first time to reset.
//
function scheduleIter( data, isRetry ) {

	var isFirst = Boolean(!data.initialized);

	data.init_data();

	if (!data.waiting) {
		// Interlock against double-dispatch.
		if (data.debug) {
			console.log("MON: "+data.label+": "+data.target_instr_type+": Ignoring event because not waiting.");
		}
		return;
	}

	data.waiting = false;

	var timedOut = false;
	if (isRetry == true) {
		data.retries_left--;
		if (data.retries_left <= 0) {
			data.retries_left = data.num_retries;
			data.is_active = false;
			if (data.debug) {
				console.log("MON: "+data.label+": "+data.target_instr_type+": Exhausted "+data.num_retries+" retries.");
			}
			timedOut = true;
		}
	}
	var interval = (data.enabled && (data.is_active || isFirst))
		? data.active_interval_sec 
		: (timedOut) 
			? data.post_timeout_interval_sec
			: data.watching_interval_sec;
		
	if (data.debug > 1) {
		var msg = "MON: "+data.label;
		if (data.target_instr_type) {
			msg += ": "+data.target_instr_type;
		}
		msg += ": enabled="+data.enabled+", active="+data.is_active+", wait for "+interval+" sec";
		console.log(msg);
	}
	setTimeout( function() {data.exec_task(data);}, interval*1000 );
}

function timestamp() {
	var now = new Date;
	return now.toLocaleString();
}

function logFilling( data, error ) {
	var startStop = data.is_active?"Started ":"Stopped ";
	var msg = "TOPUP: "+data.target_instr_type+": "+timestamp()+": "+startStop;
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
function topupCommsFailure(data,error) {
	var wasActive = data.is_active;
	scheduleIter(data,true);
	if (wasActive && !data.is_active) {
		logFilling( data, error ); // retries exhausted.
	}
}

// If failure to send command to either unit, reschedule, and possibly end as exhausted.
function dosingCommsFailure(data,error) {
	var wasActive = data.is_active;
	scheduleIter(data,true);
	if (wasActive && !data.is_active) {
		logDosing( data, error ); // retries exhausted.
	}
}

// True if its OK to fill from the RO res given a status.
// Goes into 'ro_recovering' mode when level>ro_min_level,
// then returns false until the float sw closes again.
// Also requires that it be daytime if daytime_only is set.
function ro_fill_ok(data,status) {
	if (data.daytime_only && !data.utils.is_daytime()) {
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
		if (status.res_lev >= data.ro_min_level) {
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
