var express = require('express');
var router = express.Router();
var request = require('request');

var debug_stand = 1;

/*
 * POST a command to the stand.
 */
router.post('/stand_cmd/:cmd/:instr_name/:arg1?/:arg2?/:arg3?', function(req, res) {

	var utils = req.utils;
    var cmd = req.params.cmd
				+ ((req.params.arg1 != undefined) ? " "+req.params.arg1 : "")
				+ ((req.params.arg2 != undefined) ? " "+req.params.arg2 : "")
				+ ((req.params.arg3 != undefined) ? " "+req.params.arg3 : "")
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(req,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "stand \'"+instr_name+"\' unknown.");
		return;
	}
	var url = instr.address;
	if (debug_stand) {
		console.log("STAND: Incoming command: "+cmd);
	}
	utils.queue_instr_cmd( instr, function () {
		if (debug_stand) {
			console.log("STAND: Sending "+cmd+" command from server");
		}
		request.post(
				'http://' + url,
				{ headers: { 'suth-cmd': cmd },
				  json: true,
				  timeout: 5000
				},
				function (error, response, body) {
					if (!error && response.statusCode == 200) {
						if (debug_stand) {
							console.log("STAND: Got "+cmd+" response in server:"+JSON.stringify(response.body));
						}
						res.send( { msg: '', body: body } );
					} else {
						utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to stand "+instr_name);
					}
					utils.instr_cmd_done( instr );
				}
		);
	});
});

//
// GET stand_status query.
//
router.get('/stand_status/:instr_name', function(req, res) {
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(req,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "ERROR: stand instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var url = instr.address;
	var cmd = "stat";

	if (debug_stand) {
		console.log("STAND: Incoming stand status");
	}
	utils.queue_instr_cmd( instr, function () {
		if (debug_stand) {
			console.log("STAND: Sending "+cmd+" command from server");
		}
		request.get(
			'http://' + url,
			{ headers: { 'suth-cmd': cmd },
			  json: true,
			  timeout: 5000
			},
			function (error, response, body) {
				if (!error && response.statusCode == 200) {
					if (debug_stand) {
						console.log("STAND: Got "+cmd+" response in server");
					}
					res.json( body );
				} else {
					utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to stand "+instr_name);
				}
				utils.instr_cmd_done( instr );
			}
		);
	}, res); // Sending res says "Don't do this if there's something already queued."
});



/*
 * GET temp_main.
 */
router.get('/temp_main/:instr_name', function(req, res) {
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(req,instr_name);
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
	res.locals.session = req.session;
	res.render("temp_main", d );
});

/*
 * GET probes_main.
 */
router.get('/probes_main/:instr_name', function(req, res) {
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(req,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "probes instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var calHelp = "Place probe in \'_label_\' and click to send";
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
						{ i: 0, label: "4.0", units: ""},
						{ i: 1, label: "7.0", units: ""},
						{ i: 2, label: "10.0", units: ""}
					 ]
					},
					{label: "Calibrate EC Probe",
					 id: "ec",
					 cmd: "/stand_cmd/cale/"+instr_name,
					 has_value: false,
					 steps: [
						{ help: calHelp }, 
						{ i: 0, label: "Low", units: ""},
						{ i: 1, label: "Mid", units: ""},
						{ i: 2, label: "High", units: ""}
					 ]
					}
				 ];
	res.locals.session = req.session;
	res.render("probes_main", d );
});

function init_session( session )
{
}

// Add fields to 'widget' for the given instr to support the widget just template.
function init_widget_data( session, instr, widget )
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
	  }
	]
};
