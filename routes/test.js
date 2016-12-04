var express = require('express');
var router = express.Router();
var request = require('request');

/*
 * GET test1.
 */
router.get('/test1', function(req, res) {
console.log("In test1 get\n");
	var d = { title: 'test1' };
	res.locals.session = req.session;
	res.render('test1', { d: d } );
});

/*
 * POST to fixture.
 */
router.post('/fixture/:cmd', function(req, res) {

    var cmd = req.params.cmd;
	var url = req.urls['fixture'];
	switch (cmd) {
		case 'up':
		case 'down':
			cmd += " 1 10";
			break;
	}
	request.post(
			'http://' + url,
			{ headers: { 'suth-cmd': cmd },
			  json: true 
			},
			function (error, response, body) {
				if (!error && response.statusCode == 200) {
					res.send( { msg: '', body: body } );
				} else {
					res.send( { errorCode: 500, msg: "Something went wrong?" } );
				}
			}
	);
});

module.exports = router;
