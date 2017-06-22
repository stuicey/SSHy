var ws, transport, term = null;

// Since firefox renders at a different resolution to the rest we can identify it and apply special rules
var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
var isWrapper = true;

var termRows, termCols = 0;
// Need to define these since we need the terminal to open before we can calculate the values
var fontWidth = 10;
var fontHeight = 18;

var termUsername = '';
var termPassword;

var failedAttempts = 0;

window.onload = function() {
	// Appending the document body with script to keep wrapper as small as possible for cgi builds
	document.body.innerHTML +=	'<div id="settingsNav" class="sidenav">' +
								'<a href="javascript:void(0)" class="closebtn" onclick="toggleNav(0)">&times;</a>' +
								'<span class="title large">Terminal Options</span><hr>' +
								'<span class="title" style="padding-top:20px">Font Size</span>' +
								'<a class="leftarrow" href="javascript:void(0)" onclick="modFontSize(-1)">\<--</a>' +
								'<span class="middle" id="currentFontSize">16px</span>' +
								'<a class="rightarrow" href="javascript:void(0)" onclick="modFontSize(1)">--\></a>' +
								'<span class="title" style="padding-top:40px;">Local Echo</span>' +
								'<a class="leftarrow" href="javascript:void(0)" onclick="setLocalEcho(-1)">\<--</a>' +
								'<span class="middle" id="currentLEcho">Auto</span>' +
								'<a class="rightarrow" href="javascript:void(0)" onclick="setLocalEcho(1)">--\></a>' +
								'<span class="title" style="padding-top:40px">Colours</span>' +
								'<a class="leftarrow" href="javascript:void(0)" onclick="cycleColorSchemes(0)">\<--</a>' +
								'<span class="middle" id="currentColor">Monokai</span>' +
								'<a class="rightarrow" href="javascript:void(0)" onclick="cycleColorSchemes(1)">--\></a>' +
								'<div class="fileUpload btn btn-primary">' +
								'<span class="tooltiptext">Format: Xresources</span>' +
								'<span class="middle" style="width:220px;">Upload</span>' +
								'<input type="file" title=" " id="Xresources" class="upload" onchange="importXresources()"/></div>' +
								'<span class="title" style="padding-top:20px;">Keep Alive</span>' +
								'<div class="fileUpload btn btn-primary">' +
								'<span class="tooltiptext">0 to disable</span>' +
								'<input type="text" id="keepAlive" onchange="transport.settings.setKeepAlive(this.value);" placeholder="0">' +
								'<span style="font-size:16px;"> seconds</span></div>' +
								'</div>' +
								'<span id="gear" class="gear" style="visibility:visible;" onclick="toggleNav(250)">&#9881</span>';

	setColorScheme(colorScheme_ashes);
	startSSHy();
};

// Run every time the webpage is resized
window.onresize = resize();

function resize() {
    // recalculate the termCols and rows
    termCols = Math.floor((window.innerWidth - 10) / fontWidth) - (isFirefox ? -2 : 0);
    termRows = Math.floor((window.innerHeight - 10) / fontHeight) - (isFirefox ? 1 : 1);

    if (ws && transport && term) {
        term.resize(termCols, termRows);
        transport.auth.resize_pty(termCols, termRows);
    }
}

// Run every time the page is refreshed / closed to disconnect from the SSH server
window.onbeforeunload = function() {
    if (ws || transport) {
        transport.disconnect();
    }
};

function modFontSize(sign){
	transport.settings.fontSize += sign;
	document.getElementsByClassName("xterm-rows")[0].style.lineHeight = transport.settings.fontSize + 'px';
	document.getElementById("terminal").style.fontSize = transport.settings.fontSize + 'px';

	var element = document.getElementsByClassName('terminal-cursor')[0].getBoundingClientRect();
	// We should be using terminal-cursor always but sometimes it isn't available (top/htop ect)
	if(!element){
		element = document.getElementsByClassName('xterm-color-2')[0].getBoundingClientRect();
	}
	fontWidth = transport.settings.fontSize > 14 ? Math.ceil(element.width) : Math.floor(element.width);
	fontHeight = Math.floor(element.height);

	document.getElementById("currentFontSize").innerHTML = transport.settings.fontSize + 'px';

	resize();
}

function toggleNav(size){
	document.getElementById("settingsNav").style.width = size;
	var element = document.getElementById("gear").style;
	element.visibility = element.visibility === "hidden" ? "visible" : "hidden";
}

