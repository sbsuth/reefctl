
var probes = new PageUtils( 1, "PROBES", 5000, 60000 );


// Begins a periodic query for probes status.
// Required signature.
probes.updateStatus = function ()
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
probes.handleStatus = function ( data ) {

	var page = this;

	if (data.error === undefined) {
		page.debugMsg("Got stand status: "+JSON.stringify(data));
		page.clearError();
		
		var pH = (data.pH==undefined) ? 0.0 : parseFloat(data.pH.replace(/^\"/,''));
		var EC = (data.EC==undefined) ? 0.0 : data.EC;
		var SAL = (data.SAL==undefined) ? 0.0 : data.SAL;
		var SG = (data.SG==undefined) ? 0.0 : parseFloat(data.SG.replace(/^\"/,''));
		var TDS = (data.TDS==undefined) ? 0.0 : data.TDS;
		$('#cur_ph').text(pH.toFixed(2));
		$('#cur_sg').text(SG.toFixed(3));
		$('#cur_sal').text(SAL.toFixed(1));
		$('#cur_cond').text(EC.toFixed(0));
		$('#cur_tds').text(TDS.toFixed(0));

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

// Update function for dashboard widget.
probes.widgetUpdate = function(instr,data) {
	var page = this;

	var pH = (data.pH==undefined) ? 0.0 : data.pH;
	var SG = (data.SG==undefined) ? 0.0 : data.SG;
	$('#cur_ph').text(pH.toFixed(1));
	$('#cur_sg').text(SG.toFixed(1));
}


// Sends a command to the stand.
probes.sendCmd = function (event,cmd,arg,successFunc) {

	var page=this;
    event.preventDefault();
	page.debugMsg("Sending stand cmd: "+cmd);
	$.ajax({
		type: 'POST',
		url: '/stand_cmd/'+cmd+"/"+page.instr_name+((arg==undefined)?"":("/"+arg))
	}).done(function( response ) {

		// Check for a successful (blank) response
		if (response.msg === '') {
			page.debugMsg("Back from stand cmd: "+cmd);
			page.clearError();
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

	var page = probes;

	var instr_elem = $( '#instr_name' )[0];
	if (instr_elem == undefined) {
		// Loading the file as utilities.  Don't initialize"
		return
	}
	page.instr_name = instr_elem.value;

    $('#cal_pH_open').on('click', function (event) {page.calStartStop(event,"pH");});
    $('#cal_ec_open').on('click', function (event) {page.calStartStop(event,"ec");});

	page.setupStandard(page);
	page.updateStatus();
});

// Functions =============================================================


