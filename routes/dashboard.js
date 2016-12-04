var express = require('express');
var router = express.Router();
var request = require('request');

/*
 * GET dashboard.
 */
router.get('/dashboard', function(req, res) {
	var utils = req.utils;
	var widgets = [];
	req.instruments.forEach( function(instr) {
		widgets.push( {
			name: instr.session.name,
			widget_body: instr.module.widget_page
		});
	});
	var d = utils.get_master_template_data(req);
	d.title = 'dashboard';
	d.widgets = widgets;
	res.locals.session = req.session;
	res.render('dashboard', d );
});

/*
 * GET instr_details.
 * Use the instrument name to load up its description, then render its main page.
 */
router.get('/instr_details/:instr_name', function(req, res) {
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(req,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "Instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var d = utils.get_master_template_data(req);
	res.locals.session = req.session;
	res.redirect("/"+instr.module.main_page+"/"+instr_name );
});


module.exports = router;
