#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var os = require("os")
  , temp = require('temp')
  , path = require('path')
  , request = require('request')
  , fs = require('fs')
  , colors = require('colors')
  , tessel_dfu = require('../dfu/tessel-dfu')
  , builds = require('../src/builds')
  , logs = require('../src/logs')
  ;

var common = require('../src/cli');
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

function restore(buff, client, next){
  // check to make sure buffer is valid
  if (!builds.isValid(buff)){
    logs.err("file is not a valid firmware image");
    return next && next(err)
  }

  logs.info("Updating firmware... please wait. Tessel will reset itself after the update");
  client && client.close();

  if (client){
    client.on('close', function(){
      next && next();
    })
  } else {
    next && next();
  }
}

function restoreBuild(buff, client, next){
  restore(buff, client, function(){
    tessel_dfu.write(buff, next);
  });
}

function restoreRam(buff, client, next){
  restore(buff, client, function(){
    tessel_dfu.runRam(buff, function(){
      logs.info("Wifi patch uploaded... waiting for it to apply (10s)");
  
      var holdUp = setInterval(function(){
        logs.info("...");
      }, 2000);

      setTimeout(function(){
        clearInterval(holdUp);
        logs.info("... Done");
      }, 12500);
    });
  });
}

function applyBuild(url, client, next){
  logs.info("Downloading firmware from "+url);
  builds.getBuild(url, function(err, buff){
    if (!err){
      restoreBuild(buff, client, next);
    } else {
      throw err;
    }
  });
}

function applyRam(url, client, next){
  logs.info("Downloading wifi patch from "+url);
  builds.getBuild(url, function(err, buff){
    if (!err){
      restoreRam(buff, client);
    } else {
      throw err;
    }
  });
}

function isLocalPath (str) {
  return str.match(/^[\.\/\\]/);
}

function isUrl (str){
  return str.match(/^(ftp|http|https):\/\//);
}

function isCLIValid (min, max) {
  var cliVer;
  try {
    cliVer = require('../package.json').version;
  } catch (e) {
    return false;
  }

  if (!cliVer) return false;

  if ( (!min || min == "*" || min <= cliVer) 
    && (!max || max == "*" || max >= cliVer) ) {
    return true;
  }

  return false;
}

function update(client, wifiVer){
  if (process.argv.length == 2 || argv.force || argv.dfu){
    // if there's only 2 args apply latest firmware patch
    logs.info("Checking for latest firmware... ");
    builds.checkBuildList(client == null ? null : client.version, function (allBuilds, needUpdate){
      if (!allBuilds) {
        // no builds?
        logs.err("No builds were found");
        return client && client.close();
      }
      if (needUpdate || argv.force) {
        // check for valid CLI version
        if (!isCLIValid(allBuilds[0].min_cli, allBuilds[0].max_cli)) {
          logs.err("CLI version is not supported with this firmware build. CLI must be between", allBuilds[0].min_cli, "and", allBuilds[0].max_cli);
          return client && client.close();
        }

        // check if we need a wifi update
        var wifiUpdate = function (){};
        if ( (argv.dfu && argv.wifi) || // if its in dfu mode and a wifi flag is passed, do both updates
          (allBuilds[0].wifi && Number(wifiVer) != Number(allBuilds[0].wifi)) ){ // otherwise only update if version is outdated
         
          logs.info("Wifi version is also outdated, applying wifi patch after firmware.");

          wifiUpdate = function(){
            // wait for reboot and reacquire tessel
            setTimeout(function(){
              applyRam(builds.utils.buildsPath+"wifi/"+allBuilds[0].wifi+".bin", null);
            }, 1000);
            
          }
        }

        applyBuild(builds.utils.buildsPath+allBuilds[0].url, client, wifiUpdate);
        
      } else {
        // already at latest build
        logs.info("Tessel is already on the latest firmware build. You can force an update with \"tessel update --force\"");
        return client && client.close();
      }
    });
  } else {
    var updateVer = process.argv[2];

    // check if we have a url
    if (isUrl(updateVer)) {
      // if it's a custom url
      applyBuild(updateVer, client);
    } else if (isLocalPath(updateVer)){
      // if it's a local path just send this file
      restoreBuild(fs.readFileSync(updateVer), client);
    } else if (argv.build){ 
      // get the head of the build
      builds.getBuildDetails(argv.build, function (details){
        // check for valid CLI version
        if (!isCLIValid(details.min_cli, details.max_cli)) {
          logs.err("CLI version is not supported with this firmware build. CLI must be between", details.min_cli, "and", details.max_cli);
          return client && client.close();
        }

        // rebuild url and download by build number
        applyBuild(builds.utils.buildsPath+"firmware/tessel-firmware-"+argv.build+".bin", client);
      });

    } else if (argv.wifi) {
      // apply the wifi build
      applyRam(builds.utils.buildsPath+"wifi/"+argv.wifi+".bin", client);
    }
  }
}

if (argv.list){
  // list possible builds
  builds.checkBuildList("", function(allBuilds){
    function currentize (key, i) {
      var date = key.match(/\d{4}-\d{2}-\d{2}/) || 'current   '.yellow;
      return date
    }

    logs.info("Switch to any of these builds with `tessel update -b <build name>`");
    var tags = allBuilds.filter(function (file) {
      return file.url.match(/^firmware\/./) && file.url.match(/\.bin$/);
    }).sort(function (a, b) {
      if (a.url < b.url) return 1;
      if (a.url > b.url) return -1;
      return 0;
    }).map(function (file, i) {
      return '  o '.blue + currentize(file.url.replace(/^firmware\//, ''), i);
    });

    if (tags.length > 10) {
      tags = tags.slice(0, 10);
      tags.push('  ...');
    }
    console.log(tags.join('\n'));

  });

} else {
  // check for dfu mode
  var device = tessel_dfu.findDevice();
  if (tessel_dfu.guessDeviceState(device) == 'dfu' || argv.dfu){
    // looks like they've run it in dfu mode, don't bother with common
    update(null, 0);
  } else {
    common.controller(function (err, client) {

      if (!err) {
        client.listen(true);

        client.on('error', function (err) {
          if (err.code == 'ENOENT') {
            logs.err('Cannot connect to Tessel locally.')
          } else {
            console.error(err);
          }
        });

        client.wifiVer(function(err, wifiVer){
          update(client, wifiVer);
        });
      } 
      
    });
  }
}

