
// Namespace
var power  = {

	debug: 1,
	debug_prefix : "POWER",
	progresspump : undefined,
	waiting_status : 0,
	ignore_status : 0,
	status_interval : 3000,

// Functions =============================================================

switchChange: function (event) {
	var elem = event.target;
	var instr_name = event.data.instr_name;
	while (!elem.id) {
		elem = elem.parentNode;
	}
	var id = elem.id;
	var unit = id.substring(1);
	var checked = $('#'+id+' :checkbox').is(':checked');
	var cmd = checked ? "on" : "off";

	power.sendCmd(event,cmd,instr_name,unit);
},

stopStatus: function()
{
	if (power.progresspump === undefined) {
	} else {
		clearInterval(power.progresspump);
		power.waiting_status = 0;
		power.progresspump = undefined;
	}
},

clearError: function()
{
	//var alert_box = $( "#alert_box" );
	//alert_box.find('p')[0].innerHTML = "";
	//alert_box.css('aria-hidden',true);
	//alert_box.hide();
},

showError: function ( code, message )
{
	//var alert_box = $( "#alert_box" );
	//alert_box.find('p')[0].innerHTML = message + "(" + code + ")";
	//alert_box.css('aria-hidden',false);
	//alert_box.show();
	console.log("ERROR: "+message);
},

// Start a status update loop if one is not already running.
updateSwitchStatus: function( instr_name )
{
	// Do nothing if there's already a loop going.
	if (power.progresspump !== undefined) {
		return;
	}
	power.waiting_status = 0; // In case its stale from last time?

	// Start the pump.
	power.progresspump = setInterval(function(){
	  if (!power.waiting_status) {
		power.waiting_status = 1;
		if (power.debug > 1) {
			console.log(power.debug_prefix+": Sending stat cmd");
		}
		$.getJSON( '/power_status/'+instr_name, function( data ) {
			if (data.error === undefined) {
				if (power.debug > 1) {
					console.log(power.debug_prefix+": Got switch status: "+data.on);
				}
				// Refresh checkboxes from data unless we were asked to ignore.
				if (power.ignore_status > 0) {
					power.ignore_status--;
				} else {
					var i;
					for (i = 0; i < data.on.length; i++ ) {
						$('#P'+i+" :checkbox").prop('checked', data.on[i]);
					}
					power.ignore_status = 0; // In case negative.
				}
			} else if (data.error == 429) {
				if (power.debug > 1) {
					console.log(power.debug_prefix+": Too busy for command");
				}
			} else {
				//power.showError( data.error, data.message );
				power.stopStatus();
			}
			power.waiting_status = 0;
		});
	}
  }, power.status_interval);
},

// Send command to the power panel.
sendCmd: function(event,cmd,instr_name,unit) {

    event.preventDefault();
	if (power.debug > 1) {
		console.log(power.debug_prefix+": Sending power panel cmd: "+cmd);
	}

	// If there's an outstanding status request, ignore it when the 
	// result comes in.
	if (power.waiting_status) {
		power.ignore_status++;
	}
	var url = "/power_cmd/" + cmd + "/" + instr_name + "/" + unit
	$.ajax({
		type: 'POST',
		url: url,
	}).done(function( response ) {

		// Check for a successful (blank) response
		if (response.msg === '') {
			if (power.debug > 1) {
				console.log(power.debug_prefix+": Back from power panel cmd: "+cmd);
			}
			power.updateSwitchStatus( instr_name );
		}
		else {
			alert('Error: ' + response.errorCode + ": " + response.msg);
		}
	});
}
}; // End namespace

// DOM Ready =============================================================

$(document).ready(function() {

	var instr_name = $( '#instr_name' )[0].value;

	// Setup
	$(':checkbox').checkboxpicker({
		onLabel: "On",
		offLabel: "Off"
	});

    // button events
    $(':checkbox').on('change', {instr_name: instr_name}, power.switchChange);

	// Start a status loop
	power.updateSwitchStatus( instr_name );
});

