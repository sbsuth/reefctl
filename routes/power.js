var express = require('express');
var router = express.Router();
var login = require('./login')

var debug_power = 1;

/*
 * POST a command to the panel.
 */
router.post('/power_cmd/:cmd/:instr_name/:unit?', function(req, res) {

	var session = req.session;
	var utils = req.utils;
    var cmd = req.params.cmd;
	var instr_name = req.params.instr_name;
	var unit = req.params.unit;
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "power panel \'"+instr_name+"\' unknown.");
		return;
	}
	if ((unit != undefined) && (unit >= 0)) {
		cmd += " " +unit;
	}
	var url = instr.address;
	if (debug_power) {
		console.log("POWER: Incoming command: "+cmd);
	}
	utils.queue_and_send_instr_cmd( instr, cmd, 0,
		function(body) { // Success
			if (debug_power) {
				console.log("POWER: Got "+cmd+" response in server");
			}
			res.send( { msg: '', body: body } );
		},
		function(error) { // Error
			utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to stand "+instr_name+": "+error);
		}
	);
});

//
// GET switch_status query.
//
router.get('/power_status/:instr_name/:fuse', function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var fuse = req.params.fuse;
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "ERROR: power panel \'"+instr_name+"\' unknown.");
		return;
	}
	if (debug_power) {
		console.log("POWER: Incoming power panel status request");
	}
	var url = instr.address;
	var cmd = "stat";

	utils.queue_and_send_instr_cmd( instr, cmd, fuse,
		function(body) { // Success
			if (debug_power) {
				console.log("POWER: Got "+cmd+" response in server: '"+body+"'");
			}
			res.send( body );
		},
		function(error) { // Error
			utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to stand "+instr_name+": "+error);
		}
	    , res); // Sending res says "Don't do this if there's something already queued."
});



/*
 * GET power_main.
 */
router.get('/power_main/:instr_name', login.validateUser, function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "power panel \'"+instr_name+"\' unknown.");
		return;
	}
	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/power.c.js" );
	d.instr_name = instr_name;
	d.switch_rows = [
					{cols: [{i:0, l:"Power Head #1"},	{i:1, l:"Power Head #2"}]},
					{cols: [{i:2, l:"Return"},			{i:3, l:"Skimmer"}]},
					{cols: [{i:4, l:"Wall Fan"},		{i:5, l:"Gyre"}]},
					{cols: [{i:6, l:"(unused)"},		{i:7, l:"Fuge Light"}]}
				 ];
	res.render("power_main", d );
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
	name: "power",
	handle_status: handle_status,
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
