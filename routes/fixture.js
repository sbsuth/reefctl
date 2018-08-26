var express = require('express');
var router = express.Router();
var request = require('request');
var login = require('./login')

var debug_fixture = 1;

/*
 * POST a command to the fixture.
 */
router.post('/fixture_cmd/:cmd/:instr_name/:arg1?/:arg2?/:arg3?/:arg4?/:arg5?', function(req, res) {

try {
	var session = req.session;
	var utils = req.utils;
    var cmd = req.params.cmd;
    var arg1 = req.params.arg1;
    var arg2 = req.params.arg2;
    var arg3 = req.params.arg3;
    var arg4 = req.params.arg4;
    var arg5 = req.params.arg5;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "fixture instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var url = instr.address;
	switch (cmd) {
		case 'up':
		case 'down':
			cmd += " 10";
			break;
		case 'sloc':
			var lat = parseFloat(arg1);
			var lon = parseFloat(arg2);
			var tz = parseInt(arg3);
			if ((lat == NaN) || (lon == NaN) || (tz == NaN)) {	
				utils.send_error( res, "ERROR: Bad args for "+cmd+" cmd: lat="+lat+", lon="+lon+", tz="+tz);
				return;
			}
			cmd += " " + lat.toFixed(6);
			cmd += " " + lon.toFixed(6);
			cmd += " " + tz;
			break;
		case 'spct':
			var spec = parseInt(arg1);
			var ichan = parseInt(arg2);
			var pct = parseInt(arg3);
			if ((spec == NaN) || (spec > 1) || (spec < 0) || (ichan == NaN) || (pct == NaN) || (ichan < 0) || (ichan > 11) || (pct < 0) || (pct > 100)) {	
				utils.send_error( res, "ERROR: Bad args for "+cmd+" cmd: spec="+spec+", ichan="+ichan+", pct="+pct);
				return;
			}
			cmd += " " + spec;
			cmd += " " + ichan;
			cmd += " " + pct;
			break;
		case 'spcta':
		case 'spctb':
		case 'spctc':
			var spec = parseInt(arg1);
			var pcts = [parseInt(arg2),parseInt(arg3),parseInt(arg4),parseInt(arg5)];
			if ((spec == NaN) || (spec > 1)) {
				utils.send_error( res, "ERROR: Bad args for "+cmd+" cmd: spec="+spec);
				return;
			}
			cmd += " " + spec;
			for ( var i=0; i < 4; i++ ) {
				if ((pcts[i] < 0) || (pcts[i] > 100)) {
					utils.send_error( res, "ERROR: Bad args for "+cmd+" cmd: pct="+pcts[i]);
					return;
				}
				cmd += " " + pcts[i];
			}
			break;
		case 'sday':
			var sr = parseInt(arg1);
			var per = parseInt(arg2);
			if ((sr == NaN) || (per == NaN)) {	
				utils.send_error( res, "ERROR: Bad args for "+cmd+" cmd: sr="+sr+", per="+per);
				return;
			}
			cmd += " " + sr;
			cmd += " " + per;
			break;
		case 'slev':
			var lowPct = parseInt(arg1);
			var highPct = parseInt(arg2);
			var factor = parseFloat(arg3);
			if ((factor == NaN) || (highPct == NaN) || (highPct < 0) || (highPct > 100) || (lowPct == NaN) || (lowPct < 0) || (lowPct > 100)) {	
				utils.send_error( res, "ERROR: Bad args for "+cmd+" cmd: lowPct="+lowPct+", highPct="+highPct+", factor="+factor);
				return;
			}
			cmd += " " + lowPct;
			cmd += " " + highPct;
			cmd += " " + factor.toFixed(2);
			break;
		case 'mode':
			var mode = parseInt(arg1);
			if ((mode == NaN) || (mode < 0)) {
				utils.send_error( res, "ERROR: Bad args for "+cmd+" cmd: mode="+mode);
				return;
			}
			cmd += " " + mode;
			break;
		case 'spec':
			var spec = parseInt(arg1);
			if ((spec == NaN) || (spec < 0) || (spec > 1)) {
				utils.send_error( res, "ERROR: Bad args for "+cmd+" cmd: spec="+spec);
				return;
			}
			cmd += " " + spec;
			break;
		case 'sset':
			break;
		case 'rset':
			break;
	}
	if (debug_fixture) {
		console.log("FIXTURE: Incoming command: "+cmd);
	}
	utils.queue_and_send_instr_cmd( instr, cmd, 0,
		function(body) { // Success
			if (debug_fixture) {
				console.log("FIXTURE: Got "+cmd+" response in server");
			}
			res.send( { msg: '', body: body } );
		},
		function(error) { // Error
			utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to stand "+instr_name+": "+error);
		}
	);
} catch (err) {
	console.log("CATCH: fixture_cmd: "+err);
}
});

