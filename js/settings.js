SSHyClient.settings = function() {
    // Local echo reduces latency on regular key presses to aruond 0.04s compared to ~0.2s without it
    this.localEcho = 0; // 0 - off; 1 - auto; 2 - on

    /* Default the bindings to bash */
    this.fsHintEnter = "\x1b\x5b\x3f\x31"; // seems to be the same for all shells
    this.fsHintLeave = SSHyClient.bashFsHintLeave;

    this.autoEchoState = false; // false = no echoing ; true = echoing
    this.autoEchoTimeout = 0; // stores the time of last autoecho change

    this.blockedKeys = [':']; // while localecho(force-on) don't echo these keys

    this.keepAliveInterval = undefined; // stores the setInterval() reference

    this.fontSize = 16;

    this.colorTango = true
    this.colorNames = Object.keys(this.colorSchemes);
    this.colorCounter = 0; // Stores the current index of the theme loaded in colorSchemes

    this.shellString = ''; // Used to buffer shell identifications ie ']0;fish' or 'user@host$'

    this.sidenavElementState = 0; // Stores the state of the sidenav (0 - closed, [x] - true)
    // Caches the DOM elements
    this.rxElement = document.getElementById('rxTraffic');
    this.txElement = document.getElementById('txTraffic');
    this.autoEchoElement = document.getElementById('autoEchoState');

    this.rsaCheckEnabled = true;
};
SSHyClient.settings.prototype = {
	// All our supported terminal color themes in [bg, color1, .... , color15, cursor, fg]
	colorSchemes: [
		['Solarized', {background:"#002b36", black:"#002b36", red:"#dc322f", green:"#859900", yellow:"#b58900", blue:"#268bd2", magenta:"#6c71c4", cyan:"#2aa198", white:"#93a1a1", brightBlack:"#657b83", brightRed:"#dc322f", brightGreen:"#859900", brightYellow:"#b58900", brightBlue:"#268bd2", brightMagenta:"#6c71c4", brightCyan:"#2aa198", brightWhite:"#fdf6e3", cursor:"#93a1a1", foreground:"#93a1a1"}],
		['Material', {background:"#263238", black:"#263238", red:"#ff9800", green:"#8bc34a", yellow:"#ffc107", blue:"#03a9f4", magenta:"#e91e63", cyan:"#009688", white:"#cfd8dc", brightBlack:"#37474f", brightRed:"#ffa74d", brightGreen:"#9ccc65", brightYellow:"#ffa000", brightBlue:"#81d4fa", brightMagenta:"#ad1457", brightCyan:"#26a69a", brightWhite:"#eceff1", cursor:"#eceff1", foreground:"#eceff1"}],
		['Monokai', {background:"#272822", black:"#272822", red:"#dc2566", green:"#8fc029", yellow:"#d4c96e", blue:"#55bcce", magenta:"#9358fe", cyan:"#56b7a5", white:"#acada1", brightBlack:"#76715e", brightRed:"#fa2772", brightGreen:"#a7e22e", brightYellow:"#e7db75", brightBlue:"#66d9ee", brightMagenta:"#ae82ff", brightCyan:"#66efd5", brightWhite:"#cfd0c2", cursor:"#f1ebeb", foreground:"#f1ebeb"}],
		['Ashes', {background:"#1c2023", black:"#1c2023", red:"#c7ae95", green:"#95c7ae", yellow:"#aec795", blue:"#ae95c7", magenta:"#c795ae", cyan:"#95aec7", white:"#c7ccd1", brightBlack:"#747c84", brightRed:"#c7ae95", brightGreen:"#95c7ae", brightYellow:"#aec795", brightBlue:"#ae95c7", brightMagenta:"#c795ae", brightCyan:"#95aec7", brightWhite:"#f3f4f5", cursor:"#c7ccd1", foreground:"#c7ccd1"}],
		['Google', {background:"#ffffff", black:"#ffffff", red:"#cc342b", green:"#198844", yellow:"#fba922", blue:"#3971ed", magenta:"#a36ac7", cyan:"#3971ed", white:"#c5c8c6", brightBlack:"#969896", brightRed:"#cc342b", brightGreen:"#198844", brightYellow:"#fba922", brightBlue:"#3971ed", brightMagenta:"#a36ac7", brightCyan:"#3971ed", brightWhite:"#ffffff", cursor:"#373b41", foreground:"#373b41"}],
		['Mono Light', {background:"#f7f7f7", black:"#f7f7f7", red:"#7c7c7c", green:"#8e8e8e", yellow:"#a0a0a0", blue:"#686868", magenta:"#747474", cyan:"#868686", white:"#b9b9b9", brightBlack:"#525252", brightRed:"#7c7c7c", brightGreen:"#8e8e8e", brightYellow:"#a0a0a0", brightBlue:"#686868", brightMagenta:"#747474", brightCyan:"#868686", brightWhite:"#f7f7f7", cursor:"#464646", foreground:"#464646"}],
		['Mono Dark', {background:"#000000", black:"#000000", red:"#6b6b6b", green:"#c4c4c4", yellow:"#b3b3b3", blue:"#999999", magenta:"#717171", cyan:"#8a8a8a", white:"#b5cabb", brightBlack:"#202020", brightRed:"#464646", brightGreen:"#f8f8f8", brightYellow:"#eeeeee", brightBlue:"#7c7c7c", brightMagenta:"#adadad", brightCyan:"#c0c0c0", brightWhite:"#99ac9e", cursor:"#ffffff", foreground:"#ffffff"}],
		['Tango', {}]
	],

    // Takes a single character and identifies shell type
    testShell: function(r) {
        // Check that we're adding the start of a string
        if (r.substring(0, 2).indexOf(']') === -1 && (this.shellString.length === 0 || this.shellString.length > ']0;fish'.length)) {
            this.shellString = '';
            return;
        }

        this.shellString += r;

        // Don't bother checking if we don't have enough characters for a match
        if (this.shellString.length < 7) {
            return;
        }
        // Check for fish
        if (this.shellString.indexOf(']0;fish') !== -1) {
            this.shellString = '';
            this.fsHintLeave = SSHyClient.fishFsHintLeave;
            return;
        }

        // Catch all for bash
        if (this.shellString.indexOf('@') !== -1) {
            this.shellString = '';
            this.fsHintLeave = SSHyClient.bashFsHintLeave;
            return;
        }
    },
    // Toggles Local Echo on and off
    setLocalEcho: function(dir) {
        // Clamp the setting between 0 and 2
        this.localEcho = Math.min(Math.max(this.localEcho += dir, 0), 2);

        // Change the displayed mode to the string at 'this.localEcho' of array
        document.getElementById('currentLEcho').innerHTML = ["Force Off", "Auto", "Force On"][this.localEcho];

        // If we're using auto echo mode, change the auto state tooltiptext
        var element = document.getElementById('autoEchoState');
        if (this.localEcho === 1) {
            element.style.visibility = 'visible';
            element.innerHTML = "State: " + (this.autoEchoState === false ? 'Disabled' : 'Enabled');
        } else {
            element.style.visibility = 'hidden';
        }
    },

    // Parses a given message (r) for signs to enable or disable local echo
    parseLocalEcho: function(r) {
        // if we're using auto mode
        if (this.localEcho === 1) {
            // Caching this since it takes a long time to get at least twice
            var timeout = performance.now();
            // Don't continue if we've changed state in the previous 0.1s
            if (timeout - this.autoEchoTimeout < 100) {
                return;
            }
            // We only need to examine the beginning of most messages so just take the first 64 bytes to improve performance
            r = r.substring(0, 64);
            if (!this.autoEchoState) {
                // Search for '@' aswell so we catch on 'user@hostname' aswell
                if (r.indexOf(this.fsHintLeave) != -1 && r.indexOf('@') != -1) {
                    this.autoEchoState = true;
                    // Change the Settings UI
                    this.autoEchoElement.innerHTML = "State: Enabled";
                    this.autoEchoTimeout = timeout;
                }
            } else {
                // check for 'password' incase we are inputting a password
                if (r.indexOf(this.fsHintEnter) != -1 || r.toLowerCase().indexOf('password') != -1) {
                    this.autoEchoState = false;
                    this.autoEchoElement.innerHTML = "State: Disabled";
                    this.autoEchoTimeout = timeout;
                }
            }
        }
        return;
    },
    // Parses a keydown event to determine if we can safely echo the key.
    parseKey: function(e) {
        // Don't continue to write the key if auto echoing is disabled
        if (this.localEcho === 1 && this.autoEchoState === false) {
            return;
        }
        // Make sure the key isn't a special one eg 'ArrowUp', a blocked key or a control character
        if (e.key.length > 1 || this.blockedKeys.includes(e.key) || (e.altKey || e.ctrlKey || e.metaKey)) {
            return;
        }
        // Incase someone is typing very fast don't echo to perserve servers formatting.
        if (!transport.lastKey) {
            term.write(e.key);
        }
        transport.lastKey += e.key;
    },
    // Sets the keep alive iterval or clears a current interval based on 'time'
    setKeepAlive: function(time) {
        // changes 'time' into seconds & floors time to stop 0.00001s ect
        time = time === undefined ? 0 : Math.floor(time) * 1000;
        // if there is an interval setup then clear it
        if (time === 0 || this.keepAliveInterval !== undefined) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = undefined;
            if (!time) {
                return;
            }
        }
        // otherwise create a new interval
        this.keepAliveInterval = setInterval(transport.keepAlive, time);
    },
    // Set xtermjs's color scheme to the given color
    setColorScheme: function(colIndex) {
        // Gets a reference to xterm.css
        var term_style = document.styleSheets[0];
        var themeName = this.colorSchemes[colIndex][0]
        var themeColors = this.colorSchemes[colIndex][1]

        // Interact with xtermjs
        if (term) {
        	term._setTheme(themeColors)
		}

        // Remove the old CSS rules if its a custom theme
        if(!this.colorTango){
	        for (i = 0; i < 4; i++) {
	            term_style.deleteRule(13);
	        }
	    }

	    if(themeName === 'Tango') {
	    	this.colorTango = true;
	    	document.getElementById('currentColor').innerHTML = 'Tango';
	    	return;
	    }

        // Adds html background colour
        term_style.insertRule('html, body {background-color: ' + themeColors.background + ' !important;}', 13);
        // Changes the sidenav color
        term_style.insertRule('.sidenav {background-color: ' + modColorPercent(themeColors.background, -0.2) + ' !important;}', 13);
        // Changes the rx and tx color to 10 and 11
        term_style.insertRule('.brightgreen {color: ' + themeColors.brightGreen + ' !important;}', 13);
        term_style.insertRule('.brightyellow {color: ' + themeColors.brightYellow + ' !important;}', 13);

        this.colorTango = false;

        document.getElementById('currentColor').innerHTML = themeName === undefined ? 'Custom' : themeName;
    },

    importXresources: function() {
        var reader = new FileReader();
        var element = document.getElementById('Xresources').files[0];
        reader.readAsText(element);
        reader.onload = function() {
            var file = reader.result;
            var lines = file.split("\n");
            // natural sort the Xresources list to bg, 1 - 15, cur, fg colours
            lines = lines.sort(new Intl.Collator(undefined, {
                numeric: true,
                sensitivity: 'base'
            }).compare);

            colScheme = [];

            for (var i = 0; i < lines.length; i++) {
                // Regex the line for a color code #xxx or #xxxxxx
                var result = lines[i].match(/#([0-9a-f]{3}){1,2}/ig);
                if (result) {
                    colScheme.push(result[0]);
                    // If we've added 19 colors then stop and display it?
                    if (colScheme.length >= 19) {
                        break;
                    }
                }
            }

            // Make sure the new color scheme has the required amount of colours
            if (colScheme.length !== 19) {
                return alert('Uploaded file could not be parsed correctly.');
            }

            // lastly we need to sort it into a dict instead of list
            colScheme = {background: colScheme[0],black: colScheme[1],red: colScheme[2],green: colScheme[3],yellow: colScheme[4],blue: colScheme[5],magenta: colScheme[6],cyan: colScheme[7],white: colScheme[8],brightBlack: colScheme[9],brightRed: colScheme[10],brightGreen: colScheme[11],brightYellow: colScheme[12],brightBlue: colScheme[13],brightMagenta: colScheme[14],brightCyan: colScheme[15],brightWhite: colScheme[16],cursor: colScheme[17],foreground: colScheme[18]}
            colName = element.name === '.Xresources' ? 'custom' : element.name.split('.')[0]

            // Add to the colorSchemes list
            transport.settings.colorSchemes.push([colName, colScheme])
            // Get the new key 
            transport.settings.colorNames = Object.keys(transport.settings.colorSchemes);
            transport.settings.setColorScheme(transport.settings.colorSchemes.length-1)
        };
    },
    // Cycle the color counter and set the current colors to new index
    cycleColorSchemes: function(dir) {
        // Cycles through (0 -> colorSchemes.length - 1) where dir = 1 is incrementing and dir = false decrements
        this.colorCounter = dir === 0 ? --this.colorCounter : ++this.colorCounter;
        if (this.colorCounter > this.colorNames.length - 1 || this.colorCounter < 0) {
            this.colorCounter = dir === 1 ? 0 : this.colorNames.length - 1;
        }
        // Set color scheme to (colorList [ colorNames [ counter ]])
        this.setColorScheme(this.colorCounter)
    },
    // Modify the font size of the terminal 
    modFontSize: function(sign) { 
        this.fontSize += sign; 
        term.setOption('fontSize', this.fontSize)
        
        document.getElementById("currentFontSize").innerHTML = transport.settings.fontSize + 'px'; 
        // Recalculate rows/cols
        term.fit()
        transport.auth.mod_pty('window-change', term.cols, term.rows); 
    }, 
    // Sets the terminal size where id= 0-> cols ; 1-> rows 
    modTerm: function(id, newAmount) { 
        if (!id) { 
            term.resize(newAmount, term.rows); 
        } else { 
            term.resize(term.cols, newAmount); 
        } 
 
        transport.auth.mod_pty('window-change', term.cols, term.rows); 
    }, 
    // Changes the network traffic setting to reflect transmitted or recieved data
    setNetTraffic: function(value, dir) {
        // No point recalculating if the sidenav is closed
        if (!this.sidenavElementState) {
            return;
        }
        // Convert the 'value' into the correct units
        switch (true) {
            case value < 1024:
                value = value + 'Bytes';
                break;
            case (value >= 1024 && value < 1048576):
                value = (value / 1024).toFixed(3) + 'KB';
                break;
            case (value >= 1048576 && value < 1073741824):
                value = (value / 1048576).toFixed(3) + 'MB';
                break;
            default:
                // Just going to stop at Gb since its unlikely to go above that
                value = (value / 1073741824).toFixed(3) + 'GB';
        }
        // Set the target element we we're going to change.
        element = dir === true ? this.rxElement : this.txElement;
        element.innerHTML = value;
    }
};