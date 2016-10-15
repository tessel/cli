// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

var net = require('net');
var fs = require('fs');
var path = require('path')
  , https = require('https')
  , temp = require('temp')
  , colonyCompiler = require('colony-compiler')
  , async = require('async')
  , fstream = require('fstream')
  , tar = require('tar')
  , effess = require('effess')
  , debug = require('debug')('tessel')
  , logs = require('../src/logs')
  , request = require('request')
  , zlib = require('zlib')
  ;

// We want to force node-tar to not use extended headers.
// We patch the module here.
;(function () {
  var fn = require('tar/lib/header').encode;
  require('tar/lib/header').encode = function (obj) {
    var ret = fn(obj);
    obj.needExtended = false
    return ret;
  }
})();

function toFullPath(f) {
   return function(pathToExclude) {
      return path.join(path.dirname(f), pathToExclude + '/');
   }
}

function containsFile(file) {
   return function(dir) {
      // Filename starts with dir
      return file.indexOf(dir) === 0;
   };
}

exports.bundleFiles = function (startpath, args, files, opts, next)
{
  if (typeof opts == 'function') {
    next = opts;
    opts = {};
  }

  temp.mkdir('colony', function (err, dirpath) {
    var mkdirp = require('mkdirp');

    dirpath = path.normalize(dirpath);

    Object.keys(files).forEach(function (filename) {
      mkdirp.sync(path.join(dirpath, 'app', path.dirname(filename)));
      fs.writeFileSync(path.join(dirpath, 'app', filename), fs.readFileSync(files[filename], 'binary'), 'binary');
    });

    var stub
      = 'process.env.DEPLOY_IP = ' + JSON.stringify(require('my-local-ip')()) + ';\n'
      + 'process.env.DEPLOY_TIMESTAMP = ' + JSON.stringify(String(Date.now())) + ';\n'
      + 'process.argv = ' + JSON.stringify(args) + ';\n'
      + 'require(' + JSON.stringify('./app/' + startpath.replace('\\', '/')) + ');';
    fs.writeFileSync(path.join(dirpath, '_start.js'), stub);

    // Create list of (tesselpath, localfspath) files to compile.
    var docompile = [], excludeDirs = [], noCompile;

    // First pass - collect all package.json and get blacklisted folders
    effess.readdirRecursiveSync(dirpath).forEach(function (f) {
      var fullPath = path.join(dirpath, f);
      if (f.match(/package\.json$/)) {
        try {
          noCompile = require(fullPath).noCompile;
          if (!(noCompile && noCompile.length)) {
             noCompile = [ '/static/' ];
          }
          if (!(noCompile instanceof Array)) {
             noCompile = [ noCompile ];
          }
          excludeDirs = excludeDirs.concat(noCompile.map(toFullPath(f)));
        } catch (e) {
          // in case of not well-formed json
          // ignore
        }
      }
    });

    // Collect all .js files which are not in blacklisted folders
    effess.readdirRecursiveSync(dirpath).forEach(function (f) {
      // console.log("current file", f);
      if (f.match(/\.js$/) && !excludeDirs.some(containsFile(f))) {
        docompile.push([f, path.join(dirpath, f)]);
      }
    });

    // compile with compile_lua
    async.each(docompile, function (_f, next) {
      var f = _f[0], fullpath = _f[1];

      debug('compiling', f);

      try {
        var source = fs.readFileSync(fullpath, 'utf-8');
        var res = colonyCompiler.colonize(source, {
          embedLineNumbers: true
        });
      } catch (e) {
        if (!(e instanceof SyntaxError)) {
          throw e;
        }

        // Create a readable SyntaxError message.
        var message = [
          e.message,
          '',
          fs.realpathSync(f.substr(4)) + ':' + e.loc.line,
          source.split(/\n/)[e.loc.line-2] || '',
          Array(e.loc.column || 0).join(' ') + '^'
        ].join('\n');
        // Files with syntax errors can't be compiled.
        // We can pretend they were thrown by our parser though, at runtime.
        var res = colonyCompiler.colonize('throw new SyntaxError(' + JSON.stringify(message) + ')', {
          embedLineNumbers: true
        })
      }

      fs.writeFileSync(fullpath, res.source);
      next(null);
    }, function (err) {
      exports.tarCode(dirpath, '', next);
    });
  });
};

