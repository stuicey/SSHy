SSHyClient.settings = function() {
    // Local echo reduces latency on regular key presses to aruond 0.04s compared to ~0.2s without it
    this.localEcho = 1; // 0 - off; 1 - auto; 2 - on
	this.fsHintEnter = "\x1b\x5b\x3f\x31";
	this.fsHintLeave = "\x1b\x5b\x33\x32";
	this.autoEchoState = 1;		// 0 = no echoing ; 1 = echoing
	this.autoEchoTimeout = 0;

    this.blockedKeys = [':'];

	this.keepAliveInterval = undefined;

	this.fontSize = 16;

	this.colorTango = true;
	this.colorCounter = 0; // Stores the current index of the theme loaded in colorSchemes

	this.setColorScheme(this.colorSchemes.Material()); // Sets the default colorScheme to material
};

SSHyClient.settings.prototype = {
colorSchemes: {
		'Tango': function() {
			return true;
		},
		'Solarized': function() {
		    return ["#002b36", "#002b36", "#dc322f", "#859900", "#b58900", "#268bd2", "#6c71c4", "#2aa198", "#93a1a1", "#657b83", "#dc322f", "#859900", "#b58900", "#268bd2", "#6c71c4", "#2aa198", "#fdf6e3", "#93a1a1", "#93a1a1"];
		},
		'Material': function() {
		    return ["#263238", "#263238", "#ff9800", "#8bc34a", "#ffc107", "#03a9f4", "#e91e63", "#009688", "#cfd8dc", "#37474f", "#ffa74d", "#9ccc65", "#ffa000", "#81d4fa", "#ad1457", "#26a69a", "#eceff1", "#eceff1", "#eceff1"];
		},
		'Monokai': function() {
		    return ["#272822", "#272822", "#dc2566", "#8fc029", "#d4c96e", "#55bcce", "#9358fe", "#56b7a5", "#acada1", "#76715e", "#fa2772", "#a7e22e", "#e7db75", "#66d9ee", "#ae82ff", "#66efd5", "#cfd0c2", "#f1ebeb", "#f1ebeb"];
		},
		'Ashes': function() {
		    return ["#1c2023", "#1c2023", "#c7ae95", "#95c7ae", "#aec795", "#ae95c7", "#c795ae", "#95aec7", "#c7ccd1", "#747c84", "#c7ae95", "#95c7ae", "#aec795", "#ae95c7", "#c795ae", "#95aec7", "#f3f4f5", "#c7ccd1", "#c7ccd1"];
		},
		'Google': function() {
		    return ["#ffffff", "#ffffff", "#cc342b", "#198844", "#fba922", "#3971ed", "#a36ac7", "#3971ed", "#c5c8c6", "#969896", "#cc342b", "#198844", "#fba922", "#3971ed", "#a36ac7", "#3971ed", "#ffffff", "#373b41", "#373b41"];
		},
		'Mono Light': function() {
		    return ["#f7f7f7", "#f7f7f7", "#7c7c7c", "#8e8e8e", "#a0a0a0", "#686868", "#747474", "#868686", "#b9b9b9", "#525252", "#7c7c7c", "#8e8e8e", "#a0a0a0", "#686868", "#747474", "#868686", "#f7f7f7", "#464646", "#464646"];
		},
		'Mono Dark': function() {
		    return ["#000000", "#000000", "#6b6b6b", "#c4c4c4", "#b3b3b3", "#999999", "#717171", "#8a8a8a", "#b5cabb", "#202020", "#464646", "#f8f8f8", "#eeeeee", "#7c7c7c", "#adadad", "#c0c0c0", "#99ac9e", "#ffffff", "#ffffff"];
		}
	},

	// Toggles Local Echo on and off
	setLocalEcho: function(dir){
		// Clamp the setting between 0 and 2
		this.localEcho = Math.min(Math.max(this.localEcho += dir, 0), 2);

		document.getElementById('currentLEcho').innerHTML = ["Force Off", "Auto", "Force On"][this.localEcho];

		// If we're using auto echo mode, change the auto state tooltiptext
		var element = document.getElementById('autoEchoState');
		if(this.localEcho === 1){
			element.style.visibility = 'visible';
			element.innerHTML = "State: " + (this.autoEchoState === 0 ? 'Disabled' : 'Enabled');
		} else {
			element.style.visibility = 'hidden';
		}
	},

    // Parses a given message (r) for signs to enable or disable local echo
    parseLocalEcho: function(r) {
		if(this.localEcho === 1 && (performance.now() - this.autoEchoTimeout) > 100){
			if(!this.autoEchoState){
				// Search for '@' aswell so we catch on 'user@hostname' aswell
				if(r.indexOf(this.fsHintLeave) != -1 && r.indexOf('@') != -1 ){
					this.autoEchoState = 1;
					// Change the Settings UI
					document.getElementById('autoEchoState').innerHTML = "State: Enabled";
					this.autoEchoTimeout = performance.now();
				}
			} else {
				// check for 'password' incase we are inputting a password && to speed things up don't check huge strings
				if(r.indexOf(this.fsHintEnter) != -1 || (r.length < 64 && r.toLowerCase().indexOf('password') != -1)){
					this.autoEchoState = 0;
					document.getElementById('autoEchoState').innerHTML = "State: Disabled";
					this.autoEchoTimeout = performance.now();
				}
			}
		}
		return;
    },
    // Parses a keydown event to determine if we can safely echo the key.
    parseKey: function(e) {
		// Don't continue to write the key if auto echoing is disabled
		if(this.localEcho === 1 && this.autoEchoState === 0){
			return;
		}
        if (e.key.length > 1 || this.blockedKeys.includes(e.key) || (e.altKey || e.ctrlKey || e.metaKey)) {
            return;
        }
		// Incase someone is typing very fast; to perserve servers formatting.
		if(!transport.lastKey){
			term.write(e.key);
		}
        transport.lastKey += e.key;
    },

	setKeepAlive: function(time) {
		time = time === undefined ? 0 : time * 1000;
		if(time === 0 || this.keepAliveInterval !== undefined){
			clearInterval(this.keepAliveInterval);
			this.keepAliveInterval = undefined;
			if(time){
				this.keepAliveInterval = setInterval(transport.keepAlive, time);
			}
		} else {
			this.keepAliveInterval = setInterval(transport.keepAlive, time);
		}
	},
	// format (hex) - [bg,0,1,2,3 ... 14,15, cur, fg]
	setColorScheme: function(colors, colorName) {
	    var term_style = document.styleSheets[0];
	    var i;
	    // Remove active colour scheme if there is a custom one.
	    if (!this.colorTango) {
	        for (i = 0; i < 34; i++) {
	            term_style.removeRule(13);
	        }
	    }

		// Tango is the default color scheme so nothing more is needed
		if (colors === true) {
			this.colorTango = true;
			this.getColorSchemeName(true);
			return;
		}

	    term_style.insertRule('.terminal .terminal-cursor {background-color: ' + colors[17] + '; color: ' + colors[0] + ' !important;}', 13);
	    term_style.insertRule('.terminal:not(.focus) .terminal-cursor {outline: 1px solid ' + colors[17] + ' !important;}', 13);
	    term_style.insertRule('.terminal .xterm-viewport {background-color: ' + colors[0] + ' !important;}', 13);
	    term_style.insertRule('html, body {background-color: ' + colors[0] + ' !important;}', 13);
	    term_style.insertRule('.terminal {color: ' + colors[18] + ' !important;}', 13);
		// Changes the sidenav color
	    term_style.insertRule('.sidenav {background-color: ' + modColorPercent(colors[0], -0.2) + ' !important;}', 13);

	    for (i = 1; i < 16; i++) {
	        term_style.insertRule('.terminal .xterm-color-' + (i - 1) + ' {color: ' + colors[i] + ' !important;}', 13);
	        term_style.insertRule('.terminal .xterm-bg-color-' + (i - 1) + ' {background-color: ' + colors[i] + ' !important;}', 13);
	    }

	    this.colorTango = false;

		this.getColorSchemeName(colors, colorName);
	},


	getColorSchemeName: function(colors, colorName){
		if(!colorName){
			colors = colors.toString();
			var names = Object.keys(this.colorSchemes);
			for(var i = 0; i < names.length; i++){
				if(colors == this.colorSchemes[names[i]]().toString()){
					colorName = names[i];
					this.colorCounter = i;		// Sets counter equal to the index of the colorSchemes
					break;
				}
			}
		}
		colorName = colorName === undefined ? 'Custom' : colorName;

		document.getElementById('currentColor').innerHTML = colorName;
	},

	importXresources: function() {
		var reader = new FileReader();
		var element = document.getElementById('Xresources').files[0];
		reader.readAsText(element);
		reader.onload = function() {
			var file = reader.result;
		    var lines = file.split("\n");
		    // natural sort the Xresources list to bg, 1 - 15, cur, fg colours & slice the leading 18 lines (!blue ect)
		    lines = lines.sort(new Intl.Collator(undefined, {
		        numeric: true,
		        sensitivity: 'base'
		    }).compare);

		    colorScheme_custom = [];

		    for (var i = 0; i < lines.length; i++) {
		        // Only lines containing '#' are added as they're likely a colour
		        if (lines[i].indexOf('#') != -1) {
		            colorScheme_custom.push("#" + lines[i].split("#")[1]);
		        }
		    }

			// Make sure the new color scheme has the required amount of colours
			if(colorScheme_custom.length !== 19){
				return alert('Uploaded file could not be parsed correctly.');
			}

		    transport.settings.setColorScheme(colorScheme_custom, element.name === '.Xresources' ? undefined : element.name.split('.')[0]);
		};
	},

	cycleColorSchemes: function(dir) {
		var names = Object.keys(this.colorSchemes);
	    // Cycles through (0 -> colorSchemes.length - 1) where dir = 1 is incrementing and dir = false decrements
		this.colorCounter = dir === 0 ? --this.colorCounter : ++this.colorCounter;
		if(this.colorCounter > names.length - 1 || this.colorCounter  < 0){
			this.colorCounter = dir === 1 ? 0 : names.length - 1;
		}

		this.setColorScheme(this.colorSchemes[names[this.colorCounter]]());
	},

	modFontSize: function(sign){
		this.fontSize += sign;
		document.getElementById("terminal").style.fontSize = this.fontSize + 'px';

		var element;
		// We should be using terminal-cursor always but sometimes it isn't available (top/htop ect)
		try{
			element = document.getElementsByClassName('terminal-cursor')[0].getBoundingClientRect();
		} catch (err){
			element = document.getElementsByClassName('xterm-color-2')[0].getBoundingClientRect();
		}

		fontWidth = this.fontSize > 14 ? Math.ceil(element.width) : Math.floor(element.width);
		fontHeight = Math.floor(element.height);

		document.getElementById("currentFontSize").innerHTML = transport.settings.fontSize + 'px';

		resize();
	},

	// Sets the terminal size where id= 0-> cols ; 1-> rows
	modTerm: function(id, newAmount){
		if(!id){
			termCols = newAmount;
		} else {
			termRows = newAmount;
		}

		this.changeTermSize(true);
	},

	// Sends the new size to the SSH server & changes local terminal size
	changeTermSize: function(skip){
		term.resize(termCols, termRows);
		transport.auth.resize_pty(termCols, termRows);
		// For some reason lineHeight isn't correctly calculated by xterm.js
		var element =  document.getElementsByClassName("xterm-rows");
		if(element){
			element[0].style.lineHeight = null;
		}

		if(skip === undefined){
			document.getElementById('termCols').value = termCols;
			document.getElementById('termRows').value = termRows;
		}
	}
};
