function PageUtils ( useDebug, usePrefix, useInterval ) {
	this.debug = useDebug;
	this.debug_prefix = usePrefix;
	this.waiting_status  = 0;
	this.ignore_status  = 0;
	this.status_interval  = useInterval;
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
		var msgText = "ERROR: " + this.debug_prefix + ": " + message + "(" + code + ")";
		console.log("HEY: alert_box="+JSON.stringify(alert_box));
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
	this.setUpdateInterval = function( ms ) {
		var page = this;
		if (ms > 0) {
			page.update_interval = ms;
		} else {
			page.disable_status = true;
		}
		var monitor_cb = $( "#monitor_cb:checkbox" );
		if (monitor_cb != undefined) {
			monitor_cb.prop('checked', !page.disable_status );
		}
	}
	this.scheduleStatusUpdate = function() {

		var page = this;
		if (page.disable_status || (page.status_interval <= 0)) {
			return;
		}
		setTimeout( function() { page.updateStatus() }, page.status_interval );
	}
}

