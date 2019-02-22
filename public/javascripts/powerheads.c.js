
var powerheads = new PageUtils( 1, "POWERHEADS", 2000, 20000, 0 );
var pumps = powerheads;


// Begins a periodic query for powerhead status.
// Required signature.
powerheads.updateStatus = function ()
{
	var page = this;

    if (page.waiting_status) {
		return;
	}
	var fuse_ms = 5*1000;
	page.waiting_status = 1;
	var url = '/stand_status/'+page.instr_name+"/"+fuse_ms+'/pump';
	page.debugMsg("Sending command: "+url);
	$.getJSON( url, function(data) { page.handleStatus( data ) } );
}

powerheads.updateSpeed = function( ph, speed ) {
	if (isNaN(speed)) {
		speed = 0.0;
	}
	speed = speed.toFixed(0);
	var speed_bar = $('#speed_progress_'+ph);
	var h_entry = $('#curSpeedEntry_'+ph);
	var h_cur = $('#curSpeed_'+ph);
	speed_bar.css('width', speed+'%')
	speed_bar.attr('aria-valuenow', speed+"%");
	h_entry.val(speed);
	h_cur.text(speed+"%");
}

powerheads.updateTempShutdown = function( ph, timeLeft ) {
	var h_label = $('#temp_shutdown_label_'+ph);
	var h_text = $('#temp_shutdown_'+ph);
	if (timeLeft > 0) {
		h_label.show();
		h_text.show();
		h_text.text("Shutdown for "+timeLeft+" more seconds....");
	} else {
		h_label.hide();
		h_text.hide();
	}
}

powerheads.updateSettings = function( ph, values ) {

	var page = this;

	var controls = page.controls[ph];
	controls[0].input.val( values.mode );
	controls[1].input.val( values.top_speed );
	controls[2].input.val( values.slow_speed );
	if (controls[3]) { controls[3].input.val( values.hold_sec ); }
	if (controls[4]) {controls[4].input.val( values.hold_range ); }
	if (controls[5]) {controls[5].input.val( values.ramp_sec ); }
	if (controls[6]) {controls[6].input.val( values.ramp_range ); }
}

// Return a clone of the data without the non-settings fields.
powerheads.settingsStr = function( data ) {
	var clone = $.extend(true,{},data);
	delete clone.on;
	delete clone.cur_speed;
	delete clone.last_change;
	return JSON.stringify(clone);
}

// Handler for status updated.   Updates the progress bar.
// If error, updates stop.
powerheads.handleStatus = function ( data ) {

	var page = this;

	if (page.ignore_status) {
		return;
	}

	if (data.error === undefined) {
		var i;
		var pdata = [];

		for (i=0; i < page.num_pumps; i++ ) {
			pdata.push( data[page.i_pstat[i]]);
			page.updateSpeed( i, pdata[i].cur_speed);
			page.updateTempShutdown(i, pdata[i].temp_shutdown);

			// Update settings if they haven't changed since last time.
			// Not overwriting keeps us from blasting things being entered by users.
			var settings_str = page.settingsStr(pdata[i]);
			if (settings_str != page.last_settings[i]) {
				page.updateSettings( i, pdata[i]);
				page.last_settings[i] = settings_str;
			}
			page.enable_controls(i);
		}
		page.debugMsg("New pump status: "+JSON.stringify(pdata));
		page.goodUpdate();
	} else if (data.error == 429) {
		page.debugMsg("Too busy for status_status/pump");
		page.setUpdateInterval(2000);
	} else {
		page.incrementFailedUpdates();
	}
	page.waiting_status = 0;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}

// Update function for dashboard widget.
powerheads.widgetUpdate = function(instr,data) {
	var page = powerheads;
	for ( var i=0; i < page.num_pumps; i++ ) {
		var h_mode = $('#ph_mode_'+i);
		var h_speed = $('#ph_speed_'+i);
		var d = data[page.i_pstat[i]];
		h_mode.text(page.mode_names[d.mode]);
		h_speed.text(d.cur_speed+"%");
	}

}

