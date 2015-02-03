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
  logs = require('../src/logs'),
  common = require('../src/cli');

// Setup cli.
common.basic();

var fname = process.argv[2];
var image = fs.readFileSync(fname);

common.controller({ stop: true, appMode: false }, function (err, client) {
  if (err) return logs.err(err);
  client.enterBootloader(function(err, bl) {
    if (err) return logs.err(err);
    bl.runRam(image);
    logs.info("Running ", fname);
  });
});
