
var charts = new PageUtils( 1, "CHARTS", 15*60*1000, 15*60*1000 );

function getSpan(code) 
{
	var ms = 60*60*1000;
	switch (Number(code)) {
		case 0: // 12 Hours
			return ms*12;
		case 1: // 1 Day
			return ms*24;
		case 2: // 2 Day
			return ms*2*24;
		case 3: // 3 Day
			return ms*3*24;
		case 4: // Week
			return ms*24*7;
		case 5: // Month;
			return ms*24*30;
		default:
			return ms;
	}
}

// Begins a periodic query for charts status.
// Required signature.
charts.updateStatus = function ( field )
{
	var page = this;

    if (page.waiting_status) {
		return;
	}
	var fuse_ms = 5*1000;

	// Get the longest span and query with that.
	var longest_span = 0;
	var first_times = [];
	charts.charts.forEach( function(item) {
		var range = item.range_ctrl.val();
		var span_ms = getSpan(range);
		if (span_ms > longest_span) {
			longest_span = span_ms;
		}
		var first_time = new Date();
		first_time.setTime( first_time.getTime() - span_ms );
		first_times.push( first_time );
	});
	if (longest_span == 0) {
		return;
	}

	page.waiting_status = 1;

	var end_ms = (new Date).getTime();
	var start_ms = new Date(end_ms - longest_span).getTime();
	var cmd = '/chart_data/'+page.system_name+"/"+start_ms+"/"+end_ms;
	page.debugMsg("Sending command: "+cmd);

	$.getJSON( cmd, function(data) { page.handleStatus( data, first_times, field ) } );
}
	
function updateMav( mavs, val, len )
{
	while (mavs.vals.length > len) {
		var old = mavs.vals.shift();
		mavs.sum -= old;
	}
	mavs.vals.push(val);
	mavs.sum += val;

	if (mavs.vals.length >= 8) {
		return (mavs.sum / mavs.vals.length);
	} else {
		return undefined;
	}
}

// Handler for status updated.   Updates the progress bar.
// If error, updates stop.
charts.handleStatus = function ( data, first_times, only_field ) {

	var page = this;

	if (page.ignore_status) {
		return;
	}

	var ncharts = charts.charts.length;
	var data_sets = [];
	var mavs = [];
	for ( var ichart=0; ichart < ncharts; ichart++ ) {
		data_sets.push( {val: [], mav: [] } );
		mavs.push( { vals: [], sum: 0} );
	}


	// Assemble time/value pairs for each chart in its specified range.
	var last_t = undefined;
	for ( var i=0; i < data.data.length; i++ ) {
		var d = data.data[i];
		var t = mongoIdToTime(d._id);
		if (last_t && ((t.getTime() - last_t.getTime()) < 1000*60*3)) {
			continue;
		}
		last_t = t;
		for ( var ichart=0; ichart < ncharts; ichart++ ) {
			var field = charts.charts[ichart].field;
			if ((t.getTime() > first_times[ichart]) && (!only_field || (field == only_field))) {
				var val = Number(d[field]);
				if (val != undefined) {
					data_sets[ichart].val.push( {t: t, y: val} );

					var mav_len = charts.charts[ichart].mav_len;
					if (mav_len) {
						var mav = updateMav( mavs[ichart], val, mav_len );
						if (mav != undefined) {
							data_sets[ichart].mav.push( {t: t, y: mav} );
						}
					}
				}
			}
		}
	}
	for ( var ichart=0; ichart < ncharts; ichart++ ) {
		var field = charts.charts[ichart].field;
		if (only_field && (field != only_field)) {
			continue;
		}
		var canvas = charts.charts[ichart].canvas;
		var chart = new Chart( canvas, {
				type: 'line',
				data: {
					datasets : [
					{
						data: data_sets[ichart].val,
						pointStyle: "circle",
						pointRadius: 1
					},
					{
						data: data_sets[ichart].mav,
						pointStyle: "circle",
						pointRadius: 1,
						fill: false
					}
					]
				},
				options: {
					legend: {
						display: false
					},
					scales : {
						xAxes : [{
							type: 'time',
							display: true,
						}]
					}
				}
			});
		charts.charts[ichart].chart = chart;
	}

	if (data.error === undefined) {
		page.goodUpdate();
	} else if (data.error == 429) {
		page.debugMsg("Too busy for status");
		page.setUpdateInterval(2000);
	} else {
		page.incrementFailedUpdates();
	}
	page.waiting_status = 0;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}
 
// Strip the last token off the given dash-separated ID.
function strip_last_token( id  ) {
	var segs = id.split('-');
	segs.pop();
	id = segs.join('-');
	return id;
}

charts.onRangeChanged = function ( field ) {

	// Save the last selection.
	var ctrl = $('#'+field+'-range');
	localStorage.setItem( "charts_range_"+field, ctrl.val() );

	charts.updateStatus(field);
}

// DOM Ready =============================================================


$(document).ready(function() {

	var page = charts;
	var chart_ctrls = $("[id$='-chart']");
	charts.charts = [];

	var system_name_elem = $( '#system_name' )[0];
	if (system_name_elem == undefined) {
		// Loading the file as utilities.  Don't initialize"
		return
	}
	page.system_name = system_name_elem.value;

	for ( var i=0; i < chart_ctrls.length; i++ ) {
		var chart = chart_ctrls[i];
		var field = strip_last_token(chart.id);
	    var mav_len_ctrl = $('#'+field+'-mav_len');
		charts.charts.push( {
			field: field,
			mav_len: mav_len_ctrl.val(),
			range_ctrl : $('#'+field+'-range'),
			canvas : $('#'+field+'-canvas')
		});

		// Restore old range selection.
		var oldSel = localStorage.getItem("charts_range_"+field);
		if (oldSel == undefined) {
			oldSel = 0;
		}
		charts.charts[i].range_ctrl.val( oldSel );
	}

	// 2D array of controls for easy access.
	page.setupStandard(page);
	page.updateStatus();
});

// Functions =============================================================


