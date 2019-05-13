function PageUtils ( useDebug, usePrefix, useInterval, slowInterval, idleInterval ) {
	this.debug = useDebug;
	this.debug_prefix = usePrefix;
	this.waiting_status  = 0;
	this.ignore_status  = 0;
	this.status_interval  = useInterval;
	this.slow_interval  = (slowInterval == undefined) ? useInterval : slowInterval;
	this.idle_interval  = (idleInterval == undefined) ? useInterval : idleInterval;
	this.last_update_restart = 0;
	this.num_failed_updates  = 0;
	if (useInterval > 0) {
		this.disable_status = false;
	} else {
		this.disable_status = true;
	}

	this.clearError = function() {
		var alert_box = $( "#alert_box" );
		if (alert_box != undefined) {
			alert_box.find('p')[0].innerHTML = "";
			alert_box.css('aria-hidden',true);
			alert_box.hide();
		}
	}

	this.showError = function ( code, message, elem ) {
		var alert_box = $( "#alert_box" );
		var msgText = "ERROR: " + this.debug_prefix + ": " + message;
		if (code > 0) {
			msgText += "(" + code + ")";
		}
		if ((alert_box != undefined) && (Object.keys(alert_box).length > 0)) {
			alert_box.find('p')[0].innerHTML = msgText;
			alert_box.css('aria-hidden',false);
			alert_box.show();
		}
		if (this.debug) {
			console.log(msgText);
		}
		if (elem) {
			elem.select();
		}
	}
	this.debugMsg = function( msg ) {
		if (this.debug) {
			console.log(this.debug_prefix+": "+msg);
		}
	}

	this.setupStandard = function( page ) {
		// Update checkbox.
		var monitor_cb = $( "#monitor_cb:checkbox" );
		if (monitor_cb != undefined) {
			monitor_cb.prop('checked', true );
			monitor_cb.on('change', {page: page}, page.monitorChanged);
		}
	}
	this.monitorChanged = function(event) {
		var page = event.data.page;
		var monitor_cb = $( "#monitor_cb:checkbox" );
		if (monitor_cb != undefined) {
			page.last_update_restart = new Date().getTime();
			var checked = monitor_cb.is(":checked");
			if (checked) {
				page.disable_status = false;
				page.scheduleStatusUpdate();
			} else {
				page.disable_status = true;
			}
			page.debugMsg("disable_status="+page.disable_status);
		}
	}

	this.goodUpdate = function() {
		var page = this;
		page.ignore_status = 0; // In case negative.
		page.num_failed_updates = 0;
	}

	this.incrementFailedUpdates = function() {
		var page = this;
		page.num_failed_updates++;
		if (page.num_failed_updates > 3) {
			page.debugMsg("Failed on "+page.num_failed_updates+" updates.  Disabling updates");
			page.num_failed_updates = 0;
			page.disableStatusUpdates();
		}
	}

	// Sets the initial status rate, and resets the timer.
	// Disables if 0.
	this.setUpdateInterval = function( ms ) {
 		var page = this;
		if (ms > 0) {
			page.status_interval = ms;
		} else {
			page.disable_status = true;
		}
 		page.num_failed_updates = 0;
 		var monitor_cb = $( "#monitor_cb:checkbox" );
 		if (monitor_cb != undefined) {
			monitor_cb.prop('checked', !page.disable_status );
 		}
		page.last_update_restart = new Date().getTime();
 	}

	this.disableStatusUpdates = function() {
		var page = this;
		page.disable_status = true;
		page.num_failed_updates = 0;
		var monitor_cb = $( "#monitor_cb:checkbox" );
		if (monitor_cb != undefined) {
			monitor_cb.prop('checked', false );
		}
	}
	this.scheduleStatusUpdate = function() {

		var page = this;
		if (page.disable_status || (page.status_interval <= 0)) {
			return;
		}
		// get time since start of status update, and choose update speed accordingly.
		var now = new Date().getTime();
		var delta = (now - page.last_update_restart);
		var interval = page.status_interval;
		if (delta > (5 * 60000)) {
			interval = page.idle_interval;
		} else if (delta > (1 * 60000)) {
			interval = page.slow_interval;
		}
		if (interval > 0) {
			if (page.activeTimeout) {
				clearTimeout(page.activeTimeout);
			}
			page.activeTimeout = setTimeout( function() { page.activeTimeout = undefined; page.updateStatus() }, interval );
		} else {
			page.disableStatusUpdates();
		}
	}
	
	// Enable/disable calibration elements.
	this.calEnable = function( cal, iprev ) {
		var page = this;
		var inext = iprev + 1;
		if (iprev >= 0) {
			// Disable iprev.
			var cell = cal.cells[iprev];
			cell.value.prop('disabled',true);
			cell.send.prop('disabled',true);
			cell.send.find('i').removeClass('glyphicon-upload glyphicon-unchecked').addClass('glyphicon-check');
		}

		// Enable the next row to be entered.
		if (inext < cal.cells.length) {
			var cell = cal.cells[inext];
			cell.value.prop('disabled',false);
			cell.send.prop('disabled',false);
			cell.send.find('i').removeClass('glyphicon-unchecked glyphicon-check').addClass('glyphicon-upload');
			cell.send.on('click', function() {page.calStep(cal,inext);} );
			if (cal.help != undefined) {
				var substText = cell.value.attr('placeholder');
				var text = 
				cal.help.help.text( cal.help.help_text.replace('_label_',substText));
			}
		} else {
			if (cal.help != undefined) {
				cal.help.help.text('');
			}
		}

		// Disable all the following steps
		for ( var istep=inext+1; istep < cal.cells.length; istep++ ) {
			var cell = cal.cells[istep];
			cell.value.prop('disabled',true);
			cell.send.prop('disabled',true);
			cell.send.find('i').removeClass('glyphicon-upload glyphicon-upload').addClass('glyphicon-unchecked');
		}
	}

	// Updates a calibration wizard, moving from iprev to the next step.
	this.calStep = function(cal,iprev) {

		var page = this;
		var inext = iprev + 1;

		if (iprev >= 0) {
			// Send a step.
			var url = cal.cmd + "/" + iprev;
			var cell = cal.cells[iprev];
			if (cell.value != undefined) {
				var value = cell.value.val();
				if (cell.value.is(":visible")) {
					// If there is a value to be entered, make sure its a number.
					if (isNaN(value)) {
						page.showError("Must enter a number",0);
						cell.value.select();
						cell.value.focus();
						return;
					}
					url += "/" + value;
				}
			}
			// Send the calibration commens.
			page.debugMsg("Sending command: \'"+url+"\'");
			cal.stat.text("Performing calibration step...");
			cell.send.prop('disabled',true);
			$.ajax({
				type: 'POST',
				url: url,
			}).done(function( response ) {
				// Check for a successful (blank) response with a true value.
				if ((response.msg === '') && (response.body.value == true)) {
					page.debugMsg("Calibration step succeeded");

					// Update status.
					if (inext == cal.cells.length) {
						cal.stat.text("Calibration comple!");
					} else if (cell.value != undefined) {
						cal.stat.text("Successfully sent calibration value for "+cell.value.attr('placeholder'));
					} else {
						cal.stat.text("Successfully sent calibration value");
					}

					// Update enables for the next step.
					page.calEnable( cal, iprev );
				}
				else {
					cal.stat.text("Error performing calibration step!");
					page.showError( 0, (response.msg != "") ? response.msg : " instrument error");
					cell.send.prop('disabled',false);
				}

			});
		} else {
			page.calEnable( cal, iprev );
			cal.stat.text("Ready to begin calibration");
		}

	}

	// Calibration session started or stopped.
	this.calStartStop = function( event, id ) {
		var page = this;
		var row = $('#cal_'+id+"_row");
		if (row == undefined) {
			return;
		}
		// Find the elements.
		var stat = $('#cal_'+id+'_status'); 
		var cmd = $('#cal_'+id+'_cmd').val(); 
		var help = $('#cal_'+id+'_help'); // Control we will set.  Maybe missing.
		if (help.length) {
			var help_text = $('#cal_'+id+'_help_text'); // hidden input with text.
			help = {help: help, help_text: help_text.val()};
		}
		// Find as many steps as there are.
		var istep = 0;
		var cells = [];
		while (1) {
			var cell = $('#cal_'+id+'_step_'+istep+'_cell');
			var value = $('#cal_'+id+'_step_'+istep+'_value');
			var send = $('#cal_'+id+'_step_'+istep+'_send');
			if (!cell.length || !send.length) {
				break;
			}
			cells.push( {cell: cell, value: value, send: send} );
			value.val(''); // Clear old value.
			istep++;
		}
		if (cells.length == 0) {
			return;
		}

		var vis = row.is(":visible");
		if (vis) {
			return; // Quit.
		}

		page.calStep( {cells:cells, help: help, stat: stat, cmd: cmd}, -1 );

	}

	// Convert seconds to H:M:S
	this.StoHMS = function( sec ) {
		if (isNaN(sec)) {
			return "";
		}
		var t = new Date(null);
		t.setSeconds(sec);
		return t.toISOString().substr(11, 8);
	}

}

