var fs = require('fs');
var kill = require('tree-kill');

const serverPid = fs.readFileSync('.server.pid', {
  encoding: 'utf8'
})
fs.unlinkSync('.server.pid')

kill(serverPid)
