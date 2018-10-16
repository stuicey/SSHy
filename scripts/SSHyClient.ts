/*
	An alternative starting script used by 'wrapper.html'

	- Modifies the minimal 'wrapper.html' to include a settings UI
	- Sets up the websocket connection and other page bindings
	- Starts xterm.js and SSHyClient.Transport
*/
import { SSHyClientTransport } from './transport';
import { splitSlice, termBackspace } from './lib/utilities';
import { Terminal } from 'xterm';
import { fit } from 'xterm/lib/addons/fit/fit';
import { wsproxyURL } from './frontend';

export let transport: SSHyClientTransport;
export let term: Terminal & {
    fit(this: Terminal): void,
    _evaluateKeyEscapeSequence(this: Terminal, e: KeyboardEvent): {key: string}
};

export interface IWebSocket_B64 extends WebSocket {
    sendB64: (e: string) => void;
}

export let ws: IWebSocket_B64;

// Test IE 11
if ((window as any).msCrypto) {
    // Redirect window.crypto.getRandomValues() -> window.msCrypto.getRandomValues()
    (window as any).crypto = {};
    window.crypto.getRandomValues = function(a) { return (window as any).msCrypto.getRandomValues(a); };

    // PolyFill Uint8Array.slice() for IE 11 for sjcl AES
    if (!Uint8Array.prototype.slice) {
        Object.defineProperty(Uint8Array.prototype, 'slice', {
            value: Array.prototype.slice
        });
    }
}

// Stores timeouts for window.onresize()
export let resizeInterval: number;
window.onload = () => {
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

    // Apply fit addon
    fit.apply(Terminal);

    // After the page loads start up the SSH client
    startSSHy();
};
// Sets up a bind for every time the web browser is resized
window.onresize = () => {
    clearTimeout(resizeInterval);
    resizeInterval = setTimeout(resize, 400);
};
// Run every time the page is refreshed / closed to disconnect from the SSH server
window.onbeforeunload = () => {
    if (ws || transport) {
        transport.disconnect();
    }
};

// Recalculates the terminal Columns / Rows and sends new size to SSH server + xtermjs
export const resize = () => {
    if (term) {
        term.fit()
    }
};

// Toggles the settings navigator
export const toggleNav = (size: string) => {
    (document.getElementById('settingsNav') as HTMLDivElement).style.width = size;
    transport.settings.sidenavElementState = size;
    // We need to update the network traffic whenever the nav is re-opened
    if (size) {
        transport.settings.setNetTraffic(transport.parceler.recieveData, true);
        transport.settings.setNetTraffic(transport.parceler.transmitData, false);
    }
    const element = (document.getElementById('gear') as HTMLSpanElement).style;
    element.visibility = element.visibility === 'hidden' ? 'visible' : 'hidden';
};

// Starts the SSH client in scripts/transport.js
function startSSHy() {
    // Initialise the window title
    document.title = 'SSHy Client';

    // Opens the websocket!
    ws = new WebSocket(wsproxyURL, 'base64') as IWebSocket_B64;

    // Sets up websocket listeners
    ws.onopen = function(e) {
        transport = new SSHyClientTransport(ws);

        /*
            !! Enables or disables RSA Host checking !!
            Since Linuxzoo changes host every time there is no reason to use it
            */

        transport.settings.rsaCheckEnabled = false;
    };
    // Send all recieved messages to SSHyClient.Transport.handle()
    ws.onmessage = function(e) {
        // Convert the recieved data from base64 to a string
        transport.parceler.handle(atob(e.data));
    };
    // Whenever the websocket is closed make sure to display an error if appropriate
    ws.onclose = function(e) {
        if (term) {
            // Don't display an error if SSH transport has already detected a graceful exit
            if (transport.closing) {
                return;
            }
            term.write('\n\n\rWebsocket connection to ' + transport.auth.hostname + ' was unexpectedly closed.');
            // If there is no keepAliveInterval then inform users they can use it
            if (!transport.settings.keepAliveInterval) {
                term.write('\n\n\rThis was likely caused by he remote SSH server timing out the session due to inactivity.\r\n- Session Keep Alive interval can be set in the settings to prevent this behaviour.');
            }
        } else {
            // Since no terminal exists we need to initialse one before being able to write the error
            termInit();
            (term as Terminal).write('WebSocket connection failed: Error in connection establishment: code ' + e.code);
        }
    };
    // Just a little abstraction from ws.send
    (ws as any).sendB64 = function(e: string) {
        this.send(btoa(e));

        transport.parceler.transmitData += e.length;
        transport.settings.setNetTraffic(transport.parceler.transmitData, false);
    };
}

