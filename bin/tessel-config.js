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
    return invalidConfigCommand;
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
 * A helper function for setting and unsetting that fetches
 * the current configuration and allows an action closure to be
 * executed with each key provided.
 */
var configVarHelper = function(newSettings, action) {
   // Fetch the current configuration
  config.fileContents(function(err, currentSettings) {
    if (err) {
      console.warn("Error parsing global config file!", err);
      return;
    }

    // For each new setting
    for (var setting in newSettings) {
      // Extract the key and value from the string
      var kv = newSettings[setting].split('='), key = kv[0], value = kv[1];
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
          console.warn("Global config variables saved!");
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
  });
};

/*
 * Deletes the value of a config variable key
 * from the global config file
 */
var unsetConfigVar = function(delSettings) {
  configVarHelper(delSettings, function(key, value, settings) {
    // If the setting exists
    if (settings[key]) {
      console.warn("Removing config var:", key);
      // Delete it
      delete settings[key];
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
determineConfigFunction(process.argv[2])(process.argv.slice(3));