//
// GET fixture query.
//
router.get('/fixture_query/:cmd/:instr_name/:fuse/:arg1?', function(req, res) {
	var utils = req.utils;
	var session = req.session;
	var instr_name = req.params.instr_name;
	var fuse = req.params.fuse;
	var arg1 = req.params.arg1;
try {
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
    var cmd = req.params.cmd;
	if (instr === undefined) {
		utils.send_error( res, "ERROR: fixture instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var url = instr.address;

	if (arg1 != undefined) {
		cmd += " " + arg1;
	}

	if (debug_fixture) {
		console.log("FIXTURE: Incoming fixture query: "+cmd);
	}
	utils.queue_and_send_instr_cmd( instr,  cmd, fuse,
		function(body) { // Success
			if (debug_fixture) {
				console.log("FIXTURE: Got "+cmd+" response in server");
			}
			res.send( body );
		},
		function(error) { // Error
			utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to stand "+instr_name+": "+error);
		},
		res); // Sending res says "Don't do this if there's something already queued."

} catch (err) {
	console.log("CATCH: fixture_query: "+err);
}
});

//
// GET dump_day
//
router.get('/dump_day/:instr_name/:points', function(req, res) {
try {
	var session = req.session;
	var utils = req.utils;
	var instr_name = req.params.instr_name;
    var points = req.params.points;
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "ERROR: fixture instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var url = instr.address;
	
	var cmd = "dday";
	var npoints = parseInt(points);
	if (npoints == NaN) {
		points = 24;
	}
	cmd += " "+points;
		

	if (debug_fixture) {
		console.log("FIXTURE: Incoming dump_day command: "+cmd);
	}
	utils.queue_and_send_instr_cmd( instr, cmd, 0,
		function(body) { // Success
			if (debug_fixture) {
				console.log("FIXTURE: Got "+cmd+" response in server");
			}
			res.send( body );
		},
		function(error) { // Error
			utils.send_error( res, "ERROR: sending command \'"+cmd+"\' to stand "+instr_name+": "+error);
		},
		res); // Sending res says "Don't do this if there's something already queued."
} catch (err) {
	console.log("CATCH: dump_day: "+err);
}
});



/*
 * GET fixture_main.
 */
router.get('/fixture_main/:instr_name', login.validateUser, function(req, res) {
	var session = req.session;
	var utils = req.utils;
	var instr_name = req.params.instr_name;
	var instr = utils.get_instr_by_name(session.instruments,instr_name);
	if (instr === undefined) {
		utils.send_error( res, "fixture instrument \'"+instr_name+"\' unknown.");
		return;
	}
	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/fixture.c.js" );
	d.instr_name = instr_name;
	d.channels = [
				  {
					index: 0,
					id: 6,
					name: "white",
					label: "White"
				  },
				  {
					index: 1,
					id: 5,
					name: "violet",
					label: "Violet"
				  },
				  {
					index: 2,
					id: 4,
					name: "royal",
					label: "Royal"
				  },
				  {
					index: 3,
					id: 3,
					name: "blue",
					label: "Blue"
				  },
				  {
					index: 4,
					id: 7,
					name: "cyan",
					label: "Cyan"
				  },
				  {
					index: 5,
					id: 0,
					name: "amber",
					label: "Amber"
				  },
				  {
					index: 6,
					id: 1,
					name: "red",
					label: "Red"
				  },
				  {
					index: 7,
					id: 11,
					name: "strip",
					label: "Strip"
				  }
				 ];
	res.render("fixture_main", d );
});

function init_session( req )
{
}

// Add fields to 'widget' for the given instr to support the widget just template.
function init_widget_data( req, instr, widget )
{
}

// called when the background status query gets a result for this instrument.
function handle_status( addr, cmd, status )
{
}


module.exports = {
	router: router,
	name: "fixture",
	handle_status: handle_status,
	instrs: [ 
	  {
		name: "fixture",
		label: "Lighting fixture",
		main_page: "fixture_main",
		widget_page: "fixture_widget",
		status_cmd: "stat",
		status_route: "fixture_query/stat",
		init_session: init_session,
		init_widget_data: init_widget_data
	  }
	]
};
