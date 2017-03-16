var express = require('express');
var router = express.Router();
var request = require('request');

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
	d.load_javascript.push( "/js/power.js" );
	d.instr_name = instr_name;
	res.locals.session = req.session;
	res.render("power_main", d );
});


function init_session( session )
{
}

module.exports = {
	router: router,
	descr:  {
		name: "power",
		label: "Power Panel",
		main_page: "power_main",
		widget_page: "power_widget",
		init_session: init_session,
	}
};
