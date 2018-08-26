var fixture = new PageUtils( 1, "FIXTURE", 5*1000, 30*1000, 5*60*1000 );

fixture.stat_cmd_index = -1;
fixture.moving = false;
fixture.cur_spec = 0;
fixture.standby_interval = 30*1000;
fixture.slow_interval = 5*1000;
fixture.fast_interval = 400;
fixture.standby_delay = 5*60*1000;
fixture.channels = [];
fixture.last_moving = 0;
fixture.seen_cmds = {};
fixture.last_cmd = "";
fixture.last_input = new Date().getTime();

// Sets a timestamp marking that fixture movement is occurring and shuold be tracked.
fixture.sayMoving = function() {
	fixture.last_moving = new Date().getTime();
}

// Marks a cmd as having an up to date response, so it will not be repeated.
fixture.validateCmd = function( cmd ) {
	fixture.seen_cmds[cmd] = true;
}

// Marks a cmd as not having an up to date response, so it must be repeated.
// If no cmd is given, invalidates all.
fixture.invalidateCmd = function( cmd ) {
	if (cmd == undefined) {
		fixture.seen_cmds = {};
	}  else {
		fixture.seen_cmds[cmd] = false;
	}
}

fixture.cmdValid = function( cmd ) {
	return fixture.seen_cmds[cmd];
}

fixture.uiActionDone = function() {
	fixture.last_input = new Date().getTime();
}

// Returns {cmd: <name>, delay: <d>} for the update function to do next,
// and the delay until the next update.
fixture.nextUpdateFunc = function() {

	var now = new Date().getTime();

	// If the fixture is moving, only go gh.
	if ((now - fixture.last_moving) < 2000) {
		fixture.last_input = now;
		return {cmd: "gh", delay: fixture.fast_interval};
	}

	// Do any cmds that we've not seen response for or that are invalid.
	// Always fast after these.
	var cmds = ['stat', "gvals", "gpct", "gcyc", "gh"];
	for ( var i=0; i < cmds.length; i++ ) {
		if (!fixture.seen_cmds[cmds[i]]) {
			return {cmd: cmds[i], delay: fixture.fast_interval};
		}
	}

	// Slow down updates after no UI's used for a while.
	var delay;
	if ((new Date().getTime() - fixture.last_input) > fixture.standby_delay) {
		delay = fixture.standby_interval;
	} else {
		delay = fixture.slow_interval = 5*1000;
	}

	if (fixture.last_cmd == "stat") {
		return {cmd: "gvals", delay: delay};
	} else {
		return {cmd: "stat", delay: delay};
	}
}


// Begins a periodic query for fixture status.
// Required signature.
fixture.updateStatus = function ()
{
	var page = this;


    if (page.waiting_status) {
		return;
	}

	var nextFunc = page.nextUpdateFunc();
	var cur_cmd = nextFunc.cmd;
	var fuse = nextFunc.delay;

	page.waiting_status = 1;

	var cmd_arg = "";

	page.debugMsg("Sending \'"+cur_cmd+"\' cmd");

	switch (cur_cmd) {
		case 'stat':
			callback = function(data) { page.handleStat( data ) };
			break;
		case 'gh' :
			callback = function(data) { page.handleHeight( data ) };
			break;
		case 'gvals' :
			callback = function(data) { page.handleVals( data ) };
			break;
		case 'gpct' :
			cmd_arg = "/" + page.cur_spec;
			callback = function(data) { page.handlePct( data ) };
			break;
		case 'gcyc' :
			callback = function(data) { page.handleCyc( data ) };
			break;
	}
	if (cur_cmd != "") {
		fixture.last_cmd = cur_cmd;
		$.getJSON( '/fixture_query/'+cur_cmd+'/'+page.instr_name+"/"+fuse+cmd_arg, callback );
	} else {
		page.waiting_status = 0;
	}
}

fixture.checkRadio = function( groupName, value )
{
	$("input[name="+groupName+"]").each( function() {
		if ( $(this).attr('value') == value ) {
			$(this).parent().addClass('active').siblings().removeClass('active').removeClass('focus');
		}
	});
}