// Initialises xtermjs
function termInit() {
    // Define the terminal rows/cols
    term = new Terminal({
        cols: 80,
        rows: 24
    }) as typeof term;

    // start xterm.js
    term.open(document.getElementById('terminal'), true);
    term.fit();
    term.focus();

    // set the terminal size on settings menu
    (document.getElementById('termCols') as HTMLInputElement).value = term.cols.toString();
    (document.getElementById('termRows') as HTMLInputElement).value = term.rows.toString();
    // Sets the default colorScheme to material
    transport.settings.setColorScheme(1);
}

// Binds custom listener functions to xtermjs's Terminal object
export function startxtermjs() {
    termInit();

    // if we haven't authenticated yet we're doing an interactive login
    if (!transport.auth.authenticated) {
        term.write('Login as: ');
    }

    // sets up some listeners for the terminal (keydown, paste)
    term.textarea.onkeydown = function(e) {
        // Sanity Checks
        if (!ws || !transport || transport.auth.failedAttempts >= 5 || transport.auth.awaitingAuthentication) {
            return;
        }

        let pressedKey: string;
        /** IE isn't very good so it displays one character keys as full names in .key
         EG - e.key = " " to e.key = "Spacebar"
         so assuming .char is one character we'll use that instead **/
        if (e.char && e.char.length == 1) {
            pressedKey = e.char;
        } else {
            pressedKey = e.key
        }

        // So we don't spam single control characters
        if (pressedKey.length > 1 && (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) && pressedKey != 'Backspace') {
            return;
        }

        if (!transport.auth.authenticated) {
            // Other clients doesn't allow control characters during authentication
            if (e.altKey || e.ctrlKey || e.metaKey) {
                return;
            }

            // so we can't input stuff like 'ArrowUp'
            if (pressedKey.length > 1 && (e.keyCode != 13 && e.keyCode != 8)) {
                return;
            }
            /* while termPassword is undefined, add all input to termUsername
                     when it becomes defined then change targets to transport.auth.termPassword */
            switch (e.keyCode) {
                case 8: // backspace
                    if (transport.auth.termPassword === undefined) {
                        if (transport.auth.termUsername.length > 0) {
                            termBackspace(term);
                            transport.auth.termUsername = transport.auth.termUsername.slice(0, transport.auth.termUsername.length - 1);
                        }
                    } else {
                        transport.auth.termPassword = transport.auth.termPassword.slice(0, transport.auth.termPassword.length - 1);
                    }
                    break;
                case 13: // enter
                    if (transport.auth.termPassword === undefined) {
                        term.write('\n\r' + transport.auth.termUsername + '@' + transport.auth.hostname + '\'s password:');
                        transport.auth.termPassword = '';
                    } else {
                        term.write('\n\r');
                        transport.auth.ssh_connection();
                        return;
                    }
                    break;
                default:
                    if (transport.auth.termPassword === undefined) {
                        transport.auth.termUsername += pressedKey;
                        term.write(pressedKey);
                    } else {
                        transport.auth.termPassword += pressedKey;
                    }
            }
            return;
        }

        // We've already authenticated so now any keypress is a command for the SSH server
        let command;

        // Decides if the keypress is an alphanumeric character or needs escaping
        if (pressedKey.length == 1 && (!(e.altKey || e.ctrlKey || e.metaKey) || (e.altKey && e.ctrlKey))) {
            command = pressedKey;
        } else if (pressedKey.length == 1 && (e.shiftKey && e.ctrlKey)) {
            // allows ctrl + shift + v for pasting
            if (e.key != 'V') {
                e.preventDefault();
                return;
            }
        } else {
            //xtermjs is kind enough to evaluate our special characters instead of having to translate every char ourself
            command = term._evaluateKeyEscapeSequence(e).key;
        }

        // Decide if we're going to locally' echo this key or not
        if (transport.settings.localEcho) {
            transport.settings.parseKey(e);
        }
        /* Regardless of local echo we still want a reply to confirm / update terminal
           could be controversial? but putty does this too (each key press shows up twice)
           Instead we're checking the our locally echoed key and replacing it if the
           recieved key !== locally echoed key */
        return command === null ? null : transport.expect_key(command as string);
    };

    term.textarea.onpaste = function(ev) {
        let text: string | string[] | null = null;

        // Yay IE11 stuff!
        if ((window as any).clipboardData && (window as any).clipboardData.getData) {
            text = (window as any).clipboardData.getData('Text')
        } else if (ev.clipboardData && ev.clipboardData.getData) {
            text = ev.clipboardData.getData('text/plain');
        }

        if (text != null && text.length < 1000000) {
            if (text.length > 5000) {
                // If its a long string then chunk it down to reduce load on SSHyClientParceler
                text = splitSlice(text as string);
                for (let i = 0; i < text.length; i++) {
                    transport.expect_key(text[i]);
                }
                return;
            }
            transport.expect_key(text as string);
        } else {
            alert('Error: Pasting large strings is not permitted.');
        }
    };
}
