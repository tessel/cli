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

// Command-line arguments
var argv = require("nomnom")
  .script('tessel logs')
  .option('all', {
    abbr: 'a',
    flag: true,
    help: 'listens to all messages from tessel (even ones thrown from firmware)'
  })
  .parse();

common.controller({stop: false}, function (err, client) {
  if (argv.all){
    client.listen(true);
  } else {
    client.listen(true, [10, 11, 12, 13, 20, 21, 22]);
  }
})