var MIPS_CACHE_PATH = "mips_modules";
var MIPS_BINARY_ROOT = "https://s3.amazonaws.com/tessel-mips-modules/";

var fetchMipsModule = function (location, callback)
{
  // Read in the module version.
  var filename = location + '/package.json'
  var json = JSON.parse(fs.readFileSync(filename, 'utf8'));
  var version = json.version;

  var name = location.match(/[^\/]+$/)[0];
  var mipsModulePath = path.join(MIPS_CACHE_PATH, name, version);

  // Cache the mips binaries from server. The cache is located at MIPS_CACHE_PATH
  if (fs.existsSync(mipsModulePath)) {
    logs.info("Found cached binary module", name, version)
    return setTimeout(function () { callback(mipsModulePath) });
  }

  var packageUrl = MIPS_BINARY_ROOT + name + '_' + version + '.tgz';
  logs.info("Fetching binary module", packageUrl)
  request({
    url: packageUrl,
    gzip: true
  }).pipe(zlib.createGunzip()).pipe(tar.Extract({
    path: mipsModulePath
  })).on('end', function () {
    logs.info("Fetched binary module", name, version)
    callback(mipsModulePath);
  }).on('error', function (err) {
    fs.rmdirSync(mipsModulePath);
    logs.err("No mips module found for", name, version, err);
    process.exit(1);
  });
};

var isBinaryReleasePath = function (location) {
  var match = location.match(/(node_modules\/.+)\/build\/Release$/);
  return match && match[1];
};

var createDirReader = function (root, base, filter)
{
  var reader = fstream.Reader({
    path: root,
    type: "Directory",
    filter: filter
  });
  reader.basename = "";

  var rebase = function (entry) {
    if (base) {
      entry.path = entry.path.replace(root, path.join(path.dirname(root), base));
      entry.on("entry", rebase);
    }
    else {
      // entry.root.path = entry.path;
      entry.root = {path: entry.path};
    }
  };

  reader.on('entry', rebase);

  reader.on('error', function (err) {
    logs.err('Error bundling code archive: ' + err);
    process.exit(1);
  });

  return reader;
};

// TODO should not be public,
// relied on by debug push code path
exports.tarCode = function (dirpath, options, next)
{
  options = Object(options);

  var streams = [];
  var packedData = [];

  var packer = tar.Pack();
  packer._noProprietary = true;

  packer.on('error', function (err) {
    logs.err('Error in compressing code archive: ' + err);
    process.exit(1);
  });

  var finalizePackage = function () {
    var bundle = Buffer.concat(packedData);

    var hasIndex = false;
    var parser = tar.Parse().on('entry', function (entry) {
      if (entry.path === '_start.js') {
        hasIndex = true;
      }
    }).on('end', function () {
      if (!hasIndex) {
        logs.err('Command line generated bundle without an /_start.js file. Please report this error.');
        // process.exit(1);
      }

      next(null, bundle);
    });

    parser.write(bundle);
    parser.end();
  };

  var startStream = function () {
    var root = streams[0][0];
    var base = streams[0][1];

    var stream = createDirReader(root, base, filter);
    stream.on('end', onStreamEnd);

    var piped = stream.pipe(packer, {end: false}).on('data', function (data) {
      packedData.push(data);
    });

    // Replace the arguments with the real stream.
    streams.shift();
    streams.unshift(piped);
  };

  var onStreamEnd = function () {
    streams.shift().removeAllListeners('data');

    if (streams.length) {
      startStream();
    }
    else if (!pendingStreams) {
      finalizePackage();
    }
  };

  var pendingStreams = 0;
  var queueStream = function (root, base) {
    streams.push([root, base]);
    if (pendingStreams) {
      pendingStreams -= 1;
      if (Array.isArray(streams[0])) startStream();
    }
  };

  var filter = function (entry) {
    if (entry.path.match(new RegExp(MIPS_CACHE_PATH + '$'))) return false;
    if (entry.path.match(new RegExp(".git$"))) return false;

    // If this is a binary release, spawn a new reader for the corresponding
    // mips binaries and filter our the x86 binaries.
    var modulePath = isBinaryReleasePath(entry.path);
    if (modulePath) {
      fetchMipsModule(modulePath, function (mipsPath) {
        queueStream(mipsPath, modulePath);
      });

      pendingStreams += 1;
      return false;
    }

    return true;
  };

  queueStream(dirpath, null);
  startStream();
};
