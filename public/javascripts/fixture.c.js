
var fixture = new PageUtils( 1, "FIXTURE", 2000 );


// Begins a periodic query for fixture status.
// Required signature.
fixture.updateStatus = function ()
{
	var page = this;

    if (page.waiting_status) {
		return;
	}
	page.waiting_status = 1;
	page.debugMsg("Sending fixture_height cmd");
	$.getJSON( '/fixture_height/'+page.instr_name, function(data) { page.handleStatus( data ) } );
}

// Handler for status updated.   Updates the progress bar.
// If the fixture is moving, next update is fast.  If not, next update is slow.
// If error, updates stop.
fixture.handleStatus = function ( data ) {

	var page = this;

	if (data.error === undefined) {
		page.debugMsg("Got height data: "+data.height+","+data.moving);
		var prog_bar = $('#height_progress');
		var h_entry = $('#curHeightEntry');
		var h_cur = $('#curHeight');
		prog_bar.css('width', data.height+'%')
		prog_bar.attr('aria-valuenow', data.height+"%");
		h_entry.val(data.height);
		h_cur.text(data.height+"%");
		page.setUpdateInterval(data.moving ? 200 : 2000);
	} else if (data.error == 429) {
		page.debugMsg("Too busy for fixture_height");
		page.setUpdateInterval(2000);
	} else {
		page.showError( data.error, data.message );
		page.setUpdateInterval(0);
	}
	page.waiting_status = 0;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}

// Sends the contents of the curHeightEntry to the fixture.
// NO COMMAND FOR THIS YET.
fixture.setCurHeight = function () {
	var page=this;
	var h = $('#curHeightEntry').val();
	if ((h < 0) || (h > 100)) {
		page.showError( "Enter a height as a percentage between 0 and 100", 1 );
		return;
	}
	console.log("INCOMPLETE!: Send height "+h);
}

// Sends a command to the fixture.
fixture.sendCmd = function (event,cmd) {

	var page=this;
    event.preventDefault();
	page.debugMsg("Sending fixture cmd: "+cmd);
	$.ajax({
		type: 'POST',
		url: '/fixture_cmd/'+cmd+"/"+page.instr_name,
	}).done(function( response ) {

		// Check for a successful (blank) response
		if (response.msg === '') {
			page.debugMsg("Back from fixture cmd: "+cmd);
			page.updateStatus();
		}
		else {
			page.showError( response.code, response.msg );
		}
	});
}


// DOM Ready =============================================================


$(document).ready(function() {

	var page = fixture;
	var instr_name = $( '#instr_name' )[0].value;
	page.instr_name = instr_name;

    // Fixture button events
    $('#btnUp').on('click', function (event) {fixture.sendCmd(event,"up")});
    $('#btnDown').on('click', function (event) {fixture.sendCmd(event,"down")});
    $('#btnStop').on('click', function (event) {fixture.sendCmd(event,"stop")});
    $('#setCurHeight').on('click', function (event) {fixture.setCurHeight();});
	page.setupStandard(page);
	page.updateStatus();
});

// Functions =============================================================


