var express = require('express');
var router = express.Router();
var request = require('request');


function init_session( session )
{
}

module.exports = {
	router: router,
	descr:  {
		name: "probes",
		label: "Probes (pH, temp, etc)",
		main_page: "probes_main",
		widget_page: "probes_widget",
		init_session: init_session,
	}
};
