SSHyClient.auth = function(parceler) {
    this.parceler = parceler; // We shouldn't need anything from the transport handler
    this.authenticated = null;
    this.awaitingAuthentication = false;
};

SSHyClient.auth.prototype = {
    // Requests we want to authenticate ourselves with the SSH server
    request_auth: function() {
        var m = new SSHyClient.Message();
        m.add_bytes(String.fromCharCode(SSHyClient.MSG_SERVICE_REQUEST));
        m.add_string('ssh-userauth');
        this.parceler.send(m);
    },
    // Sends the username and password provided by index.html
    ssh_connection: function() {
        if (isWrapper && term) {
            var m = new SSHyClient.Message();
            m.add_bytes(String.fromCharCode(SSHyClient.MSG_USERAUTH_REQUEST));
            m.add_string(termUsername);
            m.add_string("ssh-connection");
            m.add_string("password");
            m.add_boolean(false);
            m.add_string(termPassword);

            this.parceler.send(m);
            this.awaitingAuthentication = true;
        } else {
            // If no termUser or termPass has been set then we are likely using the wrapper
            startxtermjs();
        }
    },
    // Called on successful or partially successful SSH connection authentications
    auth_success: function(success) {
        if (success) {
            // Change the window title
            document.title = termUsername + '@' + wsproxyURL.split('/')[3].split(':')[0];
            // Purge the username and password
            termUsername = '';
            termPassword = undefined;
            // We've been authenticated, lets open a channel
            this.open_channel('session');
        }
        // TODO: implement follow on tries for authentication (keyboard/public key)
    },
    // Opens a channel - generally called right after authenticating with the SSH server
    open_channel: function(type, onsuccess) {
        onsuccess = onsuccess === undefined ? null : onsuccess;
        var m = new SSHyClient.Message();
        m.add_bytes(String.fromCharCode(SSHyClient.MSG_CHANNEL_OPEN));
        m.add_string(type);
        m.add_int(1);
        m.add_int(SSHyClient.WINDOW_SIZE);
        m.add_int(SSHyClient.MAX_PACKET_SIZE);

        this.parceler.send(m);
    },
    // Requests a pseudo-terminal, defaulting to xterm if no other terminal emulator is provided
    get_pty: function(term, width, height) {
        var m = new SSHyClient.Message();
        m.add_bytes(String.fromCharCode(SSHyClient.MSG_CHANNEL_REQUEST));
        m.add_int(0);
        m.add_string('pty-req');
        m.add_boolean(false); // we don't want any enviroment vars to be returned
        m.add_string(term);
        m.add_int(width);
        m.add_int(height);
        // pixel data, which is overwritten by the above height and width
        m.add_int(0);
        m.add_int(0);
        // not going to use any special terminal modes currently
        m.add_string('');

        this.parceler.send(m);
        // invokes the shell session right after sending the packet
        this.invoke_shell();
    },
    // called by window.resize on index.html - resizes the terminal window on the SSH server
    // useful for screen sharing applications such as tmux or screen
    resize_pty: function(width, height) {
        var m = new SSHyClient.Message();
        m.add_bytes(String.fromCharCode(SSHyClient.MSG_CHANNEL_REQUEST));
        m.add_int(0);
        m.add_string('window-change');
        m.add_boolean(false);
        m.add_int(width);
        m.add_int(height);
        m.add_int(0);
        m.add_int(0);
        this.parceler.send(m);
    },
    // Invokes the interactive terminal using the pseudo-terminal channel
    invoke_shell: function() {
        // Craft the shell invocation packet
        var m = new SSHyClient.Message();
        m.add_bytes(String.fromCharCode(SSHyClient.MSG_CHANNEL_REQUEST));
        m.add_int(0);
        m.add_string('shell');
        m.add_boolean(false);

        this.parceler.send(m);
        // Start xterm.js
        if (termPassword === undefined) {
            term.write('\n\r');
            return;
        }
        startxtermjs();
    }
};
