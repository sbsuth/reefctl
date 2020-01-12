var request = require('request');
var net = require('net');
var cp = require('child_process');
var mongo = require("mongodb");

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
	"ro_res",
	"dosing",
	"vodka"
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

if (0) {
// The default set of instruments in the system.
// This info would be stored in a database, and read based on 
// user login, and system selection, but while I've got only
// one, this is fine.
// UNREFERENCED!
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
}

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
var next_queue_id = 1;
var debug_queue = 2;
var cmd_result_cache = [];

// Looks in the cache for a result for the given instr/cmd pair
// that is within 'fuse' ms. If fuse is not positive, never matches.
function query_cache( instr, cmd, fuse )
{
	if (fuse <= 0) {
		return undefined;
	}
	var key = instr.name + ":" + cmd;
	var cval = cmd_result_cache[key];
	if (!cval) {
		return undefined;
	}

	var now = new Date().getTime();
	if ((now - cval.time) < fuse) {
		return cval.result;
	} else {
		return undefined;
	}
}

function clear_cache_for_instr( instr )
{
	var keys = Object.keys(cmd_result_cache);
	for ( var ikey=0; ikey < keys.length; ikey++ ) {
		var key = keys[ikey];
		var keyInstr = key.split(":")[0];
		if (keyInstr && (instr.name == keyInstr)) {
			delete cmd_result_cache[key];
		}
	}
}


function cache_cmd_rslt( instr, cmd, result )
{
	var key = instr.name + ":" + cmd;
	cmd_result_cache[key] = { result: result, time: new Date().getTime() };
}


