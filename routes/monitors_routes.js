var express = require('express');
var router = express.Router();
var login = require('./login')

var debug_monitors = 1;

// Interprets a string given a type.
// Retuns {val,err} where val is the typed value, and err is set if there was a problem.
function decode_value( str, type ) {
	var value = undefined;
	var err = undefined;
	switch (type) {
		case "bool":
			if ((str == "1") || (str == "true")) {
				value = true;
			} else if ((str == "0") || (str == "false")) {
				value = false;
			} else {
				err = "Must specify true, false, 1, or 0";
			}
			break;
		case "int":
			value = Number.parseInt(str);
			if (Number.isNaN(value)) {
				err = "Must specify an integer.";
			}
			break;
		case 'real':
			value = Number.parseFloat(str);
			if (Number.isNaN(value)) {
				err = "Must specify real number";
			}
			break;
		case 'str':
			value = str;
			break;
		case 'time':
			// A time from Date() in ms.
			value = new Date(str).toLocaleString();
			break;
		case 'tod':
			// Value is [hour,min], format is hour:min
			var vals = str.split(":");
			if (vals.length != 2)  {
				err = "Must specify \'hour:min\'";
			} else {
				var hour = Number.parseInt(vals[0]);
				var min = Number.parseInt(vals[1]);
				if ( Number.isNaN(hour) || (hour < 0) || (hour > 23)) {
					err = "Hours must be from 0-23.";
				} else if ( Number.isNaN(hour) || (min < 0) || (min > 59)) {
					err = "Minutes must be from 0-59."
				} else {
					value = [hour,min];
				}
			}
			break;
		default: 
			err = "Unrecognized type \'"+type+"\'";
			break;
	}
	return {value: value, err: err};
}

/*
 * POST for a shutdown request
 */
router.post('/shutdown/:system/:options/:duration', function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var system = req.params.system;
	var options = req.params.options;
	var duration = req.params.duration;

	try {
		var monitor = utils.get_monitor( system, "scheduled_shutdown", false );
		monitor.req_task( options, duration, 
			function(body) { // Success
				res.send( { msg: '', body: body } );
			},
			function(error) { // Error
				utils.send_error( res, "ERROR: sending shutdown req: "+error);
			} );

	} catch (err) {
		console.log("ERROR: shutdown: "+err);
	}
});

/*
 * POST a command for a monitor to set a value.
 */
router.post('/set_monitor_value/:system/:monitor/:field/:value/:type', function(req, res) {

	var session = req.session;
	var utils = req.utils;
	var system = req.params.system;
	var monitor = req.params.monitor;
	var field = req.params.field;
	var value = req.params.value;
	var type = req.params.type;

	if (debug_monitors) {
		console.log("MONITORS: "+system+":"+monitor+": set value: "+field+"="+value);
	}

	try {

	var parsed = decode_value(value,type);
	if (parsed.err) {
		utils.send_error( res, "ERROR: MONITORS: "+parsed.err);
		return;
	}

	var field_and_val = {}
	field_and_val[field] = parsed.value;

		utils.db.get('monitors').update( 
			{system: system, name: monitor}, 
			{$set: field_and_val},
			function( err, doc, next ) {
				if (err) {
					console.log("ERROR: MONITORS: "+system+":"+monitor+": set value: "+field+"="+parsed.value+": "+err);
				}
			});
	} catch (err) {
		console.log("ERROR: MONITORS: "+system+":"+monitor+": set value: "+field+"="+parsed.value+": "+err);
	}

});

// Utility that gets all monitors, including data from the db, and memory if its there.
// Calls the given 'next' function with an err, and an array of monitors.
function get_monitors( utils, system_name, next ) {

	// Read all the monitors for the given system.
	var monitors = utils.db.get("monitors");
	monitors.find( {system: system_name}, {}, function( err, monitor_objs ) {
		if (monitor_objs && monitor_objs.length && !err) {

			// Merge in any in-memory stuff that's not already in the db obj.
			for ( var imon=0; imon < monitor_objs.length; imon++ ) {
				var mon = monitor_objs[imon];
				var memMon = utils.get_monitor( system_name, mon.name, true );
				if (memMon != undefined ) {
					Object.keys(memMon).forEach( function(key) {
						if ( mon[key] == undefined ) {
							mon[key] = memMon[key]; // By ref.
						}
					});
				}
			}
			next( undefined, monitor_objs );
			
		} else {
			next( err, [] );
		}
	});
}


//
// GET monitors_status query.
//
router.get('/monitors_status/:system_name/:option?', function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var system_name = req.params.system_name;
	if (debug_monitors) {
		console.log("MONITORS: Incoming monitor status");
	}
	get_monitors( utils, system_name, function(err,mons) {
		var rslt = {monitors: mons};
		res.send(rslt);
	});
});

/*
 * GET monitors.
 */
