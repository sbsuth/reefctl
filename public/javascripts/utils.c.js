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

	this.showError = function ( code, message ) {
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
			page.update_interval = ms;
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
			setTimeout( function() { page.updateStatus() }, interval );
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
