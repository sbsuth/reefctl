var request = require('request');
var net = require('net');

// File-scoped variables.
var dust = 0;
var indirect_template_cache = [];

// Dust helper 'partial_indirect'
// Expects a parameter named 'target' that gives the name of a value from the
// context that is a template name to load.
// For example:
//  context:
//    { widget_body: "my_widget_body" }
//  template:
//    {@partial_indirect target="widget_body"/}
//
// Any additional parameters specified are added to the context while evaluating
// the template.
//  
// will load a partial named my_widget_body.
// This gets around a limitation against using a value from the context
// in a partial name.  What I'd really like to do is simply:
//     {>{widget_body} /}
// but this is a working substitute.
//
function partial_indirect_helper(chunk, context, bodies, params) {

	 var target_name = params["target"];
	 if (target_name === undefined) {
		console.log("ERROR: partial_indirect: \'target_name\' not defined as a parameter\n");
		return bodies.block( chunk, context );
	 }
	 var target = context.get(target_name,true);
	 if (target === undefined) {
		console.log("ERROR: partial_indirect: target \'"+target_name+"\' not defined in context\n");
		return bodies.block( chunk, context );
	 }
	 var str = "{>"+target+" /}";
	 var tmpl = indirect_template_cache[target];
	 if (!tmpl) {
		 var compiled = dust.compile(str);
		 tmpl = dust.loadSource(compiled);
		 indirect_template_cache[target] = tmpl;
	}
	return tmpl( chunk, context.push(params) );
}

// Instrument route names: one per file containing routes.
var instr_route_names = [
	"fixture",
	"power",
	"stand",
];
var instr_routes = [];

// Instrument module names: one per kind of instrument.
var instr_mod_names = [];
var instr_mods = [];

// Monitors
var monitors = {};

function load_instr_mods()
{
	for ( i=0; i < instr_route_names.length; i++ ) {
		var name = instr_route_names[i];
		var mod = require('./routes/'+name);
		instr_routes[name] = mod;
	}
}

function setup_instr_routes( app )
{
	for ( i=0; i < instr_route_names.length; i++ ) {
		var name = instr_route_names[i];
		var mod = instr_routes[name];
		app.use('/', mod.router);

		// Collect the instr_mods from the instrs arrays in the module.
		for ( j=0; j < mod.instrs.length; j++ ) {
			var instr = mod.instrs[j];
			instr_mods[instr.name] = instr;
		}
	}
}

// Given a module kind, returns a module description.
function get_instr_mod( kind )
{
	var mod = instr_mods[kind];
	if (mod === undefined) {
		return undefined;
	} else {
		return mod;
	}
}

// Gets the first instrument of the given type
function get_instr_by_type( instrs, type ) 
{
	for ( var i=0; i < instrs.length; i++ ) {
		if (instrs[i].type == type)
			return instrs[i];
	}
	return undefined;
}


function get_instr_by_name( instrs, instr_name )
{
	var i;
	for ( i=0; i < instrs.length; i++ ) {
		var instr = instrs[i];
		if (instr.name === instr_name) {
			return instr;
		}
	}
	return undefined;
}

function get_instr_info( instr_mod, session, db )
{
}

function save_instr_info()
{
}

