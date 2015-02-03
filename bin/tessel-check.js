#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

// tessel check
// Dumps a binary package.

var fs = require('fs'),
  path = require('path'),
  common = require('../src/cli');

// Setup cli.
common.basic();

function dumpBinary (file)
{
  var gzBuff = fs.readFileSync(file);
  var newGzipBuff = new Buffer(gzBuff.length - 4);
  gzBuff.copy(newGzipBuff, 0, 4, gzBuff.length);

  zlib.inflate(newGzipBuff, function(err, inflated) {
    console.log("dumping binary");

    if (!err) {
      // untar it
      fs.mkdir('dump', function(error) {
        if (!err) {
          fs.writeFileSync("dump/"+file+"-tarred", inflated);
          exec("tar xvf "+file+"-tarred", {
            cwd: process.cwd()+"/dump"
          }, function (err, stdout, stderr){
            if (err) {
              console.log("error couldn't untar", file, stderr);
            } else {
              console.log("dumped ", file);
            }
            // remove tarball
            fs.unlinkSync("dump/"+file+"-tarred");
            process.exit(1);
          });
        } else {
          console.log("can't make dump dir", error);
        }
      });
    } else {
      console.error("can't inflate", file, err);
    }
  });
}

dumpBinary(process.argv[3]);