// Toggles Local Echo on and off
function setLocalEcho(dir){
	// Clamp the setting between 0 and 2
	transport.settings.localEcho = Math.min(Math.max(transport.settings.localEcho += dir, 0), 2);

	document.getElementById('currentLEcho').innerHTML = ["Force Off", "Auto", "Force On"][transport.settings.localEcho];
}

// Called on unsuccessful SSH connection authentication
function auth_failure() {
    term.write("Access Denied\r\n");
    if (++failedAttempts >= 5) {
        term.write("Too many failed authentication attempts");
        transport.disconnect();
        return;
    }
    term.write(termUsername + '@' + wsproxyURL.split('/')[2].split(':')[0] + '\'s password:');
    termPassword = '';
}

// Starts the SSH client in scripts/transport.js
function startSSHy() {
    // Initialise the window title
    document.title = "SSHy Client";
    // Opens the websocket!
    ws = new WebSocket(wsproxyURL, 'base64');

    // Sets up websocket listeners
    ws.onopen = function(e) {
        transport = new SSHyClient.Transport(ws);
    };

    ws.onmessage = function(e) {
        transport.handle(atob(e.data));
    };

    ws.onclose = function(e) {
        // Check if term exists - if not then no SSH connection was made
        if (!term) {
            termInit();
            term.write('WebSocket connection failed: Error in connection establishment: code ' + e.code);
        }
    };
}

function termInit() {
	// Calculate the term rows/cols
	resize();
    // Define the terminal rows/cols
    term = new Terminal({
        cols: termCols,
        rows: termRows
    });
    // start xterm.js
    term.open(document.getElementById('terminal'), true);
}

function startxtermjs() {
    termInit();

    // if we haven't authenticated yet we're doing an interactive login
    if (!transport.auth.authenticated) {
        term.write('Login as: ');
    }

    // sets up some listeners for the terminal (keydown, paste)
    term.textarea.onkeydown = function(e) {
        if (!ws || !transport || failedAttempts >= 5 || transport.auth.awaitingAuthentication) { // Sanity Checks
            return;
        }

        // So we don't spam single control characters
        if (e.key.length > 1 && (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) && e.key != "Backspace") {
            return;
        }

        if (!transport.auth.authenticated) {
            // putty doesn't allow control characters during authentication
            if (e.altKey || e.ctrlKey || e.metaKey) {
                return;
            }

			// so we can't input stuff like 'ArrowUp'
			if(e.key.length > 1 && (e.keyCode != 13 && e.keyCode != 8)){
				return;
			}

            switch (e.keyCode) {
                case 8: // backspace
                    if (termPassword === undefined) {
                        if (termUsername.length > 0) {
                            term.write('\b');
                            term.eraseRight(term.x - 1, term.y);
                            termUsername = termUsername.slice(0, termUsername.length - 1);
                        }
                    } else {
                        termPassword = termPassword.slice(0, termPassword.length - 1);
                    }

                    break;
                case 13: // enter
                    if (termPassword === undefined) {
                        term.write("\n\r" + termUsername + '@' + wsproxyURL.split('/')[2].split(':')[0] + '\'s password:');
                        termPassword = '';
                    } else {
                        term.write('\n\r');
                        transport.auth.ssh_connection();
                        return;
                    }
                    break;
                default:
                    if (termPassword === undefined) {
                        termUsername += e.key;
                        term.write(e.key);
                    } else {
                        termPassword += e.key;
                    }
            }
            return;
        }

        var command;

        // Decides if the keypress is an alphanumeric character or needs escaping
        if (e.key.length == 1 && !(e.altKey || e.ctrlKey || e.metaKey)) {
            command = e.key;
        } else if (e.key.length == 1 && (e.shiftKey && e.ctrlKey)) {
            // allows ctrl + shift + v for pasting
            if (e.key != 'V') {
                e.preventDefault();
            }
        } else {
            //xtermjs is kind enough to evaluate our special characters instead of having to translate every char ourself
            command = term.evaluateKeyEscapeSequence(e).key;
        }

        if (transport.settings.localEcho) {
            // Decide if we're going to locally' echo this key or not
            transport.settings.parseKey(e);
        }
        // Regardless of local echo we still want a reply to confirm / update terminal
        return command === null ? null : transport.expect_key(command);
    };

    //TODO: Find work around for firefox
    term.textarea.onpaste = function(ev) {
        if (ev.clipboardData) {
            var text = ev.clipboardData.getData('text/plain');
            if (text.length > 5000) {
                text = splitSlice(text);
                for (var i = 0; i < text.length - 1; i++) {
                    transport.expect_key(text[i]);
                }
                return;
            }
            transport.expect_key(text);
        }
    };
}
