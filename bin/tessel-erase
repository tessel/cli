#!/usr/bin/env node

var common = require('../src/common')

common.controller(function (err, client) {
  client.erase(function () {
    console.log('tessel filesystem erased.');
      client.end();
    });
})
