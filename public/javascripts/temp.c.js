
var temp = new PageUtils( 1, "TEMP", 5000 );


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
	$.getJSON( '/stand_status/'+page.instr_name, function(data) { page.handleStatus( data ) } );
}

// Handler for status updated.   
temp.handleStatus = function ( data ) {

	var page = this;

	if (data.error === undefined) {
		page.debugMsg("Got stand status: "+JSON.stringify(data));
	} else if (data.error == 429) {
		page.debugMsg("Too busy for stand_stat");
		page.setUpdateInterval(2000);
	} else {
		page.showError( data.error, data.message );
		page.setUpdateInterval(0);
	}
	page.waiting_status = 0;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}

// Update function for dashboard widget.
temp.widgetUpdate = function(instr,data) {
	var page = this;

}

// Sends a command to the stand.
temp.sendCmd = function (event,cmd) {

	var page=this;
    event.preventDefault();
	page.debugMsg("Sending stand cmd: "+cmd);
	$.ajax({
		type: 'POST',
		url: '/stand_cmd/'+cmd+"/"+page.instr_name,
	}).done(function( response ) {

		// Check for a successful (blank) response
		if (response.msg === '') {
			page.debugMsg("Back from stand cmd: "+cmd);
			page.updateStatus();
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

    $('#cal_disp_open').on('click', function (event) {page.calStartStop(event,"disp");});
    $('#cal_sump_open').on('click', function (event) {page.calStartStop(event,"sump");});

	page.setupStandard(page);
	page.updateStatus();
});

// Functions =============================================================


