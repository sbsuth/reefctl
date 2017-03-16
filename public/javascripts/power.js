// DOM Ready =============================================================

var debug_power = 1;

$(document).ready(function() {

	var instr_name = $( '#instr_name' )[0].value;

	// Setup
	$('#P0').checkboxpicker();
	$('#P1').checkboxpicker();

    // button events
    $('#P0').on('change', function () {console.log("Got P0: " + instr_name);});
    $('#P1').on('change', function () {console.log("Got P1: " + instr_name);});
});

// Functions =============================================================

