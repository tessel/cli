// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// Loads and executes the `otp` tool using the NXP ROM to install the Tessel bootloader

var fs = require('fs'),
  usb = require('usb'),
  DFU = require('./dfu');

var NXP_ROM_VID = 0x1fc9;
var NXP_ROM_PID = 0x000c;

exports.findDevice = function findDevice() {
  return usb.findByIds(NXP_ROM_VID, NXP_ROM_PID);
}

/// Run `image` via the passed USB device, using the NXP ROM
exports.run = function romRun(device, image, callback) {
    var dfu = new DFU(device);

    var header = new Buffer(16);
    header.fill(0)
    header.writeUInt8(0xda, 0);
    header.writeUInt8(0xff, 1);
    header.writeUInt16LE(Math.floor(image.length / 512)+1, 2);
    header.writeUInt32LE(0xFFFFFFFF, 12);

    dfu.claim(function (e) {
        if (e) throw e;
        dfu.dnload(Buffer.concat([header, image]), callback);
    });
}

if (module === require.main) {
  var device = exports.findDevice()

  // This file is compiled in the otp/ directory of the Tessel firmware source.
  // It is a RAM image that installs the bootloader
  var default_otp_image = __dirname + '/bootloader_install.bin';
  var image = fs.readFileSync( process.argv[2] || default_otp_image );

  exports.run(device, image, function(e) {
    // Ignore e. The last request fails because the device is gone.
    console.log("Done");
  })
}
