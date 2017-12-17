
var power = new PageUtils( 1, "POWER", 3000 );

// Begins a periodic query for fixture status.
// Required signature.
power.updateStatus = function ()
{
	var page = this;

    if (page.waiting_status) {
		return;
	}
	page.waiting_status = 1;
	page.debugMsg("Sending power_status cmd");
	$.getJSON( '/power_status/'+page.instr_name, function(data) { page.handleStatus( data ) } );
}

// Event handler for switch press.
power.switchChange = function (event) {
	var page = event.data.page;

	var elem = event.target;
	while (!elem.id) {
		elem = elem.parentNode;
	}
	var id = elem.id;
	var unit = id.substring(1);
	var checked = $('#'+id+' :checkbox').is(':checked');
	var cmd = checked ? "on" : "off";

	power.sendCmd(event,cmd,unit);
}


// Start a status update loop if one is not already running.
power.handleStatus = function( data )
{
	var page = this;
	if (data.error === undefined) {
		page.debugMsg("Got switch status: "+data.on);
		// Refresh checkboxes from data unless we were asked to ignore.
		if (page.ignore_status > 0) {
			page.ignore_status--;
		} else {
			console.log("data="+JSON.stringify(data));
			var i;
			for (i = 0; i < data.on.length; i++ ) {
				$('#P'+i+" :checkbox").prop('checked', data.on[i]);
			}
			page.goodUpdate();
		}
	} else if (data.error == 429) {
		page.debugMsg("Too busy for command");
	} else {
		page.incrementFailedUpdates();
	}
	page.waiting_status = 0;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}

// Send command to the power panel.
power.sendCmd = function(event,cmd,unit) {

	var page = this;

    event.preventDefault();
	page.debugMsg( "Sending power panel cmd: "+cmd);

	// If there's an outstanding status request, ignore it when the 
	// result comes in.
	if (page.waiting_status) {
		page.ignore_status++;
	}
	var url = "/power_cmd/" + cmd + "/" + page.instr_name + "/" + unit
	$.ajax({
		type: 'POST',
		url: url,
	}).done(function( response ) {

		// Check for a successful (blank) response
		if (response.msg === '') {
			page.debugMsg("Back from power panel cmd: "+cmd);
			page.updateStatus();
		}
		else {
			page.showError( 0, response.msg );
			page.setUpdateInterval(0);
		}
	});
}

// Update function for dashboard widget.
// Set the color for each switch in the mini-table.
power.widgetUpdate = function(instr,data) {
	var page = this;

	var i;
	for (i = 0; i < data.on.length; i++ ) {
		var color = (data.on[i] ? "green" : "red");
		$('#MP'+i).css('background-color', color);
	}
}

// DOM Ready =============================================================

$(document).ready(function() {

	var page = power;

	var instr_elem = $( '#instr_name' )[0];
	if (instr_elem == undefined) {
		// Loading the file as utilities.  Don't initialize"
		return
	}
	page.instr_name = instr_elem.value;

	// Setup
	var power_cbs = $('.rc_one_switch_table :checkbox');
	power_cbs.checkboxpicker({
		onLabel: "On",
		offLabel: "Off"
	});

    // button events
    power_cbs.on('change', {page: page}, power.switchChange);

	page.setupStandard(page);

	// Start a status loop
	page.updateStatus();
});

