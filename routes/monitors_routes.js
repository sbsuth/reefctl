var express = require('express');
var router = express.Router();

var debug_monitors = 1;

// Interprets a string given a type.
// Retuns {val,err} where val is the typed value, and err is set if there was a problem.
function decode_value( str, type ) {
	var value = undefined;
	var err = undefined;
	switch (type) {
		case "bool":
			if ((value == "1") || (value == "true")) {
				value = true;
			} else if ((value == "0") || (value == "false")) {
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
		case 'tod':
			// Value is [hour,min], format is hour:min
			var vals = str.split(":");
			if ((vals.length != 2) || !Number.isInteger(vals[0]) || !Number.isInteger(vals[1])) {
				err = "Must specify \'hour:min\'";
			} else {
				var hour = Number.parseInt(vals[0]);
				var min = Number.parseInt(vals[1]);
				if ((hour < 0) || (hour > 23)) {
					err = "Hours must be from 0-23.";
				} else if ((min < 0) || (min > 59)) {
					err = "Minutes must be from 0-59."
				} else {
					value = [hour,,min];
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
router.get('/monitors/:system_name/', function(req, res) {
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
		manual_tank_fill: {
			view_settings: [
				{	label: "Pumpt Num",
					field: "pump_num",
					type:  "int"
				},
				{	label: "Debug",
					field: "debug",
					type:  "bool"
				},
			],
			view_status: [
				{	label: "Active",
					field: "is_active",
					type:  "bool"
				},
				{	label: "Recovering",
					field: "res_recovering",
					type:  "bool"
				},
				{	label: "time filling",
					field: "time_filling",
					type:  "int"
				},
			]
		},
		salt_res_fill: {
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
		water_change: {
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
				{	label: "Active",
					field: "is_active",
					type:  "bool"
				},
				{	label: "Dosed Today",
					field: "dosed",
					type:  "str"
				},
			]
		}
	};
// ,"name":"salt_res_fill"
// ,"enabled":false
// ,"pump_num":1
// ,"debug":2
// ,"is_active":0
// ,"time_filling":0
// ,"res_recovering":false}
// 
// ,"name":"manual_tank_fill"
// ,"enabled":false
// ,"pump_num":1
// ,"debug":2
// ,"is_active":0
// ,"time_filling":0
// ,"res_recovering":false}
// 
// ,"name":"water_change"
// ,"enabled":false
// ,"start_time":[12,0]
// ,"dosed":[500,400]
// ,"ml_per_iter":100
// ,"ml_per_day":2500
// ,"pump_num":[3,4]
// ,"phase":0
// ,"inter_interval_sec":0
// ,"debug":2
// ,"is_active":0

	get_monitors( utils, system_name, function( err, monitor_objs ) {
		if (err == undefined) {
			var d = utils.get_master_template_data(req);
			d.load_javascript.push( "/js/monitors.c.js" );
			d.system_name = system_name;
			d.monitors = monitor_objs;
			for (var imon=0; imon < d.monitors.length; imon++ ) {
				var mon = d.monitors[imon];
				Object.assign( mon, controls[mon.name] );
			}
			d.controls = controls;
			res.render("monitors", d );
		} else {
			utils.send_error( res, "No system named \'"+system_name+"\' was found: "+err);
		}
	} );
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
