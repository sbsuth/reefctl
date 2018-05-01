var express = require('express');
var router = express.Router();
var login = require('./login')

var debug_stand = 1;

/*
 * POST a command to the stand.
 */
router.post('/stand_cmd/:cmd/:instr_name/:arg1?/:arg2?/:arg3?/:arg4?', function(req, res) {

	var session = req.session;
	var utils = req.utils;
    var cmd = req.params.cmd
				+ ((req.params.arg1 != undefined) ? " "+req.params.arg1 : "")
				+ ((req.params.arg2 != undefined) ? " "+req.params.arg2 : "")
				+ ((req.params.arg3 != undefined) ? " "+req.params.arg3 : "")
				+ ((req.params.arg4 != undefined) ? " "+req.params.arg4 : "")
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "stand \'"+instr_name+"\' unknown.");
		return;
	}
	if (debug_stand) {
		console.log("STAND: Incoming command: "+cmd);
	}

	utils.queue_instr_cmd( instr, function () {
		if (debug_stand) {
			console.log("STAND: Sending "+cmd+" command from server");
		}
		utils.send_instr_cmd( instr, cmd,
			function(body) { // Success
				if (debug_stand) {
					console.log("STAND: Got "+cmd+" response in server:"+JSON.stringify(body));
				}
				res.send( { msg: '', body: body } );
			},
			function(error) { // Error
				utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to stand "+instr_name+": "+error);
			}
		);
	});

});

//
// GET stand_status query.
//
router.get('/stand_status/:instr_name/:option?', function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "ERROR: stand instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var cmd = (req.params.option=="pump") ? "pstat" : "stat";

	if (debug_stand) {
		console.log("STAND: Incoming stand status");
	}
	utils.queue_instr_cmd( instr, function () {
		if (debug_stand) {
			console.log("STAND: Sending "+cmd+" command from server");
		}
		utils.send_instr_cmd( instr, cmd,
			function(body) { // Success
				if (debug_stand) {
					console.log("STAND: Got "+cmd+" response in server:"+JSON.stringify(body));
				}
				res.send( body );
			},
			function(error) { // Error
				utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to stand "+instr_name+": "+error);
			}
		);
	}, res); // Sending res says "Don't do this if there's something already queued."
});



/*
 * GET temp_main.
 */
router.get('/temp_main/:instr_name', function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "temp control instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var calHelp = "Measure temperature for \'_label_\' and click to send";
	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/temp.c.js" );
	d.instr_name = instr_name;
	d.cal_items = [
					{label: "Calibrate Display Temp Probe",
					 id: "disp",
					 cmd: "/stand_cmd/calt/"+instr_name+"/0",
					 has_value: true,
					 steps: [
						{ help: calHelp }, 
						{ i: 0, label: "Low", units: "(&#8457;)"},
						{ i: 1, label: "Mid", units: "(&#8457;)"},
						{ i: 2, label: "High", units: "(&#8457;)"}
					 ]
					},
					{label: "Calibrate Sump Temp Probe",
					 id: "sump",
					 cmd: "/stand_cmd/calt/"+instr_name+"/1",
					 has_value: true,
					 steps: [
						{ help: calHelp }, 
						{ i: 0, label: "Low", units: "(&#8457;)"},
						{ i: 1, label: "Mid", units: "(&#8457;)"},
						{ i: 2, label: "High", units: "(&#8457;)"}
					 ]
					}
				 ];
	res.render("temp_main", d );
});

/*
 * GET probes_main.
 */
router.get('/probes_main/:instr_name', login.validateUser, function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "probes instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var calHelp = "Place probe in \'_label_\', wait for reading to settle, and click to send";
	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/probes.c.js" );
	d.instr_name = instr_name;
	d.cal_items = [
					{label: "Calibrate pH Probe",
					 id: "pH",
					 cmd: "/stand_cmd/calp/"+instr_name,
					 has_value: false,
					 steps: [
						{ help: calHelp }, 
						{ i: 0, label: "7.0", units: ""},
						{ i: 1, label: "4.0", units: ""},
						{ i: 2, label: "10.0", units: ""}
					 ]
					},
					{label: "Calibrate EC Probe",
					 id: "ec",
					 cmd: "/stand_cmd/cale/"+instr_name,
					 has_value: false,
					 steps: [
						{ help: calHelp }, 
						{ i: 0, label: "Dry", units: ""},
						{ i: 1, label: "12880", units: ""},
						{ i: 2, label: "80000", units: ""}
					 ]
					}
				 ];
	res.render("probes_main", d );
});

/*
 * GET powerheads_main.
 */
router.get('/powerheads_main/:instr_name', function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "powerheads instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/powerheads.c.js" );
	d.instr_name = instr_name;
	var settings = [{i: 0, id: "mode",        kind: "mode_combo",func: "set_mode", label: "Mode"},
					{i: 1, id: "top_speed",   kind: "edit", func: "set_speed", label: "Top Speed (%)"},
					{i: 2, id: "slow_speed",  kind: "edit", func: "set_speed", label: "Slow Speed (%)"},
	                {i: 3, id: "hold_sec",    kind: "edit", func: "set_mode", label: "Hold (sec)"},
	                {i: 4, id: "hold_range",  kind: "edit", func: "set_mode", label: "Hold Range(%)"},
	                {i: 5, id: "ramp_sec",    kind: "edit", func: "set_mode", label: "Ramp (sec)"},
	                {i: 6, id: "ramp_range",  kind: "edit", func: "set_mode", label: "Ramp Range(%)"}
				   ];
	d.indexes = [{index: 0, settings: settings},{index: 1, settings: settings}];
	res.render("powerheads_main", d );
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
	name: "stand",
	instrs: [
	  { name: "temp",
		label: "Temperature controller",
		main_page: "temp_main",
		widget_page: "temp_widget",
		status_cmd: "stat",
		status_route: "stand_status",
		init_session: init_session,
		init_widget_data: init_widget_data
	  },
	  { name: "probes",
		label: "pH and EC Probes",
		main_page: "probes_main",
		widget_page: "probes_widget",
		status_cmd: "stat",
		status_route: "stand_status",
		init_session: init_session,
		init_widget_data: init_widget_data
	  },
	  { name: "powerheads",
		label: "Powerheads",
		main_page: "powerheads_main",
		widget_page: "powerheads_widget",
		status_cmd: "pstat",
		status_route: "stand_status/pump",
		init_session: init_session,
		init_widget_data: init_widget_data
	  },
	  { name: "sump_level",
		label: "Sump Level",
		main_page: undefined,
		widget_page: undefined,
		status_cmd: "stat",
		status_route: "stand_status",
		init_session: init_session,
		init_widget_data: init_widget_data
	  },
	  { name: "ro_res", // Bogus!  Needs to go in an ro_res route
		label: "RO Reservoir",
		main_page: undefined,
		widget_page: undefined,
		status_cmd: "stat",
		status_route: "stand_status",
		init_session: init_session,
		init_widget_data: init_widget_data
	  },
	  { name: "salt_res", // Bogus!  Needs to go in an salt_res route
		label: "Saltwater Reservoir",
		main_page: undefined,
		widget_page: undefined,
		status_cmd: "stat",
		status_route: "stand_status",
		init_session: init_session,
		init_widget_data: init_widget_data
	  },
	  { name: "dosing", // Bogus!  Needs to go in an dosing route
		label: "Dosing Pumps",
		main_page: undefined,
		widget_page: undefined,
		status_cmd: "stat",
		status_route: "dosing_status",
		init_session: init_session,
		init_widget_data: init_widget_data
	  },
	]
};
