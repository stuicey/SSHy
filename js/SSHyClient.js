/*
	An alternative starting script used by 'wrapper.html'

	- Modifies the minimal 'wrapper.html' to include a settings UI
	- Sets up the websocket connection and other page bindings
	- Starts xterm.js and SSHyClient.Transport
*/
var ws, transport, term = null;
var fitAddon = null;
var wsproxyEncoding = null;

// Really struggling to encode string as a binary array buffer
// this technique seems to work, but why!
// Adapted from the following
// https://stackoverflow.com/questions/6965107/converting-between-strings-and-arraybuffers
// https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
//
function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function str2ab(str) {
  var buf = new ArrayBuffer(str.length*1); // 2 bytes for each char
  var bufView = new Uint8Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// ==============

function setProxyEncoding(en) {
  wsproxyEncoding = en;
}

// Test IE 11
if (window.msCrypto){
	// Redirect window.crypto.getRandomValues() -> window.msCrypto.getRandomValues()
	window.crypto = {} 
	window.crypto.getRandomValues = function(a) { return window.msCrypto.getRandomValues(a); }

	// PolyFill Uint8Array.slice() for IE 11 for sjcl AES
	if (!Uint8Array.prototype.slice) {
	  Object.defineProperty(Uint8Array.prototype, 'slice', {
	    value: Array.prototype.slice
	  });
	}
}

// Stores timeouts for window.onresize()
var resizeInterval;
window.onload = function() {
	// Appending the settings UI to keep 'wrapper.html' as small as possible for cgi builds on Linuxzoo.net
	document.body.innerHTML += `<div id="settingsNav" class="sidenav">
									<a href="javascript:;" class="closebtn" onclick="toggleNav(0)">&times;</a>
									<span class="title large">Terminal Options</span>
									<hr>
									<span class="title" style="padding-top:20px">Font Size</span>
									<a class="leftarrow" href="javascript:;" onclick="transport.settings.modFontSize(-1)">\<--</a>
									<span class="middle" id="currentFontSize">16px</span>
									<a class="rightarrow" href="javascript:;" onclick="transport.settings.modFontSize(1)">--\></a>
									<span class="title" style="padding-top:40px">Terminal Size</span>
									<span class="leftarrow">Cols:
										<input type="number" id="termCols" min="5" oninput="transport.settings.modTerm(0, this.value)">
									</span>
									<span class="rightarrow">Rows:
										<input type="number" id="termRows" min="5" oninput="transport.settings.modTerm(1, this.value)">
									</span>
									<span class="title" style="padding-top:60px;">Local Echo</span>
									<a class="leftarrow" href="javascript:;" onclick="transport.settings.setLocalEcho(-1)">\<--</a>
									<a class="rightarrow" href="javascript:;" onclick="transport.settings.setLocalEcho(1)">--\></a>
									<div class="fileUpload btn btn-primary nomargin">
										<span class="tooltiptext" style="visibility:visible;" id="autoEchoState">State: Enabled</span>
										<span class="middle" id="currentLEcho">Force Off</span>
									</div>
									<span class="title" style="padding-top:50px">Colours</span>
									<a class="leftarrow" href="javascript:;" onclick="transport.settings.cycleColorSchemes(0)">\<--</a>
									<span class="middle" id="currentColor">Monokai</span>
									<a class="rightarrow" href="javascript:;" onclick="transport.settings.cycleColorSchemes(1)">--\></a>
									<div class="fileUpload btn btn-primary">
										<span class="tooltiptext">Format: Xresources</span>
										<span class="middle" style="width:220px;">Upload</span>
										<input type="file" title=" " id="Xresources" class="upload" onchange="transport.settings.importXresources()" />
									</div>
									<span class="title" style="padding-top:20px;">Keep Alive</span>
									<div class="fileUpload btn btn-primary">
										<span class="tooltiptext">0 to disable</span>
										<input type="number" class="large" id="keepAlive" onchange="transport.settings.setKeepAlive(this.value);" placeholder="0">
										<span style="font-size:16px;"> seconds</span>
									</div>
									<span class="title" style="padding-top:20px;">Network Traffic</span>
									<div class="netTraffic">
										<span class="leftarrow brightgreen">rx: <span id="rxTraffic"></span></span>
										<span class="rightarrow brightyellow">tx: <span id="txTraffic"></span></span>
									</div>
									<div id="hostKey" style="display: none;">
								        <span class="title" style="padding-top:20px;">Host Key</span>
								        <span id="hostKeyImg" class="hostKeyImg"></span>
								    </div>
								</div>
								<span id="gear" class="gear" style="visibility:visible;" onclick="toggleNav(250)">&#9881</span>`;

	// After the page loads start up the SSH client
	startSSHy();
};
// Sets up a bind for every time the web browser is resized
window.onresize = function(){
	clearTimeout(resizeInterval);
	resizeInterval = setTimeout(resize, 400);
};
// Run every time the page is refreshed / closed to disconnect from the SSH server
window.onbeforeunload = function() {
    if (ws || transport) {
        transport.disconnect();
    }
};
// Recalculates the terminal Columns / Rows and sends new size to SSH server + xtermjs
function resize() {
  if (term) {
    // Calculate best rows and columns for the div
    fitAddon.fit();
    // Let the SSH session know the new size
    transport.auth.mod_pty('window-change', term.cols, term.rows);
    // Update the side panel
    document.getElementById('termCols').value = term.cols;
    document.getElementById('termRows').value = term.rows;
  }
}
// Toggles the settings navigator
function toggleNav(size){
	document.getElementById("settingsNav").style.width = size;
	transport.settings.sidenavElementState = size;
	// We need to update the network traffic whenever the nav is re-opened
	if(size){
		transport.settings.setNetTraffic(transport.parceler.recieveData, true);
		transport.settings.setNetTraffic(transport.parceler.transmitData, false);
	}
	var element = document.getElementById("gear").style;
	element.visibility = element.visibility === "hidden" ? "visible" : "hidden";
}
// Starts the SSH client in scripts/transport.js
function startSSHy() {
    // Initialise the window title
    document.title = "SSHy Client";

    // Opens the websocket!
   
    if (wsproxyEncoding == 'binary') {
    } else {
      wsproxyEncoding = 'base64';
    }

    if (wsproxyEncoding == 'binary') {
      ws = new WebSocket(wsproxyURL);
      ws.binaryType = "arraybuffer";
    } else {
      ws = new WebSocket(wsproxyURL, 'base64');
    }

    // Sets up websocket listeners
    ws.onopen = function(e) {
        transport = new SSHyClient.Transport(ws);

		/*
		!! Enables or disables RSA Host checking !!
		Since Linuxzoo changes host every time there is no reason to use it
		*/

		transport.settings.rsaCheckEnabled = false;
    };
	// Send all recieved messages to SSHyClient.Transport.handle()
    ws.onmessage = function(e) {
        if (wsproxyEncoding == 'binary') {
          	// ArrayBuffer to String
  	  transport.parceler.handle(ab2str(e.data));
        } else {
		// Convert the recieved data from base64 to a string
          transport.parceler.handle(atob(e.data));
        }
    };
	// Whenever the websocket is closed make sure to display an error if appropriate
    ws.onclose = function(e) {
		if(term){
			// Don't display an error if SSH transport has already detected a graceful exit
			if(transport.closing){
				return;
			}
			term.write('\n\n\rWebsocket connection to ' + transport.auth.hostname + ' was unexpectedly closed.');
			// If there is no keepAliveInterval then inform users they can use it
			if(!transport.settings.keepAliveInterval){
				term.write('\n\n\rThis was likely caused by he remote SSH server timing out the session due to inactivity.\r\n- Session Keep Alive interval can be set in the settings to prevent this behaviour.');
			}
		} else {
			// Since no terminal exists we need to initialse one before being able to write the error
            termInit();
            term.write('WebSocket connection failed: Error in connection establishment: code ' + e.code);
		}
    };
	// Just a little abstraction from ws.send
	ws.sendB64 = function(e){
          if (wsproxyEncoding == 'binary') {
            this.send(str2ab(e));
	
	    transport.parceler.transmitData += e.length;
	    transport.settings.setNetTraffic(transport.parceler.transmitData, false);
          } else {
		this.send(btoa(e));

		transport.parceler.transmitData += e.length;
		transport.settings.setNetTraffic(transport.parceler.transmitData, false);
          }
	};
}
// Initialises xtermjs
function termInit() {
    // Define the terminal rows/cols
    term = new Terminal({ 
        //cols: 80, 
        //rows: 24 
    });

    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    // start xterm.js
    term.open(document.getElementById('terminal'), true);
    fitAddon.fit()
    term.focus()
	// set the terminal size on settings menu
	document.getElementById('termCols').value = term.cols;
	document.getElementById('termRows').value = term.rows;
	// Sets the default colorScheme to material
	transport.settings.setColorScheme(1);

}
// Binds custom listener functions to xtermjs's Terminal object
function startxtermjs() {
    termInit();

    // if we haven't authenticated yet we're doing an interactive login
    if (!transport.auth.authenticated) {
        term.write('Login as: ');
    }

    // sets up some listeners for the terminal (keydown, paste)
    term.onData((data) => {
      if (!ws || !transport || !transport.auth.authenticated) {
        // If no connection dont send, and unauthenticated connections handled
        // elsewhere
        return;
      }
      if (data.length > 5000) {
	// Apparently long strings kill SSHyClient.parceler, although it is
        // probably best to sort that there rather than here...
        var blocks;
        blocks = splitSlice(data);
        //console.log("ondata length ",blocks.length);
        for (var i = 0; i < blocks.length; i++) {
            //console.log("ondata block ",i,blocks[i].charCodeAt(0))
            transport.expect_key(blocks[i]);
        }
      } else {
        //console.log("ondata ",data.charCodeAt(0), data.substr(1))
        transport.expect_key(data);
      }
    });
    term.attachCustomKeyEventHandler(e=> {
		// Sanity Checks
        if (e.type != 'keydown') {return;}

        // If websocket is closed, ran out of attempts to authenticate, or just
        // waiting to confirm the username and password, dont forward keys
        if (!ws || !transport || transport.auth.failedAttempts >= 5 || transport.auth.awaitingAuthentication) {
          return false;
        }
        var pressedKey
        /** IE isn't very good so it displays one character keys as full names in .key 
	 	EG - e.key = " " to e.key = "Spacebar"	
	 	so assuming .char is one character we'll use that instead **/
        if (e.char && e.char.length == 1) {
          pressedKey = e.char;
        } else { 
          pressedKey = e.key
        }

        if (pressedKey.length == 1 && (e.shiftKey && e.ctrlKey)) {
            // allows ctrl + shift + v for pasting
            // and dont forward those keys to the terminal
            if (e.key == 'V') {
               return false;
            }
        }

        // onData does the majority of sending keys for transport
        if (transport.auth.authenticated) {
          return;
        }
        // Not yet authenticated

        // For usernames and passwords only named keys Delete and Enter is ok
        // so we can't input stuff like 'ArrowUp'
        if ((pressedKey.length > 1) && (e.keyCode != 13 && e.keyCode != 8)){
            return;
        }
        // Other clients doesn't allow control characters during authentication
        if (e.altKey || e.ctrlKey || e.metaKey) {
          return;
        }
			/* while termPassword is undefined, add all input to termUsername
			   when it becomes defined then change targets to transport.auth.termPassword */
            switch (e.keyCode) {
                case 8: // backspace
                    if (transport.auth.termPassword === undefined) {
                        if (transport.auth.termUsername.length > 0) {
                            term.write("\b \b");
                            transport.auth.termUsername = transport.auth.termUsername.slice(0, transport.auth.termUsername.length - 1);
                        }
                    } else {
                        transport.auth.termPassword = transport.auth.termPassword.slice(0, transport.auth.termPassword.length - 1);
                    }
                    return false;
                    break;
                case 13: // enter
                    if (transport.auth.termPassword === undefined) {
                        term.write("\n\r" + transport.auth.termUsername + '@' + transport.auth.hostname + '\'s password:');
                        transport.auth.termPassword = '';
                    } else {
                        term.write('\n\r');
                        transport.auth.ssh_connection();
                    }
                    return false;
                    break;
                default:
                    if (transport.auth.termPassword === undefined) {
                        transport.auth.termUsername += pressedKey;
                        term.write(pressedKey);
                    } else {
                        transport.auth.termPassword += pressedKey;
                    }
            }
            return false;
    });
}
