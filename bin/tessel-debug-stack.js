#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var common = require('../src/cli');

// Setup cli.
common.basic();

common.controller({stop:false}, function (err, client) {
  console.log('Requesting stack trace from Tessel...'.grey);

  client.debugstack(function(err, stack) {
    if (err) throw err;
    console.log(stack || "Not running");
    client.close();
  })
})
