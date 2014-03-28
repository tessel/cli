var usb = require('usb');
var util = require('util');
var async = require('async');
var EventEmitter = require('events').EventEmitter;

var TESSEL_VID = 0x1d50;
var TESSEL_PID = 0x6097;

var REQ_FW_STATUS = 0x01;

var DEBUG_INTF = 0;

var MSG_INTF   = 1;
var REQ_RESET_MSG_STATE = 0x01;
var REQ_STOP_APP = 0x11;

var RECIPIENT_VENDOR_INTERFACE = usb.LIBUSB_RECIPIENT_INTERFACE|usb.LIBUSB_REQUEST_TYPE_VENDOR;

function Tessel(dev) {
	this.usb = dev;
}

exports.Tessel = Tessel;

util.inherits(Tessel, EventEmitter);

Tessel.prototype.init = function init(next) {
	var self = this;
	this.usb.open();
	this.usb.timeout = 10000;
	this.initCommands();

	this.usb.getStringDescriptor(this.usb.deviceDescriptor.iSerialNumber, function (error, data) {
		if (error) return next(error);
		self.serialNumber = data;
		next(null, self);
	})
}

Tessel.prototype.close = function close() {
	this.usb.close();
}

Tessel.prototype.listen = function listen(colors, logLevels) {
	var self = this;
	var intf = this.usb.interface(DEBUG_INTF);
	intf.claim();
	intf.setAltSetting(1, function(error) {
		if (error) throw error;
		var ep_debug = intf.endpoints[0];

		ep_debug.startStream(2, 4096);
		ep_debug.on('data', function(data) {
			// Log level is wrapped with ASCII SOH STX. Throw it away for now

			var pos = 0;
			while (pos < data.length) {
				if (data[pos] !== 1) { throw new Error("Expected STX at"+ pos +' ' + data[pos]) }
				var level = data[pos+1];
				
				for (var next=pos+2; next<data.length; next++) {
					if (data[next] === 1) {
						break;
					}
				}

				if (!logLevels || logLevels.indexOf(level) != -1) {
					var str = data.toString('utf8', pos+2, next);
					process.stdout.write(str + "\n");
				}

				pos = next;
			}
		});

		ep_debug.on('error', function(err) {
			console.log(err)
		});

		self.once('end', function () {
			ep_debug.stopStream();
		});
	});
}

// TODO: move this to usb module
usb.OutEndpoint.prototype.transfer_with_zlp = function (buf, cb) {
	if (buf.length % this.descriptor.wMaxPacketSize == 0) {
		this.transfer(buf);
		this.transfer(new Buffer(0), cb);
	} else {
		this.transfer(buf, cb);
	}
}

Tessel.prototype.postMessage = function postMessage(tag, buf, cb) {
	var intf = this.usb.interface(MSG_INTF);
	intf.claim();

	var header = new Buffer(8);
	header.writeUInt32LE(buf.length, 0);
	header.writeUInt32LE(tag, 4);
	var data = Buffer.concat([header, buf]);

	var msg_out_endpoint = intf.endpoints[1];
	msg_out_endpoint.transfer_with_zlp(data, function(error) {
		cb && cb(error);
	});
}

Tessel.prototype.command = function command(cmd, buf, next) {
	next = next || function(error) { if(error) console.error(error); }
	this.postMessage(cmd.charCodeAt(0), buf, next);
}

Tessel.prototype.receiveMessages = function listenForMessages() {
	var self = this;
	var intf = this.usb.interface(MSG_INTF);
	intf.claim();

	var transferSize = 4096;
	var msg_in_endpoint = intf.endpoints[0];
	msg_in_endpoint.startStream(2, transferSize);

	var buffers = [];
	msg_in_endpoint.on('data', function(data) {
		buffers.push(data);
		if (data.length < transferSize) {
			var b = Buffer.concat(buffers);
			var len = b.readUInt16LE(0);
			var tag = b.readUInt16LE(4);
			b = b.slice(8);

			self.emit('rawMessage', tag, b);

			// backwards compatibility
			if (tag >> 24 === 0) {
				self.emit('command', String.fromCharCode(tag&0xff), b.toString('utf8'));
			}

			buffers = [];
		}
	});

	this.once('end', function () {
		msg_in_endpoint.stopStream();
	});
};

Tessel.prototype.end = function end() {
	this.emit('end');
};

exports.findTessel = function findTessel(desiredSerial, next) {
	exports.listDevices(function (err, devices) {
		if (err) return next(err);

		for (var i=0; i<devices.length; i++) {
			if (!desiredSerial || desiredSerial == devices[i].serialNumber) {
				return next(null, devices[i]);
			}
		}

		return next(desiredSerial?"Device not found.":"No devices found.", null);
	});
}

exports.listDevices = function listDevices(next) {
	var devices = usb.getDeviceList().map(function(dev) {
		if ((dev.deviceDescriptor.idVendor == TESSEL_VID) && (dev.deviceDescriptor.idProduct == TESSEL_PID)) {
			return new Tessel(dev);
		}
	}).filter(function(x) {return x});

	async.each(devices, function(dev, cb) { dev.init(cb) }, function(err) { next(err, devices)} );
}
