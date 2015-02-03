// Ensure a minimum version number for Node.

var colors = require('colors'),
  semver = require('semver'),
  logs = require('../src/logs');

if ('node' in process.versions) {
  var expecting = require('../package.json').engines.node;
  if (!semver.satisfies(process.versions.node, expecting)) {
    logs.err('Expecting Node version %s. You are running %s, please upgrade.', expecting, process.versions.node);
    process.exit(127);
  }
}