function reqShutdown( event, system, options, duration ) {

    event.preventDefault();
	var url="/shutdown/"+system+"/"+options+"/"+duration;
	console.log("Sending shutdown request: "+url);
	$.ajax({
		type: 'POST',
		url: url
	}).done(function( response ) {
	});
}

function limitSpinner( val, min, max )
{
	if (val > max) {
		return max;
	} else if (val < min) {
		return min;
    } else {
		return val;
	}
}

var spinnerCallback;

function spinnerMouseDown( obj, delta, min, max ) {
	clearInterval(spinnerCallback);
	var input = $(obj).parent().siblings('.spinner input');
	input.val( limitSpinner( parseInt( input.val(), 10) + delta, min, max)).trigger("input");
	spinnerCallback = setInterval( function() {spinnerMouseDown(obj,delta,min,max);}, 100);
}

function cancelSpinnerCallback() {
	if (spinnerCallback) {
		clearInterval(spinnerCallback);
	}
}
	  
// Handle up and down buttons for .spinner
function spinnerSupport( id, min, max, func ) {
	  $('[id$='+id+'].spinner .btn:first-of-type').each( function() {
		$(this).on('mousedown', function() {spinnerMouseDown( $(this), 1, min, max )} )
			   .on('mouseup',function() {cancelSpinnerCallback();});
	  });
	  $('[id$='+id+'].spinner .btn:last-of-type').each( function() {
		$(this).on('mousedown', function() {spinnerMouseDown( $(this), -1, min, max )} )
			   .on('mouseup',function() {cancelSpinnerCallback();});
	  });
	  $('[id$='+id+'].spinner input').on( 'input', function() { func(this); } );
}