powerheads.validateInt = function( input, descr, min, max ) {
	var page = this;
	var value = input.val();
	if (parseInt(value) != value) {
		page.showError( 0, "Must enter an integer for "+descr+"! ("+value+")");
		input.select(); input.focus();
		return false;
	}
	if ((value < min) || (value > max)) {
		page.showError( 0, descr+" must be between "+min+" and "+max);
		input.select(); input.focus();
		return false;
	}
	return true;
}

// True if one of the controls in the given set (mode || !mode) has changed.
powerheads.controlsChanged = function( index, mode ) {
	var page = this;
	for ( var i=0; i < page.changed_controls[index].length; i++ ) {
		var control = page.controls[index][i];
		if ((mode && control.is_mode) || (!mode && !control.is_mode)) {
			if (page.changed_controls[index][i]) {
				return true;
			}
		}
	}
	return false;
}

// Clears the changed bit for the given PH, for the give mode|!mode.
powerheads.clearControlsChanged = function( index, mode ) {
	var page = this;
	for ( var i=0; i < page.changed_controls[index].length; i++ ) {
		var control = page.controls[index][i];
		if ((mode && control.is_mode) || (!mode && !control.is_mode)) {
			page.changed_controls[index][i] = false;
		}
	}
}


// Set the top speed and slow speed.
powerheads.set_speed = function( event, index, modeAlso ) {
	var page=this;
	var controls = page.controls[index];
	var top_speed = controls[1];
	var slow_speed = controls[2];
	if (modeAlso == undefined) {
		modeAlso = true;
	}

	if (!page.validateInt( top_speed.input, top_speed.label.text(), 0, 100 )) {
		return;
	}
	if (!page.validateInt( slow_speed.input, slow_speed.label.text(), 0, 100 )) {
		return;
	}
	// Set both speeds.
	page.ignore_status++;
	page.sendCmd(event,"pspd", page.i_pstat[index]+"/"+top_speed.input.val()+"/"+slow_speed.input.val(), function() {
		page.last_settings[index] = "";
		page.clearControlsChanged(index,false);

		// Set the mode also if it has changed.
		if (modeAlso) {
			if (page.controlsChanged(index,true)) {
				page.set_mode( event, index, false );
			}
			page.sendCmd(event,"sset"); // Once for both, but never on recursion.
		}
	});
	page.ignore_status--;
}

// Set the mode values given one new one.
powerheads.set_mode = function( event, index, speedAlso ) {
	var page=this;
	var controls = page.controls[index];
	var mode = controls[0];
	var hold_sec = controls[3];
	var hold_range = controls[4];
	var ramp_sec = controls[5];
	var ramp_range = controls[6];

	if (speedAlso == undefined) {
		speedAlso = true;
	}

	if ( mode.input.val() < 0) {
		page.showError( 0, "Must select a mode");
		mode.input.select(); mode.input.focus();
		return;
	}
	if (hold_sec && !page.validateInt( hold_sec.input, hold_sec.label.text(), 1, 1000 )) {
		return;
	}
	if (hold_range && !page.validateInt( hold_range.input, hold_range.label.text(), 0, 100 )) {
		return;
	}
	if (ramp_sec && !page.validateInt( ramp_sec.input, ramp_sec.label.text(), 1, 1000 )) {
		return;
	}
	if (ramp_range && !page.validateInt( ramp_range.input, ramp_range.label.text(), 0, 100 )) {
		return;
	}
	// Combine hold and range as <hold_sec>.<range_pct>
	var hold_spec = 0;
	if (hold_sec && hold_range) {
		hold_spec = (hold_sec.input.val()*1.0) + ((hold_range.input.val()*1.0)/100.0);
	}
	var ramp_spec = 0;
	if (ramp_sec && ramp_range) {
		ramp_spec = (ramp_sec.input.val()*1.0) + ((ramp_range.input.val()*1.0)/100.0);
	}

	// Set mode and all params.
	page.ignore_status++;
	var cmd = page.i_pstat[index]+'/'+mode.input.val()+'/'+hold_spec.toFixed(2)+'/'+ramp_spec.toFixed(2);
	page.sendCmd(event,"mset", cmd, function() {
		page.last_settings[index] = "";
		page.clearControlsChanged(index,false);

		// Set the speed also if it has changed.
		if (speedAlso) {
			if (page.controlsChanged(index,false)) {
				page.set_speed( event, index, false );
			}
			page.sendCmd(event,"sset"); // Once for both, but never on recursion.
		}
	});
	page.ignore_status--;
}

