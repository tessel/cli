/* tessel fake
 * - Execute the passed script as if it was being processed by the hardware.
 * Requires consumer to also use module tessel-fakes (https://www.npmjs.com/package/tessel-fakes) 
 * and to require this module, rather than tessel when running fakes
 * (Alternately: Rename the tessel-fakes folder after npm install...)
 */
(function tesselFake() {
    var path = require('path'), 
    common = require('../src/cli'), 
    colors = require('colors'); 

    common.basic();
    var script = path.resolve(process.cwd(), process.argv[2]);
    require(script); 
})(); 