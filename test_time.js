var net = require('net');
var server = net.createServer(function(socket) {
	socket.on('data', function(data){
		console.log("INSTR QUERY: "+data);
		var curtimeCmd = "curtime";
		var str = data.toString('utf8');
		if ( str.substring(0,curtimeCmd.length) == "curtime") {
			var d = new Date;
			var t = Math.floor(Date.now()/1000);
			var tz= d.getTimezoneOffset() * 60;
			t -= tz;
			socket.write(""+t+"X");
		} else {
			console.log("ERROR: Unrecognized query");
		}
	});
	socket.on('error', function(data){
		console.log(data);
	});
});
//server.listen(52275, '127.0.0.1');
server.listen(3001, '10.10.2.2');
//server.listen(3001, '10.10.2.3');
//server.listen(3001, '192.168.227.130');
