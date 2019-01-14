
var monitors = new PageUtils( 1, "MONITORS", 60000, 60000 );
	
// Format is monitor-<field>-<monitor_name>-<type>
// Name may have u
function decode_id(id) {
	var segs = id.split('-');
	return {field: segs[1],
			monitor: segs[2],
			type: segs[3] };
			
}
function encode_id(monitor,field,type) {
	return "monitor-"+field+"-"+monitor+"-"+type;
}

// Strip the last token off the given dash-separated ID.
function strip_last_token( id  ) {
	var segs = id.split('-');
	segs.pop();
	id = segs.join('-');
	return id;
}

// return string with leading 0 for <10.
function dig2( val ) {
	if ((val >= 0) && (val < 10)) {
		return "0" + val;
	} else {
		return val;
	}
}

// Returns a string given a typed value and a type.
function encode_value( val, type ) {
	var str = undefined;
	switch (type) {
		case "bool":
			str = val ? "true" : "false";
			break;
		case "int":
			str = val;
			break;
		case 'real':
			str = val.toFixed(1);
			break;
		case 'int10':
			// Convert to float, and divide by 10.
			val = val / 10.0;
			str = val.toFixed(1);
			break;
		case 'str':
			str = val;
			break;
		case 'time':
			// A time from Date() in ms.
			str = new Date(val).toLocaleString();
			break;
		case 'tod':
			// Value is [hour,min], format is hour:min
			str = val[0]+":"+val[1];
			break;
		case 'hms':  
			// Value is sec, format is hour:min[:sec].
			var hours = Math.floor(val/3600);
			var min = Math.floor( (val % 3600) / 60 );
			var sec = Math.floor( (val % 60) );
			str =  dig2(hours)+":"+dig2(min);
			if (sec > 0) {
				str += ":" + dig2(sec);
			}
			break;
		default: 
			break;
	}
	return str;
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
		case 'real':
			value = Number.parseFloat(str);
			if (Number.isNaN(value)) {
				err = "Must specify real number";
			}
			break;
		case 'int10':
			value = Number.parseFloat(str);
			if (Number.isNaN(value)) {
				err = "Must specify real number";
			} else {
				Math.floor( value * 10 );
			}
			break;
		case 'str':
			value = str;
			break;
		case 'tod':
			// Value is [hour,min], format is hour:min
			var vals = str.split(":");
			if (vals.length != 2) {
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
			break;
	}
	return {value: value, err: err};
}



// Begins a periodic query for temp status.
// Required signature.
monitors.updateStatus = function ()
{
	var page = this;

    if (page.waiting_status) {
		return;
	}
	page.waiting_status = 1;
	page.debugMsg("Sending monitor status query");
	$.getJSON( '/monitors_status/'+page.system_name, function(data) { page.handleStatus( data ) } );
}

// Handler for status updated.   
monitors.handleStatus = function ( data ) {

	var page = this;

	if (data.error === undefined) {
		page.debugMsg("Got monitor status: length="+data.monitors.length);
		
		page.goodUpdate();
	} else if (data.error == 429) {
		page.debugMsg("Too busy for stand_stat");
		page.setUpdateInterval(2000);
	} else {
		page.incrementFailedUpdates();
	}
	page.waiting_status = 0;

	page.ignore_changes = true;

	// build up a mons_by_name table for use in the next loop.
	var mons_by_name = {};
	for (var imon=0; imon < data.monitors.length; imon++ ) {
		var mon = data.monitors[imon];
		mons_by_name[mon.name] = mon;
	}

	// Get all fields, and look for a setting in the incoming data.
	// Apply the ones that are present.
	var fields = $('[id^=monitor-]');
	for ( ifield=0; ifield < fields.length; ifield++ ) {
		var field = fields[ifield];
		var id = field.id;
		var id_info = decode_id(id); // {field,monitor,type}
		var mon = mons_by_name[id_info.monitor];
		if ( (mon != undefined) && (mon[id_info.field] != undefined)) {
			var qfield = $('#'+encode_id(mon.name,id_info.field,id_info.type));
			if (field.type == "checkbox") {
				qfield.prop('checked', mon[id_info.field]);
			} else {
				var str = encode_value( mon[id_info.field], id_info.type );
				if (str != undefined) {
					if (field.type == "text") {
						qfield.val( str );
					} else if (field.tagName == "P") {
						qfield.text( str );
					}
				}
			}
		}
	}

	page.ignore_changes = false;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}

// Sends a setting to be stored in the db
monitors.sendSetting = function (event,monitor,setting,value,type,successFunc) {

	var page=this;
    event.preventDefault();
	page.debugMsg("sendSetting: "+setting+"="+value);
	$.ajax({
		type: 'POST',
		url: '/set_monitor_value/'+page.system_name+"/"+monitor+"/"+setting+"/"+value+'/'+type
	}).done(function( response ) {

		// Check for a successful (blank) response
		if (response.msg === '') {
			page.debugMsg("Back from sendSetting: "+setting+"="+value);
			page.updateStatus();
			if (successFunc != undefined) {
				successFunc();
			}
		}
		else {
			page.showError( response.code, response.msg );
		}
	});
}

// A set button was pressed.
monitors.setValue = function(event) {
	var page = this;

	if (page.ignore_changes) {return;}

	// Name of the button same as field to set with a -button suffix.
	var elem = event.target;
	while (!elem.id) {
		elem = elem.parentNode;
	}
	var val_id = strip_last_token(elem.id);
	var id_info = decode_id(val_id);
	var value = $('#'+val_id).val();
	page.sendSetting(  event, id_info.monitor, id_info.field, value, id_info.type );
}

// Event handler for switch press.
monitors.switchChange = function (event) {
	var page = event.data.page;

	if (page.ignore_changes) {return;}

	var elem = event.target;
	while (!elem.id) {
		elem = elem.parentNode;
	}
	var id = elem.id;
	var id_info = decode_id(id);
	var checked = $('#'+id).is(':checked');
	page.sendSetting(  event, id_info.monitor, "enabled", (checked ? "true" : "false"), "bool" );
}



// DOM Ready =============================================================


$(document).ready(function() {

	var page = monitors;

	var system_name_elem = $( '#system_name' )[0];
	if (system_name_elem == undefined) {
		// Loading the file as utilities.  Don't initialize"
		return
	}
	page.system_name = system_name_elem.value;

	// Setup
	var enable_cbs = $('[id^=monitor-enabled]');
	enable_cbs.checkboxpicker({
		onLabel: "On",
		offLabel: "Off"
	});

    // button events
    enable_cbs.on('change', {page: page}, monitors.switchChange);

	// handle enter in each edit to an associated push button.
	// The  buttons have -button at the end.
	var buttons = $("[id$='-button']");
	for ( var i=0; i < buttons.length; i++ ) {
		var button = buttons[i];
		var val_id = strip_last_token(button.id);
		$("#"+val_id).keyup(function(event) {
		    if (event.keyCode === 13) {
				$("#"+event.target.id+"-button").click();
			}
		});
	}

	page.setupStandard(page);
	page.updateStatus();
});

// Functions =============================================================


