var express = require('express');
var router = express.Router();
var login = require('./login')

var debug_chart = 1;

/*
 * GET charts.
 */
router.get('/charts/:system_name/', login.validateUser, function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/moment.js" );
	d.load_javascript.push( "/js/Chart.min.js" );
	d.load_javascript.push( "/js/charts.c.js" );

	d.system_name = session.system_name;

	d.charts = [
		{	label:	"pH",
			field:  "pH",
			collection: "log_data",
			type:	"real",
			mav_len: 150
		},
		{	label:	"Temperature",
			field:  "temp",
			collection: "log_data",
			type:	"real",
			mav_len: 30
		},
		{	label:	"Salinity",
			field:  "salinity",
			collection: "log_data",
			type:	"real",
			mav_len: 0
		},
		{	label:	"Salt Reservoir Level",
			field:  "salt_res",
			collection: "log_data",
			type:	"int",
			mav_len: 40
		},
	];

	res.render("charts_main", d );
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
	var startId = utils.mongo_id_for_time(startDate);
	var endId = utils.mongo_id_for_time(endDate);
	var log_data = utils.db.get("log_data");
	log_data.find( {system: system_name,
					_id: {$gt: startId, $lt: endId}
				    }, {}, function( err, data_objs ) {
		if (data_objs && data_objs.length && !err) {
			var rslt = {data: data_objs};
			res.send( rslt );
		} else {
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
