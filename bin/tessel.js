#!/usr/bin/env node
// Copyright 2014 Technical Machine, Inc. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the Apache License, Version 2.0 <LICENSE-APACHE or
// http://www.apache.org/licenses/LICENSE-2.0> or the MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>, at your
// option. This file may not be copied, modified, or distributed
// except according to those terms.

require('../src/pester'); // force a current node version

function usage () {
  console.error("Tessel CLI\nUsage:\n" +
    "   tessel list\n" +
    "   tessel logs\n" +
    "   tessel run <filename> [args...]\n" +
    "          run a script temporarily without writing it to flash\n" +
    "          -s push the specified file only (rather than associated files and modules)\n" + 
    "   tessel push <filename> [options]\n" +
    "          see 'tessel push --help' for options list\n" +
    "   tessel erase\n" +
    "          erases saved usercode (JavaScript) on Tessel\n" +
    "   tessel repl\n" +
    "          interactive JavaScript shell\n" +
    "   tessel wifi -n <ssid> -p <pass> -s <security (wep/wpa/wpa2, wpa2 by default)>\n"+
    "   tessel wifi -n <ssid>\n" +
    "          connects to a wifi network without a password\n" + 
    "   tessel wifi -l\n" +
    "          see current wifi status\n" + 
    "   tessel config set <CONFIG_KEY=CONFIG_VALUE>\n" +
    "          sets a global configuration variable named CONFIG_KEY to CONFIG_VALUE\n" +
    "   tessel config get <CONFIG_KEY=CONFIG_VALUE>\n" +
    "          gets the value of a global configuration variable named CONFIG_KEY\n" +
    "   tessel config unset <CONFIG_KEY=CONFIG_VALUE>\n" +
    "          removes a global configuration variable named CONFIG_KEY\n" +
    "   tessel stop\n" +
    "          stop the current script\n" +
    "   tessel check <file>\n" + 
    "          dumps the tessel binary code\n" + 
    // "   tessel dfu-restore [tag]\n" +
    // "          uploads new firmware when in DFU mode\n" +
    // "          no arguments: list available tags\n" +
    // "          relative or absolute path: pushes a local binary to tessel\n" +
    "   tessel blink\n" +
    "          uploads test blinky script\n" +
    "   tessel update [--list]\n" +
    "          updates tessel to the newest released firmware. Optionally can list all builds/revert to older builds.\n" +
    "   tessel debug [script]\n" +
    "          runs through debug script and uploads logs\n" +
    "   tessel version [--board]\n" +
    "          show version of tessel cli. If --board is specified, shows version of the connected Tessel\n" +
    ""
    );
}


var builtinCommands = {
  'blink': 'blink', 'blinky': 'blink', 'blinkie': 'blink', 'blinkee': 'blink',
  'debug': 'debug',
  'check': 'check',
  'create-config' : 'create-config',
  'config': 'config',
  'debug-stack': 'debug-stack',
  'erase': 'erase',
  'firmware': 'firmware',
  'update': 'update', 'dfu-restore': 'update',
  'list': 'list',
  'logs': 'logs', 'listen': 'logs',
  'node': 'run', 'run': 'run',
  'pack': 'pack',
  'ping': 'ping',
  'push': 'push',
  'repl': 'repl',
  'stop': 'stop',
  'verbose': 'verbose',
  'version': 'version',
  'wifi': 'wifi',
  'install-drivers': 'install-drivers',
  'boot': 'boot',
}

if (process.argv.length < 3 || !builtinCommands[process.argv[2]]) {
  usage();
  process.exit(1);
}

// Launch subprocess as though it were ourself
var subprocess = './tessel-' + builtinCommands[process.argv[2]] + '.js';
process.argv.splice(1, 2, subprocess)
require(subprocess);