fixture.handleStat = function ( data ) {
	var page = this;
	if (data.error === undefined) {

		if ( !page.cmdValid("stat") ) {
			$("#latitude").val( data.lat );
			$("#longitude").val( data.lon );
			$("#timezone").val( data.tz );
			$("#high_level").val( data.high_pct );
			$("#low_level").val( data.low_pct );
			page.checkRadio('modes',data.mode);
			page.checkRadio('spectrum',data.spec);
			page.cur_spec = data.spec;
			$("#sunrise").val( encodeDayTime(data.sr_sec) );
			$("#period").val( encodeDayTime(data.period_sec) );
		}

		$("#timed_pct").text( data.timed_pct );

		$("#sun_angle").text( data.sun_angle );
		$("#am_factor").text( data.am_factor );
		$("#ang_factor").text( data.ang_factor );
		$("#norm_factor").text( data.norm_factor );
		$("#norm_factor_set").val( data.norm_factor );
		$("#peak_factor").text( data.peak_factor );
		$("#tod_sec").text( todStr(data.tod_sec) );
		$("#eff_tod").text( todStr(data.eff_tod) );

		if (data.moving) {
			page.sayMoving();
		}
		page.validateCmd("stat");

		page.setUpdateInterval( page.nextUpdateFunc().delay );
		page.goodUpdate();
	} else if (data.error == 429) {
		page.debugMsg("Too busy for command");
		page.setUpdateInterval(page.slow_interval);
	} else {
		page.incrementFailedUpdates();
	}
	page.waiting_status = 0;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}

// Given an LED ID, return an element index, or -1 if not found.
function ledIdToElemOrder( ledid ) {
	for ( var i=0; i < fixture.channels.length; i++ ) {
		var elem = fixture.channels[i];
		if (elem.id == ledid) {
			return elem.index;
		}
	}
	return -1;
}

// Given an element index, return its LED ID, or -1 if not found.
function elemOrderToLedId( ielem ) {
	for ( var i=0; i < fixture.channels.length; i++ ) {
		var elem = fixture.channels[i];
		if (elem.index == ielem) {
			return elem.id;
		}
	}
	return -1;
}

// Given a 12-entry percents array ordered as for the instr,
// returns an 8-entry array ordered in element order.
function instrToLocalPcts( ipcts, scale ) {
	var lpcts = [0,0,0,0,0,0,0,0];
	for ( var ipct=0; ipct < ipcts.length; ipct++ ) {
		var lpct = ledIdToElemOrder(ipct);
		if ((lpct >= 0) && (lpct < 8)) {
			var val = ipcts[ipct];
			if (scale != 0) {
				val = Math.floor( ((val * 100)/scale) + 0.5 );
			}
			lpcts[lpct] = val;
		}
	}
	return lpcts;
}

// Given an 8-entry percents array ordered for display channels,
// returns a 12-entry array ordered for the instr.
function localToInstrPcts( lpcts ) {
	var ipcts = [0,0,0,0,0,0,0,0,0,0,0,0];
	for ( var lpct=0; lpct < lpcts.length; lpct++ ) {
		var ipct = ledIdToElemOrder(lpct);
		if ((ipct >= 0) && (ipct < 12)) {
			ipcts[ipct] = lpcts[lpct];
		}
	}
	return ipcts;
}

fixture.handleVals = function ( data ) {
	var page = this;
	if (data.error === undefined) {

		page.updateSpectrum("bars_cur", instrToLocalPcts(data.cur_pct,256));
		
		page.validateCmd("gvals");

		page.setUpdateInterval( page.nextUpdateFunc().delay );
		page.goodUpdate();
	} else if (data.error == 429) {
		page.debugMsg("Too busy for command");
		page.setUpdateInterval(page.slow_interval);
	} else {
		page.incrementFailedUpdates();
	}
	page.waiting_status = 0;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}

fixture.handlePct = function ( data ) {
	var page = this;
	if (data.error === undefined) {

		page.updateSpectrum("bars_spec", instrToLocalPcts(data.max_pct,false));

		$("div[id$='pct_spec']").each( function(index) {
			var input = $(this).find("input");
			var index = input.data('id');
			input.val( data.max_pct[index] );
		});

		page.validateCmd("gpct");

		page.setUpdateInterval( page.nextUpdateFunc().delay );
		page.goodUpdate();
	} else if (data.error == 429) {
		page.debugMsg("Too busy for command");
		page.setUpdateInterval(page.slow_interval);
	} else {
		page.incrementFailedUpdates();
	}
	page.waiting_status = 0;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}

// Send currently specified spectrum values.
fixture.applyPcts = function(event) {

	// Collect values in instr
	var vals0 = [fixture.cur_spec,0,0,0,0];
	var vals1 = [fixture.cur_spec,0,0,0,0];
	var vals2 = [fixture.cur_spec,0,0,0,0];
	$("div[id$='pct_spec']").each( function(index) {
		var input = $(this).find("input");
		var index = input.data('id');
		if (index < 4) {
			vals0[index+1] = input.val();
		} else if (index < 8) {
			vals1[(index-4)+1] = input.val();
		} else {
			vals2[(index-8)+1] = input.val();
		}
	});

	// 2 commands for upper and lower halves of the array.
	fixture.sendCmd( event, "spcta", vals0, function(response) {
		fixture.sendCmd( event, "spctb", vals1, function(responve) {
			fixture.sendCmd( event, "spctc", vals2, function(responve) {
				fixture.invalidateCmd("gvals");
				fixture.clearError();
			});
		});
	});
}