function queue_instr_cmd( instr, cmd, fuse, func, res )
{
	var url = instr.address;
	var queue = instr_cmd_queue[url];
	if (queue === undefined) {
		queue = [];
		instr_cmd_queue[url] = queue;
	}

	var queued_func = {
		func: func, 
		instr: instr, 
		time_queued: new Date().getTime(), 
		id: next_queue_id, 
		executed: false,
		cached_result: query_cache( instr, cmd, fuse )
	};
	next_queue_id++;

	// If we get a cache hit, call func immediately.
	if (queued_func.cached_result) {
		func( queued_func );
		return;
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


	queue.push( queued_func );
	if (queue.length == 1) {
		if (debug_queue) {
			console.log("QUEUE: Executing command immediately for " + instr.name);
		}
		queued_func.executed = true;
		func( queued_func );
	} else {
		// Return, expecting that the next function on the queue
		// to return will call instr_cmd_done().
		if (debug_queue) {
			console.log("QUEUE: Queing command for " + instr.name);
		}
	}
}

// A queued command has completed.
// Remove it from the head of the queue, and call any next command.
function instr_cmd_done( instr, queued_func )
{
	var url = instr.address;
	var queue = instr_cmd_queue[url];

	var unqueued = false;

	// If given a specific queued_func, find that one and remove it.
	// Otherwise, remove the first
	if (queued_func != undefined) {
		for ( var iqueue=0; iqueue < queue.length; iqueue++ ) {
			if (queued_func.id == queue[iqueue].id) {
				queue.splice(iqueue,1);
				unqueued = true;
				break;
			}
		}
	} else {
		queue.shift();
		unqueued = true;
	}

	if (debug_queue) {
		if (unqueued) {
			console.log("QUEUE: command done.  "+queue.length+" commands left for "+instr.name);
		} else {
			console.log("QUEUE: command done. Did not find cmd ID "+queued_func.id+" in queue. Leaving "+queue.length+" commands left for "+instr.name);
		}
	}
	if (queue.length > 0) {
		// Execute the first  unexecuted command off the queue.
		// Marking as executed prevents us from re-executing commands that will eventually 
		// be removed as timed out.
		for ( var iqueue=0; iqueue < queue.length; iqueue++ ) {
			if (!queue[iqueue].executed) {
				if (debug_queue) {
					console.log("QUEUE: Executing cmd off queue for "+instr.name);
				}
				queue[iqueue].executed = true;
				queue[iqueue].func( queue[iqueue] );
				break;
			}
		}
	}
}

// Removes old queued funcs.
// There is no failure func to call: something went wrong, and they were never removed from the queue as complete.
function purge_timed_out_funcs() {

	var timeout_ms = 30 * 1000;

	var now = new Date().getTime();

	Object.keys(instr_cmd_queue).forEach( function(key) {
		var queue = instr_cmd_queue[key];
		for ( var iqueue=0; iqueue < queue.length; ) {
			if ((now - queue[iqueue].time_queued) > timeout_ms) {
				if (debug_queue) {
					console.log("QUEUE: Remove command for \'"+queue[iqueue].instr+"\' because it timed out on the queue.");
				}
				queue.splice( iqueue, 1 );
			} else {
				iqueue++;
			}
		}
	});
}

function start_queue_monitor() {
	setInterval( function() { purge_timed_out_funcs(); }, 30*1000 );
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


var instr_cmd_cache = [];

// Store the last successful result for an instrument command.
function cache_instr_cmd_rslt( queued_func, result ) {
	if ((queued_func == undefined) || ( queued_func.cmd == undefined) || (queued_func.instr == undefined)) {
		return;
	}

	// Keys for the cache are "instr:cmd"
	var now = new Date().getTime();
	var key = "" + queued_func.instr + ":" + queued_func.cmd;
	instr_cmd_cache[key] = { result: result, time: now };
}

// Return a cached result for the given instr+cmd if it was stored within timeout.
// If not, return  undefined.
function get_cached_instr_cmd_rslt( instr, cmd, fuse_ms ) {
	
	if ((instr == undefined) || (instr == "") || (cmd == undefined) || (cmd == "")) {
		return undefined;
	}

	var key = "" + instr + ":" + cmd;
	var cached = instr_cmd_cache[key];
	if (cached == undefined) {
		return undefined;
	}
	var now = new Date().getTime();
	delta = (now - cached.time);
	if ( (delta >= 0) && (delta < fuse_ms)) {
		return cached.result;
	} else {
		return undefined;
	}
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
function send_instr_cmd_proto( instr, cmd, queued_func, parseFunc, state, successfunc, failurefunc ) 
{
	var addr = instr.address;
	var url = addr.split(':');
	var client = new net.Socket();
	var success = false;
	var result = "";

	if (queued_func) {
		queued_func.cmd = cmd;
	}

	client.setTimeout(3000);
	state.connected = false;
	state.connecting = true;
	client.connect( url[1], url[0], function() {
		if (debug_queue > 1) {
			console.log("QUEUE: Client connected. Sending command \'"+cmd+"\' to "+url[0]);
		}
		state.connected = true;
		state.connecting = false;
		client.write(cmd+"\n");
	});

	client.on('data', function(data) {
		var  complete = parseFunc( state, data.toString() );
		if (debug_queue) {
			console.log("QUEUE: Got result from cmd '"+cmd+" to "+url[0]+": "+data.toString()+": complete="+complete);
		}
		if (complete) {
			client.setTimeout(0);
			client.end();
		}
		success = true;

	});
	client.on('error', function(err) {
		state.result = err;
		if (debug_queue) {
			console.log("QUEUE: Got error from cmd '"+cmd+" to "+url[0]+": "+state.result);
		}
		success = false;
		client.end();
		client.setTimeout(0);
	});

	client.on('close', function() {
		if (debug_queue > 1) {
			console.log("QUEUE: Connection closed for "+cmd+" to "+url[0]+", success="+success);
		}
		if (success) {
			try {
				if (state.result != "") {
					result = JSON.parse(state.result);
				} else {
					result = new Object;
				}
				cache_instr_cmd_rslt( queued_func, result );
				if (!state.result_reported) {
					state.result_reported = true;
					successfunc( result );
				}
			} catch (err) {
				console.log("ERROR: Caught while processing error results from \'"+cmd+"\' to "+url[0]+": "+err+" ("+state.result_reported+")");
				if (!state.result_reported) {
					state.result_reported = true;
					failurefunc(err);
				}
			}
		} else {
			if (!state.result_reported) {
				state.result_reported = true;
				failurefunc( state.result );
			}
		}
		instr_cmd_done( instr, queued_func );
		state.connected = false;
		client.setTimeout(0);
		client.end();
	});
	client.on('timeout', function() {
		if (debug_queue) {
			console.log("QUEUE: Timeout sending command '"+cmd+"'");
		}
		state.result = "Timeout sending command '"+cmd+"': addr:"+url[0];
		success = false;
		if (state.connecting) {
			state.connecting = false;
			if (!state.result_reported) {
				state.result_reported = true;
				failurefunc( state.result );
			}
			instr_cmd_done( instr, queued_func );
		}
		client.setTimeout(0);
		state.connected = false;
		client.end();
		
	});

	// Fallback timeout for rare cases where 'end' even doesn't occur.
	// Ordinarily, we will either have completed, or timed out under net.Socket
	// control, but if a 'close' never happens, the entire monitor stops running.
	// This just catches that case and calls failureFunc.
	setTimeout( function () {
		if (!state.result_reported) {
			state.result = "net.Socket never called close for command '"+cmd+"': addr:"+url[0];
		    success = false;
			if (debug_queue) {
				console.log("QUEUE: "+state.result);
			}
			//send_text_msg( "Fallback timeout", state.result);
			state.result_reported = true;
			failurefunc(state.result);
			instr_cmd_done( instr, queued_func );
			client.setTimeout(0);
			state.connected = false;
			client.end();
		}
	}, 15000);
}

// send a command to an instrument directly as a TCP client.
// call either the success or failure functions depending on the result.
// Expect a fixed length response.
function send_instr_cmd( instr, cmd, queued_func, successFunc, failureFunc ) 
{
	// Clear any cached result for the entire instr before sending.
	clear_cache_for_instr(instr);
	
	var state = {nread: 0, content_len: -1, result: "", connecting: false, connected: false, result_reported: false};
	send_instr_cmd_proto( instr, cmd, queued_func, parseFixedLengthReply, state, successFunc, failureFunc );
}
// send a command to an instrument directly as a TCP client.
// call either the success or failure functions depending on the result.
// Expect a series of lines terminated with \n, and \n\n at the end of the data.
function send_instr_cmd_lines( instr, cmd, meta, successfunc, failurefunc ) 
{
	var state = {nread: 0, accum: "", result: {lines: [] }, connected: false, result_reported: false};
	send_instr_cmd_proto( instr, cmd, meta, parseReplyLines, state, successFunc, failureFunc );
}

function queue_and_send_instr_cmd( instr, cmd, fuse, successfunc, failurefunc, res )  {
	queue_instr_cmd( instr, cmd, fuse, function(queued_func) {
		if (queued_func.cached_result) {
			if (debug_queue) {
				console.log("QUEUE: Returning cached result for "+instr.name+" cmd \'"+cmd+"\': "+JSON.stringify(queued_func.cached_result));
			}
			successfunc(queued_func.cached_result);
		} else {
			send_instr_cmd( instr, cmd, queued_func, 
				function(rslt) {
					// Cache the result and pass it on.
					cache_cmd_rslt( instr, cmd, rslt )
					successfunc(rslt);
				}, 
				function (error) {
					// Clear cache, then pass it on.
					clear_cache_for_instr(instr);
					failurefunc(error);
				}
			);
		}
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

// Given 2 [hour,sec] arrays, adds incr to t and returns the result.
function add_time( t, incr )
{
	var sum = [t[0] + incr[0],t[1] + incr[1]];
	sum[0] += Math.floor(sum[1]/60);
	sum[1] = Math.floor(sum[1]%60);
	return sum;
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

// Utility that gets all monitors, including data from the db, and memory if its there.
// Calls the given 'next' function with an err, and an array of monitors.
function get_monitors( system_name, filter, next ) {

	// Read all the monitors for the given system.
	var monitors = this.db.get("monitors");
	monitors.find( {system: system_name}, {}, function( err, monitor_objs ) {
		if (monitor_objs && monitor_objs.length && !err) {

			// Merge in any in-memory stuff that's not already in the db obj.
			for ( var imon=0; imon < monitor_objs.length; imon++ ) {
				var mon = monitor_objs[imon];
				if ( (filter != undefined) && (filter[mon.name] == undefined)) {
					monitor_objs.splice( imon, 1 );
					imon--;
					continue;
				}
				var memMon = get_monitor( system_name, mon.name, true );
				if (memMon != undefined ) {
					Object.keys(memMon).forEach( function(key) {
						if ( mon[key] == undefined ) {
							mon[key] = memMon[key]; // By ref.
						}
					});
				}
			}
			next( undefined, monitor_objs );
			
		} else {
			next( err, [] );
		}
	});
}


// Returns all monitors for the given system.
function get_all_monitors( system_name, stripped ) {
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

var base_zwave_url = 'http://reefctl2:8123/api/';

function send_zwave_cmd( entity, cmd, successFunc, errorFunc ) {
	var url = base_zwave_url + cmd;
	request.post(
		{ url: url,
		  json: true,
		  timeout: 1000,
		  body: {
			entity_id: entity
		  }
		},
		function(error,response,body) {
			if (response.statusCode == 200) {
				if (successFunc) {
					successFunc(body); // Nothing in these...
				}
			} else {
				if (errorFunc) {
					errorFunc(body.message); 
				}
			}
		}
	).on('error',function(err) {console.log("error");});
}


function get_zwave_state( state, entity, successFunc, errorFunc ) {
	var url = base_zwave_url + "states/" + entity;
	request.get(
		{ url: url,
		  json: true,
		  timeout: 1000
		},
		function(error,response,body) {
			// Use response.statusCode.  'error' doesnt get set.
			if (response.statusCode == 200) {
				if (successFunc) {
					successFunc(body[state]);
				}
			} else {
				if (errorFunc) {
					errorFunc(body.message);
				}
			}
		}
	);
}


var entity_power_status = {};

function get_entity_power_status(entity) {
	var eps = entity_power_status[entity];
	if (eps != undefined) {
		return eps;
	}
	eps = {
		state: "inactive",
		entity: "",
		num_retries: 0,
		max_retries: 5,
		retry_interval_ms: 30 * 1000,
		off_time_ms: 5 * 1000,
		debug: 1
	};
	entity_power_status[entity] = eps;
	return eps;
}

function power_cycle_fsm( eps ) {

	switch (eps.state) {
		case "inactive":
		case "given_up" :
			// Do nothing.
			break;
		case "start":
			// Send turn_off
			if (eps.debug) { console.log("POWER_CYCLE: "+eps.entity+": sending turn_off"); }

			send_zwave_cmd( eps.entity, "services/switch/turn_off",
				function (resp) {
					// Verify off after 1 sec.
					setTimeout( function() {
						if (eps.debug) { console.log("POWER_CYCLE: "+eps.entity+": sending verify off"); }
						get_zwave_state( "state", eps.entity, 
							function(state) {
								if (state == "off") {
									if (eps.debug) { console.log("POWER_CYCLE: "+eps.entity+": scheduling turn_on");}
									eps.state = "turn_on";
									setTimeout( function() {power_cycle_fsm(eps)}, eps.off_time_ms );
								} else {
									retry_power_cycle(eps);
								}
							},
							function (err) {
								if (eps.debug) { console.log("POWER_CYCLE: "+eps.entity+": got error \'"+err+"\'"); }
								retry_power_cycle(eps);

							});
					}, 1000 );
				},
				function (err) {
					retry_power_cycle(eps);
				});
			break;
		case "turn_on" :
			// Send turn_on
			if (eps.debug) { console.log("POWER_CYCLE: "+eps.entity+": sending turn_on");}
			send_zwave_cmd( eps.entity, "services/switch/turn_on",
				function (resp) {
					// Verify on after 1 sec.
					setTimeout( function() {
						if (eps.debug) { console.log("POWER_CYCLE: "+eps.entity+": sending verify on");}
						get_zwave_state( "state", eps.entity, 
							function(state) {
								if (state == "on") {
									// Done.
									if (eps.debug) { console.log("POWER_CYCLE: "+eps.entity+": completed successfully");}
									reset_power_cycle(eps.entity);
								} else {
									retry_power_cycle(eps);
								}
							},
							function (err) {
								retry_power_cycle(eps);

							});
					}, 1000 )
				},
				function (err) {
					retry_power_cycle(eps);
				});
			break;
	}
}

function retry_power_cycle(eps) {

	eps.num_retries++;
	if (eps.num_retries > eps.max_retries) {
		// If we exceed the max number of retries, go into a "given_up" state.
		// Send a "turn_on" for good measure.
		send_zwave_cmd( eps.entity, "turn_on" );
		eps.state = "given_up";
		if (eps.debug) { console.log("POWER_CYCLE: "+eps.entity+": giving up after "+eps.num_retries+" retries") }
		return;
	}

	// Try again, leaving the state the same.
	if (eps.debug) {console.log("POWER_CYCLE: "+eps.entity+": wait for retry #"+eps.num_retries+" in state \'"+eps.state+"\'") }
	setTimeout( function () { power_cycle_fsm(eps); }, eps.retry_interval_ms );
}

function req_power_cycle( entity ) {
	var eps = get_entity_power_status(entity);
	if (eps.state == "inactive") {
		eps.entity = entity;
		eps.state = "start";
		power_cycle_fsm(eps);
		return 1;
	} else {
		return 0;
	}
}

function reset_power_cycle( entity ) {
	var eps = get_entity_power_status(entity);
	eps.entity = "";
	eps.num_retries = 0;
	eps.state = "inactive";
}

function send_text_msg( title, content )
{
	var mail = cp.spawn('mail', ["-s", title, "4254177661@txt.att.net"]);
	mail.stdin.write(content);
	mail.stdin.end();
}

// Interprets a string given a type.
// Retuns {val,err} where val is the typed value, and err is set if there was a problem.
function decode_value( str, type ) {
	var value = undefined;
	var err = undefined;
	switch (type) {
		case "bool":
			if ((str == "1") || (str == "true")) {
				value = true;
			} else if ((str == "0") || (str == "false")) {
				value = false;
			} else {
				err = "Must specify true, false, 1, or 0";
			}
			break;
		case "int":
			value = Number.parseInt(str);
			if (Number.isNaN(value)) {
				err = "Must specify an integer.";
			}
			break;
		case "int_arr":
			value = [];
			if (str != "none") {
				var values = str.split(',');
				for (var i=0; i < values.length; i++ ) {
					var ival = Number.parseInt(values[i]);
					if (Number.isNaN(value)) {
						err = "Must specify an integer.";
					} else {
						value.push(ival);
					}
				}
			}
			break;
		case 'real':
			value = Number.parseFloat(str);
			if (Number.isNaN(value)) {
				err = "Must specify real number";
			}
			break;
		case 'int10':
			// Specified as real, mult by 10 and store as int. 
			value = Number.parseFloat(str);
			if (Number.isNaN(value)) {
				err = "Must specify real number";
			} else {
				value = Math.floor(value * 10.0);
			}
			
			break;
		case 'str':
			value = str;
			break;
		case 'time':
			// A time from Date() in ms.
			value = new Date(str).toLocaleString();
			break;
		case 'tod':
			// Value is [hour,min], format is hour:min
			var vals = str.split(":");
			if (vals.length != 2)  {
				err = "Must specify \'hour:min\'";
			} else {
				var hour = Number.parseInt(vals[0]);
				var min = Number.parseInt(vals[1]);
				if ( Number.isNaN(hour) || (hour < 0) || (hour > 23)) {
					err = "Hours must be from 0-23.";
				} else if ( Number.isNaN(hour) || (min < 0) || (min > 59)) {
					err = "Minutes must be from 0-59."
				} else {
					value = [hour,min];
				}
			}
			break;
		case 'hms':
			// Value is 'sec', format is hour:min[:sec]
			var vals = str.split(":");
			if (vals.length < 2)  {
				// Take value directly as seconds.
				var sec = Number.parseInt(vals[0]);
				value = sec;
			} else {
				var hour = Number.parseInt(vals[0]);
				var min = Number.parseInt(vals[1]);
				var sec = (vals.length > 2) ? Number.parseInt(vals[2]) : 0;
				if ( Number.isNaN(hour) || (hour < 0) || (hour > 23)) {
					err = "Hours must be from 0-23.";
				} else if ( Number.isNaN(hour) || (min < 0) || (min > 59)) {
					err = "Minutes must be from 0-59."
				} else {
					value = hour*3600 + min*60 + sec;
				}
			}
			break;
		default: 
			err = "Unrecognized type \'"+type+"\'";
			break;
	}
	return {value: value, err: err};
}

// returns a mongo ObjectID for a Date.
function mongo_id_for_time( t ) {
	var hexSeconds = Math.floor(t/1000).toString(16);
	var objt = new mongo.ObjectID(hexSeconds + "0000000000000000");
	return objt;
}

// Returns true if the given unit's address's last digit is in the given set of ints.
function unit_addr_in_set( unit, addrs ) {
	if ( !addrs || !unit || (addrs.length == 0)) {
		return false;
	}
	var nums = unit.address.split('.');
	if (nums.length < 4) {
		return false;
	}
	var last_num = Number.parseInt(nums[3]);
	if (last_num <= 0) {
		return false;
	}
	return (addrs.indexOf(last_num) >= 0);
}

module.exports = {
	init_dust_helpers: function( dust_in ) {
		dust = dust_in;
		dust.helpers.partial_indirect = partial_indirect_helper;
	},
	load_instr_mods: load_instr_mods,
	start_queue_monitor: start_queue_monitor,
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
	//default_instruments: default_instruments,
	is_daytime: is_daytime,
	register_monitor: register_monitor,
	get_monitor: get_monitor,
	get_monitors: get_monitors,
	get_all_monitors: get_all_monitors,
	compare_times: compare_times,
	add_time: add_time,
	start_query_server: start_query_server,
	query_cache: query_cache,
	clear_cache_for_instr: clear_cache_for_instr,
	cache_cmd_rslt: cache_cmd_rslt,
	req_power_cycle: req_power_cycle, 
	reset_power_cycle: reset_power_cycle,
	send_text_msg: send_text_msg,
	decode_value: decode_value,
	mongo_id_for_time: mongo_id_for_time,
	unit_addr_in_set: unit_addr_in_set
}
