#!/usr/bin/env node

var common = require('../src/common')

// Setup cli.
common.basic();

try {
  console.log(require('../package.json').version.replace(/^v?/, 'v'))
} catch (e) {
  console.error('version unknown');
}