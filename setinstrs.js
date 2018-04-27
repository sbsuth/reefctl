var SHA256 = require("crypto-js/sha256");
var argv = process.argv;
var username = argv[2];
var instrfile = argv[3];
if (!username || !instrfile) {
	console.log("ERROR: Must specify username and instrument file.");
	process.exit(1);
}
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/reefctl');

var systemData = require("./"+instrfile);

var users = db.get('users');
var systems = db.get('systems');
users.find({username: username}).then( (doc) => {
	if (doc.length == 1) {
		systemData.user_id = doc[0]._id;

		console.log("Inserting data for system \'"+systemData.name+"\'");
		systems.update( {name: systemData.name}, systemData, {upsert: true}, function(err,doc,next) {
			if (err) {
				console.log("ERROR: "+err);
			}
			process.exit();
		});
	} else {
		console.log("ERROR: Unrecognized user \'"+usename+"\'");
		process.exit();
	}
});