fixture.setMode = function(event) {
	var value = $(event.target).find("input").prop('value');
	fixture.sendCmd( event, "mode", [value], function(response) {
		fixture.invalidateCmd("gvals");
		fixture.clearError();
	});
}

fixture.setSpectrum = function(event) {
	var value = $(event.target).find("input").prop('value');
	fixture.cur_spec = value;
	fixture.sendCmd( event, "spec", [value], function(response) {
		fixture.invalidateCmd("gvals");
		fixture.invalidateCmd("gpct");
		fixture.clearError();
	});
}

fixture.setLevels = function(event) {
	var low = $("#low_level").val();
	var high = $("#high_level").val();
	var factor = $("#norm_factor_set").val();
	if ((low < 0) || (low > 100)) {
		fixture.showError( 0, "Low level must be a percentage between 0 and 100", $("#low_level") );
		return;
	}
	if ((high < 0) || (high > 100)) {
		fixture.showError( 0, "High level must be a percentage between 0 and 100", $("#high_level"));
		return;
	}
	if ((factor < 0) || (factor > 1)) {
		fixture.showError( 0, "Norm factor must be a number between 0.0 and 1.0", $("#norm_factor_set"));
		return;
	}
	var vals = [low,high,factor];
	fixture.sendCmd( event, "slev", vals,  function(response) {
		fixture.invalidateCmd("stat");
		fixture.invalidateCmd("gvals");
		fixture.clearError();
	});
}

fixture.setLocation = function(event) {
	var latitude = $("#latitude").val();
	var longitude = $("#longitude").val();
	var timezone = $("#timezone").val();

	if (isNaN(latitude)) {
		fixture.showError( 0, "Latitude must be a number", $("#latitude"));
		return;
	}

	if (isNaN(longitude)) {
		fixture.showError( 0, "Longitude must be a number", $("#longitude"));
		return;
	}

	if (isNaN(latitude)) {
		fixture.showError( 0, "Timezone must be a number", $("#timezone"));
		return;
	}

	var vals = [latitude,longitude,timezone];
	fixture.sendCmd( event, "sloc", vals,  function(response) {
		fixture.invalidateCmd(); // Whack everything.
		fixture.clearError();
	});
}

fixture.setPeriod = function(event) {
	var sunrise = $("#sunrise").val();
	var period = $("#period").val();

	var sunrise_sec = decodeDayTime(sunrise);
	if (sunrise_sec < 0) {
		fixture.showError( 0, "Unrecognized time for sunrise.  Use hours:min" );
		return;
	}

	var period_sec = decodeDayTime(period);
	if (period_sec < 0) {
		fixture.showError( 0, "Unrecognized time for photo period.  Use hours:min" );
		return;
	}

	var vals = [sunrise_sec,period_sec];
	fixture.sendCmd( event, "sday", vals,  function(response) {
		fixture.invalidateCmd(); // Whack everything.
		fixture.clearError();
	});
}

fixture.handleCyc = function ( data ) {
	var page = this;
	if (data.error === undefined) {

		$("#calc_sr").text( todStr(data.calc.sr) );
		$("#calc_ss").text( todStr(data.calc.ss) );
		$("#calc_ps").text( todStr(data.calc.ps) );
		$("#calc_pp").text( data.calc.pp );

		$("#used_sr").text( todStr(data.used.sr) );
		$("#used_ss").text( todStr(data.used.ss) );
		$("#used_ps").text( todStr(data.used.ps) );
		$("#used_pp").text( data.used.pp );

		page.validateCmd("gcyc");

		page.setUpdateInterval( page.nextUpdateFunc().delay );
		page.goodUpdate();
	} else if (data.error == 429) {
		page.debugMsg("Too busy for command");
		page.setUpdateInterval(page.slow_interval);
	} else {
		page.incrementFailedUpdates();
	}
	page.waiting_status = 0;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}

