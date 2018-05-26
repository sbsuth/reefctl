var express = require('express');
var router = express.Router();
var request = require('request');
var login = require('./login')

/*
 * GET dashboard.
 */
router.get('/dashboard', login.validateUser, function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var widgets = [];
	session.instruments.forEach( function(instr) {
		var mod = utils.get_instr_mod(instr.type);
		if (mod.widget_page != undefined) {
			var mod = utils.get_instr_mod(instr.type);
			var widget_data = {
				instr : instr,
				status_key: instr.address + ";" + mod.status_cmd + ";" + mod.status_route,
				widget_body: mod.widget_page,
				details_page: mod.main_page + "/" + instr.name
			};
			mod.init_widget_data( req, instr, widget_data );
			widgets.push( widget_data );
		}
	});
	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/dashboard.c.js" );
	d.title = 'dashboard';
	d.widgets = widgets;
	res.locals.session = req.session;
	res.render('dashboard', d );
});

function init_session( req )
{
}

module.exports = {
	router: router,
	descr:  {
		name: "dahboard",
		label: "Dashboard",
		init_session: init_session,
	}
};
