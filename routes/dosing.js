var express = require('express');
var router = express.Router();
var login = require('./login')

var debug_dosing = 1;

/*
 * POST a command to the dosing.
 */
router.post('/dosing_cmd/:cmd/:instr_name/:arg1?/:arg2?/:arg3?/:arg4?', function(req, res) {

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
		utils.send_error( res, "dosing \'"+instr_name+"\' unknown.");
		return;
	}
	if (debug_dosing) {
		console.log("DOSING: Incoming command: "+cmd);
	}

	utils.queue_and_send_instr_cmd( instr, cmd, 0,
		function(body) { // Success
			if (debug_dosing) {
				console.log("DOSING: Got "+cmd+" response in server:"+JSON.stringify(body));
			}
			res.send( { msg: '', body: body } );
		},
		function(error) { // Error
			utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to dosing "+instr_name+": "+error);
		}
	);
});

//
// GET dosing_status query.
//
router.get('/dosing_status/:instr_name/:fuse/:option?', function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var fuse = req.params.fuse;
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "ERROR: dosing instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var cmd = "stat";

	if (debug_dosing) {
		console.log("DOSING: Incoming dosing status");
	}
	utils.queue_and_send_instr_cmd( instr, cmd, fuse,
		function(body) { // Success
			if (debug_dosing) {
				console.log("DOSING: Got "+cmd+" response in server:"+JSON.stringify(body));
			}
			res.send( body );
		},
		function(error) { // Error
			utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to dosing "+instr_name+": "+error);
		}, 
		res); // Sending res says "Don't do this if there's something already queued."
});


function init_session( req )
{
}

// Add fields to 'widget' for the given instr to support the widget just template.
function init_widget_data( req, instr, widget )
{
}

// called when the background status query gets a result for this instrument.
function handle_status( addr, cmd, status )
{
}


module.exports = {
	router: router,
	name: "dosing",
	handle_status: handle_status,
	instrs: [
	  { name: "salt_res", 
		label: "Saltwater Reservoir",
		main_page: undefined,
		widget_page: undefined,
		status_cmd: "stat",
		status_route: "dosing_status",
		init_session: init_session,
		init_widget_data: init_widget_data
	  },
	  { name: "dosing", 
		label: "Dosing Pumps",
		main_page: undefined,
		widget_page: undefined,
		status_cmd: "stat",
		status_route: "dosing_status",
		init_session: init_session,
		init_widget_data: init_widget_data
	  }
	]
};
