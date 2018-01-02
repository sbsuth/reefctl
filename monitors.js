
var topup_interval_sec = 5;

function topupTask( data ) {
	if (!data.busy) {
		data.busy = true;

console.log("HEY: In topupTask");
		data.busy = false;
	}
	setTimeout( function() {topupTask({});}, topup_interval_sec*1000 );
}

function startup( utils ) {
	
	var data = { utils: utils };

	setTimeout( function() {topupTask(data);}, topup_interval_sec );
}

module.exports = {
	startup: startup
}
