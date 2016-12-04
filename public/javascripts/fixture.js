// DOM Ready =============================================================

var debug_fixture = 1;

$(document).ready(function() {

	var instr_name = $( '#instr_name' )[0].value;

    // Fixture button events
    $('#btnUp').on('click', function (event) {fixtureCmd(event,"up",instr_name)});
    $('#btnDown').on('click', function (event) {fixtureCmd(event,"down",instr_name)});
    $('#btnStop').on('click', function (event) {stopHeightProgress(); fixtureCmd(event,"stop",instr_name)});
});

// Functions =============================================================

function clearError()
{
	var alert_box = $( "#alert_box" );
	alert_box.find('p')[0].innerHTML = "";
	alert_box.css('aria-hidden',true);
	alert_box.hide();
}

function showError( code, message )
{
	var alert_box = $( "#alert_box" );
	alert_box.find('p')[0].innerHTML = message + "(" + code + ")";
	alert_box.css('aria-hidden',false);
	alert_box.show();
}

var progresspump;
var waiting_height = 0;

function stopHeightProgress()
{
	if (progresspump === undefined) {
	} else {
		clearInterval(progresspump);
		waiting_height = 0;
		progresspump = undefined;
	}
}

// Begins a periodic query for fixture height, and updates the progress bar.
function updateHeightProgress( instr_name )
{
	if (progresspump !== undefined) {
		return;
	}
    waiting_height = 0;
	progresspump = setInterval(function(){
	if (!waiting_height) {
		waiting_height = 1;
		if (debug_fixture) {
			console.log("FIXTURE: Sending fixture_height cmd");
		}
		$.getJSON( '/fixture_height/'+instr_name, function( data ) {
			if (data.error === undefined) {
				if (debug_fixture) {
					console.log("FIXTURE: Got height data: "+data.height+","+data.moving);
				}
				var prog_bar = $('#height_progress');
				prog_bar.css('width', data.height+'%')
				prog_bar.attr('aria-valuenow', data.height+"%");
				if (!data.moving) {
					stopHeightProgress();
				}
			} else if (data.error == 429) {
				if (debug_fixture) {
					console.log("FIXTURE: Too busy for fixture_height");
				}
			} else {
				showError( data.error, data.message );
				stopHeightProgress();
			}
			waiting_height = 0;
		});
	}
  }, 200);
}

// Fixture stop.
function fixtureCmd(event,cmd,instr_name) {

    event.preventDefault();
	if (debug_fixture) {
		console.log("FIXTURE: Sending fixture cmd: "+cmd);
	}
	$.ajax({
		type: 'POST',
		url: '/fixture_cmd/'+cmd+"/"+instr_name,
	}).done(function( response ) {

		// Check for a successful (blank) response
		if (response.msg === '') {
			if (debug_fixture) {
				console.log("FIXTURE: Back from fixture cmd: "+cmd);
			}
			updateHeightProgress( instr_name );
		}
		else {
			alert('Error: ' + response.errorCode + ": " + response.msg);
		}
	});
};
