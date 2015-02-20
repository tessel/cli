var envfile = require('envfile')
  , fs = require('fs')
  , config = require('../src/config-file.js')
  ;
/*
 * Determines with config function should be called
 * based on the config commang
 */
var determineConfigFunction = function(command) {
  if (command === "get") {
    return getConfigVar;
  }
  else if (command === "set") {
    return setConfigVar;
  }
  else if (command === "unset") {
    return unsetConfigVar;
  }
  else {
    return null;
  }
};

/*
 * Retrieves the value of a config variable key
 * from the global config file
 */
var getConfigVar = function(keys) {
  // Fetch the current configuration
  config.fileContents(function(err, currentSettings) {
    if (err) {
      console.warn("Unable to parse global config file!", err);
      return;
    }

    // For each requested key
    for (var index in keys) {
      var key = keys[index];
      // Print out its value if it exists
      if (currentSettings[key]) {
        console.info(key + '=' + currentSettings[key]);
      }
      // Otherwise, output a warning
      else {
        console.warn(key, 'is not set as a global config variable.');
      }
    }

  });
};

/*
 * A helper function for parsing the key and value of a setting.
 */
var parseSetting = function(setting) {
  // Fetch the position if the k,v separator
  var equalPos = setting.indexOf('=')

  // If it doesn't exist, get mad
  if (equalPos === -1) {
    throw new Error("Invalid setting provided:" + setting + ". Must be in the form KEY=VALUE");
  }

  // The key is the first value before the '=', value is the rest
  var key = setting.substr(0, equalPos);

  if (!config.isValidKeyName(key)) {
    throw new Error("Invalid Key name:" + "=" + key + ". Must be a valid JS variable identifier");
  }

  var value = setting.substr(equalPos+1);

  return [key, value];
}

/*
 * A helper function for setting and unsetting that fetches
 * the current configuration and allows an action closure to be
 * executed with each key provided.
 */
var configVarHelper = function(newSettings, action, next) {
   // Fetch the current configuration
  config.fileContents(function(err, currentSettings) {
    if (err) {
      console.warn("Error parsing global config file!", err);
      return;
    }

    // For each new setting
    for (var setting in newSettings) {

      // Extract the key and value from the string
      var kv = parseSetting(newSettings[setting]), key = kv[0], value = kv[1];
      // Perform the selected action with the settings
      action(key, value, currentSettings);
    }

    envfile.stringify(currentSettings, function(err) {
      if (err) {
        console.warn("Could not stringify the config vars!", err);
        return;
      }

      // Re-write the settings to the file
      fs.writeFile(config.filePath, envfile.stringifySync(currentSettings), function(err) {
        if (err) {
          console.warn("Could not write config vars to the global file:", err);
        }
        else {
          next && next();
        }
      });
    })
  });
}

/*
 * Sets the value of a config variable key
 * from the global config file
 */
var setConfigVar = function(newSettings) {
  configVarHelper(newSettings, function(key, value, settings) {
    // Set the key in the current settings and set the value
    console.info("Adding", key + "=" + value, "...");
    settings[key] = value;
  }, function() {
    console.warn("Global config variables saved!");
  });
};

/*
 * Deletes the value of a config variable key
 * from the global config file
 */
var unsetConfigVar = function(delSettings) {
  // In order to avoid an error being thrown within the
  // helper func, add an equal sign and empty value
  var original = delSettings[0];
  if (delSettings[0].indexOf('=') == -1) delSettings[0]+="=''"

  configVarHelper(delSettings, function(key, value, settings) {
    // If the setting exists
    if (settings[key]) {
      console.warn("Removing config var:", key);
      // Delete it
      delete settings[key];
    }
    else {
      console.warn("Setting", original, "does not exist...");
    }
  });
};

/*
 * Called when an invalid config command was provided
 */
var invalidConfigCommand = function() {
  console.warn('Invalid Config command. Must be set, unset, or get!');
};

// Call the appropriate function with the appropriate arguments
if (process.argv.length > 2) {
  var cmd = process.argv[2];
  var fn = determineConfigFunction(cmd);
  var args = process.argv.slice(3);

  if (!fn) {
    invalidConfigCommand();
  }
  else if (!args.length) {
    throw new Error("You must supply arguments for the command: " + cmd);
  }
  else {
    fn(args);
  }
}

module.exports.test = { parseSetting: parseSetting};