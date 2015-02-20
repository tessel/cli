var fs = require('fs')
  , config = require('../src/config-file.js');

fs.exists(config.filePath, function(err, exists) {
  if (!exists) {
    fs.writeFile(config.filePath, '');
  }
})