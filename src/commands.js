// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// Add command helpers to client.
var zlib = require('zlib');
var path = require('path');
var fs = require('fs');
var stream = require('stream');
var clone = require('structured-clone')
  , logs = require('../src/logs')
  , humanize = require('humanize')
  ;

var tessel = require('./');
var prototype = tessel.Tessel.prototype;

/**
 * If bundle size reaching this amount, show error and stop deployment
 * @type {number}
 */
var MAX_BUNDLE_SIZE = 30 * 1024 * 1024;


// Abstract raw command writing from JS API.
// Eventually this will correspond to the USB interface.
var commands = {
  disconnect: function (client, callback) {
    client.postMessage(0x0059, new Buffer(4), callback);
  },
  connect: function (client, ssid, pass, security, callback) {
    // Package Wifi arguments
    var outbuf = new Buffer(128);
    outbuf.fill(0);
    ssid.copy(outbuf, 0, 0, ssid.length);
    pass.copy(outbuf, 32, 0, pass.length)
    security.copy(outbuf, 96, 0, security.length);

    client.postMessage(0x0057, outbuf, callback);
  },
  macAddress: function(client, callback) {
    client.postMessage(0x0063, null, callback);
  },
  writeStdin: function (client, buffer, callback) {
    client.postMessage(0x006e, buffer, callback);
  },
  ping: function (client, callback) {
    client.postMessage(0x0047, new Buffer('ping'), callback);
  },
  checkWifi: function (client, lastCheck, callback) {
    client.postMessage(0x0043, new Buffer([lastCheck ? 0x1 : 0x0]), callback);
  },
  uploadRam: function (client, bundle, callback) {
    client.postMessage(0x0055, bundle, callback);
  },
  uploadFlash: function (client, bundle, callback) {
    client.postMessage(0x0050, bundle, callback);
  },
  writeProcessMessage: function (client, data, callback) {
    client.postMessage(0x004d, clone.serialize(data), callback);
  },
  requestWifiNetworksAndStatus: function (client, callback) {
    client.postMessage(0x0056, null, callback);
  },
  enterBootloader: function (client, callback) {
    client.postMessage(0x0042, null, callback);
  },
  eraseWifiProfiles: function (client, callback) {
    client.postMessage(0x0044, new Buffer('erase'), callback);
  }
};

// Soon, interface should be an instance of the commands object.
Object.defineProperty(prototype, 'interface', {
  get: function () {
    var obj = {};
    for (var key in commands) {
      obj[key] = commands[key].bind(this, this);
    }
    return obj;
  }
});

prototype.initCommands = function () {
  var self = this;

  // Script status.
  this.on('rawMessage:0053', function (data) {
    var code = parseInt(String(data));
    if (code > 0) {
      this.emit('script-start');
    } else {
      this.emit('script-stop', -code);
    }
  });

  // Upload status.
  this.on('rawMessage:0055', function (data) {
    var packet = JSON.parse(data);
    this.emit('upload-status', packet);
  });

  // Wifi events.
  this.on('rawMessage:0057', function (data) {
    var packet = JSON.parse(data);
    this.emit('wifi-' + packet.event, packet);
    // console.log(packet);
  });

  // Wifi list.
  this.on('rawMessage:0056', function (data) {
    var packet = JSON.parse(data);
    this.emit('wifi-list', packet);
  });

  // process.send() message
  this.on('rawMessage:004d', function (data) {
    this.emit('message', clone.deserialize(data));
  });

  // Debug stack
  this.on('rawMessage:006b', function (data) {
    this.emit('debug-stack', data.toString('utf-8'));
  });

  // Mac Address
  this.on('rawMessage:0063', function(data) {
    var packet = JSON.parse(data);
    this.emit('mac-address', packet);
  });

  // Ping / pong.
  this.on('rawMessage:0047', function (data) {
    var packet = JSON.parse(data);
    this.emit('pong', packet);
  });

  // Wifi profile erase ACK.
  this.on('rawMessage:0044', function (data) {
    this.emit('wifi-profile-erase', parseInt(data.toString('utf-8')));
  });

  // Create stream objects.
  this.stdout = new stream.Readable();
  this.stdout._read = function () {
  };
  this.stdout.pause();

  this.stderr = new stream.Readable();
  this.stderr._read = function () {
  };
  this.stderr.pause();

  this.stdin = new stream.Writable();
  this.stdin._write = function (chunk, encoding, callback) {
    commands.writeStdin(self, Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk, encoding), callback)
  };

  this.on('log', function (level, str) {
    if (level == 30) {    // raw stderr
        self.stdout.push(str);
    }
    if (level == 31) {    // raw stdout
      self.stderr.push(str);
    }
    if (level == 10 || level == 11 || level == 12) {
      self.stdout.push(str + '\n');
    }
    if (level == 13 || level == 22) {
      self.stderr.push(str + '\n');
    }
  });
}

