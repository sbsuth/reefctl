var child_process = require('child_process');
var fs = require('fs');

const child = child_process.spawn('node', [
  './bin/www'
], {
  detached: true,
  stdio: [0,1,2]
})
child.unref()

if (typeof child.pid !== 'undefined') {
  fs.writeFileSync('.server.pid', child.pid, {
    encoding: 'utf8'
  })
}