// A mode was selected.  Enable and disable other controls.
powerheads.enable_controls = function( index ) {
	var page=this;

	var mode = page.controls[index][0].input;
	var enable = undefined;
	var modeVal = mode.val();
	switch ( Number(modeVal)) {
		case 0:  // Constant 
			enable = [0,1];
			break;
		case 1:  // Slow 
			enable = [0,2];
			break;
		case 2:  // Square 
			enable = [0,1,2,3,4];
			break;
		case 3: // Ramp 
			enable = [0,1,2,3,4,5,6];
			break;
		case 4: // Off 
		case 5:  // Test 
			enable = [0];
			break;
		case 6: // Sin 
			enable = [0,1,2,5,6];
			break;
	}
	for ( var i=1; i < 7; i++ ) {
		var disabled = Boolean((enable == undefined) || (enable.indexOf(i) < 0));
		var cell = page.controls[index][i];
		if (cell != undefined) {
			cell.input.prop('disabled',disabled);
			cell.button.prop('disabled',disabled);
		}
	}
}

// One of the control inputs has changed.
powerheads.onControlChanged = function( icontrol, index ) {
	var page = this;

	page.changed_controls[index][icontrol] = true;

	page.enable_controls(index);
}


// Sends a command to the stand.
powerheads.sendCmd = function (event,cmd,arg,successFunc) {

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

powerheads.setTopSpeed = function(event,i) {
	var page=this;
	var input = $('#topSpeed_'+i);
	var value = input.val();
	if ( isNaN(value) || (value < 0) || (value > 100)) {
		page.showError( 0, "Must enter a number between 0 and 100 for top speed!");
		input.select(); input.focus();
		return;
	}
	page.sendCmd(event,"pspd", i+"/"+value, function() {
		page.sendCmd(event,"sset");
	});
}


// DOM Ready =============================================================


$(document).ready(function() {

	var page = powerheads;
	page.last_settings = ["",""];;
	page.mode_names = ["Constant","Slow","Square","Ramp","Off","Test","Sin"];

	page.i_pstat = []; // Indexes in pump status array for each powerhead.

	var instr_elem = $( '#instr_name' )[0];
	page.num_pumps = $( '#num_pumps' )[0].value;
	if (instr_elem == undefined) {
		// Loading the file as utilities.  Don't initialize"
		return
	}
	page.instr_name = instr_elem.value;

	

	// 2D array of controls for easy access.
	page.controls = new Array();
	page.changed_controls = new Array();
	for (var i=0; i < page.num_pumps; i++ ) {
		var ctrls = new Array();
		page.controls.push(ctrls);
		page.changed_controls.push( new Array() );

		// Store the pump nums stored in pump_num_<index> controls.
		var pump_num_ctrl = $("#pump_num_"+i);
		var pump_num = pump_num_ctrl.val();
		page.i_pstat.push( pump_num );
		
		// Use the values of the '<id>_row_<index>' hidden inputs to get a list of names.
		$("[id$=row_"+i+"]").each( function() { 
			var name = $(this).val();
			var button = $('#set_'+name+"_"+i);
			// Look for set_mode in onclick to identify mode controls.
			var is_mode = Boolean( String(button.attr("onclick")).indexOf("set_mode") >= 0);
			ctrls.push({ input:  $('#'+name+"_"+i),
						 button: button,
						 label: $('#'+name+"_label_"+i),
						 is_mode: is_mode
						});
			page.changed_controls[i].push(false);
		});
		page.enable_controls(i);
	}
	page.setupStandard(page);
	page.updateStatus();
});

// Functions =============================================================


