var express = require('express');
var router = express.Router();
var request = require('request');


/*
 * GET login.
 */
router.get('/login', function(req, res) {
	var utils = req.utils;
	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/login.c.js" );
	res.locals.session = req.session;
	res.render("login", d );
});

module.exports = router;
