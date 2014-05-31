#!/usr/bin/env node

var path = require('path')

var common = require('../src/cli')
  , keypress = require('keypress')
  , read = require('read')
  , colors = require('colors')
  , builds = require('../src/builds')
  , util = require('util')
  ;

var colonyCompiler = require('colony-compiler')
var fs = require('fs')

// Setup cli.
common.basic();

// Command-line arguments
var argv = require("nomnom")
  .script('tessel run')
  .option('script', {
    position: 0,
    // required: true,
    full: 'script.js',
    help: 'Run this script on Tessel.',
  })
  .option('arguments', {
    position: 1,
    list: true,
    help: 'Arguments to pass in as process.argv.'
  })
  .option('version', {
    abbr: 'v',
    flag: true,
    help: 'Print tessel-node\'s version.',
    callback: function() {
      return require('./package.json').version.replace(/^v?/, 'v');
    }
  })
  .option('await-wifi', {
    abbr: 'w',
    flag: true,
    help: 'Await wifi connection before running script.'
  })
  .option('interactive', {
    abbr: 'i',
    flag: true,
    help: 'Enter the REPL.'
  })
  .option('upload-dir', {
    abbr: 'u',
    flag: false,
    help: 'Directory where uploads from process.sendfile should be saved to'
  })
  // .option('remote', {
  //   abbr: 'r',
  //   flag: true,
  //   help: '[Tessel] Push code to a Tessel by IP address.'
  // })
  .option('quiet', {
    abbr: 'q',
    flag: true,
    help: '[Tessel] Hide tessel deployment messages.'
  })
  .option('single', {
    abbr: 's',
    flag: true,
    help: '[Tessel] Push a single script file to Tessel.'
  })
  .option('help', {
    abbr: 'h',
    flag: true,
    help: 'Show usage for tessel node'
  })
  .parse();

argv.verbose = !argv.quiet;

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

function repl (client)
{
  // make `process.stdin` begin emitting "keypress" events
  keypress(process.stdin);
  // listen for the ctrl+c event, which seems not to be caught in read loop
  process.stdin.on('keypress', function (ch, key) {
    if (key && key.ctrl && key.name == 'c') {
      process.exit(0);
    }
  });

  client.on('message', prompt);

  function convertToContext (cmd) {
    var self = this, matches,
        scopeVar = /^\s*var\s*([_\w\$]+)(.*)$/m,
        scopeFunc = /^\s*function\s*([_\w\$]+)/;

    // Replaces: var foo = "bar";  with: self.context.foo = bar;
    matches = scopeVar.exec(cmd);
    if (matches && matches.length === 3) {
      return matches[1] + matches[2];
    }

    // Replaces: function foo() {};  with: foo = function foo() {};
    matches = scopeFunc.exec(self.bufferedCommand);
    if (matches && matches.length === 2) {
      return matches[1] + ' = ' + self.bufferedCommand;
    }

    return cmd;
  };

  function prompt() {
    read({prompt: '>>'}, function (err, data) {
      try {
        if (err) {
          throw err;
        }
        data = String(data);

        data = convertToContext(data);
        var script
          // = 'function _locals()\nlocal variables = {}\nlocal idx = 1\nwhile true do\nlocal ln, lv = debug.getlocal(2, idx)\nif ln ~= nil then\n_G[ln] = lv\nelse\nbreak\nend\nidx = 1 + idx\nend\nreturn variables\nend\n'
          = 'local function _run ()\n' + colonyCompiler.colonize(data, {returnLastStatement: true, wrap: false}) + '\nend\nsetfenv(_run, colony.global);\nreturn _run()';
        client.command('M', new Buffer(JSON.stringify(script)));
      } catch (e) {
        console.error(e.stack);
        setImmediate(prompt);
      }
    });
  }
}

function awaitConfig (client, next) {
  if (!argv['await-wifi']) {
    next();
  } else {
    client.wifiStatus(function (err, data) {
      if (data && data.connected && data.ip) {
        next();
      } else {
        setTimeout(awaitConfig, 1000*3, client, next);
      }
    })
  }
}

common.controller(true, function (err, client) {
  awaitConfig(client, function () {
    client.listen(true, [10, 11, 12, 13, 20, 21, 22])
    client.on('error', function (err) {
      if (err.code == 'ENOENT') {
        console.error('Error: Cannot connect to Tessel locally.')
      } else {
        console.error(err);
      }
    })

    // Forward stdin by line.
    process.stdin.resume();
    process.stdin.pipe(client.stdin);

    // Check pushing path.
    if (argv.interactive) {
      var pushpath = path.resolve(__dirname, '../scripts/repl');
    } else if (!argv.script) {
      usage();
    } else {
      var pushpath = argv.script;
    }

    // Command command.
    var updating = false;
    client.on('command', function (command, data) {
      if (command == 'u') {
        verbose && console.error(data.grey)
      } else if (command == 'U') {
        if (updating) {
          // Interrupted by other deploy
          process.exit(0);
        }
        updating = true;
      }
    });

    builds.checkBuildList(client.version, function (allBuilds, needUpdate){
      if (!allBuilds) return pushCode();

      if (needUpdate){
        // show warning
        console.log(colors.red("NOTE: There is a newer version of firmware available. Use \"tessel update\" to update to the newest version"));
      }
      
      pushCode();
    });

    function pushCode(){
      client.run(pushpath, ['tessel', pushpath].concat(argv.arguments || []), function () {
        // script-start emitted.
        console.error(colors.grey('Running script...'));

        // Stop on Ctrl+C.
        process.on('SIGINT', function() {
          setTimeout(function () {
            // timeout :|
            console.error(colors.grey('Script aborted'));
            process.exit(131);
          }, 200);
          client.stop();
        });

        client.once('script-stop', function (code) {
          client.close(function () {
            process.exit(code);
          });
        });

        client.on('rawMessage', function (tag, data) {
          if (tag == 0x4113) {
            if (!argv['upload-dir']) {
              console.error(colors.red('ERR:'), colors.grey('ignoring uploaded file. call tessel with --upload-dir to save files from a running script.'));
              return;
            }

            try {
              var packet = require('structured-clone').deserialize(data);
              fs.writeFileSync(path.resolve(argv['upload-dir'], path.basename(packet.filename)), packet.buffer);
              console.error(colors.grey(util.format(packet.filename, 'saved to', argv['upload-dir'])));
            } catch (e) {
              console.error(colors.red('ERR:'), colors.grey('invalid sendfile packet received.'));
            }
          }
        });
        
        // repl is implemented in repl/index.js. Uploaded to tessel, it sends a
        // message telling host it's ready, then receives stdin via
        // process.on('message')
        if (argv.interactive) {
          repl(client);
        }
      });
    }
  });
})
