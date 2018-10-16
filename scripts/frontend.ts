import { splitSlice } from './lib/utilities';
import * as SSHyClient from './SSHyClient';
import { term, transport, ws } from './SSHyClient';
import { SSHyClientSettings } from './settings';
import { fit } from 'xterm/lib/addons/fit/fit';
import { Terminal } from 'xterm';
import { SSHyClientTransport } from './transport';

window.onload = function() {
    (document.getElementById('login_cred') as HTMLDivElement).style.display = 'block';
    // Sets the default colorScheme to material
    const settings = new SSHyClientSettings();
    settings.setColorScheme(1);

    // Apply fit addon
    fit.apply(Terminal);

    // Build the default wsProxy URL for display on sidenav
    buildWSProxyURL()
};

// Run every time the webpage is resized
window.onresize = function() {
    clearTimeout(SSHyClient.resizeInterval);
    SSHyClient.resizeInterval = setTimeout(resize, 400);
};

// Recalculates the terminal Columns / Rows and sends new size to SSH server + xtermjs
function resize() {
    if (term) {
        term.fit()
    }
}

export let wsproxyURL: string;

// Build the entire websocket url eg (wss://localhost:5999/) based on http protocol
function buildWSProxyURL(portPassed?: string) {
    // Decide if we're using secure ws or not
    if (window.location.protocol == 'https:') {
        wsproxyProto = 'wss'
    }

    const port = portPassed ? '' : ':' + wsproxyPorts[wsproxyProto];

    // Build the wsproxyURL up
    wsproxyURL = wsproxyProto + '://' + wsproxyURL + port + '/';

    (document.getElementById('websockURL') as HTMLInputElement).value = wsproxyURL;
}

// Changes the websocket proxy URL ** BEFORE ** connection ONLY
function modProxyURL(newURL: string) {
    if (!ws) {
        // Strip it down to barebones URL:PORT(optional)
        const matches = /^w?s{0,2}:?\/{0,2}(([a-z0-9]+\.)*[a-z0-9]+\.?[a-z]+)\:?([0-9]{1,5})?/g.exec(newURL) as RegExpExecArray;
        var port = '';
        if (newURL.match(':')) {
            port = ':' + matches[matches.length - 1];
        }

        wsproxyURL = matches[1] + port;
        buildWSProxyURL(port)
    }
}

// Toggles the settings navigator
function toggleNav(size: string) {
    (document.getElementById('settingsNav') as HTMLDivElement).style.width = size + 'px';
    settings.sidenavElementState = size;
    // We need to update the network traffic whenever the nav is re-opened
    if (size && transport) {
        settings.setNetTraffic(transport.parceler.recieveData, true);
        settings.setNetTraffic(transport.parceler.transmitData, false);
    }
    var element = (document.getElementById('gear') as HTMLSpanElement).style;
    element.visibility = element.visibility === 'hidden' ? 'visible' : 'hidden';
}

// Rudimentary checks that an IP address is external and is a valid hostname or IP address
function validate(id: string, text?: string) {
    const el = document.getElementById(id);
    if (el == null) return;
    const fail_el = document.getElementById('failure') as HTMLElement;

    if (!text) {
        el.style.borderBottom = 'solid 2px #ff4d4d'
    } else {
        if (id === 'ipaddress') {
            // incase we have a error for the port
            if (text.indexOf(':') > -1) {
                if (!validate_port(parseInt(text.split(':')[1]))) {
                    el.style.borderBottom = 'solid 2px #ff4d4d';
                    return
                } else {
                    el.style.borderBottom = 'solid 2px #c9c9c9';
                    fail_el.style.display = 'none';
                }
            } else {
                // if we're not doing ports then hide the failure message
                fail_el.style.display = 'none';
            }
            // test for valid domain name
            if (!/^([a-z0-9]+\.)*[a-z0-9]+\.[a-z]+(\:[0-9]{1,5})?$/.test(text)) {
                if (check_internal(text)) {
                    display_error('Be aware - IP addresses are resolved at the websocket proxy');
                }
                // test ip aswell.
                if (!/^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$|(\:[0-9]{1,5}))){4}$/.test(text)) {
                    el.style.borderBottom = 'solid 2px #ff4d4d';
                    return;
                } else {
                    if (check_internal(text)) {
                        display_error('Could no resolve hostname: Please use an external address');
                    }
                    el.style.borderBottom = 'solid 2px #c9c9c9';
                    return;
                }
            }
        }
        el.style.borderBottom = 'solid 2px #c9c9c9'
    }
}

