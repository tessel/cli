var tessel = require('..');
var tar = require('tar');

console.log('1..6');
tessel.bundleFiles('index.js', [], {
   'index.js': __dirname + '/compile-exclude/index.js',
   'static/banned.js': __dirname + '/compile-exclude/static/banned.js',
   'package.json': __dirname + '/compile-exclude/package.json',
   'node_modules/sample-lib/package.json': __dirname + '/compile-exclude/node_modules/sample-lib/package.json',
   'node_modules/sample-lib/lib.js': __dirname + '/compile-exclude/node_modules/sample-lib/lib.js',
   'node_modules/sample-lib/banned/file.js': __dirname + '/compile-exclude/node_modules/sample-lib/banned/file.js',
   'node_modules/sample-lib/static/static.js': __dirname + '/compile-exclude/node_modules/sample-lib/static/static.js'
}, function (err, bundle) {
   tar.Parse()
      .on('entry', function (data) {
         if (/\.js$/.test(data.path)) {
            if (data.path.indexOf('banned') !== -1) {
               data.once('data', function (chunk) {
                  console.log(String(chunk) == "'this file is not compiled';" ? 'ok' : ('nok - ' + data.path));
               })
            } else {
               data.once('data', function (chunk) {
                  console.log(String(chunk).substr(0, 7) == "console" ? ('nok - ' + data.path) : 'ok');
               })
            }
         }

      })
      .write(bundle);
});
