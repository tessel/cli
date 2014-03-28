#!/usr/bin/env node

var common = require('../src/common')

var argv = require('optimist').argv;

common.controller(function (err, client) {
  client.listen(true, [86])
  if (argv._.length == 1) {
    client.wifiStatus(function (err, data) {
      Object.keys(data).map(function (key) {
        console.log(key.replace(/^./, function (a) { return a.toUpperCase(); }) + ':', data[key]);
      })
      process.exit(0);
    })

  } else {
    // if (argv._.length < 3) {
    //   usage();
    //   process.exit(1);
    // }

    function retry () {
      var ssid = argv._[1];
      var pass = argv._[2] || "";
      var security = (argv._[3] || (pass ? 'wpa2' : 'unsecure')).toLowerCase();

      // Only defer to make print after thing.
      client.once('connect', function () {
        console.log(('Network ' + JSON.stringify(ssid) + 
          ' (pass ' + JSON.stringify(pass) + ') with ' + security + ' security'));
      });

      // This is just for fun logs
      client.on('command', function listener (command, data) {
        if (command == 'w') {
          console.log(data);
        }
        if (command == 'W' && 'connected' in data) {
          client.removeListener('command', listener);
        }
      });

      client.configureWifi(ssid, pass, security, {
        timeout: argv.timeout || 8
      }, function (err) {
        if (err && !argv['no-retry']) {
          console.error('Retrying...');
          setImmediate(retry);
        } else {
          process.exit(err ? 1 : 0);
        }
      });
    }

    retry();
  }
})
