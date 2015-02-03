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
  colors = require('colors'),
  util = require('util'),
  logs = require('../src/logs');

// Setup cli.
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel wifi')
  .option('list', {
    abbr: 'l',
    flag: true,
    help: '[Tessel] List available wifi networks.',
  })
  .option('network', {
    abbr: 'n',
    help: '[Tessel] The network to connect to.'
  })
  .option('password', {
    abbr: 'p',
    help: '[Tessel] Password of the network. Omit for unsecured networks.'
  })
  .option('password-hex', {
    help: '[Tessel] Password of the network in hex.'
  })
  .option('security', {
    abbr: 's',
    default: 'wpa2',
    help: '[Tessel] Security type of the network, one of (wpa2|wpa|wep). Omit for unsecured networks.'
  })
  .option('timeout', {
    abbr: 't',
    default: 20,
    help: '[Tessel] Sets timeout before retrying connection to network.'
  })
  .option('disconnect', {
    abbr: 'd',
    flag: true,
    help: '[Tessel] erases stored wifi configurations on Tessel'
  })
  .option('help', {
    abbr: 'h',
    help: '[Tessel] Show usage for tessel wifi'
  })
  .option('mac', {
    abbr: 'm',
    flag: true,
    help: '[Tessel] Show the MAC Address of the WiFi chip'
  })
  .parse();


function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

common.controller({stop: false}, function (err, client) {
  if (argv.list) {
    client.listen(true, null); // TODO: should use [20, 21, 22, 86] once firmware logs at the right level
    client.wifiStatus(function (err, data) {
      Object.keys(data).map(function (key) {
        if (key.toUpperCase() == "IP"){
          // reverse key.data
          data[key] = data[key].split(".").reverse().join(".");
        }
        logs.info(key.replace(/^./, function (a) { return a.toUpperCase(); }) + ':', data[key]);
      })
      client.close();
    })

  } else if (argv.disconnect) {
    client.wifiErase(function(err){
      if (err) return console.error("Got error code:", err, "while erasing profiles");
      console.log("Erased wifi profiles");
      client.close();
    })
  }
  else if (argv.mac) {
    client.macAddress(function(err, macAddress) {
      if (err) return console.log("Error retrieving Mac Address.", err);
      else {
        logs.info("Mac Address:", macAddress);
      }
      client.close();
    })
  } else {
    if (!argv.network){
      usage();
    }

    function retry () {
      var ssid = new Buffer(String(argv.network));
      var pass = argv.password || "";

      if (argv['password-hex']) {
        pass = new Buffer(argv['password-hex'], 'hex');
      } else {
        pass = new Buffer(String(pass));
      }

      var security = new Buffer((String(argv.security) || (pass ? 'wpa2' : 'unsecure')).toLowerCase());

      client.configureWifi(ssid, pass, security, {
        timeout: argv.timeout
      }, function (data) {
        if (data.event == 'error') {
          logs.err('Error in connecting (%d). Please try again.', data.error);
          process.on('exit', function () {
            process.exit(1);
          })
          client.close();
        } else if (!data.connected) {
          logs.err('Connection failed. Check that your ssid and password are correct. Try moving closer to your router for a quicker connection.');
          logs.info('The wifi connection timeout can be increased with "tessel wifi -n <network> -p <password> -t <timeout (s)>" if the connection is weak.');
          client.close();
        } else {
          logs.info('Connected!\n');

          console.log('IP\t', data.ip);
          console.log('DNS\t', data.dns);
          console.log('DHCP\t', data.dhcp);
          console.log('Gateway\t', data.gateway);
          client.close();
        }
      });
    }

    // Flush earlier USB network messages.
    // TODO: Actually flush these.
    setTimeout(retry, 2000);
  }
})
