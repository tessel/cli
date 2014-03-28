#!/usr/bin/env node

// tessel-repl
// Thin redirect to tessel-node -i

var spawn = require('child_process').spawn;

spawn(__dirname + '/tessel-node', ['-i'], {
  stdio: 'inherit'
})
.on('exit', function (code) {
  process.exit(code);
});