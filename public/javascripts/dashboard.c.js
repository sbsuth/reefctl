var dashboard = new PageUtils( 1, "DASHBOARD", 3000 );

dashboard.widgets_by_key = [];
dashboard.widgets = [];
dashboard.icur = 0;

// Functions =============================================================

// Registers a widget that will be updated with status.
// The key has the format IP:port;command;route. We use the first 2 tokens so that
// several widgets may use the same set, which is the case when several instruments
// are implemented on one unit and have a primitive status command
// and execute the status queries, and push the results to widgets via the 
// update funcs round-robbin.  The route in the key is used to get the status.
dashboard.register_widget = function ( full_key, instr_name, update_func_name, js, css) {

	// We use the address and 
	var key_tokens = full_key.split(';');
	var status_key = key_tokens[0] + ";" + key_tokens[1];
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
}

// Start a status update loop if one is not already running.
dashboard.updateStatus = function()
{
	var page = dashboard;

	// Do nothing if there's already a loop going, or if no instruments.
	if (dashboard.widgets.length < 1) {
		return;
	}
	if (dashboard.waiting_status) {
		return;
	}
	dashboard.waiting_status = 1;

	// Get the next key and callbacks.
	var item = dashboard.widgets[dashboard.icur];
	dashboard.icur++;
	if (dashboard.icur >= dashboard.widgets.length)
		dashboard.icur = 0;

	page.debugMsg("Sending stat cmd: "+'/'+item.route+'/'+item.instr_name);
	$.getJSON( '/'+item.route+'/'+item.instr_name, function( data ) { page.handleStatus( item, data ) } );
}

dashboard.handleStatus = function(item, data) {

	var page = this;

	if (data.error === undefined) {
		page.debugMsg(""+dashboard.debug_prefix+": Got status: "+JSON.stringify(data));
	
		// Send status to all on this key.
		item.update_funcs.forEach( function(update_func) {
			var cmd = update_func + "(\"" + item.instr_name + "\"," + JSON.stringify(data) + ")";
			eval( cmd );
		});
	} else if (data.error == 429) {
		page.debugMsg(dashboard.debug_prefix+": Too busy for command");
	} else {
		page.showError( data.error, data.message );
		page.setUpdateInterval(0);
	}
	page.waiting_status = 0;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}

// DOM Ready =============================================================

$(document).ready(function() {
	
	var page = dashboard;

	// Each widget can have an element with id=register_func whose value is a function call.
	// Call each of them.  'value' is a string, so use eval().
	$('#register_widget').each( function(index,item) { eval(item.value); } );

	page.setupStandard(page);
	page.updateStatus();
});

