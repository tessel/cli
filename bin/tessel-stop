#!/usr/bin/env node

var common = require('../src/common')

common.controller(function (err, client) {
  client.stop(function () {
    console.log('tessel runtime stopped.');
      client.end();
    });
})
