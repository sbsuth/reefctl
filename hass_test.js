var argv = process.argv;
var cmd = argv[2];
var unit = argv[3];
const WebSocket = require('ws');
global.WebSocket = WebSocket;
const HAWS = require("home-assistant-js-websocket");

const getWsUrl = haUrl => `ws://${haUrl}/api/websocket`;

if ((cmd != "turn_on") && (cmd != "turn_off")) {
	console.log("ERROR: Command must be turn_on or turn_off");
	process.exit();
}

var name;
if ((unit == undefined) || (unit == 0)) {
	name ="switch.60_cube_dc_power";
} else if (unit == 1) {
	name="switch.bathroom_units_dc_power";
} else {
	console.log("ERROR: Unit must be 0 or 1");
	process.exit();
}

var url = 'localhost:8123';
console.log("Creating connection");
HAWS.createConnection( getWsUrl(url,{iauthToken: "lrlrbfd"})).then(
	conn => {
		console.log("Calling service");
		conn.callService("switch",cmd,{entity_id: name});
		HAWS.subscribeEntities(conn, logEntities);
	},
	err => {
		console.error('Connection failed with code', err)
	});

function logEntities(entities) {
	if (entities[name]) {
		console.log("switch:"+entities[name].state);
	}
}
