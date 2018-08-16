
var unit_check = new PageUtils( 1, "UNIT_CHECK", 60000, 60000 );
	
// Handler for status updated.   
unit_check.handleStatus = function ( data ) {

	var page = this;

	if (data.error === undefined) {
		page.goodUpdate();
	} else if (data.error == 429) {
		page.debugMsg("Too busy for unit_check");
		page.setUpdateInterval(2000);
	} else {
		page.incrementFailedUpdates();
	}
	page.waiting_status = 0;

	page.ignore_changes = true;

	page.ignore_changes = false;

	// Call again at the given interval.
	page.scheduleStatusUpdate();
}

unit_check.updateStatus = function ()
{
	var page = this;

    if (page.waiting_status) {
		return;
	}
	page.waiting_status = 1;
	page.debugMsg("Sending unit_check status query");
	$.getJSON( '/monitors_status/'+page.system_name, function(data) { page.handleStatus( data ) } );
}

unit_check.demoChart = function() {
	var page = this;
var ctx = document.getElementById("myChart");
var myChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: ["Red", "Blue", "Yellow", "Green", "Purple", "Orange"],
        datasets: [{
            label: '# of Votes',
            data: [12, 19, 3, 5, 2, 3],
            backgroundColor: [
                'rgba(255, 99, 132, 0.2)',
                'rgba(54, 162, 235, 0.2)',
                'rgba(255, 206, 86, 0.2)',
                'rgba(75, 192, 192, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(255, 159, 64, 0.2)'
            ],
            borderColor: [
                'rgba(255,99,132,1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)'
            ],
            borderWidth: 1
        }]
    },
    options: {
        scales: {
            yAxes: [{
                ticks: {
                    beginAtZero:true
                }
            }]
        }
    }
});
}

// DOM Ready =============================================================


$(document).ready(function() {

	var page = unit_check;

	var system_name_elem = $( '#system_name' )[0];
	if (system_name_elem == undefined) {
		// Loading the file as utilities.  Don't initialize"
		return
	}
	page.system_name = system_name_elem.value;

	// Setup
	var enable_cbs = $('[id^=monitor-enabled]');
	enable_cbs.checkboxpicker({
		onLabel: "On",
		offLabel: "Off"
	});

	page.demoChart();

	page.setupStandard(page);
	page.updateStatus();
});

// Functions =============================================================


