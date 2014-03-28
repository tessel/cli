var tessel_usb = require('./tessel_usb');
var bundle = require('./bundle');
var Tessel = tessel_usb.Tessel;

require('./commands').apply(Tessel.prototype);
exports.findTessel = tessel_usb.findTessel;
exports.listDevices = tessel_usb.listDevices;
exports.bundleFiles = bundle.bundleFiles;