// The default set of instruments in the system.
// This info would be stored in a database, and read based on 
// user login, and system selection, but while I've got only
// one, this is fine.
var default_instruments = [
	{ name: 'main_fixture',
	  type: 'fixture',
	  label: "Light Fixture",
	  address: "10.10.2.4:1000"
	},
	{ name: 'main_power',
	  type: 'power',
	  label: 'Power Panel',
	  address: "10.10.2.5:1000"
	},
	{ name: 'temp_control',
	  type: 'temp',
	  label: "Temperature Controller",
	  address: "10.10.2.7:1000"
	},
	{ name: 'probes',
	  type: 'probes',
	  label: "pH and EC Probes",
	  address: "10.10.2.7:1000"
	},
	{ name: 'powerheads',
	  type: 'powerheads',
	  label: "Powerheads",
	  address: "10.10.2.7:1000"
	},
	{ name: 'sump',
	  type: 'sump_level',
	  label: "Sump Level",
	  address: "10.10.2.7:1000"
	},
	{ name: 'ro_res',
	  type: 'ro_res',
	  label: "RO Reservoir",
	  address: "10.10.2.6:1000"
	},
	{ name: 'salt_res',
	  type: 'salt_res',
	  label: "Saltwater Reservoir",
	  address: "10.10.2.8:1000"
	},
	{ name: 'dosing',
	  type: 'dosing',
	  label: "Dosing Pumps",
	  address: "10.10.2.8:1000"
	},
];

// Step 2 in session setup: get instruments for user's system.
// Users have an array of systems, and we read the instruments from the DB
// for the system, given its name.
function init_session_instruments( req, next )
{
}

// Called from an early filter to initialize the session.
// Initializes the data in the session if its not already initialized.
// This includes the definition of the instruments in the currently
// selected system.  
// INCOMPLETE: The "system" is hard-coded now.
function init_session( req, next )
{
	var session = req.session;
	if (session.user != undefined && (session.instruments == undefined )) {
		// Lookup in the system by session.system_name, which should be set when user is set during login.
		var systems = req.db.get('systems');
		systems.find( {name: session.system_name} ).then( (docs) => {
			if (docs.length > 0) {
				session.instruments = docs[0].instruments;

				// Allow each module to intialize its instruments.
				var i;
				for ( i=0; i < session.instruments.length; i++ ) {
					var instr = session.instruments[i];
					instr.mod = get_instr_mod(instr.type);
					get_instr_mod(instr.type).init_session(req);
				}
			}
			next();
		});
	} else {
		next();
	}


	//session.instruments = default_instruments; // HARD CODED!

}

// Clear out the session when logging out.
function clear_session( session )
{
	session.user = undefined;
	session.instruments = undefined;
}

// Fill an object with the basic info needed from the session
// for the master template.
function get_master_template_data( req ) {

	// Shutdown encoding:
	// option[1:0] : main
	// option[3:2] : ph
	//
	//  0 : unset
	//  1 : cancel
	//  2 : off
	//  3 : half
	//  4 : full

	var d = { session: req.session,
			  instruments: req.session.instruments,
			  load_javascript: [],
			  shutdowns: [
				{ label: "All off, 1 min",
				  duration: 1,
				  options: (2 << 3) | 2
				},
				{ label: "Pumps off, PH half, 1 min",
				  duration: 1,
				  options: (3 << 3) | 2
				},
				{ label: "Pumps off, PH full, 5 min",
				  duration: 5,
				  options: (3 << 4) | 2
				},
				{ label: "All off, 5 min",
				  duration: 5,
				  options: (2 << 3) | 2
				},
				{ label: "Pumps off, PH half, 5 min",
				  duration: 5,
				  options: (3 << 3) | 2
				},
				{ label: "Cancel",
				  duration: 0,
				  options: (1 << 3) | 1
				},
			  ]
			};
	return d;
}

function send_error( res, msg ) 
{
	console.log( "ERROR returned: \'"+msg+"\'");
    res.send({
      message: msg,
      msg: msg,
      error: 400
    });
}

function json_resp_header() {
	var header = "HTTP/1.1 200 OK\r\n";
	header += "Content-Type: application/jsonrequest\r\n";
	header += "Content-Length: ";
	return header;
}

function http_wrap (msg) {
	var jmsg = json_resp_header() + msg.length + "\r\n\r\n" + msg;
	return jmsg;
}

// Persistent array of queues.
// Indexed by URL.
// Each queue is an array of functions.
var instr_cmd_queue = [];
var debug_queue = 2;

