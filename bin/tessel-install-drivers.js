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
  child_process = require('child_process'),
  common = require('../src/cli'),
  logs = require('../src/logs');

// Setup cli.
common.basic();

if (process.platform === 'linux') {
  var rules_name = '85-tessel.rules';
  var dest = '/etc/udev/rules.d/' + rules_name;
  var rules = fs.readFileSync(__dirname + '/../install/' + rules_name);

  try {
    fs.writeFileSync(dest, rules);
  } catch (e) {
    if (e.code === 'EACCES') {
      logs.info('NOTE: Please run `sudo tessel install-drivers` to complete your driver installation.');
      logs.err('could not write to ' + dest);
      process.exit(1);
    } else {
      throw e;
    }
  }
  logs.info("udev rules installed to", dest);


  var udevadm = child_process.spawn('udevadm', ['control', '--reload-rules']);
  udevadm.on('close', function (code) {
    if (code !== 0) {
      logs.err("reloading udev.");
      process.exit(code);
    } else {
      logs.info("Driver installation complete. Unplug and re-plug Tessel to begin using it.");
    }
  });
} else {
  logs.info("No driver installation necessary.");
}
