var colorScheme_tango = true;  // tango is the default scheme
var colorScheme_solarized = ["#002b36","#002b36","#dc322f","#859900","#b58900","#268bd2","#6c71c4","#2aa198","#93a1a1","#657b83","#dc322f","#859900","#b58900","#268bd2","#6c71c4","#2aa198","#fdf6e3", "#93a1a1", "#93a1a1"];
var colorScheme_monokai = ["#272822","#48483e","#dc2566","#8fc029","#d4c96e","#55bcce","#9358fe","#56b7a5","#acada1","#76715e","#fa2772","#a7e22e","#e7db75","#66d9ee","#ae82ff","#66efd5","#cfd0c2", "#f1ebeb",  "#f1ebeb"];
var colorScheme_ashes = ["#1c2023","#1c2023","#c7ae95","#95c7ae","#aec795","#ae95c7","#c795ae","#95aec7","#c7ccd1","#747c84","#c7ae95","#95c7ae","#aec795","#ae95c7","#c795ae","#95aec7","#f3f4f5", "#c7ccd1", "#c7ccd1"];

var colorSchemes = ['', colorScheme_solarized, colorScheme_monokai, colorScheme_ashes];

var c = 0;	// Stores the current index of the theme loaded in colorSchemes

// format (hex) - [bg,0,1,2,3 ... 14,15, cur, fg]
function setColorScheme(colors){
	var term_style = document.styleSheets[0];
	var i;
	// Remove active colour scheme if there is a custom one.
	if(!colorScheme_tango){
		for(i = 0; i < 33; i++){
			term_style.removeRule(13);
		}
		// Tango is the default color scheme so nothing more is needed
		if(!colors){
			colorScheme_tango = true;
			return;
		}
	}

	term_style.insertRule('.terminal .terminal-cursor {background-color: ' + colors[17] + '; color: ' + colors[0] +' !important;}', 13);
	term_style.insertRule('.terminal:not(.focus) .terminal-cursor {outline: 1px solid ' + colors[17] + ' !important;}', 13);
	term_style.insertRule('.terminal .xterm-viewport {background-color: ' + colors[0] + ' !important;}', 13);
	term_style.insertRule('html, body {background-color: '+ colors[0] + ' !important;}', 13);
	term_style.insertRule('.terminal {color: ' + colors[18] + ' !important;}', 13);

	for(i = 1; i < 16; i++){
		term_style.insertRule('.terminal .xterm-color-' + (i - 1) + ' {color: ' + colors[i] + ' !important;}', 13);
		term_style.insertRule('.terminal .xterm-bg-color-' + (i - 1) + ' {background-color: ' + colors[i] + ' !important;}', 13);
	}

	colorScheme_tango = false;
}

function importXresources(){
	var file = document.getElementById('Xresources').value;
	var lines = file.split("\n");
	// natural sort the Xresources list to bg, 1 - 15, cur, fg colours & slice the leading 18 lines (!blue ect)
	lines = lines.sort(new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'}).compare);

	colorScheme_custom = [];

	for(var i = 0; i < lines.length; i++){
		// Only lines containing '#' are added
		if(lines[i].indexOf('#') != -1){
			colorScheme_custom.push("#" + lines[i].split("#")[1]);
		}
	}

	setColorScheme(colorScheme_custom);
}

function cycleColorSchemes(dir){
	dir = dir === undefined ? true : false;
	// Cycles through (c = 0 -> colorSchemes.length - 1) where dir = true is incrementing and dir = false decrements
	setColorScheme(colorSchemes[(dir === true ? ++c : (--c < 0 ? c = colorSchemes.length - 1 : c = c)) > colorSchemes.length - 1 ? c = 0 : c]);
}