// Validates the port is 0 > port < 65536
function validate_port(port_num: number): number {
    if (port_num > 0 && port_num < 65536) {
        return port_num
    } else {
        display_error('Invalid port: port must be between 1 - 65535');
        validate('ipaddress', '');
    }
    return 22;
}

// checks for 10.*.*.*, 192.168.*.*, 172.16.*.*, 127.0.0.1 & loocalhost
function check_internal(ip_address: string) {
    if (/10\.\d+\.\d+\.\d+/.test(ip_address) || /192\.168\.\d+\.\d+/.test(ip_address) || /172\.16\.\d+\.\d+/.test(ip_address)) {
        return true;
    }
    return ['127.0.0.1', 'localhost'].indexOf(ip_address);
}

// Displays a given err on the page
export function display_error(err: string) {
    // remove the loading cog and set the 'connecting' to connect
    (document.getElementById('load-container') as HTMLDivElement).style.display = 'none';
    (document.getElementById('connect') as HTMLInputElement).value = 'connect';

    (document.getElementById('failure') as HTMLElement).innerText = err;
    (document.getElementById('failure') as HTMLElement).style.display = 'block';
}

export let html_port: number;

// Starts the SSH client in scripts/transport.js
function startSSHy() {
    let html_ipaddress = (document.getElementById('ipaddress') as HTMLInputElement).value;
    const termUsername = (document.getElementById('username') as HTMLInputElement).value;
    const termPassword = (document.getElementById('password') as HTMLInputElement).value;

    // find the port number
    if (html_ipaddress.indexOf(':') > -1) {
        const split = html_ipaddress.split(':');
        html_ipaddress = split[0];
        html_port = validate_port(parseInt(split[1]));
    } else {
        html_port = 22;
    }

    if (termUsername.length === 0 || termPassword.length === 0) {
        validate('username', termUsername);
        validate('password', termPassword);
        return;
    }

    // Error checking is done so remove any currently displayed errors
    (document.getElementById('failure') as HTMLElement).style.display = 'none';
    (document.getElementById('connect') as HTMLInputElement).value = 'Connecting...';
    (document.getElementById('load-container') as HTMLDivElement).style.display = 'block';

    // Disable websocket proxy modifications
    (document.getElementById('websockURL') as HTMLInputElement).disabled = true;

    // Initialise the window title
    document.title = 'SSHy Client';
    // Opens the websocket!
    wsproxyURL += html_ipaddress + ':' + html_port;
    ws = new WebSocket(wsproxyURL, 'base64');

    // Sets up websocket listeners
    ws.onopen = function(e) {
        transport = new SSHyClientTransport(ws, settings);
        transport.auth.termUsername = termUsername;
        transport.auth.termPassword = termPassword;
        transport.auth.hostname = html_ipaddress;
    };
    // Send all recieved messages to SSHyClient.Transport.handle()
    ws.onmessage = function(e) {
        // Convert the recieved data from base64 to a string
        transport.parceler.handle(atob(e.data));
    };
    // Whenever the websocket is closed make sure to display an error if appropriate
    ws.onclose = function(e) {
        // Set the sidenav websocket proxy color to yellow
        (document.getElementById('websockURL') as HTMLInputElement).classList.remove('brightgreen');
        (document.getElementById('websockURL') as HTMLInputElement).classList.add('brightyellow');
        if (term) {
            // Don't display an error if SSH transport has already detected a graceful exit
            if (transport.closing) {
                return;
            }
            term.write('\n\n\rWebsocket connection to ' + transport.auth.hostname + ' was unexpectedly closed.');
            // If there is no keepAliveInterval then inform users they can use it
            if (!settings.keepAliveInterval) {
                term.write('\n\n\rThis was likely caused by he remote SSH server timing out the session due to inactivity.\r\n- Session Keep Alive interval can be set in the settings to prevent this behaviour.');
            }
        } else {
            // Since no terminal exists we need to initialse one before being able to write the error
            termInit();
            term.write('WebSocket connection failed: Error in connection establishment: code ' + e.code);
        }
    };
    // Just a little abstraction from ws.send
    ws.sendB64 = function(e: string) {
        this.send(btoa(e));

        transport.parceler.transmitData += e.length;
        settings.setNetTraffic(transport.parceler.transmitData, false);
    };

    // Set the sidenav websocket proxy color to green
    (document.getElementById('websockURL') as HTMLInputElement).classList.add('brightgreen');
}

