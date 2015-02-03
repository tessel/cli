#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// tessel blink
// Whoever blinks first loses.

var path = require('path'),
	common = require('../src/cli'),
	logs = require('../src/logs');

// Setup cli.
common.basic();

common.controller({stop: true}, function (err, client) {
  client.listen(true, [10, 11, 12, 13, 20, 21, 22])
  client.on('error', function (err) {
    if (err.code == 'ENOENT') {
      logs.err("Cannot connect to Tessel locally.");
    } else {
      console.error(err);
    }
  })

  // Command command.
  var updating = false;
  client.on('upload-status', function () {
    if (updating) {
      // Interrupted by other deploy
      process.exit(0);
    }
    updating = true;
  });

  client.run(path.resolve(__dirname, '../scripts/blink'), ['tessel', 'blink.js'], function (err) {
    // Stop on Ctrl+C.
    process.on('SIGINT', function() {
      client.once('script-stop', function (code) {
        process.exit(code);
      });
      setTimeout(function () {
        // timeout :|
        process.exit(code);
      }, 5000);
      client.stop();
    });

    client.once('script-stop', function (code) {
      client.close();
      process.exit(code);
    });
  });
})
