
// Shared settings for all topup monitors.
var topup_settings = {
	init_data:					initTopupData,
	exec_task:					topupTask,
	active_interval_sec:		10,
	watching_interval_sec:		5 * 60,
	post_timeout_interval_sec:	1 * 60,
	fuse_ms:					5 * 1000,
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
	active_interval_sec:		(2 * 60) + 10, // Glitch in pump with every check so wait longer than expected time.
	watching_interval_sec:		5 * 60,
	post_timeout_interval_sec:	1 * 60,
	fuse_ms:					5 * 1000,
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

// Periodic unit check.
var unit_check_settings = {
	init_data:					initUnitCheckData,
	exec_task:					unitCheck,
	active_interval_sec:		10,
	watching_interval_sec:		10,
	post_timeout_interval_sec:	10,
	store_interval_sec:			5 * 60,
	fuse_ms:					5 * 1000,
	power_cycle_after_ms:		5 * 60 * 1000,
	power_cycle_after_min_bad:	5,
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
	//Object.assign( monitors.salt_res_fill, topup_settings, {daytime_only: false} );
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
	Object.assign( monitors.manual_tank_fill, topup_settings, {daytime_only: false}  );

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
	// VODKA DOSING
	//
	monitors.vodka_dosing = { 
		name: "vodka_dosing",
		label: "Vodka Dosing",
		stand_instr_type: "sump_level",
		target_instr_type: "vodka",
		num_phases: 1,
		pump_num: 1,
		phase: 0,
		stand_ok_for_dosing: function(data,status) {
			// Always OK for now.
			return true;
		},
		dosing_ok: function(data,status) {
			// Always OK for now.
			return true;
		},
	};
	Object.assign( monitors.vodka_dosing, dosing_settings );

	//
	// AMINO DOSING
	//
	monitors.amino_dosing = { 
		name: "amino_dosing",
		label: "Amino Dosing",
		stand_instr_type: "sump_level",
		target_instr_type: "vodka",
		num_phases: 1,
		pump_num: 1,
		phase: 0,
		stand_ok_for_dosing: function(data,status) {
			// Always OK for now.
			return true;
		},
		dosing_ok: function(data,status) {
			// Always OK for now.
			return true;
		},
	};
	Object.assign( monitors.amino_dosing, dosing_settings );

	//
	// TSP DOSING
	//
	monitors.tsp_dosing = { 
		name: "tsp_dosing",
		label: "TSP Dosing",
		stand_instr_type: "sump_level",
		target_instr_type: "vodka",
		num_phases: 1,
		pump_num: 0,
		phase: 0,
		stand_ok_for_dosing: function(data,status) {
			// Always OK for now.
			return true;
		},
		dosing_ok: function(data,status) {
			// Always OK for now.
			return true;
		},
	};
	Object.assign( monitors.tsp_dosing, dosing_settings );

	//
	// Scheduled shutdown
	//
	monitors.scheduled_shutdown = {
		name: "scheduled_shutdown",
		label: "Schedule Shutdown",
		target_instr_type: "powerheads",
		start_task: startScheduledShutdown,
		end_task: endScheduledShutdown,
		req_task: reqShutdownTask,
		cancel_task: cancelCurShutdownTask
	};

	Object.assign( monitors.scheduled_shutdown, server_task_settings );


	//
	// Fuge light
	//
	monitors.fuge_light = {
		name: "fuge_light",
		label: "Fuge Light",
		target_instr_type: "power",
		start_task: relayOn,
		end_task: relayOff,
	};

	Object.assign( monitors.fuge_light, server_task_settings );


	//
	// Gyre power cycle
	//
	monitors.gyre_cycle = {
		name: "gyre_cycle",
		label: "Power Cyc;e Gyre",
		target_instr_type: "power",
		start_task: relayOff,
		end_task: relayOn,
	};

	Object.assign( monitors.gyre_cycle, server_task_settings );

	//
	// Unit check
	//
	monitors.unit_check = {
		name: "unit_check",
		label: "Unit Check",
		target_instr_type: "all",
	};

	Object.assign( monitors.unit_check, unit_check_settings );

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
	
	// Start Home Assistant connection
	//startup_home_assistant(utils);

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
	data.dosed = [];
	for ( i=0; i < data.num_phases; i++ ) {
		data.dosed.push(0);
	}
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
	
// Initialize missing fields in unit check data.
function initUnitCheckData() {
	var data = this;
	var utils = data.utils;
	var instrs = data.instrs;
	if (!initData(data)) {
		return;
	}

	// We find all unique addresses for instrments whose module has a handle_status.
	// We will use a status_cmd from the first instrument found so this mechanism 
	// is not good for gathering data reported by any of the later instrs at the same address.
	// Unit tags are the addresses, so we check once per address.
	data.units = []; // An array of units to be monitored.  Indexed by integer.
	data.handledAddrs = []; // A record of which addresses are handled.  Index by string.
	data.shutdownSwitches = [];
	var now = new Date().getTime();
	for ( var iinstr=0; iinstr < instrs.length; iinstr++ ) {
		var instr = instrs[iinstr];
		var mod = utils.get_instr_mod( instr.type );
		if (!instr.status_cmd || (instr.status_cmd == "") || (data.handledAddrs[instr.address] != undefined)) {
			continue;
		}
		var mod_check = {
			module_name: mod.name,
			address: instr.address,
			cmd: instr.status_cmd,
			shutdown_switch: instr.shutdown_switch,
			handle_status: mod.handle_status,
			last_store_ms: now,
			num_good: 0,
			num_bad: 0,
			cur_good: undefined
		};
		if (instr.shutdown_switch) {
			if (data.shutdownSwitches[instr.shutdown_switch] == undefined) {
				data.shutdownSwitches[instr.shutdown_switch] = [mod_check];
			} else {
				data.shutdownSwitches[instr.shutdown_switch].push(mod_check);
			}
		}
		data.handledAddrs[instr.address] = mod_check;
		data.units.push(mod_check);
	}
	data.next_unit = (data.units.length > 0) ? 0 : -1;

	// Stats for display
	data.cur_good = 0;
	data.cur_bad = 0;
	data.recent_good = [];
	data.num_recent_good = 0;
	data.max_recent_good = 128;
	data.num_recent_bad = 0;
	data.pct_recent_good = undefined;
	data.last_bad_addr = undefined;
	data.last_bad_time = undefined;
	data.last_power_cycle_entity = undefined;
	data.last_power_cycle_addr = undefined;
	data.last_power_cycle_time = undefined;
}
	
function topupTask( data ) {

  try {
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
		utils.queue_and_send_instr_cmd( target, "stat", data.fuse_ms,
			function(target_status) { // Success
				utils.queue_and_send_instr_cmd( ro_res, "stat",  data.fuse_ms,
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
							utils.queue_and_send_instr_cmd( ro_res, pon_cmd, 0,
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
  } catch (err) {
	console.log("ERROR: topupTask: catch: "+err);
  }
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

  try {
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
			data.interval_remaining = 0;
			writeDosingData(data);
			scheduleIter(data,false);
			return;
		}

		if (!data.enabled || (data.daytime_only && !data.utils.is_daytime())) {
			scheduleIter(data,false);
			return;
		}

		if (   (!data.started && ((hour < data.start_time[0]) || ((hour == data.start_time[0]) && (min < data.start_time[1]))))
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
		utils.queue_and_send_instr_cmd( dosing, "stat", data.fuse_ms,
			function(dosing_status) { // Success
				data.res_lev = dosing_status.dist;

				// If currently dosing, or in an interval,
				//  or dosing_ok() is false, come back.
				if (     (dosing_status.num_active > 0)
					  || (data.interval_remaining > 0)
					  || !data.dosing_ok(data,dosing_status)) {
					var doNow = false;
					if (dosing_status.num_active == 0) {
						if (data.interval_remaining < data.active_interval_sec) {
							data.is_active = false; // Go to inactive if already past interval.
							data.interval_remaining = 0;
							if (data.inter_interval_sec) {
								doNow = true;
							}
						} else {
							data.interval_remaining -= data.active_interval_sec;
						}
					}
					scheduleIter(data,false,doNow);
				} else {

					// Get stand status 
					utils.queue_and_send_instr_cmd( stand, "stat", data.fuse_ms,
						function(stand_status) { // Success
							if ( data.stand_ok_for_dosing(data,stand_status)) {
								if (data.dosed[0] == 0) {
									data.is_active = true;
									logDosing(data);
								}
								// Send command to dose.

								var pn = data.pump_num;;
								if (pn.length != undefined) {
									pn = pn[data.phase];
								}
								var disp_cmd = "disp " + pn + " " + data.ml_per_iter;
								utils.queue_and_send_instr_cmd( dosing, disp_cmd, 0,
									function(dosing_status) { // Success
										data.is_active = true;
										data.dosed[data.phase] += data.ml_per_iter;
										data.phase++;
										if (data.phase >= data.num_phases) {
											data.phase = 0;
										}
										if (data.dosed[data.num_phases-1] >= data.ml_per_day) {
											// Done.
											data.is_active = false;
											data.interval_remaining = 0;
											logDosing(data);
										} else {
											data.interval_remaining = data.inter_interval_sec;
											if (data.debug) {
												console.log("DOSING: Finished "+data.dosed+" of "+data.ml_per_day+"ml");
											}
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
  } catch (err) {
	console.log("ERROR: dosingTask: catch: "+err);
  }
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

// If there is a repeat field in a time, and if it differs from repeat_used, 
// Remove all times after the current time, then add dups of the repeated field
// at the specified interval.
function initRepeatTimes(data) {

	var d = new Date();
	var hour = d.getHours(); // Midnight is 0.
	var min = d.getMinutes();
	var irepeat = undefined;
	var irepeat_done = undefined;
	var now = [hour,min];
	// Find the first time with a repeat, and the last time after whose start time has already occurreed.
	for ( var itime=0; itime < data.times.length; itime++ ) {
		var time = data.times[itime];
		if (irepeat != undefined) {
			if ( (data.utils.compare_times( now, time.start ) > 0) && time.done_today) {
				irepeat_done = itime;
			}
		} else if (time.repeat && ((time.repeat[0] > 0.0) || (time.repeat[1] > 0.0))) {
			irepeat = itime;
		} else if (time.repeat_used != undefined) {
			// Was a repeat where repeat was removed, so clear from here on.
			while (data.times.length > (itime+1)) {
				data.times.pop();
			}
			time.repeat_used = undefined;
			return true;
		}
	}
	if (irepeat == undefined) {
		return false;
	}

	// Nothing to do if there is no repeat, or if repeat_used == repeat)
	// Create a signature from start, duration, and repeat.
	// If that hasn't changed, we re-init.
	var to_repeat = data.times[irepeat];
	var signature = JSON.stringify( to_repeat.start.concat( to_repeat.duration ).concat( to_repeat.repeat ) );
	if (to_repeat.repeat_used == signature) {
		return false;
	}
	to_repeat.repeat_used = signature;

	// Remove any repeats that haven't started yet.
	var i_keep = (irepeat_done ? irepeat_done : irepeat);
	while (data.times.length > (i_keep+1)) {
		data.times.pop();
	}
	// Increment must be at least as long as the duration.
	var incr = to_repeat.repeat;
	var dur = to_repeat.duration;
	if ( data.utils.compare_times( incr, dur ) <= 0 ) {
		incr = data.utils.add_time( dur, [0,1] );
	}
	// Add repeats until the end of the day.
	var cur = data.times[i_keep].start;
	while (1) {
		cur = data.utils.add_time( cur, incr );
		if (cur[0] >= 24.0) {
			break;
		}
		var rep_time = {
			start : cur.slice(),
			duration : dur.slice(),
			done_today: false,
			option: to_repeat.option
		}
		data.times.push( rep_time );
	}
	return true;
}

// Execute tasks scheduled at specific times.
function serverTask( data ) {

  try {
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
				time.repeat_used = undefined; // Cause re-calc of repeats.
			}


			// If there's a task active, mark it as having gone past midnight.
			if (data.active_task && data.is_active) {
				data.active_task.over_midnight = true;
			} else {
				initRepeatTimes(data);
			}

			writeServerTaskData(data);
			scheduleIter(data,false);
			return;
		}

		if (initRepeatTimes(data))
			writeServerTaskData(data);

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
			var end = utils.add_time( time.start, time.duration );
			var option = time.option;
			var duration = (time.duration[0] * 60) | time.duration[1];

			if ((itime < 0) && data.is_active) {
				// 'time' is the active task.  Check if it should stop.
				// If the task has gone past midnight, move back 'end'.
				if (time.over_midnight && (end[0] >= 24)) {
					end[0] = end[0] - 24;
				}
				if ( utils.compare_times( now, end ) >= 0) {
					data.end_task( data, option,
						function() {
							// Successfully ended.
							data.active_task = undefined;
							data.is_active = false;
							time.done_today = true;
							writeServerTaskData(data);
							scheduleIter(data,false);
						}, 
						function (error) {
							// Error ending.
							writeServerTaskData(data);
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
  } catch (err) {
	console.log("ERROR: serverTask: catch: "+err);
  }
}

function checkIfPowerCycleNeeded( data, unit, success )
{
	if (!unit.shutdown_switch) {
		return;
	}

	if (success) {

		if (unit.first_failure_ms != undefined) {
			if (data.debug) {
				console.log("UNIT CHECK: Got good result for "+unit.address+": power cycle countdown reset.");
			}
		}
				
		// Clear string of failures.
		unit.first_failure_ms = undefined;

		// Check if all units on the same switch are free of failures, and reset it
		// if so.  This allows a recovery on an external restart if we failed.
		var units = data.shutdownSwitches[unit.shutdown_switch];
		var all_good = true;
		for ( var iunit=0; iunit < units.length; iunit++ ) {
			var unit = units[iunit];
			if (unit.first_failure_ms) {
				all_good = false;
			}
		}
		if (all_good) {
			data.utils.reset_power_cycle( unit.shutdown_switch );
		}

	} else {
		var now = new Date().getTime();
		if (unit.first_failure_ms) {
			var timeDown = (now - unit.first_failure_ms);
			if (  (unit.first_failure_ms && (timeDown > data.power_cycle_after_ms))
			    && (unit.num_bad >= data.power_cycle_after_min_bad)) {

				if (data.debug) {
					console.log("UNIT CHECK: Failures for "+(timeDown/1000)+" sec.  Power cycling "+unit.shutdown_switch);
				}
				data.last_power_cycle_entity = unit.shutdown_switch;
				data.last_power_cycle_addr = unit.address;
				data.last_power_cycle_time = now;

				// Initiate the power cycle.
				data.utils.req_power_cycle( unit.shutdown_switch );

				// Record the shutdown request in the db.
				var unit_check = data.utils.db.get("unit_check");
				var rec = {
					kind: "power_cycle",
					module_name: unit.module_name,
					address: unit.address,
					cmd: unit.cmd,
					time_down_sec: timeDown/1000,
					power_cycle:  unit.shutdown_switch
				};
				unit_check.insert( rec, {w: 0} );

				// Send a text
				data.utils.send_text_msg( "Unit restart", "Unit: "+unit.address+", time: "+new Date().toLocaleTimeString());

				unit.num_good = 0;
				unit.num_bad = 0;
				unit.first_failure_ms = undefined;
			}
		} else {
			unit.first_failure_ms = now;
		}
	}
}

// Handle a successful or bad attempt to contact a  unit.
function handleUnitCheckResult( data, unit, success, value )
{
	var now = new Date().getTime();

	if (success) {
		unit.num_good++;
		data.num_recent_good++;
	} else {
		unit.num_bad++;
		data.num_recent_bad++;
		data.last_bad_addr = unit.address;
		data.last_bad_time = now;
	}
	unit.cur_good = success;

	// Update stats.
	data.cur_good = 0;
	data.cur_bad = 0;
	for ( var iunit=0; iunit < data.units.length; iunit++ ) {
		var aunit = data.units[iunit];
		if (aunit.cur_good != undefined) {
			if (aunit.cur_good) {
				data.cur_good++;
			} else {
				data.cur_bad++;
			}
		}
	}

	// Keep a shift reg of success values, and update num_recent_good/bad stats and pct.
	data.recent_good.unshift(success);
	while (data.recent_good.length > data.max_recent_good) {
		var removed = data.recent_good.pop();
		if (removed) {
			data.num_recent_good--;
		} else {
			data.num_recent_bad--;
		}
	}
	data.pct_recent_good = Math.floor((data.num_recent_good / (data.num_recent_good + data.num_recent_bad)) * 100);

	var reported = unit.num_good + unit.num_bad;

	if (data.debug) {
		console.log("UNIT CHECK: result: addr="+unit.address+", success="+success+", good/bad=("+unit.num_good+","+unit.num_bad+"), value="+JSON.stringify(value));
	}

	// If there is a handle_status routine, call it.  This may log items from the status 
	// to unit-specific streams.
	if (unit.handle_status && success) {
		unit.handle_status( unit.address, unit.cmd, value );
	}

	if (data.auto_power_cycle) {
		checkIfPowerCycleNeeded( data, unit, success );
	}

	var live_sec = (now - unit.last_store_ms)/1000;
	if (live_sec > data.store_interval_sec) {
		unit.last_store_ms = now;
		if (data.debug) {
			console.log("UNIT CHECK: "+ new Date().toLocaleTimeString() + ": store for addr="+unit.address+", good/bad=("+unit.num_good+","+unit.num_bad+")");
			var unit_check = data.utils.db.get("unit_check");
			var rec = {
				kind: "unit_status",
				module_name: unit.module_name,
				address: unit.address,
				cmd: unit.cmd,
				num_good: unit.num_good,
				num_bad: unit.num_bad
			};
			unit_check.insert( rec, {w: 0} );
		}
		unit.num_good = 0;
		unit.num_bad = 0;
	}

	scheduleIter(data,false); // Never retry.
}


// Execute a periodic unit check.
function unitCheck( data ) {

  try {
	var utils = data.utils;
	var instrs = data.instrs;

	if (data.waiting) {
		// In an async chain.  Don't restart on timer.
		if (err) {
			console.log("MON: Skipping unitCheck event because waiting");
		}
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

		var handled = false;

		var iunit = data.next_unit;
		var unit = data.units[iunit];
		if (unit != undefined) {
			data.next_unit = (data.next_unit + 1) % data.units.length;
			handled = true;
			var instr = utils.get_instr_by_type( instrs, unit.module_name );
			utils.queue_and_send_instr_cmd( instr, unit.cmd, data.fuse_ms,
				function(status) { // Success
					handleUnitCheckResult( data, unit, true, status );
				},
				function(error) { // Error
					handleUnitCheckResult( data, unit, false, error );
				}
			);
		}

		if (!handled) {
			scheduleIter(data,false);
		}
	});
  } catch (err) {
	console.log("ERROR: unitCheck: catch: "+err);
  }
}


// Function to begin an scheduled pump shutdown.
// Options:
// 
// option[2:0] : main
// option[5:3] : ph
//
//  0 : unset
//  1 : cancel
//  2 : off
//  3 : half
//  4 : full
//  
function startScheduledShutdownX( data, option, duration_min, successFunc, errorFunc ) {
	var utils = data.utils;
	var instrs = data.instrs;
	var stand = utils.get_instr_by_type( instrs, data.target_instr_type );

	var main_opt = (option & 7);
	var ph_opt = (option >> 3);
	var duration_sec = (duration_min * 60);
	var cmd = "tshut "+duration_sec+" "+main_opt+" "+ph_opt;
	utils.queue_and_send_instr_cmd( stand, cmd, 0,
		function(status) { // Success
			data.is_active = false;
			successFunc();
		},
		errorFunc );
}

// Function to restore the non-shutdown pump speeds.
function endScheduledShutdownX( data, option, successFunc, errorFunc ) {
	successFunc();
}

// Temp version that turns off switch #2.
function startScheduledShutdown( data, option, duration_min, successFunc, errorFunc ) {
	var utils = data.utils;
	var instrs = data.instrs;
	var power = utils.get_instr_by_type( instrs, "power" );

	var cmd = "off 2";
	utils.queue_and_send_instr_cmd( power, cmd, 0,
		function(status) { // Success
			data.is_active = false;
			successFunc();
		},
		errorFunc );
}

// Temp version that turn on switch #2.
function endScheduledShutdown( data, option, successFunc, errorFunc ) {
	var utils = data.utils;
	var instrs = data.instrs;
	var power = utils.get_instr_by_type( instrs, "power" );

	var cmd = "on 2";
	utils.queue_and_send_instr_cmd( power, cmd, 0,
		function(status) { // Success
			data.is_active = false;
			successFunc();
		},
		errorFunc );
}


// Function to turn a relay on
// Options: switch num.
function relayOn( data, option, duration_min, successFunc, errorFunc ) {
	var utils = data.utils;
	var instrs = data.instrs;
	var power = utils.get_instr_by_type( instrs, data.target_instr_type );

	var cmd = "on "+option;
	utils.queue_and_send_instr_cmd( power, cmd, 0,
		function(status) { // Success
			data.is_active = false;
			successFunc();
		},
		errorFunc );
}

// Function to turn a relay off
// Option: swich num.
function relayOff( data, option, successFunc, errorFunc ) {
	var utils = data.utils;
	var instrs = data.instrs;
	var power = utils.get_instr_by_type( instrs, data.target_instr_type );

	var cmd = "off "+option;
	utils.queue_and_send_instr_cmd( power, cmd, 0,
		function(status) { // Success
			data.is_active = false;
			successFunc();
		},
		errorFunc );
}


// 
// Function to request a shutdown task to start now with a specified duration.
// Set the active_task member with 'now' as a start time so it will be retried if 
// this attempt fails.
function reqShutdownTask( option, durationMin, successFunc, errorFunc ) {
	var d = new Date();
	var data = this;
	data.active_task = { option: option,
						 done_today: false,
						 start: [d.getHours(), d.getMinutes()],
						 duration: [ Math.floor(durationMin/60), Math.floor(durationMin%60) ] };
	startScheduledShutdown( data, option, durationMin,
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
function scheduleIter( data, isRetry, doNow ) {

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
	var interval = doNow
		? 0
		: (data.enabled && (data.is_active || isFirst))
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
	startup: startup,
}
