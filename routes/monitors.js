var express = require('express');
var router = express.Router();

var debug_monitors = 1;

/*
 * POST a command for a monitor
 */
router.post('/monitor_cmd/:system/:monitor/:arg1?/:arg2?/:arg3?/:arg4?', function(req, res) {

	var session = req.session;
	var utils = req.utils;
	var system = req.params.system;
	var monitor = req.params.monitor;

	if (debug_monitors) {
		console.log("MONITORS: Incoming command: "+system+":"+monitor);
	}


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
	res.send({});
});


/*
 * GET monitors.
 */
router.get('/monitors/:system_name/', function(req, res) {
	var session = req.session;
	var utils = req.utils;

	var system = req.params.system;

	if (debug_monitors) {
		console.log("MONITORS: get : "+system);
	}

	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/monitors.c.js" );
	d.system_name = monitor_name;
	res.render("monitors", d );
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
