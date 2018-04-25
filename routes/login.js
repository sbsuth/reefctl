var express = require('express');
var router = express.Router();
var request = require('request');
var bodyParser = require('body-parser');
var SHA256 = require("crypto-js/sha256");

var urlencodedParser = bodyParser.urlencoded({ extended: false });
var jsonParser = bodyParser.json();

function loginPrompt( req, res, msg, username, target_url ) {
	var utils = req.utils;
	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/crypto-js.js");
	d.load_javascript.push( "/js/login.c.js" );
	d.msg = msg ? msg : "";
	d.username = username ? username : "";
	d.target_url = target_url ? target_url : req.originalUrl;
	res.locals.session = req.session;
	res.render("login", d );
}

/*
 * GET login.
 */
router.get('/login', function(req, res) {
	loginPrompt( req, res );
});

/*
 * POST login.
 */
router.post('/login', function(req, res) {

	var username = req.body.username;
	var password = req.body.password;
	var target_url = req.body.target_url;
	req.db.get('users').find({username: username}).then( (doc) => {
		var msg = undefined;
		if (doc.length != 1) {
			msg = "Unrecognized username "+username;
		} else {
			// The password is hashed on the client, and we hash it again
			// before storing, so hash before comparing.
			var hashed = SHA256(password);
			if (doc[0].password != hashed) {
				msg = "Bad password.  Try again.";
			} else {
				req.session.user = username;
				var url = (target_url && (target_url != "/login")) ? target_url : "/dashboard";
				res.redirect( url);
			}
		}
		if (msg != undefined) {
			loginPrompt( req, res, msg, username, target_url );
		}
    });

});

function validateUser( req, res, next ) {

	// If there's no user field in the session, put up the login box.
	if (req.session.user == undefined) {
		loginPrompt( req, res );
	} else {
		next();
	}
}

module.exports = {
	router: router,
	validateUser: validateUser
};
