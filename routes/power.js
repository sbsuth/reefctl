var express = require('express');
var router = express.Router();
var request = require('request');

var debug_power = 1;

/*
 * POST a command to the panel.
 */
router.post('/power_cmd/:cmd/:instr_name/:unit', function(req, res) {

	var utils = req.utils;
    var cmd = req.params.cmd;
	var instr_name = req.params.instr_name;
	var unit = req.params.unit;
	var instr = utils.get_instr_by_name(req,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "power panel \'"+instr_name+"\' unknown.");
		return;
	}
	if (unit >= 0) {
		cmd += " " +unit;
	}
	var url = instr.address;
	if (debug_power) {
		console.log("POWER: Incoming command: "+cmd);
	}
	utils.queue_instr_cmd( instr, function () {
		if (debug_power) {
			console.log("POWER: Sending "+cmd+" command from server");
		}
		request.post(
				'http://' + url,
				{ headers: { 'suth-cmd': cmd },
				  json: true 
				},
				function (error, response, body) {
					if (!error && response.statusCode == 200) {
						if (debug_power) {
							console.log("POWER: Got "+cmd+" response in server");
						}
						res.send( { msg: '', body: body } );
					} else {
						utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to power panel "+instr_name);
					}
					utils.instr_cmd_done( instr );
				}
		);
	});
});

//
// GET switch_status query.
//
router.get('/power_status/:instr_name', function(req, res) {
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(req,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "ERROR: power panel \'"+instr_name+"\' unknown.");
		return;
	}
	if (debug_power) {
		console.log("POWER: Incoming power panel status request");
	}
	var url = instr.address;
	var cmd = "stat";

	utils.queue_instr_cmd( instr, function () {
		if (debug_power) {
			console.log("POWER: Sending "+cmd+" command from server");
		}
		request.get(
			'http://' + url,
			{ headers: { 'suth-cmd': cmd },
			  json: true,
			  timeout: 5000
			},
			function (error, response, body) {
				if (!error && response.statusCode == 200) {
					if (debug_power) {
						console.log("POWER: Got "+cmd+" response in server");
					}
					res.json( body );
				} else {
					utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to power panel "+instr_name);
				}
				utils.instr_cmd_done( instr );
			}
		);
	}, res); // Sending res says "Don't do this if there's something already queued."
});



/*
 * GET power_main.
 */
router.get('/power_main/:instr_name', function(req, res) {
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(req,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "power panel \'"+instr_name+"\' unknown.");
		return;
	}
	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/power.c.js" );
	d.instr_name = instr_name;
	d.switch_rows = [
					{cols: [{i:0, l:"Power Head #1"},  {i:1, l:"Power Head #2"}]},
					{cols: [{i:2, l:"Return"},         {i:3, l:"Skimmer"}]},
					{cols: [{i:4, l:"Stand Light"},    {i:5, l:"Reactor"}]},
					{cols: [{i:6, l:"(unused)"},      {i:7, l:"(unused)"}]}
				 ];
	res.locals.session = req.session;
	res.render("power_main", d );
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
	name: "power",
	instrs: [ 
	  {
		name: "power",
		label: "Power Panel",
		main_page: "power_main",
		widget_page: "power_widget",
		status_cmd: "stat",
		status_route: "power_status",
		init_session: init_session,
		init_widget_data : init_widget_data
	  }
	]
};