router.get('/monitors/:system_name/', login.validateUser, function(req, res) {
	var session = req.session;
	var system_name = req.params.system_name;
	var utils = req.utils;

	if (debug_monitors) {
		console.log("MONITORS: get : "+system_name);
	}

	// Settings for all types of controls.
	// They'll get merged into the monitors for access in the view.
	var controls = {
		ato: {
			order: 0,
			view_settings: [
				{	label: "Pump Num",
					field: "pump_num",
					type:  "int"
				},
				{	label: "Debug",
					field: "debug",
					type:  "bool"
				},
			],
			view_status: [
				{	label: "Full",
					field: "target_full",
					type:  "bool"
				},
				{	label: "Sump Level",
					field: "target_lev",
					type:  "int"
				},
				{	label: "Active",
					field: "is_active",
					type:  "bool"
				},
				{	label: "Time Filling",
					field: "time_filling",
					type:  "int"
				},
			]
		},
		water_change: {
			order: 1,
			view_settings: [
				{	label: "Start Time",
					field: "start_time",
					type:  "tod"
				},
				{	label: "ml Per Day",
					field: "ml_per_day",
					type:  "int"
				},
				{	label: "ml Per Iter",
					field: "ml_per_iter",
					type:  "int"
				},
				{	label: "Pump Num",
					field: "pump_num",
					type:  "int"
				},
				{	label: "Debug",
					field: "debug",
					type:  "bool"
				},
			],
			view_status: [
				{	label: "Res Level",
					field: "res_lev",
					type:  "int"
				},
				{	label: "Active",
					field: "is_active",
					type:  "bool"
				},
				{	label: "Dosed Today",
					field: "dosed",
					type:  "str"
				},
			]
		},
		salt_res_fill: {
			order: 2,
			view_settings: [
				{	label: "Pump Num",
					field: "pump_num",
					type:  "int"
				},
				{	label: "Debug",
					field: "debug",
					type:  "bool"
				},
			],
			view_status: [
				{	label: "Full",
					field: "target_full",
					type:  "bool"
				},
				{	label: "Res Level",
					field: "target_lev",
					type:  "int"
				},
				{	label: "Active",
					field: "is_active",
					type:  "bool"
				},
				{	label: "Recovering",
					field: "res_recovering",
					type:  "bool"
				},
				{	label: "Time Filling",
					field: "time_filling",
					type:  "int"
				},
			]
		},
		manual_tank_fill: {
			order: 3,
			view_settings: [
				{	label: "Pump Num",
					field: "pump_num",
					type:  "int"
				},
				{	label: "Debug",
					field: "debug",
					type:  "bool"
				},
			],
			view_status: [
				{	label: "RO Res Level",
					field: "target_lev",
					type:  "int"
				},
				{	label: "Active",
					field: "is_active",
					type:  "bool"
				},
				{	label: "Recovering",
					field: "res_recovering",
					type:  "bool"
				},
				{	label: "Time Filling",
					field: "time_filling",
					type:  "int"
				},
			]
		},
		unit_check: {
			order: 4,
			view_settings: [
				{	label: "Auto Power Cycle",
					field: "auto_power_cycle",
					type:  "bool"
				},
				{	label: "Debug",
					field: "debug",
					type:  "bool"
				},
				{	label: "",
					link: "Show Details",
					href: "/unit_check/"+system_name
				},
			],
			view_status: [
				{	label: "#Good:",
					field: "cur_good",
					type:  "int"
				},
				{	label: "#Bad:",
					field: "cur_bad",
					type:  "int"
				},
				{	label: "Good Rate:",
					field: "pct_recent_good",
					type:  "int"
				},
				{	label: "Last Bad:",
					field: "last_bad_addr",
					type:  "str"
				},
				{	label: "Bad Time:",
					field: "last_bad_time",
					type:  "time"
				},
				{	label: "Last Dead:",
					field: "last_power_cycle_addr",
					type:  "str"
				},
				{	label: "Dead Time:",
					field: "last_power_cycle_time",
					type:  "time"
				},
				{	label: "PC Switcth:",
					field: "last_power_cycle_entity",
					type:  "str"
				},
			]
		},
	};

	get_monitors( utils, system_name, function( err, monitor_objs ) {
		if (err == undefined) {
			var d = utils.get_master_template_data(req);
			d.load_javascript.push( "/js/monitors.c.js" );
			d.system_name = system_name;
			for (var imon=0; imon < monitor_objs.length; imon++ ) {
				var mon = monitor_objs[imon];
				Object.assign( mon, controls[mon.name] );
			}
			monitor_objs.sort( function(a,b) { return a.order > b.order; } );
			d.monitors = monitor_objs;
			d.controls = controls;
			res.render("monitors", d );
		} else {
			utils.send_error( res, "No system named \'"+system_name+"\' was found: "+err);
		}
	} );
});

function objectIdWithTimestamp(timestamp) {
    // Convert string date to Date object (otherwise assume timestamp is a date)
    if (typeof(timestamp) == 'string') {
        timestamp = new Date(timestamp);
    }

    // Convert date object to hex seconds since Unix epoch
    var hexSeconds = Math.floor(timestamp/1000).toString(16);

    // Create an ObjectId with that hex timestamp
    var constructedObjectId = ObjectId(hexSeconds + "0000000000000000");

    return constructedObjectId
}

function getData(utils) {

	var startDate = new Date("August 16, 2018 20:30:00");
	var endDate = new Date(startDate.getTime()+(30*1000*60));
	var start = objectIdWithTimestamp(startDate);
	var end = objectIdWithTimestamp(endDate);
	utils.db.getCollection('unit_check').find({address: /\.7:/, _id: {$gt: start, $lt: end}})
}

router.get('/unit_check/:system_name/', login.validateUser, function(req, res) {
	var session = req.session;
	var system_name = req.params.system_name;
	var utils = req.utils;

	if (debug_monitors) {
		console.log("UNIT_CHECK: get : "+system_name);
	}

	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/Chart.min.js" );
	d.load_javascript.push( "/js/unit_check.c.js" );
	d.system_name = system_name;
	res.render("unit_check", d );
});


function init_session( req )
{
}

// Add fields to 'widget' for the given instr to support the widget just template.
function init_widget_data( req, instr, widget )
{
}


module.exports = {
	router: router,
	name: "monitors",
};
