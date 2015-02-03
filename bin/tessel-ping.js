#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var tessel_dfu = require('../dfu/tessel-dfu'),
  fs = require('fs'),
  path = require('path'),
  logs = require('../src/logs'),
  common = require('../src/cli');

// Setup cli.
common.basic();

common.controller({stop: true}, function (err, client) {
  (function loop () {
    logs.info('ping...');
    client.ping(function pong (err, data) {
      if (err) {
        logs.err(err.message);
        setImmediate(loop);
      } else {
        logs.info(data);
        setTimeout(loop, 1000);
      }
    });
  })();
});
