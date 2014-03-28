#!/usr/bin/env node

var common = require('../src/common')

common.controller(function (err, client) {
  console.log('Requesting stack trace from Tessel...'.grey);
  client.command('K', new Buffer([0xff, 0xff, 0xff, 0xff]));
  client.on('command', function (kind, data) {
    if (kind == 'k') {
      data = String(data);
      var out = data.replace(/(---|###)\s*$/, '');
      if (out) {
        console.log(out);
      }
      if (data.match(/---\s*$/)) {
        console.error('Not running.');
        process.exit(1);
      } else if (data.match(/###\s*$/)) {
        process.exit(0);
      }
    }
  })
})
