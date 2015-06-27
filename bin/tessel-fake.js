// Fake tessel implementation

var colors = require('colors');

(function fakeTessel() {
    
    var leds = [
        { color: "bgGreen", name: "LED1" },
        { color: "bgBlue", name: "LED2" },
        { color: "bgRed", name: "Error"},
        { color: "bgYellow", name: "Conn"}
    ];
    
    function led(index, state) {
        var selected = leds[index];
        return colors[(state ? selected.color : "black")].white(selected.name); 
    }
    
    function log(what) {
        console.info(colors.cyan("T | " + what));   
    }
    
    var pin = function(ledIndex) {
        
        var ledState = false;
        
        return { 
            'output': function(value) {
                ledState = value; 
                log("Outputted " + value + " on " + led(ledIndex, value));
                return this; 
            },
            'toggle': function() {
                ledState = !ledState;
                log("Toggled " + led(ledIndex, ledState));
            } 
        }
    }; 
    
    exports.led = [
           pin(0),
           pin(1),
           pin(2),
           pin(3),
        ];    
        
                
    var path = require('path'), 
    common = require('../src/cli'), 
    colors = require('colors'); 

    common.basic();
    var script = path.resolve(process.cwd(), process.argv[2]);
    require(script); 
})(); 