function queue_instr_cmd( instr, func, res )
{
	var url = instr.address;
	var queue = instr_cmd_queue[url];
	if (queue === undefined) {
		queue = [];
		instr_cmd_queue[url] = queue;
	}

	if ((res !== undefined) && (queue.length > 0)) {
		// If given a response when the queue is not empty, respond with 
		// code 429 : Too Many Requests.
		if (debug_queue) {
			console.log("QUEUE: Returning 429 because busy");
		}
		res.send({
		  message: "Instrument " + instr.name + " is busy.",
		  error: 429
		});
		return;
	}

	queue.push( func );
	if (queue.length == 1) {
		if (debug_queue) {
			console.log("QUEUE: Executing command immediately for " + instr.name);
		}
		func();
	} else {
		// Return, expecting that the next function on the queue
		// to return will call inst_cmd_done().
		if (debug_queue) {
			console.log("QUEUE: Queing command for " + instr.name);
		}
	}
}

// A queued command has completed.
// Remove it from the head of the queue, and call any next command.
function instr_cmd_done( instr )
{
	var url = instr.address;
	var queue = instr_cmd_queue[url];
	queue.shift();
	if (debug_queue) {
		console.log("QUEUE: command done.  "+queue.length+" commands left for "+instr.name);
	}
	if (queue.length > 0) {
		if (debug_queue) {
			console.log("QUEUE: Executing cmd off queue for "+instr.name);
		}
		queue[0]();
	}
}

function send_instr_cmd_http( instr, cmd, successFunc, failureFunc ) 
{
	var url = instr.address;
	request.post(
			'http://' + url,
			{ headers: { 'suth-cmd': cmd },
			  json: true,
			  timeout: 5000
			},
			function (error, response, body) {
				if (!error && response.statusCode == 200) {
					successFunc(body);
				} else {
					failureFunc(error);
				}
				instr_cmd_done( instr );
			}
	);
}

// Parses a reply with a leading length.
// Returns true if it is "complete" which is either when
// A content length has been read, and that many bytes have
// been read after the header. 
// Either "Content-Length: " or "CL: " are supported.
function parseFixedLengthReply( state, str ) 
{
	// We make assumptions based on what we know the instruments
	// may return:
	//  - May or may not have an HTTP header.
	//  - Content length is either Content-Length: or CL:.
	//  - A blank line \r\n follows the Content-Length field.
	//  - Payload is expeceted to be JSON, and is parsed.
	var complete = false;
	var pos = 0;
	while (pos < str.length) {
		// Add everything up to the next \n to the accumulated result.
		var eol = str.indexOf('\n',pos);
		state.result += str.substr( pos, (eol>=0) ? eol : undefined );

		if (eol >= 0) { 
			// Complete header line. Decode content or ignore.
			var clTag = ['Content-Length: ', 'CL: '];
			for ( var i=0; i < 2; i++ ) {
				var len = clTag[i].length;
				if (state.result.substring( 0, len ) == clTag[i]) {
					state.content_len = parseInt( state.result.substring(len) );
					break;
				}
			}
			state.result = "";
			pos = eol + 1;
		} else {
			if (   (state.content_len >= 0) 
				&& (state.result.length >= state.content_len)) {
				// Complete payload.
				complete = true;
			}
			pos = str.length;
		}
	}
	return complete;
}

// Parses a reply from an instrument.
// Copies non-header strings into the result field.
// Expects \n termiaated lines, with the transaction termianted by \n\n.
// The 'lines' member of state.result stores the lines in an array.
// Returns true when the transaction is complete.
function parseReplyLines( state, str ) 
{
	// We make assumptions based on what we know the instruments
	// may return:
	//  - May or may not have an HTTP header.
	//  - Content length is either Content-Length: or CL:.
	//  - A blank line \r\n follows the Content-Length field.
	//  - Payload is expeceted to be JSON, and is parsed.
	var complete = false;
	var pos = 0;
	while (pos < str.length) {
		// Add everything up to the next \n to the accumulated result.
		var eol = str.indexOf('\n',pos);
		state.accum += str.substr( pos, (eol>=0) ? eol : undefined );

		if (eol == 0) {
			// Empty line means we're done.
			complete = true;
			break;
		}

		if (eol > 0) { 
			pos = eol + 1;
			state.result.lines.push( state.accum );
			state.accum = "";
		} else {
			pos = str.length;
		}
	}
	return complete;
}

