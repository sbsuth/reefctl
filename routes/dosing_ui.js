var express = require('express');
var router = express.Router();
var login = require('./login')

var debug_dosers = 1;

/*
 * POST a command for a doser to set a value.
 */
router.post('/set_doser_value/:system/:doser/:field/:value/:type', function(req, res) {

	var session = req.session;
	var utils = req.utils;
	var system = req.params.system;
	var doser = req.params.doser;
	var field = req.params.field;
	var value = req.params.value;
	var type = req.params.type;

	if (debug_dosers) {
		console.log("DOSERS: "+system+":"+doser+": set value: "+field+"="+value);
	}

	try {

	var parsed = utils.decode_value(value,type);
	if (parsed.err) {
		utils.send_error( res, "ERROR: DOSERS: "+parsed.err);
		return;
	}

	var field_and_val = {}
	field_and_val[field] = parsed.value;

		utils.db.get('monitors').update( 
			{system: system, name: doser}, 
			{$set: field_and_val},
			function( err, doc, next ) {
				if (err) {
					console.log("ERROR: DOSERS: "+system+":"+doser+": set value: "+field+"="+parsed.value+": "+err);
				}
			});
	} catch (err) {
		console.log("ERROR: DOSERS: "+system+":"+doser+": set value: "+field+"="+parsed.value+": "+err);
	}

});


/*
 * GET dosers.
 */
router.get('/dosers/:system_name/', login.validateUser, function(req, res) {
	var session = req.session;
	var system_name = req.params.system_name;
	var utils = req.utils;

	if (debug_dosers) {
		console.log("DOSERS: get : "+system_name);
	}

	// Settings for all types of controls.
	// They'll get merged into the monitors for access in the view.
	var controls = {
		vodka_dosing: {
			order: 0,
			view_settings: [
				{	label: "Start Time",
					field: "start_time",
					type:  "tod"
				},
				{	label: "ml Per Day",
					field: "ml_per_day",
					type:  "int10"
				},
				{	label: "ml Per Iter",
					field: "ml_per_iter",
					type:  "int10"
				},
				{	label: "Iteration gap",
					field: "inter_interval_sec",
					type:  "hms"
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
					type:  "int10"
				},
			]
		},
	};

	utils.get_monitors( system_name, controls, function( err, doser_objs ) {
		if (err == undefined) {
			var d = utils.get_master_template_data(req);
			d.load_javascript.push( "/js/monitors.c.js" );
			d.system_name = system_name;
			for (var imon=0; imon < doser_objs.length; imon++ ) {
				var mon = doser_objs[imon];
				Object.assign( mon, controls[mon.name] );
			}
			doser_objs.sort( function(a,b) { return a.order > b.order; } );
			d.title = "Dosing";
			d.monitors = doser_objs;
			d.controls = controls;
			res.render("monitors", d );
		} else {
			utils.send_error( res, "No system named \'"+system_name+"\' was found: "+err);
		}
	} );
});

//
// GET dosers_status query.
//
router.get('/dosers_status/:system_name/:option?', function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var system_name = req.params.system_name;
	if (debug_dosers) {
		console.log("DOSERS: Incoming monitor status");
	}
	utils.get_monitors( system_name, undefined, function(err,mons) {
		var rslt = {monitors: mons};
		res.send(rslt);
	});
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
	name: "dosers",
};
