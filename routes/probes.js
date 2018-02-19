var express = require('express');
var router = express.Router();
var request = require('request');


function init_session( req )
{
}

// Add fields to 'widget' for the given instr to support the widget just template.
function init_widget_data( req, instr, widget )
{
}


module.exports = {
	router: router,
	descr:  {
		name: "probes",
		label: "Probes (pH, temp, etc)",
		main_page: "probes_main",
		widget_page: "probes_widget",
		status_cmd: "stat",
		init_session: init_session,
		init_widget_data: init_widget_data
	}
};
