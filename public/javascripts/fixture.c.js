var fixture = new PageUtils( 1, "FIXTURE", 2000 );

fixture.stat_cmd_index = -1;
fixture.moving = false;
fixture.cur_spec = 0;
fixture.slow_interval = 2000;
fixture.fast_interval = 200;
fixture.channels = [];


// Begins a periodic query for fixture status.
// Required signature.
fixture.updateStatus = function ()
{
	var page = this;


    if (page.waiting_status) {
		return;
	}

	var stat_kinds = ['stat', 'gh', "gvals", "gpct", "gcyc"];

	var cur_cmd;
	if (fixture.moving) {
		cur_cmd = "gh";
	} else {
		fixture.stat_cmd_index++;
		if (fixture.stat_cmd_index >= stat_kinds.length)
			fixture.stat_cmd_index = 0;
		cur_cmd = stat_kinds[fixture.stat_cmd_index];
	}

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
		$.getJSON( '/fixture_query/'+cur_cmd+'/'+page.instr_name+cmd_arg, callback );
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

		$("#latitude").val( data.lat );
		$("#longitude").val( data.lon );
		$("#timezone").val( data.tz );
		$("#high_level").val( data.high_pct );
		$("#low_level").val( data.low_pct );
		$("#timed_pct").text( data.timed_pct );

		page.checkRadio('modes',data.mode);
		page.checkRadio('spectrum',data.spec);
		page.cur_spec = data.spec;
		$("#sun_angle").text( data.sun_angle );
		$("#am_factor").text( data.am_factor );
		$("#ang_factor").text( data.ang_factor );
		$("#norm_factor").text( data.norm_factor );
		$("#norm_factor_set").val( data.norm_factor );
		$("#peak_factor").text( data.peak_factor );
		$("#tod_sec").text( todStr(data.tod_sec) );
		$("#sunrise").val( data.sr_sec );
		$("#period").val( data.period_sec );

		page.setUpdateInterval( page.slow_interval);
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

// Given an 8-entry percents array ordered as for the instr,
// returns a 7-entry array ordered in element order.
function instrToLocalPcts( ipcts, scale ) {
	var lpcts = [0,0,0,0,0,0,0];
	for ( var ipct=0; ipct < ipcts.length; ipct++ ) {
		var lpct = ledIdToElemOrder(ipct);
		if ((lpct >= 0) && (lpct < 7)) {
			var val = ipcts[ipct];
			if (scale != 0) {
				val = Math.floor( (val * 100)/scale );
			}
			lpcts[lpct] = val;
		}
	}
	return lpcts;
}

// Given an 7-entry percents array ordered for display channels,
// returns a 8-entry array ordered for the instr.
function localToInstrPcts( lpcts ) {
	var ipcts = [0,0,0,0,0,0,0,0];
	for ( var lpct=0; lpct < lpcts.length; lpct++ ) {
		var ipct = ledIdToElemOrder(lpct);
		if ((ipct >= 0) && (ipct < 8)) {
			ipcts[ipct] = lpcts[lpct];
		}
	}
	return ipcts;
}

fixture.handleVals = function ( data ) {
	var page = this;
	if (data.error === undefined) {

		page.updateSpectrum("bars_cur", instrToLocalPcts(data.cur_pct,256));
		
		page.setUpdateInterval( page.slow_interval);
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

		page.setUpdateInterval( page.slow_interval);
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
	$("div[id$='pct_spec']").each( function(index) {
		var input = $(this).find("input");
		var index = input.data('id');
		if (index < 4) {
			vals0[index+1] = input.val();
		} else {
			vals1[(index-4)+1] = input.val();
		}
	});

	// 2 commands for upper and lower halves of the array.
	fixture.sendCmd( event, "spcta", vals0, function(response) {
		fixture.sendCmd( event, "spctb", vals1 );
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

		page.setUpdateInterval( page.slow_interval);
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
		page.setUpdateInterval(data.moving ? page.fast_interval : page.slow_interval);
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
		pcts = [10,20,30,40,50,60,70];
	}

	// Find largest, and clip to 0->100.
	var ibar;
	var maxPct  = 0;
	for ( ibar=0; ibar<7; ibar++ ) {
		if ( Number(pcts[ibar]) > maxPct) {
			maxPct = pcts[ibar];
		}
	}
	
	// The 'top' style must be set based on the longest bar.
	// The bars are always aligned at the bottom, so we 
	// must offset the longest one so that it fills 
	// its percent of the top px_bars% of the space.
	var px_longestBar = Math.floor( (maxPct * px_bars)/100 );
	var bar_top = px_bars - px_longestBar;
	var title_off = bar_top + title_off;

	// Set the height style of each bar based on its percent,
	// and set the 'top' style of all of them the same.
	// Set the 'top' style of all labels to the same value.
	ibar = 0;
	bars.each( function(index) {
		if (index < 7) {
			$(this).css( "height", Math.floor( (pcts[index] * px_bars)/100) );
			$(this).css( "top", Math.floor(bar_top) );
		} else {
			$(this).css( "top", Math.floor(title_off) );
			$(this).children("p").text( pcts[index-7]+"%");
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
	page.updateSpectrum("bars_spec");
	page.updateSpectrum("bars_cur");
	page.setupStandard(page);
	page.updateStatus();

	spinnerSupport("pct_spec",0,100, function(input) {page.pct_spec_entryChanged(input);} );

	
});

// Functions =============================================================


