
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

temp.calcAve = function( t0, t1 ) {

	var tave = 0.0;
	if ((t0 > 0.0) && (t1 > 0.0)) {
		tave = (t0 + t1)/2;
	} else if (t0 > 0.0) {
		tave = t0;
	} else {
		tave = t1;
	}
	return tave;
}

temp.updateHeaterOn = function( heat ) {
	var hon = $('#heater_on');
	var add = heat ? "label-danger" : "label-primary";
	var remove = "label-default " + (heat ? "label-primary" : "label-danger");
	var suff = heat ? "On" : "Off";
	var text = "Heater " + suff;
	hon.removeClass(remove).addClass(add);
	hon.text(text);
}

// Handler for status updated.   
temp.handleStatus = function ( data ) {

	var page = this;

	if (data.error === undefined) {
		page.debugMsg("Got stand status: "+JSON.stringify(data));
		
		var t0 = (data.temp0==undefined) ? 0.0 : data.temp0;
		var t1 = (data.temp1==undefined) ? 0.0 : data.temp1;
		var tset = data.tset;
		var tper = data.tper;
		var tsens = data.tsens;
		var tave = page.calcAve(t0,t1);
		$('#t_ave').text(tave.toFixed(1));
		$('#t_disp').text(t0.toFixed(1));
		$('#t_sump').text(t1.toFixed(1));

		var target = $('#targetTemp');
		var sample = $('#samplePeriod');
		var sens = $('#sensitivity');
		if (target.val() == "") {
			target.val(tset);
		}
		if (sample.val() == "") {
			sample.val(tper);
		}
		if (sens.val() == "") {
			sens.val(tsens);
		}


		page.updateHeaterOn(data.heat);

		var ton = $('#t_on');
		var ton_label = $('#t_on_label');
		var suff = data.heat ? "On" : "Off";
		var label = "Time " + suff;
		ton_label.text("Time "+suff+":");
		ton.text( page.StoHMS(data.theat/1000) );

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
temp.widgetUpdate = function(instr,data) {
	var page = this;
	var t0 = (data.temp0==undefined) ? 0.0 : data.temp0;
	var t1 = (data.temp1==undefined) ? 0.0 : data.temp1;
	var tave = page.calcAve(t0,t1);
	$('#ave_temp').html(tave.toFixed(1)+" &#8457;");
	$('#disp_temp').text("Display: "+t0.toFixed(1));
	$('#sump_temp').text("Sump: "+t1.toFixed(1));

	page.updateHeaterOn(data.heat);
}
temp.setTargetTemp = function(event) {
	var page=this;
	var input = $('#targetTemp');
	var value = input.val();
	if ( isNaN(value) ) {
		page.showError( 0, "Must enter a number for target temp!");
		input.select(); input.focus();
		return;
	}
	var min = 65.0;
	var max = 85.0;
	if ((value < min) || (value > max)) {
		page.showError( 0, "Temperatures must be between "+min+" and "+max+" deg F.");
		input.select(); input.focus();
		return;
	}
	page.sendCmd(event,"stt", value+"/0/0.0", function() {
		page.sendCmd(event,"sset");
	});
}

temp.setSensitivity = function(event) {
	var page=this;
	var input = $('#sensitivity');
	var value = input.val();
	if ( isNaN(value) ) {
		page.showError( 0, "Must enter a number for sensitivity!");
		input.select(); input.focus();
		return;
	}
	var min = 0.1;
	var max = 2.0;
	if ((value < min) || (value > max)) {
		page.showError( 0, "Sensitivity must be between "+min+" and "+max+" deg F.");
		input.select(); input.focus();
		return;
	}
	page.sendCmd(event,"stt", "0.0/0/"+value, function() {
		page.sendCmd(event,"sset");
	});
}

temp.setSamplePeriod = function(event) {
	var page=this;
	var input = $('#samplePeriod');
	var value = input.val();
	if (parseInt(value) != value) {
		page.showError( 0, "Must enter an integer for sample period! ("+value+")");
		input.select(); input.focus();
		return;
	}
	var min = 100;
	var max = 100000;
	if ((value < min) || (value > max)) {
		page.showError( 0, "Sample period must be between "+min+" and "+max+" ms");
		input.select(); input.focus();
		return;
	}
	page.sendCmd(event,"stt", "0.0/"+value+"/0.0", function() {
		page.sendCmd(event,"sset");
	});
}

// Sends a command to the stand.
temp.sendCmd = function (event,cmd,arg,successFunc) {

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

    $('#cal_disp_open').on('click', function (event) {page.calStartStop(event,"disp");});
    $('#cal_sump_open').on('click', function (event) {page.calStartStop(event,"sump");});

	page.setupStandard(page);
	page.updateStatus();
});

// Functions =============================================================


