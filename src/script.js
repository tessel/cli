// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var fs = require('fs')
  , path = require('path')
  ;

var hardwareResolve = require('hardware-resolve')
  , effess = require('effess')
  , humanize = require('humanize')
  , envfile = require('envfile')
  , tessel = require('../')
  , logs = require('../src/logs')
  ;

// analyzeScript (string arg, { verbose, single }) -> { pushdir, relpath, files, size }
// Given a command-line file path, resolve whether we are bundling a file, 
// its directory, or its ancestral node module.

function analyzeScript (arg, opts)
{
  function duparg (arr) {
    var obj = {};
    arr.forEach(function (arg) {
      obj[arg] = arg;
    })
    return obj;
  }

  var ret = {};

  hardwareResolve.root(arg, function (err, pushdir, relpath) {
    var files;
    if (opts.single || !pushdir) {
      if (!opts.single && fs.lstatSync(arg).isDirectory()) {
        ret.warning = String(err ? err.message : 'Warning.').replace(/\.( |$)/, '. Deploying just this directory.');

        pushdir = fs.realpathSync(arg);
        relpath = fs.lstatSync(path.join(arg, 'index.js')) && 'index.js';
        files = duparg(effess.readdirRecursiveSync(arg, {
          inflateSymlinks: true,
          excludeHiddenUnix: true
        }))
      } else {
        ret.warning = String(err ? err.message : 'Warning.').replace(/\.( |$)/, '. Deploying just this file.');

        pushdir = path.dirname(fs.realpathSync(arg));
        relpath = path.basename(arg);
        files = duparg([path.basename(arg)]);
      }
    } else {
      // Parse defaults from command line for inclusion or exclusion
      var defaults = {};
      if (typeof opts.x == 'string') {
        opts.x = [opts.x];
      }
      if (opts.x) {
        opts.x.forEach(function (arg) {
          defaults[arg] = false;
        })
      }
      if (typeof opts.i == 'string') {
        opts.i = [opts.i];
      }
      if (opts.i) {
        opts.i.forEach(function (arg) {
          defaults[arg] = true;
        })
      }

      // Get list of hardware files.
      files = hardwareResolve.list(pushdir, null, null, defaults);
      // Ensure the requested file from command line is included, even if blacklisted
      if (!(relpath in files)) {
        files[relpath] = relpath;
      }
    }

    tessel.bundleConfigVars(pushdir);

    ret.pushdir = pushdir;
    ret.relpath = relpath;
    ret.files = files;

    // Update files values to be full paths in pushFiles.
    Object.keys(ret.files).forEach(function (file) {
      ret.files[file] = fs.realpathSync(path.join(pushdir, ret.files[file]));
    })
  })

  // Dump stats for files and their sizes.
  var sizelookup = {};
  Object.keys(ret.files).forEach(function (file) {
    sizelookup[file] = fs.lstatSync(ret.files[file]).size;
    var dir = file;
    do {
      dir = path.dirname(dir);
      sizelookup[dir + '/'] = (sizelookup[dir + '/'] || 0) + sizelookup[file];
    } while (path.dirname(dir) != dir);
  });
  if (opts.verbose) {
    Object.keys(sizelookup).sort().forEach(function (file) {
      logs.info(file.match(/\/$/) ? ' ' + file.underline : ' \u2192 ' + file, '(' + humanize.filesize(sizelookup[file]) + ')');
    });
    logs.info('Total file size:', humanize.filesize(sizelookup['./'] || 0));
  }
  ret.size = sizelookup['./'] || 0;

  return ret;
}

tessel.bundleConfigVars = function(rootDir) {
  // Gather the global config variables
  var globals = envfile.parseFileSync(__dirname + '/../.global_env');
  // Gather the local config variables
  var locals = envfile.parseFileSync(rootDir + "/.env");

  // For each global config var
  for (var prop in globals) {
    // If it's not already a local config var
    if (!locals[prop]) {
      // Add it to the locals dict
      locals[prop] = globals[prop];
    }
  } 

  // Return the hash map of all relevant config vars
  return locals;
}

// tessel.bundleScript(pushpath, args, opts, next(err, tarbundle))
// Bundles a script path and arguments into a packed bundle.

tessel.bundleScript = function (pushpath, argv, bundleopts, next)
{
  var self = this;
  if (typeof bundleopts == 'function') {
    next = bundleopts;
    bundleopts = {};
  }
  var verbose = !bundleopts.quiet;

  var ret = analyzeScript(pushpath, bundleopts);
  if (ret.warning) {
    verbose && logs.warn(ret.warning);
  }
  verbose && logs.info('Bundling directory ' + ret.pushdir);

  // Create archive and deploy it to tessel.
  tessel.bundleFiles(ret.relpath, argv, ret.files, bundleopts, next);
}

// client#run(pushpath, args, next(err))
// Run and deploy a script to this Tessel.
// Meant to be a simplification of the bundling process.

tessel.Tessel.prototype.run = function (pushpath, argv, bundleopts, next)
{
  var self = this;
  if (typeof bundleopts == 'function') {
    next = bundleopts;
    bundleopts = {};
  }
  var verbose = !bundleopts.quiet;

  // Bundle code based on file path.
  tessel.bundleScript(pushpath, argv, bundleopts, function (err, tarbundle) {
    verbose && logs.info('Deploying bundle (' + humanize.filesize(tarbundle.length) + ')...');
    if (bundleopts.savePath){
      fs.writeFile(bundleopts.savePath, tarbundle, function(){
        self.deployBundle(tarbundle, bundleopts, next);
      });
    } else {
      self.deployBundle(tarbundle, bundleopts, next);
    }
  })
}


// tessel.script(pushpath, args, next(err))
// Dead-simple mechanism for pushing code to Tessel.

function script (pushpath, args, next)
{
  tessel.findTessel({}, function (err, client) {
    // client.listen(true, [10, 11, 12, 13, 20, 21, 22])

    if (err) {
      throw new Error('No tessel connected, aborting: ' + err);
    }

    client.run(pushpath, args, function (err) {
      // Log errors.
      client.on('error', function (err) {
        logs.err('Cannot connect to Tessel locally.', err);
      })

      // Bundle and upload code.
      logs.info('uploading tessel code...');

      // When this script ends, stop the client.
      client.once('script-stop', function (code) {
        client.close();
      });

      // Handle running script.
      next(err, client);
    })
  });
}

tessel.analyzeScript = analyzeScript;
tessel.script = script;
