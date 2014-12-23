var tessel = require('..')
  , config = require('../bin/tessel-config').test
  ;

console.log('1..8');

var k1 = "COMMON_KEY";
var v1 = "COMMON_VALUE"
// It should be able to pass the simplest test
// by parsing this back into a key and value
parseSettingsTest([k1], [v1]);


// It should throw an error if there is no
// equal sign
var k2 = "COMMON_KEY";
try {
  var res = config.parseSetting(k2);
}
catch(err) {
  console.log(err != null ? "ok" : "nok");
}

var k3 = "COMMON_KEY";
var v3 = "COMMON=VALUE"

// It should be be able to retain the equal sign
// in the value
parseSettingsTest([k3], [v3]);


var k4 = "enum";
var v4 = "COMMON=VALUE"

try {
  var res = config.parseSetting(k4 + "=" + v4);
}
catch(err) {
  console.log(err != null ? "ok" : "nok");
}

var k5 = "COMMON KEY";
var v5 = "COMMON=VALUE"

try {
  var res = config.parseSetting(k5 + "=" + v5);
}
catch(err) {
  console.log(err != null ? "ok" : "nok");
}

var k6 = " COMMONKEY";
var v6 = "COMMON=VALUE"

try {
  var res = config.parseSetting(k6 + "=" + v6);
}
catch(err) {
  console.log(err != null ? "ok" : "nok");
}


function parseSettingsTest(keys, values) {
  if (keys.length != values.length) {
    throw new Error("There must be the same number of keys and values!");
  }
  
  for (var i = 0; i < keys.length; i++) {
    var keyIndex = i * 2;
    var res = config.parseSetting(keys[keyIndex] + "=" + values[keyIndex]);
    console.log(res[keyIndex] === keys[keyIndex] ? "ok" : "nok");
    console.log(res[keyIndex + 1] === values[keyIndex] ? "ok" : "nok");
  }
}

