#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var common = require('../src/cli'),
  logs = require('../src/logs'),
  builds = require('../src/builds');
  
// Setup cli.
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel version')
  .option('board', {
    abbr: 'b',
    flag: true,
    help: '[Tessel] Get the version information of the connected Tessel board.',
  })
  .option('help', {
    abbr: 'h',
    help: 'Show usage for tessel version'
  })
  .parse();

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

if (argv.board){
  common.controller({stop: true}, function (err, client) {
    client.wifiVer(function(err, wifiVer){
      logs.info("Serial #:", client.serialNumber);
      logs.info("Wifi Version:", wifiVer);
      logs.info("Firmware Commit:", client.version.firmware_git);
      logs.info("Runtime Commit:", client.version.runtime_git);

      // try to check for the semver
      builds.checkBuildList(client.version.firmware_git, function (buildRes){
        if (buildRes) {
          var filtered = buildRes.filter(function(build){
            if (build.version && build.url.indexOf('current') == -1) return build.version.search(client.version.firmware_git) >= 0
            return false;
          });

          if (filtered.length > 0) {
            // parse out the semver
            var ver = filtered[0].url;
            logs.info("Firmware Build:", ver.substring(ver.lastIndexOf('-')+1, ver.lastIndexOf('.')));
          }
        } else {
          logs.warn("Could not look up build server to determine build. You can manually check for the commit hash at https://github.com/tessel/firmware/commits/master");
        }

        client.close(function () {
          process.exit(0);
        });
      });

    });
  });
} else {
  try {
    logs.info(require('../package.json').version.replace(/^v?/, 'v'))
  } catch (e) {
    logs.err('version unknown');
  }
}
