#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var fs = require('fs'),
  path = require('path'),
  logs = require('../src/logs'),
  common = require('../src/cli');

var erasePath = path.join(__dirname, "tessel-erase.bin");

// Setup cli.
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel logs')
  .option('force', {
    abbr: 'f',
    flag: true,
    hidden: true,
  })
  .parse();

common.controller({ stop: true, appMode: false }, function (err, client) {
  if (argv.force) {
    logs.info("--force is no longer necessary.")
  }

  if (client.mode === 'app') {
    client.erase(function () {
      logs.info('Attempting to erase Tessel filesystem.');
      logs.info("If erasing failed, press the Reset button while holding down the Config button, then try again");
      client.close();
    });
  } else if (client.mode === 'boot') {
    client.runRam(fs.readFileSync(erasePath), function() {
      logs.info('Tessel filesystem erased.');
    });
  } else {
    logs.err("Unknown device mode: " + client.mode);
  }
});
