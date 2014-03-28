// Add command helpers to client.
var zlib = require('zlib');
var path = require('path');
var fs = require('fs');
var stream = require('stream');

var tessel = require('./');

exports.apply = function (prototype) {

  prototype.initCommands = function() {
    this.stdout = new stream.Duplex();
    this.stdout._read = function () {
    };
    this.stdout._write = function (data, encoding, next) {
      this.push(data);
      this.push('\n');
      next(null);
    };

    this.on('command', function (command, data) {
      if (command == 'S') {
        var code = parseInt(data);
        if (code > 0) {
          this.emit('script-start');
        } else {
          this.emit('script-stop', -code);
        }
      } else if (command == 'M') {
        this.emit('message', data);
      }
    })
  }


  prototype.wifiStatus = function (next) {
    this.command('V', new Buffer([0xde, 0xad, 0xbe, 0xef]), function () {
      console.error('Requesting wifi status...'.grey);
    });

    this.on('command', function oncommand (command, data) {
      if (command == 'V') {
        this.removeListener('command', oncommand);
        next(null, JSON.parse(data));
      }
    });
  }

  prototype.configureWifi = function (ssid, pass, security, opts, next) {
    typeof opts == 'function' && (next = opts);
    next == null && (opts = {});

    this.on('command', function oncommand (command, data) {
      if (command == 'W' && 'ip' in data) {
        this.removeListener('command', oncommand);
        next(!data.connected, data);
      }
    });

    // Package Wifi arguments
    var outbuf = new Buffer(129);
    outbuf.fill(0);
    new Buffer(String(ssid)).copy(outbuf, 0, 0, ssid.length);
    new Buffer(String(pass)).copy(outbuf, 32, 0, pass.length);
    new Buffer(String(security)).copy(outbuf, 96, 0, security.length);
    new Buffer([opts.timeout || 8]).copy(outbuf, 128, 0, 1);

    this.command('W', outbuf);
  }

  // prototype.deploy = function (file, args, next) {
  //   tessel.detectDirectory(file, function (err, dirpath, relpath) {
  //     tessel.bundleCode(dirpath, relpath, args, function (err, tarstream) {
  //       this.deployBundle(tarstream, {}, next);
  //     });
  //   });
  // }

  prototype.deployBundle = function (bundle, options, next) {
    if (options.save){
      fs.writeFileSync("builtin.tar", bundle);
      console.log("wrote builtin.tar");
    }
    this.stop(function () {
      next && this.once('script-start', next);
      this.command(options.flash?'P':'U', bundle);
    }.bind(this));
  }

  prototype.erase = function (next) {
    this.command('P', new Buffer([0xff, 0xff, 0xff, 0xff]), next);
  }

  prototype.stop = function (next) {
    this.command('X', new Buffer([0xff, 0xff, 0xff, 0xff]), next);
  }

  prototype.deployBinary = function (file, next) {
    // open up the file
    var buffer = fs.readFileSync(file);
    next && this.once('script-start', next);
    this.command('U', buffer);
  }

  prototype.send = function (data) {
    this.command('M', new Buffer(JSON.stringify(data)));
  };
}