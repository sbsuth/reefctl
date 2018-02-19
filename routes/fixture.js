var express = require('express');
var router = express.Router();
var request = require('request');

var debug_fixture = 1;

/*
 * POST a command to the fixture.
 */
router.post('/fixture_cmd/:cmd/:instr_name', function(req, res) {

	var utils = req.utils;
    var cmd = req.params.cmd;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(req,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "fixture instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var url = instr.address;
	switch (cmd) {
		case 'up':
		case 'down':
			cmd += " 10";
			break;
	}
	if (debug_fixture) {
		console.log("FIXTURE: Incoming command: "+cmd);
	}
	utils.queue_instr_cmd( instr, function () {
		if (debug_fixture) {
			console.log("FIXTURE: Sending "+cmd+" command from server");
		}
		utils.send_instr_cmd( instr, cmd,
			function(body) { // Success
				if (debug_fixture) {
					console.log("FIXTURE: Got "+cmd+" response in server");
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
// GET fixture_height query.
//
router.get('/fixture_height/:instr_name', function(req, res) {
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(req,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "ERROR: fixture instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var url = instr.address;
	var cmd = "gh";

	if (debug_fixture) {
		console.log("FIXTURE: Incoming fixture height");
	}
	utils.queue_instr_cmd( instr, function () {
		if (debug_fixture) {
			console.log("FIXTURE: Sending "+cmd+" command from server");
		}
		utils.send_instr_cmd( instr, cmd,
			function(body) { // Success
				if (debug_fixture) {
					console.log("FIXTURE: Got "+cmd+" response in server");
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
 * GET fixture_main.
 */
router.get('/fixture_main/:instr_name', function(req, res) {
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(req,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "fixture instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/fixture.c.js" );
	d.instr_name = instr_name;
	res.locals.session = req.session;
	res.render("fixture_main", d );
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
	name: "fixture",
	instrs: [ 
	  {
		name: "fixture",
		label: "Lighting fixture",
		main_page: "fixture_main",
		widget_page: "fixture_widget",
		status_cmd: "gh",
		status_route: "fixture_height",
		init_session: init_session,
		init_widget_data: init_widget_data
	  }
	]
};
