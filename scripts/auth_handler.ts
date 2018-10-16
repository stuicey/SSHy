import { SSHyClientParceler } from './parceler';
import { SSHyClientMessage } from './message';
import { SSHyClientDefines } from './defines';
import { SSHyClientTransport } from './transport';
import { startxtermjs, term } from './SSHyClient';
import { display_error, wsproxyURL } from './frontend';

export class SSHyClientAuth {
    channelOpened: boolean;
    failedAttempts: number;
    termUsername: string;
    authenticated?: boolean;
    termPassword?: string;
    hostname: string;
    awaitingAuthentication: boolean;
    transport: SSHyClientTransport;

    constructor(public parceler: SSHyClientParceler) {
        this.authenticated = undefined;
        this.awaitingAuthentication = false;
        this.hostname = wsproxyURL ? wsproxyURL.split('/')[2].split(':')[0] : '';
        this.termUsername = '';
        this.termPassword = undefined;
        this.failedAttempts = 0;
        this.channelOpened = false;
        this.transport = this.parceler.transport;
    }

    // Requests we want to authenticate ourselves with the SSH server
    request_auth() {
        const m = new SSHyClientMessage();
        m.add_bytes(String.fromCharCode(SSHyClientDefines.MSG_SERVICE_REQUEST));
        m.add_string('ssh-userauth');
        this.parceler.send(m);
    }

    // Sends the username and password provided by index.html
    ssh_connection() {
        if (!this.termUsername || !this.termPassword) {
            // If no termUser or termPass has been set then we are likely using the wrapper
            if (!term) {
                startxtermjs();
            }
            return;
        }

        const m = new SSHyClientMessage();
        m.add_bytes(String.fromCharCode(SSHyClientDefines.MSG_USERAUTH_REQUEST));
        m.add_string(this.termUsername);
        m.add_string('ssh-connection');
        m.add_string('password');
        m.add_boolean(false);
        m.add_string(this.termPassword);

        this.awaitingAuthentication = true;

        this.parceler.send(m);
    }

    // Called on successful or partially successful SSH connection authentications
    auth_success(success: boolean) {
        if (success) {
            // Change the window title
            document.title = this.termUsername + '@' + this.hostname;
            // Purge the username and password
            this.termUsername = '';
            this.termPassword = undefined;
            // Make sure xtermjs has been initialised
            if (!term) {
                startxtermjs();
            }
            // Starts up the keep alive interval to 240s
            const keepAlive = 240;
            this.transport.settings.setKeepAlive(keepAlive);
            (document.getElementById('keepAlive') as HTMLInputElement).value = keepAlive.toString();
            // We've been authenticated, lets open a channel
            this.open_channel('session');
        }
        // TODO: implement follow on tries for authentication (keyboard/public key)
    }

    // Opens a channel - generally called right after authenticating with the SSH server
    open_channel(type: string /*, onsuccess?*/) {
        // onsuccess = onsuccess === undefined ? null : onsuccess;
        const m = new SSHyClientMessage();
        m.add_bytes(String.fromCharCode(SSHyClientDefines.MSG_CHANNEL_OPEN));
        m.add_string(type);
        m.add_int(1);
        m.add_int(SSHyClientDefines.WINDOW_SIZE);
        m.add_int(SSHyClientDefines.MAX_PACKET_SIZE);

        this.parceler.send(m);
    }

    // Requests a pseudo-terminal, defaulting to xterm if no other terminal emulator is provided when type == "pty-req"
    // Sends the remote server our terminal rows/cols settings, called by window.resize() when type == "window-change"
    mod_pty(type: string, width: number, height: number, term?: string) {
        if (!this.channelOpened) {
            return;
        }

        const m = new SSHyClientMessage();
        m.add_bytes(String.fromCharCode(SSHyClientDefines.MSG_CHANNEL_REQUEST));
        m.add_int(0);
        m.add_string(type);
        m.add_boolean(false); // we don't want any enviroment vars to be returned
        if (term) {
            m.add_string(term);
        }
        m.add_int(width);
        m.add_int(height);
        // pixel data, which is overwritten by the above height and width
        m.add_int(0);
        m.add_int(0);

        if (term) {
            // Don't sent any special terminal modes
            m.add_string('');
        }

        this.parceler.send(m);

        if (term) {
            // invokes the shell session right after sending the packet
            this.invoke_shell();
        }
    }

    // Invokes the interactive terminal using the pseudo-terminal channel
    invoke_shell() {
        // Craft the shell invocation packet
        const m = new SSHyClientMessage();
        m.add_bytes(String.fromCharCode(SSHyClientDefines.MSG_CHANNEL_REQUEST));
        m.add_int(0);
        m.add_string('shell');
        m.add_boolean(false);

        this.parceler.send(m);
        // Start xterm.js
        if (this.termPassword === undefined) {
            term.write('\n\r');
            return;
        }
        startxtermjs();
    }

    // Called on unsuccessful SSH connection authentication
    authFailure() {
        if (term) {
            term.write('Access Denied\r\n');
            // if we've failed authentication more than 5 times than disconect and warn the user
            if (++this.failedAttempts >= 5) {
                term.write('Too many failed authentication attempts');
                this.transport.disconnect();
                return;
            }
            term.write(this.termUsername + '@' + this.hostname + '\'s password:');
            this.termPassword = '';
        } else {
            display_error('Invalid Username or Password');
        }
    }
}
