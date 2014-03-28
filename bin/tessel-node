#!/usr/bin/env node

var common = require('../src/common')

// Command-line arguments
var argv = require("nomnom")
  .script('tessel-node')
  .option('script', {
    position: 1,
    // required: true,
    full: 'script.js',
    help: 'Run this script on Tessel.',
  })
  .option('arguments', {
    position: 2,
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
  .option('interactive', {
    abbr: 'i',
    flag: true,
    help: 'Enter the REPL.'
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
  .option('messages', {
    abbr: 'm',
    flag: true,
    help: '[Tessel] Forward stdin as child process messages.'
  })
  .option('single', {
    abbr: 's',
    flag: true,
    help: '[Tessel] Push a single script file to Tessel.'
  })

  .parse();

argv.verbose = !argv.quiet;

function usage () {
  console.error(require('nomnom').getUsage());
  process.exit(1);
}

function pollInteractive (client)
{
  // make `process.stdin` begin emitting "keypress" events
  keypress(process.stdin);
  // listen for the ctrl+c event, which seems not to be caught in read loop
  process.stdin.on('keypress', function (ch, key) {
    if (key && key.ctrl && key.name == 'c') {
      process.exit(0);
    }
  });

  read({prompt: '>>'}, function (err, data) {
    try {
      if (err) {
        throw err;
      }
      var script
        // = 'function _locals()\nlocal variables = {}\nlocal idx = 1\nwhile true do\nlocal ln, lv = debug.getlocal(2, idx)\nif ln ~= nil then\n_G[ln] = lv\nelse\nbreak\nend\nidx = 1 + idx\nend\nreturn variables\nend\n'
        = 'local function _run ()\n' + colony.colonize(data, false) + '\nend\nsetfenv(_run, colony.global);\n_run()';
      client.command('M', new Buffer(JSON.stringify(script)));
      client.once('message', function (ret) {
        console.log(ret.ret);
        setImmediate(pollInteractive);
      })
    } catch (e) {
      console.error(e.stack);
      setImmediate(pollInteractive);
    }
  });
}

common.controller(function (err, client) {
  client.on('error', function (err) {
    if (err.code == 'ENOENT') {
      console.error('Error: Cannot connect to Tessel locally.')
    } else {
      console.error(err);
    }
  })

  // Forward stdin as messages with "-m" option
  if (argv.messages) {
    process.stdin.resume();
    require('readline').createInterface(process.stdin, {}, null).on('line', function (std) {
      client.send(JSON.stringify(std));
    })
  }

  // Check pushing path.
  if (argv.interactive) {
    var pushpath = __dirname + '/../scripts/repl';
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

  client.once('script-start', function () {
    // Stop on Ctrl+C.
    process.on('SIGINT', function() {
      client.once('script-stop', function (code) {
        process.exit(code);
      });
      setTimeout(function () {
        // timeout :|
        process.exit(code);
      }, 5000);
      client.stop();
    });

    // Flush existing output, then pipe output to client
    while (null !== (chunk = client.stdout.read())) {
      ;
    }
    client.stdout.pipe(process.stdout);

    client.once('script-stop', function (code) {
      client.end();
      process.exit(code);
    });

    // repl is implemented in repl/index.js. Uploaded to tessel, it sends a
    // message telling host it's ready, then receives stdin via
    // process.on('message')
    if (argv.interactive) {
      client.once('message', pollInteractive.bind(client));
    }
  });

  // Forward path and code to tessel cli handling.
  common.pushCode(client, pushpath, ['tessel', pushpath].concat(argv.arguments || []), {}, argv);
})