prototype.enterBootloader = function (next) {
  var self = this;
  self.claim(true, function() {
    self.log_ep.stopPoll();
    self.msg_in_ep.stopPoll();
    commands.enterBootloader(self, function(err) {
      if (err) return next && next(err);
      self.usb.close();
      self.closed = true;
      self.reFind('boot', next);
    });
  });
};

prototype.ping = function (opts, next) {
  if (typeof opts == 'function') {
    next = opts;
    opts = null;
  }
  opts = opts || {};
  opts.timeout = opts.timeout || 3000;

  var self = this;
  function ponghandler (data) {
    if (timeout) {
      clearTimeout(timeout);
      self.removeListener('pong', ponghandler);
      next(null, data);
    }
  }
  var timeout = setTimeout(function () {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
      next(new Error('timeout occurred after ' + (opts.timeout / 1000) + ' seconds!'), null);
    }
  }, opts.timeout)
  self.once('pong', ponghandler);
  commands.ping(self);
}

prototype.wifiStatus = function (next) {
  commands.requestWifiNetworksAndStatus(this, function () {
    logs.info('Requesting wifi status...'.grey);
  });

  this.once('wifi-list', function (list) {
    next(null, list);
  });
}

prototype.wifiErase = function (next) {
  commands.eraseWifiProfiles(this, function () {
    console.error('Erasing saved wifi profiles'.grey);
  });

  this.once('wifi-profile-erase', function (data) {
    if (Number(data) < 0) {
      next(data);
    } else {
      next(null);
    }
  });
}

prototype.macAddress = function(next) {
  commands.macAddress(this, function () {
    logs.info('Requesting MAC Address...'.grey);
  });

  this.once('mac-address', function(data) {
    if (data.event === 'error') {
      next && next(new Error("Unable to retrieve MAC Address. Error Number " + data.status));
    }
    else {
      next && next(null, data.mac_address);
    }
  });
}

prototype.configureWifi = function (ssid, pass, security, opts, next) {
  var self = this;

  typeof opts == 'function' && (next = opts);
  next == null && (opts = {});
  var timeout = opts.timeout || 20;

  var switching = false;
  self.once('wifi-status', function (data) {
    if (data.connected) {
      logs.info('Disconnecting from current network...');
      self.once('wifi-disconnect', start);
      commands.disconnect(self);
    } else {
      start();
    }
  });
  self.checkWifi(true);

  function start () {
    logs.info('Connecting to "%s" with %s security...', ssid, security);
    (function timeoutloop () {
      var checkInterval = null;
      var acquiring = false;

      function onAcquire (packet) {
        // Polling animation
        acquiring = true;
        logs.info('Acquiring IP address. ')
        var count = 0;
        var maxCount = timeout;

        checkInterval = setInterval(function(){
          count++;
          if (count >= maxCount){
            process.stderr.write(' timeout.\n');
            logs.info('Retrying...');

            cleanup();
            setTimeout(timeoutloop, 1000);
          } else {
            process.stderr.write('.');
          }
        }, 1000);
      }

      function onDHCPSuccess(packet) {
        if (acquiring) {
          process.stderr.write('\n');
        }

        self.once('wifi-status', function (packet) {
          cleanup();
          next(packet);
        })
      }

      function onError (packet) {
        cleanup();

        next(packet);
      }

      function cleanup () {
        if (checkInterval != null) {
          clearInterval(checkInterval);
        }
        self.removeListener('wifi-acquire', onAcquire);
        self.removeListener('wifi-dhcp-success', onDHCPSuccess);
        self.removeListener('wifi-disconnect', onDHCPSuccess);
        self.removeListener('wifi-error', onError);
      }

      self.once('wifi-acquire', onAcquire);
      self.once('wifi-dhcp-success', onDHCPSuccess);
      self.once('wifi-disconnect', onDHCPSuccess);
      self.once('wifi-error', onError);

      commands.connect(self, ssid, pass, security);
    })();
  }
}

prototype.checkWifi = function(lastCheck){
  commands.checkWifi(this, lastCheck);
};

prototype.deployBundle = function (bundle, options, next) {
  var self = this;

  if (bundle.length > MAX_BUNDLE_SIZE) {
    logs.err('Bundle size is %s and is above max limit of %s',
        humanize.filesize(bundle.length),
        humanize.filesize(MAX_BUNDLE_SIZE));
    process.exit(-1);
  }

  self.stop(function () {
    next && self.once('script-start', next);
    if (options.flash) {
      commands.uploadFlash(self, bundle);
    } else {
      commands.uploadRam(self, bundle);
    }
  });
};

prototype.erase = function (next) {
  var self = this;
  self.stop(function () {
    commands.uploadFlash(self, new Buffer([0xff, 0xff, 0xff, 0xff]), next);
  });
}

prototype.send = function (data) {
  commands.writeProcessMessage(this, data);
};