// Handler for status updated.   Updates the progress bar.
// If the fixture is moving, next update is fast.  If not, next update is slow.
// If error, updates stop.
fixture.handleHeight = function ( data ) {

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
		if (data.moving) {
			page.sayMoving();
		}
		page.validateCmd("gh");
		page.setUpdateInterval( page.nextUpdateFunc().delay );
		page.goodUpdate();
	} else if (data.error == 429) {
		page.debugMsg("Too busy for fixture_height");
		page.setUpdateInterval(page.slow_interval);
	} else {
		page.incrementFailedUpdates();
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
fixture.sendCmd = function (event,cmd,args,nextFunc) {

	var page=this;
    event.preventDefault();
	page.debugMsg("Sending fixture cmd: "+cmd);

	fixture.uiActionDone();

	var url = '/fixture_cmd/'+cmd+"/"+page.instr_name;
	if (args) {
		for ( var i=0; i < args.length; i++ ) {
			url += "/" + args[i];
		}
	}

	$.ajax({
		type: 'POST',
		url: url,
	}).done(function( response ) {

		// Check for a successful (blank) response
		if (response.msg === '') {
			page.debugMsg("Back from fixture cmd: "+cmd);

			if (nextFunc) {
				nextFunc(response);
			} else {
				page.updateStatus();
			}
		}
		else {
			page.showError( response.code, response.msg );
		}
	});
}

fixture.updateSpectrum = function( elem, pcts ) {
    var graph = $('#'+elem);
	var bars = graph.children("div");

	var px_bars = 70;
	var title_off = -5;

	if (!pcts) {
		pcts = [10,20,30,40,50,60,70,80];
	}

	// Find largest, and clip to 0->100.
	var ibar;
	var maxPct  = 0;
	for ( ibar=0; ibar<8; ibar++ ) {
		if ( Number(pcts[ibar]) > maxPct) {
			maxPct = pcts[ibar];
		}
	}
	
	// The 'top' style must be set based on the longest bar.
	// The bars are always aligned at the bottom, so we 
	// must offset the longest one so that it fills 
	// its percent of the top px_bars% of the space.
	var px_longestBar = Math.floor( ((maxPct * px_bars)/100) + 0.5 );
	var bar_top = px_bars - px_longestBar;
	var title_off = bar_top + title_off;

	// Set the height style of each bar based on its percent,
	// and set the 'top' style of all of them the same.
	// Set the 'top' style of all labels to the same value.
	ibar = 0;
	bars.each( function(index) {
		if (index < 8) {
			$(this).css( "height", Math.floor( ((pcts[index] * px_bars)/100) + 0.5) );
			$(this).css( "top", Math.floor(bar_top) );
		} else {
			$(this).css( "top", Math.floor(title_off) );
			$(this).children("p").text( pcts[index-8]+"%");
		}
	});
}

// Called when spectrum spinner changed.
// We have to read all the spinner values since the graph needs to know the largest value.
fixture.pct_spec_entryChanged = function(input) {

	var pcts = [];
	$(input).parents("#pct_spec_group").find(":input").each( function(index) {
		if ( $(this).is("input")) {
			var val = Number($(this).val());
			if (val < 0) {
				val = 0;
			} else if (val > 100) {
				val = 100;
			}
			pcts.push(val);
		}
	});

	fixture.uiActionDone();

	var input_id = $(input).parent().attr('id');
	var suffix = input_id.substring( input_id.lastIndexOf("_")+1);
	fixture.updateSpectrum("bars_"+suffix,pcts);
}


// DOM Ready =============================================================


$(document).ready(function() {

	var page = fixture;

	// Read hidden inputs.
	var instr_name = $( '#instr_name' )[0].value;
	page.instr_name = instr_name;
	page.channels = JSON.parse( $('#channels').val() );

    // Fixture button events
    $('#btnUp').on('click', function (event) {fixture.sendCmd(event,"up")});
    $('#btnDown').on('click', function (event) {fixture.sendCmd(event,"down")});
    $('#btnStop').on('click', function (event) {fixture.sendCmd(event,"stop")});
    $('#setCurHeight').on('click', function (event) {fixture.setCurHeight();});
    $('#btnSPcts').on('click', function (event) {fixture.applyPcts(event);});
    $('#btnSPcts').on('click', function (event) {fixture.applyPcts(event);});
    $('#btnLevel').on('click', function (event) {fixture.setLevels(event);});
    $('#btnPeriod').on('click', function (event) {fixture.setPeriod(event);});
    $('#btnLoc').on('click', function (event) {fixture.setLocation(event);});
	$("input[id$='_mode']").parent().on('click', function(event){ fixture.setMode(event);});
	$("input[id^='spec_']").parent().on('click', function(event){ fixture.setSpectrum(event);});
    $('#btnSave').on('click', function (event) {fixture.sendCmd(event,"sset")});
    $('#btnRestore').on('click', function (event) {fixture.sendCmd(event,"rset")});

	spinnerSupport("pct_spec",0,100, function(input) {page.pct_spec_entryChanged(input);} );

	page.setupStandard(page);
	var initInterval = setInterval( function() { clearInterval(initInterval); page.updateStatus(); }, 100 );

	
});

// Functions =============================================================


