function PageUtils ( useDebug, usePrefix, useInterval ) {
	this.debug = useDebug;
	this.debug_prefix = usePrefix;
	this.waiting_status  = 0;
	this.ignore_status  = 0;
	this.status_interval  = useInterval;

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
		if (alert_box != undefined) {
			alert_box.find('p')[0].innerHTML = message + "(" + code + ")";
			alert_box.css('aria-hidden',false);
			alert_box.show();
		}
		console.log("ERROR: "+message);
	}
	this.debugMsg = function( msg ) {
		if (this.debug) {
			console.log(this.debug_prefix+": "+msg);
		}
	}
}

