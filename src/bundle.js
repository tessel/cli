var net = require('net');
var fs = require('fs');
var path = require('path')
  , temp = require('temp')
  , colony = require('colony')
  , async = require('async')
  , fstream = require('fstream')
  , tar = require('tar')
  , osenv = require('osenv');

(function () {
  // We want to force node-tar to not use extended headers.
  var fn = require('tar/lib/header').encode;
  require('tar/lib/header').encode = function (obj) {
    var ret = fn(obj);
    obj.needExtended = false
    return ret;
  }
})();

var wrench = require('./wrench');

exports.bundleFiles = function (startpath, args, files, next)
{
  temp.mkdir('colony', function (err, dirpath) {
    var mkdirp = require('mkdirp');
    Object.keys(files).forEach(function (filename) {
      mkdirp.sync(path.join(dirpath, 'app', path.dirname(filename)));
      fs.writeFileSync(path.join(dirpath, 'app', filename), fs.readFileSync(files[filename], 'binary'), 'binary');
    })

    var stub
      = 'process.env.DEPLOY_IP = ' + JSON.stringify(require('my-local-ip')()) + ';\n'
      + 'process.argv = ' + JSON.stringify(args) + ';\n'
      + 'require(' + JSON.stringify('./app/' + startpath.replace('\\', '/')) + ');';
    fs.writeFileSync(path.join(dirpath, '_start.js'), stub);

    var docompile = [];

    wrench.readdirRecursive(path.join(dirpath), function (err, curFiles) {
      // console.log(curFiles);
      if (!curFiles) {
        afterColonizing();
        return;
      }
      curFiles.forEach(function (f) {
        // console.log("current file", f);
        if (f.match(/\.js$/)) {
          try {
            var res = colony.colonize(fs.readFileSync(path.join(dirpath, f), 'utf-8'));
            fs.writeFileSync(path.join(dirpath, f), res);
            docompile.push([f, path.join(dirpath, f)]);
          } catch (e) {
            e.filename = f.substr(4);
            console.log('Syntax error in', f, ':\n', e);
            process.exit(1);
          }
        }
      })
    });

    var compileBytecode = true;

    function afterColonizing () {
      // compile with compile_lua
      async.each(docompile, function (f, next) {
        if (!compileBytecode) {
          next(null);
        } else {
          try {
            colony.toBytecode(fs.readFileSync(f[1], 'utf-8'), '/' + f[0].split(path.sep).join('/'), function (err, res) {
              !err && fs.writeFileSync(f[1], res);
              next(err);
            });
          } catch (e) {
            console.log('ERR'.red, 'Compilation process failed for the following file:');
            console.log('ERR'.red, ' ', f[0].replace(/^[^/]+/, '.'))
            console.log('ERR'.red, 'This is a compilation bug! Please file an issue at');
            console.log('ERR'.red, 'https://github.com/tessel/beta/issues with this text');
            console.log('ERR'.red, 'and a copy of the file that failed to compile.')
            process.exit(1);
          }
        }

      }, function (err) {
        exports.tarCode(dirpath, '', next);
      });
    }
  });
};


// TODO should not be public,
// relied on by debug push code path
exports.tarCode = function (dirpath, pushdir, next)
{
  var fstr = fstream.Reader({path: dirpath, type: "Directory"})
  fstr.basename = '';

  fstr.on('entry', function (e) {
    e.root = {path: e.path};
  })

  fstr.on('error', function (err) {
    console.error('Error bundling code archive: ' + err);
    process.exit(1);
  })

  var bufs = [];
  var p = tar.Pack();
  p._noProprietary = true;
  fstr.pipe(p).on('data', function (buf) {
    bufs.push(buf);
  }).on('end', function () {
    var bundle = Buffer.concat(bufs);

    var hasIndex = false;
    var p = tar.Parse().on('entry', function (a) {
      if (a.path == '_start.js') {
        hasIndex = true;
      }
    }).on('end', function () {
      if (!hasIndex) {
        console.error('ERR'.red, 'Command line generated bundle without an /_start.js file. Please report this error.');
        process.exit(1);
      }

      next(null, bundle);
    })
    p.write(bundle);
    p.end();
  }).on('error', function (err) {
    console.error('ERR'.red, 'Error in compressing code archive: ' + err);
    process.exit(1);
  });
}