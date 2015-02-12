#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var common = require('../src/cli')
  , colors = require('colors')
  , tessel = require('../')
  , path = require('path')
  , fs = require('fs')
  , util = require('util')
  , humanize = require('humanize')
  , logs = require('../src/logs')
  ;

// Setup cli.
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel-push')
  .option('script', {
    position: 0,
    // required: true,
    default: '.',
    full: 'script.js',
    help: 'Pack this script as an archive.',
  })
  .option('args', {
    abbr: 'a',
    list: true,
    help: 'Arguments to pass in as process.argv.'
  })
  .option('dry', {
    abbr: 'd',
    flag: true,
    help: 'Do not output a tar bundle.'
  })
  .option('help', {
    abbr: 'h',
    flag: true,
    help: 'Show usage for tessel pack'
  })
  .parse();

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

tessel.bundleScript(argv.script, argv.args, {
  quiet: true,
}, function (err, tarbundle) {
  logs.info('wrote %s bytes', humanize.filesize(tarbundle.length))
  if (!argv.dry) {
    var file = 'tessel-' + path.basename(process.cwd()) + '.tar';
    logs.info(file)
    fs.writeFileSync(file, tarbundle);
  }
})
