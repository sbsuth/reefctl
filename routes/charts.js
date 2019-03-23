var express = require('express');
var router = express.Router();
var login = require('./login')

var debug_chart = 1;

/*
 * GET chart data.
 */
router.get('/chart/:system_name/', login.validateUser, function(req, res) {
	var session = req.session;
	var system_name = req.params.system_name;
	var utils = req.utils;

	if (debug_chart) {
		console.log("CHARTS: get : "+system_name);
	}

	utils.send_error( res, "No char page yet!);
});

//
// GET chart_data query.
//
router.get('/chart_data/:system_name/:option?', function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var system_name = req.params.system_name;
	if (debug_chart) {
		console.log("CHARTS: Incoming chart_data");
	}

	var log_data = this.db.get("log_data");
	log_data.find( {system: system_name
				    }, {}, function( err, data_objs ) {
		if (data_objs && data_objs.length && !err) {
			var rslt = {data: data_objs};
			res.send( rslt );
		} else {
			var rslt = {data: data_objs};
			res.send( rslt );
		}
	});
});


function objectIdWithTimestamp(timestamp) {
    // Convert string date to Date object (otherwise assume timestamp is a date)
    if (typeof(timestamp) == 'string') {
        timestamp = new Date(timestamp);
    }

    // Convert date object to hex seconds since Unix epoch
    var hexSeconds = Math.floor(timestamp/1000).toString(16);

    // Create an ObjectId with that hex timestamp
    var constructedObjectId = ObjectId(hexSeconds + "0000000000000000");

    return constructedObjectId
}

function getData(utils) {

	var startDate = new Date("August 16, 2018 20:30:00");
	var endDate = new Date(startDate.getTime()+(30*1000*60));
	var start = objectIdWithTimestamp(startDate);
	var end = objectIdWithTimestamp(endDate);
	utils.db.getCollection('unit_check').find({address: /\.7:/, _id: {$gt: start, $lt: end}})
}

router.get('/unit_check/:system_name/', login.validateUser, function(req, res) {
	var session = req.session;
	var system_name = req.params.system_name;
	var utils = req.utils;

	if (debug_chart) {
		console.log("UNIT_CHECK: get : "+system_name);
	}

	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/Chart.min.js" );
	d.load_javascript.push( "/js/unit_check.c.js" );
	d.system_name = system_name;
	res.render("unit_check", d );
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
