
// Namespace
var dashboard  = {

	debug: 2,
	debug_prefix : "DASHBOARD",
	widgets_by_key: [],
	widgets: [],
	icur : 0,
	progresspump : undefined,
	waiting_status : 0,
	ignore_status : 0,
	status_interval : 3000,

// Functions =============================================================

// Registers a widget that will be updated with status.
// The key has the format IP:port;command;route. We use the first 2 tokens so that
// several widgets may use the same set, which is the case when several instruments
// are implemented on one unit and have a primitive status command
// and execute the status queries, and push the results to widgets via the 
// update funcs round-robbin.  The route in the key is used to get the status.
register_widget: function ( full_key, instr_name, update_func_name, js, css) {

	// We use the address and 
	var key_tokens = full_key.split(';');
	var status_key = key_tokens[0] + ";" + key_tokens[1];
	//console.log("HEY: register_widget: full_key="+full_key+", update_func_name="+update_func_name+", instr_name="+instr_name+", js="+js);
	var item = dashboard.widgets_by_key[status_key];
	if (item == undefined) {
		item = { key : status_key,
				 route : key_tokens[2],
				 instr_name : instr_name,
				 update_funcs : [] 
				};
		dashboard.widgets_by_key[status_key] = item;
		dashboard.widgets.push(item);
	}
	item.update_funcs.push( update_func_name );

	if (js != undefined) {
		if ( $('script[src*="' + js +'"]').length == 0) {
			// Load the given javascript.
			 var script = document.createElement("script"); // Make a script DOM node
			 script.src = js; 
			 document.head.appendChild(script);
		}
	}
	if (css != undefined) {
		if ( $('link[href*="' + css +'"]').length == 0) {
		console.log("Loading css"+css);
			// Load the given stylesheet.
			 var link = document.createElement("link"); // Make a script DOM node
			 link.type = "text/css"; 
			 link.rel = "stylesheet"
			 link.href = css;
			 document.head.appendChild(link);
		}
		else {console.log("css"+css+" already loaded.");}
	}
},

// Start a status update loop if one is not already running.
updateStatus: function()
{
	// Do nothing if there's already a loop going, or if no instruments.
	if ((dashboard.progresspump !== undefined) || (dashboard.widgets.length < 1)) {
		return;
	}
	dashboard.waiting_status = 0; // In case its stale from last time?
	// Start the pump.
	dashboard.progresspump = setInterval(function(){
	  if (!dashboard.waiting_status) {
		dashboard.waiting_status = 1;

		// Get the next key and callbacks.
		var item = dashboard.widgets[dashboard.icur];
		dashboard.icur++;
		if (dashboard.icur >= dashboard.widgets.length)
			dashboard.icur = 0;

		if (dashboard.debug > 1) {
			console.log(dashboard.debug_prefix+": Sending stat cmd: "+'/'+item.route+'/'+item.instr_name);
		}
		$.getJSON( '/'+item.route+'/'+item.instr_name, function( data ) {
			if (data.error === undefined) {
				if (dashboard.debug > 1) {
					console.log(dashboard.debug_prefix+": Got status: "+JSON.stringify(data));
				}
				// Send status to all on this key.
				item.update_funcs.forEach( function(update_func) {
					var cmd = update_func + "(\"" + item.instr_name + "\"," + JSON.stringify(data) + ")";
					eval( cmd );
				});
			} else if (data.error == 429) {
				if (dashboard.debug > 1) {
					console.log(dashboard.debug_prefix+": Too busy for command");
				}
			} else {
				//dashboard.showError( data.error, data.message );
				dashboard.stopStatus();
			}
			dashboard.waiting_status = 0;
		});
	}
  }, dashboard.status_interval);
},
// Stop updating
stopStatus: function()
{
	progresspump = undefined;
}

}; // End namespace

// DOM Ready =============================================================

$(document).ready(function() {
	
	// Each widget can have an element with id=register_func whose value is a function call.
	// Call each of them.  'value' is a string, so use eval().
	$('#register_widget').each( function(index,item) { eval(item.value); } );

	dashboard.updateStatus();
});