function padInt2(val)
{
	return ("0" + val).slice(-2);
}

function todStr( todInt ) {
	var hours = Math.floor(todInt / 3600);
	todInt = todInt % 3600;
	var min = Math.floor(todInt / 60);
	todInt = todInt % 60;
	var sec = todInt;
	var str = ""+ padInt2(hours) +":"+ padInt2(min);
	if (sec > 0) {
		str += ":"+ padInt2(sec) ;
	}
	return str;
}

function encodeDayTime( spec ) {
	if ((spec == "") || (spec == "0") || isNaN(spec) ) {
		return 0;
	}
	if ((spec < 0) || (spec >= 3600*24)) {
		return (3600*24)-1;
	}
	return todStr(spec);
}

// Expect hour:min:sec, with  :sec optional.
// '0' is special: means 0.
function decodeDayTime( spec ) {

	// Empty string or integer 0 means 0.
	if ((spec == "") || (spec == "0")) {
		return 0;
	}
	var fields = spec.split(":");
	if ((fields.length > 3) || (fields.length < 2)) {
		return -1;
	}
	var hour = fields[0];
	var min = fields[1];
	var sec = (fields.length > 2) ? fields[2] : 0;
	if ((hour < 0) || (hour > 23)) {
		return -1;
	}
	if ((min < 0) || (min > 59)) {
		return -1;
	} 
	if ((sec < 0) || (sec > 59)) {
		return -1;
	}
	return (hour * 3600) + (min * 60) + sec;
		
}

function mongoIdToTime( id ) 
{
	var tstr = "0x" + id.substring( 0, id.length-16 );
	var tms = parseInt(tstr) * 1000;
	var t = new Date;
	t.setTime(tms);
	return t;
}

