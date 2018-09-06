SSHyClient.Transport = function(ws, settings) {
    this.local_version = 'SSH-2.0-SSHyClient';
    this.remote_version = '';

    // Kex variables
    this.local_kex_message = null; // Our local kex init message containing algorithm negotiation
    this.remote_kex_message = null; // The remote servers ^

    // Our supported Algorithms
    this.preferred_algorithms = ['diffie-hellman-group-exchange-sha256,diffie-hellman-group-exchange-sha1,diffie-hellman-group14-sha256,diffie-hellman-group14-sha1,diffie-hellman-group1-sha256,diffie-hellman-group1-sha1',
        'ssh-rsa',
        'aes128-ctr',
        'hmac-sha2-256,hmac-sha1',
        'none',
		''
    ];

    // Objects storing references to our different algorithm modules
    this.preferred_kex = null;
    this.preferred_mac = null;
	this.preferred_hash = null;

	// Other SSHyClient module classes
    this.parceler = new SSHyClient.parceler(ws, this);
    this.auth = new SSHyClient.auth(this.parceler);
	this.settings = settings === undefined ? new SSHyClient.settings() : settings;

    this.lastKey = '';

	this.closing = false;
};

SSHyClient.Transport.prototype = {
	/* 	Lookup table for all of our supported KEX algorithms
		- Called by kex_info[<string> id]
		- returns <object> KEX algorithm */
    kex_info: {
        'diffie-hellman-group1-sha1': function(self) {
            return new SSHyClient.kex.DiffieHellman(self, 1, 'SHA-1');
        },
        'diffie-hellman-group14-sha1': function(self) {
            return new SSHyClient.kex.DiffieHellman(self, 14, 'SHA-1');
        },
        'diffie-hellman-group-exchange-sha1': function(self) {
            return new SSHyClient.kex.DiffieHellman(self, undefined, 'SHA-1');
        },
        'diffie-hellman-group1-sha256': function(self) {
            return new SSHyClient.kex.DiffieHellman(self, 1, 'SHA-256');
        },
        'diffie-hellman-group14-sha256': function(self) {
            return new SSHyClient.kex.DiffieHellman(self, 14, 'SHA-256');
        },
        'diffie-hellman-group-exchange-sha256': function(self) {
            return new SSHyClient.kex.DiffieHellman(self, undefined, 'SHA-256');
        }
    },
	/* 	Lookup table for all of our supported MAC algorithms
		Called by kex_info[<string> id]	*/
    mac_info: {
        'hmac-sha1': function(self) {
            self.parceler.hmacSHAVersion = 'SHA-1';
            self.preferred_hash = 20;
            return;
        },
        'hmac-sha2-256': function(self) {
            self.parceler.hmacSHAVersion = 'SHA-256';
            self.preferred_hash = 32;
            return;
        }
    },
    /*
    	A table storing various function calls corresponding to the Message ID numbers defined [https://www.ietf.org/rfc/rfc4250.txt]
    	called like :
    		`handler_table[id](<object> SSHyClient.transport, <string> message)`
    */
    handler_table: {
		/* Sends our local SSH version to the SSH server */
		0: function(self, m){
			// Directly interface with the websocket
			self.parceler.socket.sendB64(self.local_version + '\r\n');
			// Slice off the '/r/n' from the end of our remote version
			self.remote_version = m.slice(0, m.length - 2);
			self.send_kex_init();
			return;
		},
        /* SSH_MSG_DISCONNECT - sent by the SSH server when the connection is gracefully closed */
        1: function(self, m) {
            self.disconnect();
            return;
        },
        /* SSH_MSG_IGNORE - sent by the SSH server when keys are not to be echoed */
        2: function(self, m) {
            return;
        },
        /* SSH_MSG_UNIMPLEMENTED - sent by the server to indicate a function is not implemented on the remote */
        3: function(self, m) {
            return;
        },
        /* SSH_MSG_SERVICE_ACCEPT: sent by the SSH server after the client request's a service (post-kex) */
        6: function(self, m) {
            var service = new SSHyClient.Message(m.slice(1)).get_string();
            // Check th type of message sent by the server and start the appropriate service
            if (service == "ssh-userauth") {
                self.auth.ssh_connection();
            }
            return;
        },
        /* SSH_MSG_KEXINIT: sent by the server after algorithm negotiation - contains server's keys and hash */
        20: function(self, m) {
            // Remote_kex_message must have no padding or length meta data so we have to strip that out
            self.parse_kex_reply(m);
            self.remote_kex_message = m; // we need this later for calculating H
            self.preferred_kex.start();
            return;
        },
		/*  SSH_MSG_NEWKEYS: sent by the server to inform us that it will use encryption from now on */
		21: function(self){
	        self.activate_encryption();
			return;
		},
        /* SSH_MSG_KEX_DH_GEX_GROUP: used for DH GroupEx when negotiating which group to use */
        31: function(self, m) {
            /* Since we're just extracting data from r in parse_reply, we don't need to do the processing to remove the padding
			 and can just remove the first 1 byte (message code) */
            self.preferred_kex.parse_reply(31, m.slice(1));
            return;
        },
        /* SSH_MSG_KEX_DH_GEX_REPLY: used for DH GroupEx, sent by the server - contains server's keys and hash */
        33: function(self, m) {
            self.preferred_kex.parse_reply(33, m.slice(1));
            return;
        },
        /* SSH_MSG_USERAUTH_FAILURE: sent by the server when there is a complete or partial failure with user authentication */
        51: function(self, m) {
            self.auth.awaitingAuthentication = false;
            self.auth.authFailure();
            return;
        },
        /* SSH_MSG_USERAUTH_SUCCESS: sent by the server when an authentication attempt succeeds */
        52: function(self, m) {
            self.auth.authenticated = true;
            self.auth.awaitingAuthentication = false;
            self.auth.auth_success(true);
            return;
        },
        /* SSH_MSG_GLOBAL_REQUEST: sent by the server to request information, server sends its hostkey after user-auth
           but RSA keys (TODO) aren't implemented so for now we can ignore this message */
        80: function(self, m) {
            return;
        },
        /* SSH_MSG_CHANNEL_OPEN_CONFIRMATION: sent by the server to inform the client that a new channel has been opened */
        91: function(self, m) {
            self.auth.channelOpened = true;
            resize()
            self.auth.mod_pty('pty-req', term.cols, term.rows, 'xterm');
            return;
        },
        /* SSH_MSG_CHANNEL_WINDOW_ADJUST: sent by the server to inform the client of the maximum window size (bytes) */
        93: function(self, m) {
            return;
        },
        /* SSH_MSG_CHANNEL_DATA: text sent by the server which is displayed by writing to the terminal */
        94: function(self, m) {
            // Slice the heading 9 bytes and send the remaining xterm sequence to the terminal
            var str = m.slice(9);

			// Local Echo module
			if(self.settings.localEcho){
				// Inspect the packet for identifying shell type
				self.settings.testShell(str);
				// Inspect the packet for fullscreen applications
				self.settings.parseLocalEcho(str);
				if (self.lastKey) {
					/* 	If packet data == lastkey pressed do nothing, otherwise delete last key in term
						and write the returned packet data 	*/
	                if (str == self.lastKey.substring(0,1)) {
	                    self.lastKey = self.lastKey.slice(1);
	                    return;
	                }
	                self.lastKey = self.lastKey.slice(1);
	                term.write('\b');
	            }
			}
			// Convert str and write it to console
            term.write(fromUtf8(str));
            return;
        },
        /* SSH_MSG_CHANNEL_EOF: sent by the server indicating no more data will be sent to the channel*/
        96: function(self, m) {
            return;
        },
        /* SSH_MSG_CHANNEL_CLOSE: sent by the server to indicate the channel is now closed; the SSH connection remains open*/
        97: function(self, m) {
            self.disconnect();
            return;
        },
        /* SSH_MSG_CHANNEL_REQUEST: sent by the server to request a new channel, as the client we can just ignore this*/
        98: function(self, m) {
            return;
        }
    },

    /*
		Once the SSH server has transmitted its full window size it gets locked up and cannot send more data
		until the window has been readjusted.

		Using WINDOW_SIZE from puTTy
	*/
    winAdjust: function() {
        var m = new SSHyClient.Message();
        m.add_bytes(String.fromCharCode(SSHyClient.MSG_CHANNEL_WINDOW_ADJUST));
        m.add_int(0);
        m.add_int(SSHyClient.WINDOW_SIZE);

        this.send_packet(m.toString());
        this.parceler.windowSize = SSHyClient.WINDOW_SIZE;
    },
    // Disconnect the web client from the server with a given error code (11 - SSH_DISCONNECT_BY_APPLICATION )
    disconnect: function(reason) {
		this.closing = true;
        reason = reason === undefined ? 11 : reason;
        var m = new SSHyClient.Message();
        m.add_bytes(String.fromCharCode(SSHyClient.MSG_DISCONNECT));
        m.add_int(reason);
        this.send_packet(m.toString());
        ws.close();
        term.write("\r\nConnection to " + this.auth.hostname + " closed. Code - " + reason);
    },
	// Sends a null packet to the SSH server to keep the connection alive
	keepAlive: function(){
		// Make sure the websocket is still open
		if(ws.readyState === 3){
			return;
		}
		var m = new SSHyClient.Message();
		m.add_bytes(String.fromCharCode(SSHyClient.MSG_IGNORE));
		m.add_string('');

		transport.send_packet(m.toString());
	},
	/* 	Cuts the padding 00's off the end of a message by reading the padding length
		- param <string> m
		returns <string>	*/
    cut_padding: function(m) {
        return m.substring(1, m.length - m[0].charCodeAt(0));
    },
	// Sends the raw packet to the parceler to be encapsulated and sent via websocket
    send_packet: function(m) {
        this.parceler.send(m);
    },
	// Initiates the key exchange process by sending our supported algorithms & ciphers
    send_kex_init: function() {
        var m = new SSHyClient.Message();
        m.add_bytes(String.fromCharCode(SSHyClient.MSG_KEX_INIT));
        // add 16 random bytes
        m.add_bytes(read_rng(16));
        m.add_string(this.preferred_algorithms[0]); // Preferred Kex
        m.add_string(this.preferred_algorithms[1]); // Preferred Server keys
		// Adds cipher, mac, compression and languages twice
		for(var i = 2; i < 6; i++){
			m.add_string(this.preferred_algorithms[i]);
			m.add_string(this.preferred_algorithms[i]);
		}

        m.add_boolean(false); // Kex guessing
        m.add_int(0);

		m = m.toString();
        //save a copy for calculating H later
        this.local_kex_message = m;

        this.send_packet(m);
    },
	// Parses the server's kex init and selects best fit algorithms & ciphers
    parse_kex_reply: function(m) {
        m = new SSHyClient.Message(m);
		// Cuts the 16 byte random cookie and message flags from the beginning
		m.get_bytes(17);

		// Gets the supported algorithms, ignoring repeated keys/cipher algorithms
        var kex = filter(this.preferred_algorithms[0], m.get_string().split(','));
        var keys = filter(this.preferred_algorithms[1], m.get_string().split(','));
        m.get_string();
        var cipher = filter(this.preferred_algorithms[2], m.get_string().split(','));
        m.get_string();
        var mac = filter(this.preferred_algorithms[3], m.get_string().split(','));

		// Sanity checking to make sure nessesary algorithms have been negotiated
        if (!kex || !keys || !cipher || !mac) {
            var missing = '';
            if (!kex) {
                missing += "KEX Algorithm,";
            }
            if (!keys) {
                missing += "Host Keys,";
            }
            if (!cipher) {
                missing += "Encryption Cipher,";
            }
            if (!mac) {
                missing += "MAC Algorithm";
            }

            //term.write("Incompatable SSH server (no compatable - " + missing + " )");
            throw "Chosen Algs = kex=" + kex + ", keys=" + keys + ", cipher=" + cipher + ", mac=" + mac;
        }
        // Set those preferred Algs
        this.preferred_kex = this.kex_info[kex](this);
        this.preferred_mac = this.mac_info[mac](this);
    },

    /* 	Takes a character and size then generates a key to be used by ssh
    	A = Initial IV 		client -> server
    	C = Encryption Key 	client -> server
    	E = Integrity Key 	client -> server
    */
    generate_key: function(char, size) {
        var m = new SSHyClient.Message();
        m.add_mpint(SSHyClient.kex.K);
        m.add_bytes(SSHyClient.kex.H);
        m.add_bytes(char);
        m.add_bytes(SSHyClient.kex.sessionId);

        return this.preferred_kex.SHAVersion == 'SHA-1' ? new SSHyClient.hash.SHA1(m.toString()).digest().substring(0, size) : new SSHyClient.hash.SHA256(m.toString()).digest().substring(0, size);
    },
	// Sets up the keys and ciphers that the parceler will use
    activate_encryption: function() {
        this.parceler.block_size = 16;
		this.parceler.macSize = this.preferred_hash;

        // Generate the keys we need for encryption and HMAC
        this.parceler.outbound_enc_iv = this.generate_key('A', this.parceler.block_size, this.preferred_kex.SHAVersion);
        this.parceler.outbound_enc_key = this.generate_key('C', this.parceler.block_size, this.preferred_kex.SHAVersion);
        this.parceler.outbound_mac_key = this.generate_key('E', this.parceler.macSize, this.preferred_kex.SHAVersion);

        this.parceler.outbound_cipher = new SSHyClient.crypto.AES(this.parceler.outbound_enc_key,
            SSHyClient.AES_CTR,
            this.parceler.outbound_enc_iv,
            new SSHyClient.crypto.counter(this.parceler.block_size * 8, inflate_long(this.parceler.outbound_enc_iv)));

        this.parceler.inbound_enc_iv = this.generate_key('B', this.parceler.block_size, this.preferred_kex.SHAVersion);
        this.parceler.inbound_enc_key = this.generate_key('D', this.parceler.block_size, this.preferred_kex.SHAVersion);
        this.parceler.inbound_mac_key = this.generate_key('F', this.parceler.macSize, this.preferred_kex.SHAVersion);

        this.parceler.inbound_cipher = new SSHyClient.crypto.AES(this.parceler.inbound_enc_key,
            SSHyClient.AES_CTR,
            this.parceler.inbound_enc_iv,
            new SSHyClient.crypto.counter(this.parceler.block_size * 8, inflate_long(this.parceler.inbound_enc_iv)));

        // signal to the parceler that we want to encrypt and decypt
        this.parceler.encrypting = true;

        this.auth.request_auth();
    },
	// Takes an arbitrary packet and processes it to be looked up by the handler_table
    handle_dec: function(m) {
        // Cut the padding off
        m = this.cut_padding(m);
        // Should now be in format [ptype][message]
        try {
            this.handler_table[m.substring(0, 1).charCodeAt(0)](this, m);
        } catch (err) {
            console.log(err);
            console.log("Error! code - " + m.substring(0, 1).charCodeAt(0) + " does not exist!");
        }
    },
    str_to_bytes: function(s) {
        return unescape(encodeURIComponent(s))
    },
	// Takes a char or string and sends it to the SSH server
    expect_key: function(command) {
		// Make sure a non-null command is being sent
		if(!command){
			return;
		}
		// encapsulates a character or command and sends it to the SSH server
		var m = new SSHyClient.Message();
		m.add_bytes(String.fromCharCode(SSHyClient.MSG_CHANNEL_DATA));
		m.add_int(0);
		m.add_string(this.str_to_bytes(command.toString()));

		this.parceler.send(m);
    },
	// Sends the new keys message signaling we're using the generated keys from now on
    send_new_keys: function(SHAVersion) {
        var m = new SSHyClient.Message();
        m.add_bytes(String.fromCharCode(SSHyClient.MSG_NEW_KEYS));

        this.send_packet(m);
    }
};
