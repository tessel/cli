#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var os = require("os"),
  temp = require('temp'),
  path = require('path'),
  request = require('request'),
  fs = require('fs'),
  colors = require('colors'),
  builds = require('../src/builds'),
  logs = require('../src/logs'),
  semver = require('semver'),
  common = require('../src/cli');
  
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel update')
  .option('list', {
    abbr: 'l',
    flag: true
  })
  .option('wifi', {
    abbr: 'w',
    help: 'optional version of CC3000 wifi firmware to install'
  })
  .option('build', {
    abbr: 'b',
    help: 'Optional build of the firmware version (does not update wifi)'
  })
  .option('force',{
    abbr: 'f',
    flag: true,
    help: 'forcibly reload firmware onto Tessel'
  })
  .option('dfu', {
    abbr: 'd',
    flag: true,
    help: 'apply firmware update to device in DFU mode'
  })
  .parse();

function usage(){
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

function done(err) {
  if (err) {
    logs.err(err.stack || err);
    process.exit(1);
  } else {
    logs.info("Complete")
  }
}

function fetchBuild(path, next) {
  if (isUrl(path)) {
    logs.info('Downloading remote file', path);
    builds.getBuild(path, check);
  } else {
    logs.info('Using local file', path);
    fs.readFile(path, check);
  }

  function check(err, buf) {
    if (err) return next(err);
    if (builds.isValid(buf)) {
      next(null, buf);
    } else {
      next(new Error("file is not a valid firmware image"));
    }
  }
}


function applyBuild(url, client, next){
  fetchBuild(url, function(err, buff){
    if (err) return next(err);
    logs.info("Updating firmware... please wait. Tessel will reset itself after the update");

    client.enterBootloader(function(err, bl) {
      if (err) return next(err);
      bl.writeFlash(buff, function() {
        if (next) {
          bl.reFind('app', next);
        }
      }, common.showStatus);
    });

  });
}

function applyRam(url, client, next){
  fetchBuild(url, function(err, buff){
    if (err) return next(err);

    client.enterBootloader(function(err, bl) {
      if (err) return next(err);

      bl.runRam(buff, function (e) {
        logs.info("Wifi patch uploaded... waiting for it to apply (10s)");

        var holdUp = setInterval(function(){
          logs.info("...");
        }, 2000);

        setTimeout(function(){
          clearInterval(holdUp);
          logs.info("");
          if (next) {
            bl.reFind('app', next);
          }
        }, 12500);
      });
    });
  });
}

function isUrl (str){
  return str.match(/^(ftp|http|https):\/\//);
}

function update(client) {
  if (argv._.length > 0) { // The user requested a specific file
    applyBuild(argv._[0], client, done);
  } else if (argv.build) {
    // rebuild url and download by build number
    applyBuild(builds.utils.buildsPath+"firmware/tessel-firmware-"+argv.build+".bin", client, done);
  } else if (argv.wifi) {
    // apply the wifi build
    applyRam(builds.utils.buildsPath+"wifi/"+argv.wifi+".bin", client, done);
  } else {
    // if there's only 2 args apply latest firmware patch
    logs.info("Checking for latest firmware... ");
    builds.checkBuildList(client == null ? null : client.version, function (allBuilds, needUpdate) {
      if (!allBuilds) {
        // no builds?
        logs.err("No builds were found");
        client && client.close();
        return;
      }
      if (needUpdate || argv.force) {
        if (client.mode == 'app') {
          client.wifiVer( function(err, wifiVer) {
            if (err) return done(err);

            if (wifiVer === '0.0') {
              logs.err("Error retrieving WiFi version");
              step(null, client);
            } else if (allBuilds[0].wifi && Number(wifiVer) != Number(allBuilds[0].wifi)) {
              logs.info("Wifi version is also outdated.");
              applyRam(builds.utils.buildsPath+"wifi/"+allBuilds[0].wifi+".bin", client, step);
            } else {
                step(null, client);
            }
          });
        } else {
          logs.info("Already in bootloader mode: could not check WiFi version.")
          step(null, client);
        }

        function step(err, newClient) {
          if (err) return done(err);
          applyBuild(builds.utils.buildsPath+allBuilds[0].url, newClient, done);
        }

      } else {
        // already at latest build
        logs.info("Tessel is already on the latest firmware build. You can force an update with \"tessel update --force\"");
        return client && client.close();
      }
    });
  }
}

if (argv.list){
  // list possible builds
  builds.checkBuildList("", function(allBuilds){
    function currentize (key, i) {
      return key == 'current' ? key.yellow : key;
    }

    function tagsort (a, b) {
      if (semver.valid(a) && !semver.valid(b)) {
        return -1;
      }
      if (!semver.valid(a) && semver.valid(b)) {
        return 1;
      }
      if (semver.valid(a) && semver.valid(b)) {
        return semver.lt(a, b) ? 1 : semver.gt(a, b) ? -1 : 0;
      }
      if (a < b) return 1;
      if (a > b) return -1;
      return 0;
    }

    logs.info("Switch to any of these builds with `tessel update -b <build name>`");
    var alltags = allBuilds.filter(function (file) {
      return file.url.match(/^firmware\/./) && file.url.match(/\.bin$/);
    }).map(function (file) {
      return path.basename(file.url, '.bin').replace(/^tessel-firmware-/, '');
    });

    var currenttags = alltags.filter(function (tag) {
      return tag == 'current';
    }).sort(tagsort);
    var vertags = alltags.filter(function (tag) {
      return semver.valid(tag);
    }).sort(tagsort);
    var datetags = alltags.filter(function (tag) {
      return tag.match(/^\d{4}\-\d{2}\-\d{2}$/);
    }).sort(tagsort);

    var tags = [].concat(currenttags, vertags, datetags).map(function (file, i) {
      return '  o '.blue + currentize(file);
    });

    if (tags.length > 10) {
      tags = tags.slice(0, 10);
      tags.push('  ...');
    }
    console.log(tags.join('\n'));

  });

} else {
  common.controller({stop: true, appMode: false}, function (err, client) {
    if (err) throw err;
    update(client);
  });
}
