var tessel = require('..');
var tar = require('tar');

console.log('1..1')
tessel.bundleFiles('index.js', [], {
	'sym/sym2/index.js': __dirname + '/sym/sym2/index.js'
}, {}, function (err, bundle) {
	tar.Parse()
		.on('entry', function (data) {
			if (data.path == 'app/sym/sym2/index.js') {
				data.on('data', function (data) {
					console.log(String(data).indexOf('console') ? 'ok' : 'nok');
				})
			}
		})
		.write(bundle);
});