// Send a command over a socket to an instrument, and parse good responses
// with the given function.  The 'state' variable's content is dependent on parseFunc.
// Call either the success or failure functions depending on the result.
function send_instr_cmd_proto( instr, cmd, parseFunc, state, successfunc, failurefunc ) 
{
	var addr = instr.address;
	var url = addr.split(':');
	var client = new net.Socket();
	var success = false;
	var result = "";

	client.setTimeout(3000);
	client.connect( url[1], url[0], function() {
		if (debug_queue > 1) {
			console.log("QUEUE: Client connected. Sending command.");
		}
		state.connected = true;
		client.write(cmd+"\n");
	});

	client.on('data', function(data) {
		if (debug_queue) {
			console.log("QUEUE: Got result from cmd '"+cmd+"': "+data.toString());
		}
		if (parseFunc( state, data.toString() )) {
			client.setTimeout(0);
			client.end();
		}
		success = true;

	});
	client.on('error', function(err) {
		state.result = err;
		if (debug_queue) {
			console.log("QUEUE: Got error from cmd '"+cmd+"': "+state.result);
		}
		success = false;
		client.end();
		client.setTimeout(0);
	});

	client.on('close', function() {
		if (debug_queue > 1) {
			console.log("QUEUE: Connection closed for "+cmd+"', success="+success);
		}
		if (success) {
			try {
				if (state.result != "") {
					result = JSON.parse(state.result);
				} else {
					result = new Object;
				}
				successfunc( result );
			} catch (err) {
				console.log("ERROR: Caught while processing error results from \'"+cmd+"\': "+err);
				failurefunc(err);
			}
		} else {
			failurefunc( state.result );
		}
		instr_cmd_done( instr );
		state.connected = false;
		client.setTimeout(0);
		client.end();
	});
	client.on('timeout', function() {
		if (debug_queue) {
			console.log("QUEUE: Timeout sending command '"+cmd+"'");
		}
		state.result = "Timeout sending command '"+cmd+"'";
		success = false;
		if (client.connecting) {
			failurefunc( state.result );
			instr_cmd_done( instr );
		}
		client.setTimeout(0);
		state.connected = false;
		client.end();
		
	});

}

// send a command to an instrument directly as a TCP client.
// call either the success or failure functions depending on the result.
// Expect a fixed length response.
function send_instr_cmd( instr, cmd, successFunc, failureFunc ) 
{
	var state = {nread: 0, content_len: -1, result: "", connected: false};
	send_instr_cmd_proto( instr, cmd, parseFixedLengthReply, state, successFunc, failureFunc );
}
// send a command to an instrument directly as a TCP client.
// call either the success or failure functions depending on the result.
// Expect a series of lines terminated with \n, and \n\n at the end of the data.
function send_instr_cmd_lines( instr, cmd, successfunc, failurefunc ) 
{
	var state = {nread: 0, accum: "", result: {lines: [] }, connected: false};
	send_instr_cmd_proto( instr, cmd, parseReplyLines, state, successFunc, failureFunc );
}

function queue_and_send_instr_cmd( instr, cmd, successfunc, failurefunc, res )  {
	queue_instr_cmd( instr, function() {
		send_instr_cmd( instr, cmd, successfunc, failurefunc );
	}, res );
}

