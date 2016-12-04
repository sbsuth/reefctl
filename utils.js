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

// Return an object with the info we need for this session populated.
function setup_session( session )
{
	return { user: "sbsuth",
			 cur_system: 1,
			};
}

var instr_mod_names = [
	"fixture",
	"probes"
];

var instr_mods = [];

function load_instr_mods()
{
	for ( i=0; i < instr_mod_names.length; i++ ) {
		var name = instr_mod_names[i];
		var mod = require('./routes/'+name);
		instr_mods[name] = mod;
	}
}

function setup_instr_routes( app )
{
	for ( i=0; i < instr_mod_names.length; i++ ) {
		var name = instr_mod_names[i];
		var mod = instr_mods[name];
		app.use('/', mod.router);
	}
}

// Given a module kind, returns a module description.
function get_instr_mod( kind )
{
	var mod = instr_mods[kind];
	if (mod === undefined) {
		return undefined;
	} else {
		return mod.descr;
	}
}

function get_instr_by_name( req, instr_name )
{
	var i;
	for ( i=0; i < req.instruments.length; i++ ) {
		var instr = req.instruments[i];
		if (instr.session.name === instr_name) {
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

// Initializes and adds an object to the instruments member of the req
// for each instrument with info in the session.
// Members initialized:
//  'session':  a reference to the for the same instrument.
//  'module':  a reference to the module class for the instrument.
//  'status':  empty
//  'settings':  empty
function init_instruments( session, req )
{
	session.instruments.forEach( function(instr_session) {
		if ( req.instruments === undefined ){
			req.instruments = [];
		}
		var instr = {
			session: instr_session,
			module: get_instr_mod( instr_session.type ),
			status: {},
			settings: {}
		}
		instr.module.init_session(instr);
		req.instruments.push(instr);
	});
}

// Called from an early filter to initialize the session.
// Presumes that the 'user' is set and verified: this must be done beforehand.
// Initializes an array of instruments in the request.  The 'instruments'
// array in the session will be references as the session in each req instruments
// member.
function init_session( session, req )
{
	session.user = "sbsuth"; // HARD CODED!
	session.system_index = 0; // HARD CODED!
	session.systems = ["steves_reef"]; // HARD CODED!
	session.instruments = [ // HARD CODED!
		{ name: 'main_fixture',
		  type: 'fixture',
		  address: "10.10.2.4:1000"
		},
		{ name: 'probes1',
		  type: 'probes',
		  address: "10.10.2.5:1000"
		},
		{ name: 'probes2',
		  type: 'probes',
		  address: "10.10.2.6:1000"
		},
		{ name: 'probes3',
		  type: 'probes',
		  address: "10.10.2.7:1000"
		}
	];
	init_instruments( session, req );
}

// Fill an object with the basic info needed from the session
// for the master template.
function get_master_template_data( req ) {
	var d = { session: req.session,
			  load_javascript: []
			};
	return d;
}

function send_error( res, msg ) 
{
	console.log( "ERROR returned: \'"+msg+"\'");
    res.send({
      message: msg,
      error: 400
    });
}

// Persistent array of queues.
// Indexed by URL.
// Each queue is an array of functions.
var instr_cmd_queue = [];
var debug_queue = 0;

function queue_instr_cmd( instr, func, res )
{
	var url = instr.session.address;
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
		  message: "Instrument " + instr.session.name + " is busy.",
		  error: 429
		});
		return;
	}

	queue.push( func );
	if (queue.length == 1) {
		if (debug_queue) {
			console.log("QUEUE: Executing command immediately for " + instr.session.name);
		}
		func();
	} else {
		// Return, expecting that the next function on the queue
		// to return will call inst_cmd_done().
		if (debug_queue) {
			console.log("QUEUE: Queing command for " + instr.session.name);
		}
	}
}

// A queued command has completed.
// Remove it from the head of the queue, and call any next command.
function instr_cmd_done( instr )
{
	var url = instr.session.address;
	var queue = instr_cmd_queue[url];
	queue.shift();
	if (debug_queue) {
		console.log("QUEUE: command done.  "+queue.length+" commands left for "+instr.session.name);
	}
	if (queue.length > 0) {
		if (debug_queue) {
			console.log("QUEUE: Executing cmd off queue for "+instr.session.name);
		}
		queue[0]();
	}
}

module.exports = {
	init_dust_helpers: function( dust_in ) {
		dust = dust_in;
		dust.helpers.partial_indirect = partial_indirect_helper;
	},
	setup_session: setup_session,
	load_instr_mods: load_instr_mods,
	get_instr_mod: get_instr_mod,
	get_instr_info: get_instr_info,
	save_instr_info: save_instr_info,
	setup_instr_routes: setup_instr_routes,
	init_session: init_session,
	get_master_template_data: get_master_template_data,
	get_instr_by_name: get_instr_by_name,
	send_error: send_error,
	queue_instr_cmd: queue_instr_cmd,
	instr_cmd_done: instr_cmd_done
};
