var argv = process.argv;
var cmd = argv[2];
const WebSocket = require('ws');
global.WebSocket = WebSocket;
const HAWS = require("home-assistant-js-websocket");

const getWsUrl = haUrl => `ws://${haUrl}/api/websocket`;
var name="switch.60_cube_dc_power";
//var name="switch.bathroom_units_dc_power";

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
