
var monitors = new PageUtils( 1, "MONITORS", 0, 0 );


// Begins a periodic query for temp status.
// Required signature.
temp.updateStatus = function ()
{
	var page = this;

    if (page.waiting_status) {
		return;
	}
	page.waiting_status = 1;
	page.debugMsg("Sending stand status");
	$.getJSON( '/monitor_satus/'+page.system_name, function(data) { page.handleStatus( data ) } );
}

// Handler for status updated.   
temp.handleStatus = function ( data ) {

	var page = this;

	if (data.error === undefined) {
		page.debugMsg("Got monitor status: "+JSON.stringify(data));
		
		page.goodUpdate();
	} else if (data.error == 429) {
		page.debugMsg("Too busy for stand_stat");
		page.setUpdateInterval(2000);
	} else {
		page.incrementFailedUpdates();
	}
	page.waiting_status = 0;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}

// Sends a command to the monitors.
temp.sendCmd = function (event,cmd,monitor,arg,successFunc) {

	var page=this;
    event.preventDefault();
	page.debugMsg("Sending monitors cmd: "+cmd);
	$.ajax({
		type: 'POST',
		url: '/monitors/'+cmd+"/"+page.system_name+"/"+monitor+((arg==undefined)?"":("/"+arg))
	}).done(function( response ) {

		// Check for a successful (blank) response
		if (response.msg === '') {
			page.debugMsg("Back from monitor cmd: "+cmd);
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


// DOM Ready =============================================================


$(document).ready(function() {

	var page = temp;

	var instr_elem = $( '#instr_name' )[0];
	if (instr_elem == undefined) {
		// Loading the file as utilities.  Don't initialize"
		return
	}
	page.instr_name = instr_elem.value;

	page.setupStandard(page);
	page.updateStatus();
});

// Functions =============================================================


