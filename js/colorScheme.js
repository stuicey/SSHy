var colorScheme_tango = true; // tango is the default scheme
var colorScheme_solarized = ["#002b36", "#002b36", "#dc322f", "#859900", "#b58900", "#268bd2", "#6c71c4", "#2aa198", "#93a1a1", "#657b83", "#dc322f", "#859900", "#b58900", "#268bd2", "#6c71c4", "#2aa198", "#fdf6e3", "#93a1a1", "#93a1a1"];
var colorScheme_monokai = ["#272822", "#48483e", "#dc2566", "#8fc029", "#d4c96e", "#55bcce", "#9358fe", "#56b7a5", "#acada1", "#76715e", "#fa2772", "#a7e22e", "#e7db75", "#66d9ee", "#ae82ff", "#66efd5", "#cfd0c2", "#f1ebeb", "#f1ebeb"];
var colorScheme_ashes = ["#1c2023", "#1c2023", "#c7ae95", "#95c7ae", "#aec795", "#ae95c7", "#c795ae", "#95aec7", "#c7ccd1", "#747c84", "#c7ae95", "#95c7ae", "#aec795", "#ae95c7", "#c795ae", "#95aec7", "#f3f4f5", "#c7ccd1", "#c7ccd1"];
var colorScheme_material = ["#263238", "#263238", "#ff9800", "#8bc34a", "#ffc107", "#03a9f4", "#e91e63", "#009688", "#cfd8dc", "#37474f", "#ffa74d", "#9ccc65", "#ffa000", "#81d4fa", "#ad1457", "#26a69a", "#eceff1", "#eceff1", "#eceff1"];
var colorScheme_google = ["#ffffff", "#1d1f21", "#cc342b", "#198844", "#fba922", "#3971ed", "#a36ac7", "#3971ed", "#c5c8c6", "#969896", "#cc342b", "#198844", "#fba922", "#3971ed", "#a36ac7", "#3971ed", "#ffffff", "#373b41", "#373b41"];
var colorScheme_monolight = ["#f7f7f7", "#101010", "#7c7c7c", "#8e8e8e", "#a0a0a0", "#686868", "#747474", "#868686", "#b9b9b9", "#525252", "#7c7c7c", "#8e8e8e", "#a0a0a0", "#686868", "#747474", "#868686", "#f7f7f7", "#464646", "#464646"];
var colorScheme_monodark = ["#000000", "#000000", "#6b6b6b", "#c4c4c4", "#b3b3b3", "#999999", "#717171", "#8a8a8a", "#b5cabb", "#202020", "#464646", "#f8f8f8", "#eeeeee", "#7c7c7c", "#adadad", "#c0c0c0", "#99ac9e", "#ffffff", "#ffffff"];

var colorSchemes = [true, colorScheme_solarized, colorScheme_monokai, colorScheme_ashes, colorScheme_material, colorScheme_google, colorScheme_monolight, colorScheme_monodark];
var colorSchemesNames = ['Tango', 'Solarized', 'Monokai', 'Ashes', 'Material', 'Google', 'Mono (light)', 'Mono (Dark)'];

var c = 0; // Stores the current index of the theme loaded in colorSchemes

// format (hex) - [bg,0,1,2,3 ... 14,15, cur, fg]
function setColorScheme(colors, colorName) {
    var term_style = document.styleSheets[0];
    var i;
    // Remove active colour scheme if there is a custom one.
    if (!colorScheme_tango) {
        for (i = 0; i < 33; i++) {
            term_style.removeRule(13);
        }
        // Tango is the default color scheme so nothing more is needed
        if (!colors) {
            colorScheme_tango = true;
			getColorSchemeName(true);
            return;
        }
    }

    term_style.insertRule('.terminal .terminal-cursor {background-color: ' + colors[17] + '; color: ' + colors[0] + ' !important;}', 13);
    term_style.insertRule('.terminal:not(.focus) .terminal-cursor {outline: 1px solid ' + colors[17] + ' !important;}', 13);
    term_style.insertRule('.terminal .xterm-viewport {background-color: ' + colors[0] + ' !important;}', 13);
    term_style.insertRule('html, body {background-color: ' + colors[0] + ' !important;}', 13);
    term_style.insertRule('.terminal {color: ' + colors[18] + ' !important;}', 13);

    for (i = 1; i < 16; i++) {
        term_style.insertRule('.terminal .xterm-color-' + (i - 1) + ' {color: ' + colors[i] + ' !important;}', 13);
        term_style.insertRule('.terminal .xterm-bg-color-' + (i - 1) + ' {background-color: ' + colors[i] + ' !important;}', 13);
    }

    colorScheme_tango = false;

	getColorSchemeName(colors, colorName);
}

function getColorSchemeName(colors, colorName){
	if(!colorName){
		for(var i = 0; i < colorSchemes.length; i++){
			if(colors === colorSchemes[i]){
				colorName = colorSchemesNames[i];
				c = i;		// Sets 'c' equal to the index of the colorSchemes
				break;
			}
		}
	}
	colorName = colorName === undefined ? 'Custom' : colorName;

	document.getElementById('currentColor').innerHTML = colorName;
}
function importXresources() {
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

	    setColorScheme(colorScheme_custom, element.name === '.Xresources' ? undefined : element.name.split('.')[0]);
	};
}

function cycleColorSchemes(dir) {
    // Cycles through (c = 0 -> colorSchemes.length - 1) where dir = 1 is incrementing and dir = false decrements
	c = dir === 0 ? --c : ++c;
	if(c > colorSchemes.length - 1 || c < 0){
		c = dir === 1 ? 0 : colorSchemes.length - 1;
	}
	setColorScheme(colorSchemes[c]);
}
