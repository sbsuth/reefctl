var express = require('express');
var router = express.Router();
var login = require('./login')

var debug_monitors = 1;

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

	var parsed = utils.decode_value(value,type);
	if (parsed.err) {
		utils.send_error( res, "ERROR: MONITORS: "+parsed.err);
		return;
	}

	// Field names can contain :<i> for subscripts.
	// For $set, this becomes .<i>
	field = field.replace(":",".");

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
		console.log("ERROR: MONITORS: "+system+":"+monitor+": set value: "+field+"="+value+": "+err);
	}

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
				{	label: "Disabled Addrs",
					field: "disabled_addrs",
					type:  "int_arr"
				},
				{	label: "Silent Addrs",
					field: "no_text_addrs",
					type:  "int_arr"
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
		scheduled_shutdown: {
			order: 6,
			view_settings: [
				{	label: "Start",
					field: "times:0.start",
					type: "tod"
				},
				{	label: "Duration",
					field: "times:0.duration",
					type: "tod"
				}
			],
			view_status: [
				{	label: "Done Today",
					field: "times:0.done_today",
					type: "bool"
				}
			]
		},
		fuge_light: {
			order: 7,
			view_settings: [
				{	label: "Start",
					field: "times:0.start",
					type: "tod"
				},
				{	label: "Duration",
					field: "times:0.duration",
					type: "tod"
				},
				{	label: "Switch#",
					field: "times:0.option",
					type: "int"
				}
			],
			view_status: [
				{	label: "Done Today",
					field: "times:0.done_today",
					type: "bool"
				}
			]
		},
		gyre_cycle: {
			order: 8,
			view_settings: [
				{	label: "Start",
					field: "times:0.start",
					type: "tod"
				},
				{	label: "Duration",
					field: "times:0.duration",
					type: "tod"
				},
				{	label: "Repeat",
					field: "times:0.repeat",
					type: "tod"
				},
				{	label: "Switch#",
					field: "times:0.option",
					type: "int"
				}
			],
			view_status: [
				{	label: "Done Today",
					field: "times:0.done_today",
					type: "bool"
				}
			]
		},
		data_logger: {
			order: 9,
			view_settings: [
				{	label: "Interval",
					field: "interval",
					type: "tod"
				}
			],
			view_status: [
				{	label: "Last Logged",
					field: "last_time",
					type: "tod"
				}
			]
		},
	};


	utils.get_monitors( system_name, controls, function( err, monitor_objs ) {
		if (err == undefined) {
			var d = utils.get_master_template_data(req);
			d.load_javascript.push( "/js/monitors.c.js" );
			d.system_name = system_name;
			for (var imon=0; imon < monitor_objs.length; imon++ ) {
				var mon = monitor_objs[imon];
				var control = controls[mon.name];
				Object.assign( mon, control );
			}
			monitor_objs.sort( function(a,b) { return a.order > b.order; } );
			d.title = "Monitors";
			d.monitors = monitor_objs;
			d.controls = controls;
			res.render("monitors", d );
		} else {
			utils.send_error( res, "No system named \'"+system_name+"\' was found: "+err);
		}
	} );
});

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
	utils.get_monitors( system_name, undefined, function(err,mons) {
		var rslt = {monitors: mons};
		res.send(rslt);
	});
});


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
