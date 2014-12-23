var platform = require('platform-tool')
  , envfile = require('envfile')
  , globalConfigFile = "tessel"
  ;

var filePath = platform.appDir(globalConfigFile);

module.exports.fileContentsSync = function() {
  return envfile.parseFileSync(filePath);
}

module.exports.fileContents = function(callback) {
  envfile.parseFile(filePath, callback);
}

module.exports.filePath = filePath;