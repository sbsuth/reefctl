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

	utils.send_error( res, "No char page yet!");
});

//
// GET chart_data query.
//
router.get('/chart_data/:system_name/:start/:end', function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var system_name = req.params.system_name;
	var start = req.params.start;
	var end = req.params.end;
	if (debug_chart) {
		console.log("CHARTS: Incoming chart_data");
	}
try {
	var startDate = new Date( parseInt(start) );
	var endDate = new Date( parseInt(end) );

//startDate = new Date( 2019, 2, 22, 22, 0, 0, 0 );
//endDate = new Date( 2019, 2, 22, 23, 59, 59, 0 );
	var startId = utils.mongo_id_for_time(startDate);
	var endId = utils.mongo_id_for_time(endDate);

	var log_data = utils.db.get("log_data");
	log_data.find( {system: system_name,
					_id: {$gt: startId, $lt: endId}
				    }, {}, function( err, data_objs ) {
		if (data_objs && data_objs.length && !err) {
			var rslt = {data: data_objs};
console.log("HEY: Got "+data_objs.length+" data");
			res.send( rslt );
		} else {
console.log("HEY: Got no data");
			var rslt = {data: data_objs};
			res.send( rslt );
		}
	});
} catch (err) {
	console.log("CATCH: chart_data: "+err);
	res.send( {error: err} );
}
});


function getData(utils) {

	var startDate = new Date("August 16, 2018 20:30:00");
	var endDate = new Date(startDate.getTime()+(30*1000*60));
	var start = utils.mongo_id_for_time(startDate);
	var end = utils.mongo_id_for_time(endDate);
	utils.db.getCollection('unit_check').find({address: /\.7:/, _id: {$gt: start, $lt: end}})
}


function init_session( req )
{
}

// Add fields to 'widget' for the given instr to support the widget just template.
function init_widget_data( req, instr, widget )
{
}


module.exports = {
	router: router,
	name: "charts",
};