// Initialises xtermjs
function termInit() {
    // Define the terminal rows/cols
    term = new Terminal({
        cols: 80,
        rows: 24
    });

    // start xterm.js
    term.open((document.getElementById('terminal') as HTMLDivElement), true);
    term.fit();
    term.focus();

    // set the color scheme to whatever the user's changed it to in the mean time
    var colName = (document.getElementById('currentColor') as HTMLSpanElement).innerHTML;
    for (let i = 0; i < settings.colorSchemes.length; i++) {
        if (settings.colorSchemes[i][0] === colName) {
            settings.setColorScheme(i);
            break;
        }
    }

    // clear the modal elements on screen
    (document.getElementById('load-container') as HTMLDivElement).style.display = 'none';
    (document.getElementById('login_cred') as HTMLDivElement).style.display = 'none';
}

// Binds custom listener functions to xtermjs's Terminal object
function startxtermjs() {
    termInit();

    // sets up some listeners for the terminal (keydown, paste)
    term.textarea.onkeydown = function(e: KeyboardEvent) {
        // Sanity Checks
        if (!ws || !transport || transport.auth.failedAttempts >= 5 || transport.auth.awaitingAuthentication) {
            return;
        }

        // So we don't spam single control characters
        if (e.key.length > 1 && (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) && e.key !== 'Backspace') {
            return;
        }

        // We've already authenticated so now any keypress is a command for the SSH server
        var command, pressedKey;

        /** IE isn't very good so it displays one character keys as full names in .key
         EG - e.key = " " to e.key = "Spacebar"
         so assuming .char is one character we'll use that instead **/
        if (e.char && e.char.length === 1) {
            pressedKey = e.char;
        } else {
            pressedKey = e.key
        }

        // Decides if the keypress is an alphanumeric character or needs escaping
        if (pressedKey.length === 1 && (!(e.altKey || e.ctrlKey || e.metaKey) || (e.altKey && e.ctrlKey))) {
            command = pressedKey;
        } else if (pressedKey.length === 1 && (e.shiftKey && e.ctrlKey)) {
            // allows ctrl + shift + v for pasting
            if (pressedKey !== 'V') {
                e.preventDefault();
                return;
            }
        } else {
            //xtermjs is kind enough to evaluate our special characters instead of having to translate every char ourself
            command = term._evaluateKeyEscapeSequence(e).key;
        }

        // Decide if we're going to locally' echo this key or not
        if (settings.localEcho) {
            settings.parseKey(e);
        }
        /* Regardless of local echo we still want a reply to confirm / update terminal
           could be controversial? but putty does this too (each key press shows up twice)
           Instead we're checking the our locally echoed key and replacing it if the
           recieved key !== locally echoed key */
        return command === null ? null : transport.expect_key(command as string);
    };

    term.textarea.onpaste = function(ev) {
        let text;

        // Yay IE11 stuff!
        if ((window as any).clipboardData && (window as any).clipboardData.getData) {
            text = (window as any).clipboardData.getData('Text')
        } else if (ev.clipboardData && ev.clipboardData.getData) {
            text = ev.clipboardData.getData('text/plain');
        }

        if (text) {
            // Just don't allow more than 1 million characters to be pasted.
            if (text.length < 1000000) {
                if (text.length > 5000) {
                    // If its a long string then chunk it down to reduce load on SSHyClientParceler
                    text = splitSlice(text);
                    for (let i = 0; i < text.length; i++) {
                        transport.expect_key(text[i]);
                    }
                    return;
                }
                transport.expect_key(text);
            } else {
                alert('Error: Pasting large strings is not permitted.');
            }
        }
    };
}
