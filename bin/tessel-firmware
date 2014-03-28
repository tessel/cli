#!/usr/bin/env node

var fs = require('fs');

var request = require('request')
  , repository = require('../src/repository')
  , common = require('../src/common')

// Setup cli.
common.basic();

function isLocalPath (str) {
  return str.match(/^[\.\/\\]/);
}

if (process.argv.length == 3) {
  // Display list of tools.
  repository.getToolsListing(function (err, entries) {
    function currentize (key, i) {
      var date = key.match(/\d{4}-\d{2}-\d{2}/) || 'current   '.yellow;
      // return i == 0 ? (key + '  (current)').yellow : key;
      return date // + ('\t\t' + key + '').grey
    }

    console.log('Available firmware tags:')
    var tags = entries.filter(function (file) {
      return file.key.match(/^firmware\/./) && file.key.match(/\.bin$/);
    }).sort(function (a, b) {
      if (a.key < b.key) return 1;
      if (a.key > b.key) return -1;
      return 0;
    }).map(function (file, i) {
      return '  o '.blue + currentize(file.key.replace(/^firmware\//, ''), i);
    });
    if (tags.length > 10) {
      tags = tags.slice(0, 10);
      tags.push('  ...');
    }
    console.log(tags.join('\n'));
  })
} else if (isLocalPath(process.argv[3])) {
  // Try local file.
  console.error('Deploying local file', process.argv[3], 'to Tessel.');
  dfuRestoreFunc(fs.readFileSync(process.argv[3]));
} else {
  // Download tagged version.
  var tag = process.argv[3];
  if (tag == '--latest') {
    tag = 'current';
  }
  var url = repository.firmwareURL(tag);

  process.stdout.write(String('Downloading ' + url));
  request(url, {
    headers: {
      'User-Agent': 'tessel',
      'Accept': 'application/octet-stream'
    },
    encoding: null,
    followRedirect: false
  }, function (err, res, body) {
    if (err || res.statusCode >= 400) {
      process.stderr.write(' failed!');
      console.error('Could not download file, aborting.')
      process.exit(10);
    }

    if (res.statusCode == 302) {
      request(res.headers.location, {
        headers: {
          'User-Agent': 'tessel',
          'Accept': 'application/octet-stream'
        },
        encoding: null,
        followRedirect: true
      }, function (err, res, body) {
        console.error(', done.');
        dfuRestoreFunc(body);
      });
    } else {
      console.error(', done.');
      dfuRestoreFunc(body);
    }
  });
}

function dfuRestoreFunc (body) {
  require('../dfu/tessel-dfu').write(body)
}