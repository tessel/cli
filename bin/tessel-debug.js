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
  pjson = require("../package.json"),
  common = require('../src/cli'),
  temp = require('temp'),
  mkdirp = require('mkdirp'),
  path = require('path'),
  request = require('request'),
  fs = require('fs'),
  colors = require('colors'),
  builds = require('../src/builds'),
  logs = require('../src/logs');

temp.track();

common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel debug')
  .option('script', {
    position: 0,
    full: 'script.js',
    help: 'Run this script on Tessel after default scripts.',
  })
  .option('args', {
    abbr: 'a',
    list: true,
    help: 'Arguments to pass in as process.argv.'
  })
  .option('single', {
    abbr: 's',
    flag: true,
    help: '[Tessel] Push a single script file to Tessel.'
  })
  .option('help',{
    abbr: 'h',
    flag: true,
    help: 'Show usage for Tessel debug'
  })
  .parse();

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

function stop(client, logId){
  logs.info("Done.");
  logs.info("Debug logs can be viewed at", builds.utils.debugPath+"logs/"+logId);
  logs.info("Please submit this link with your support request");

  client.stop();
  process.exit();
}

function postToWeb(path, data, next){
  request({uri: builds.utils.debugPath+path, method: 'post', json: true, headers:{
    'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(data))
    }, body: data}
  , function(error, res, body){
    if (error) {
      logs.err("There was an issue uploading the debug files.", body);
      logs.info("Trying with path", path, "with data", data);
      process.exit();
    }
    next && next(body);
  });
}

function initDebug(serial, wifi, info, next){
  postToWeb('/new', {
    serial: serial,
    firmware: info.firmware_git,
    runtime: info.runtime_git,
    firmware_date: info.date,
    firmware_time: info.time,
    wifi: wifi,
    hostType: os.type(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    node: process.version,
    cli: pjson.version },
    function(res){
      if (!res || res == false) return logs.err("Could not communicate with host debug server", res);
      // res = JSON.parse(res);
      next && next(res);
    }
  );
}

function Logger(id, urls, name, client) {
  this.id = id;
  this.client = client;
  this.files = [];
  this.path = temp.mkdirSync(name);
  this.urls = urls;

  this.logPaths = {};
  this.logPaths[name] = path.join(this.path, name);

  var self = this;
  this.client.on('rawMessage', function(message){
    fs.appendFile(self.logPaths[name], "[RAW]: "+message+"\n", function(err){
      if (err) throw err;
    });
  });

  this.client.on('log', function(level, str){
    fs.appendFile(self.logPaths[name], "[LOG]["+level+"]: "+str+"\n", function(err){
      if (err) throw err;
    });
  });

  this.client.on('rawMessage', function(tag, buf){
    fs.appendFile(self.logPaths[name], "[CMD]["+tag.toString(16)+"]: "+buf.toString('utf-8')+"\n", function(err){
      if (err) throw err;
    });
  });
}

Logger.prototype.detach = function(){
  this.client.removeListener('rawMessage');
  this.client.removeListener('log');
}

Logger.prototype.uploadFiles = function(next){
  var count = 0;
  var self = this;
  var pathKeys = Object.keys(self.logPaths);
  pathKeys.forEach(function(file){
    // upload the file
    var s3File = fs.readFile(self.logPaths[file], function(err, data){
      request({method: 'PUT', uri: self.urls[file], body: data}, function(err, res, body){
        postToWeb('/logs/'+self.id, {key: file}, function(){
          count++;
          if (count >= pathKeys.length){
            next && next();
          }
        });
      });
    });
  });
}

Logger.prototype.addFile = function(key, filepath){
  this.logPaths[key] = filepath;
}

function userScript(id, client, urls){
  var userLogger = new Logger(id, urls, 'user_log', client);
  argv.savePath = path.join(userLogger.path, "user_tar");
  argv.flash = false;
  userLogger.addFile('user_tar', argv.savePath);

  // reconnect
  client.init(function(){
    client.listen(true);

    console.log(colors.green("Running user script... stopping with Ctrl+C or when we hit an error"));
    client.run(argv.script, ['tessel', argv.script].concat(argv.arguments || []), argv, function(){
      // stop on script exit
      process.on('SIGINT', function() {
        userLogger.uploadFiles(function(){
          stop(client, id);
        });
      });

    });
  });
}

common.controller({stop: true}, function (err, client) {
  client.listen(true);
  client.wifiVer(function(err, wifiVer){
    initDebug(client.serialNumber, wifiVer, client.version, function(init){
      console.log(colors.cyan("Starting debug logs... saving to"), colors.green(builds.utils.debugPath+"logs/"+init.id));
      var blinkyLogger = new Logger(init.id, init.urls, 'blinky_log', client);
      argv.save = true;
      argv.savePath = path.join(blinkyLogger.path, "blinky_tar");
      blinkyLogger.addFile('blinky_tar', argv.savePath);

      var blinkyPath = path.join(__dirname, '/../', 'scripts/blink');
      console.log(colors.cyan("Running Blinky test... please wait..."));

      client.run(blinkyPath, ['tessel', blinkyPath].concat(argv.arguments || []), argv, function () {

        setTimeout(function(){
          blinkyLogger.uploadFiles(function (){
            if (argv.script){
              // stop that client
              client.stop();

              setTimeout(function(){
                userScript(init.id, client, init.urls);
              }, 1000);

            } else {
              logs.info("No userscript detected. In order to run a userscript, specify `tessel debug <script.js>`")
              stop(client, init.id);
            }
          });
          // run blinky for 5 seconds
        }, 5000);

      });
    });
  });
});