// 10AM or later, before 11PM.
function is_daytime() {
	var d = new Date();
	var hour = d.getHours(); // Midnight is 0.
	if ((hour >= 10) && (hour < 23)) {
		return true;
	} else {
		return false;
	}
}

// Compare 2 time specs, where each is a pair of integers [hour,min].
// Return -1 if a before b, 1 if a after b, and 0 if they match.
function compare_times( a, b ) {
	if (a[0] > b[0]) {
		return 1;
	} else if (a[0] == b[0]) {
		if (a[1] > b[1]) {
			return 1;
		} else if (a[1] < b[1]) {
			return -1;
		} else {
			return 0;
		}
	} else {
		return -1;
	}
}

// Stores the given monitor, indexed by system naem and name.
function register_monitor( monitor ) {
	var key = monitor.system_name + "." + monitor.name;
	monitors[key] = monitor;
}

// Copies the given monitor object, and removes some fields that
// are either big, or are recursive.
function strip_monitor(mon) 
{
	var unwanted = ['instrs', 'utils', '_id', 'exec_task'];
	var newMon = {};
	Object.keys(mon).forEach( function(key) {
		if ( unwanted.indexOf(key) == -1) {
			newMon[key] = mon[key];
		}
	});
	return newMon;
}

// Returns a monitor for the given system_name and name.
function get_monitor( system_name, monitor_name, stripped ) {
	var key = system_name + "." + monitor_name;
	var mon = monitors[key];
	if (stripped && (mon != undefined)) {
		mon = strip_monitor(mon);
	}
	return mon;
}

// Returns all monitors for the given system.
function get_monitors( system_name, stripped ) {
	var rslt = [];
	Object.keys(monitors).forEach( function(key) {
		if (key.split('.')[0] == system_name) {
			var mon = monitors[key];
			if (stripped) {
				mon = strip_monitor(mon);
			}
			rslt.push(mon);
		}
	});
	return rslt;
}

// Begin to listen on port 3001 for queries from instruments.
function start_query_server()
{
	var server = net.createServer(function(socket) {
		socket.on('data', function(data){
			console.log("INSTR QUERY: "+data);
			var curtimeCmd = "curtime";
			var str = data.toString('utf8');

			if ( str.substring(0,curtimeCmd.length) == "curtime") {
				// "curtime" query.
				// Returns a time integer adjusted for the current timezone.
				var d = new Date;
				var t = Math.floor(Date.now()/1000);
				var tz= d.getTimezoneOffset() * 60;
				t -= tz;
				socket.write(""+t+"X");
			} else {
				console.log("ERROR: Unrecognized query");
			}
		});
		socket.on('error', function(data){
			console.log(data);
		});
	});
	server.listen(3001, '10.10.2.2');
}

module.exports = {
	init_dust_helpers: function( dust_in ) {
		dust = dust_in;
		dust.helpers.partial_indirect = partial_indirect_helper;
	},
	load_instr_mods: load_instr_mods,
	get_instr_mod: get_instr_mod,
	get_instr_info: get_instr_info,
	get_instr_by_type: get_instr_by_type,
	save_instr_info: save_instr_info,
	setup_instr_routes: setup_instr_routes,
	init_session: init_session,
	clear_session: clear_session,
	get_master_template_data: get_master_template_data,
	get_instr_by_name: get_instr_by_name,
	send_error: send_error,
	queue_instr_cmd: queue_instr_cmd,
	queue_and_send_instr_cmd: queue_and_send_instr_cmd,
	send_instr_cmd_http: send_instr_cmd_http,
	send_instr_cmd: send_instr_cmd,
	send_instr_cmd_lines: send_instr_cmd_lines,
	instr_cmd_done: instr_cmd_done,
	default_instruments: default_instruments,
	is_daytime: is_daytime,
	register_monitor: register_monitor,
	get_monitor: get_monitor,
	get_monitors: get_monitors,
	compare_times: compare_times,
	start_query_server: start_query_server
};
