SSHyClient.parceler = function(web_socket, transport) {
    this.socket = web_socket;
    this.transport = transport;
    this.encrypting = false;

    // Encryption & Mac variables
    this.outbound_enc_iv = this.outbound_enc_key = this.outbound_mac_key = this.outbound_cipher= null;

    this.inbound_iv = this.inbound_enc_key = this.inbound_mac_key = this.inbound_cipher = null;

    this.hmacSHAVersion = null;
	this.macSize = 0;

    this.outbound_sequence_num = this.inbound_sequence_num = 0;
    this.block_size = 8;

    this.prevHeader = this.inbound_buffer = '';

	this.windowSize = SSHyClient.WINDOW_SIZE;

	/* Stores the recieved and transmitted data in bytes;
	   possible integer overflow however would need to exchange 8.1PetaBytes of data*/
	this.recieveData = this.transmitData = 0;
};

SSHyClient.parceler.prototype = {
	// Send / Encrypt messages to the websocket proxy
    send: function(data) {
		// Encapsulate the data with padding and length
		packet = this.pack_message(data.toString());

		if (this.encrypting) {
			// Encrypt the encapsulated packet
			var encrypted_packet = this.outbound_cipher.encrypt(packet);

            // Add the mac hash & pack the sequence number
            packet = encrypted_packet + SSHyClient.hash.HMAC(this.outbound_mac_key, struct.pack('I', this.outbound_sequence_num) + packet, this.hmacSHAVersion);
        }

		// Now send it as a base64 string
		this.socket.sendB64(packet);

        this.outbound_sequence_num++;
    },

    // Calculates and adds the packet length, padding length and padding to the message
    pack_message: function(data) {
        var padding = 3 + this.block_size - ((data.length + 8) % this.block_size);

        // Adds the message length, padding length and data together
        var packet = struct.pack('I', data.length + padding + 1) + struct.pack('B', padding) + data;

        // RFC says we should use random bytes but we should only need if we are encrypting. Otherwise it is a waste of time
        packet += this.encrypting ? read_rng(padding) : new Array(padding + 1).join('\x00');

        return packet;
    },
	// Handles inbound traffic over the socket
	handle: function(r) {
		// Add the packet length to the parceler's rx
		this.recieveData += r.length;
		this.transport.settings.setNetTraffic(transport.parceler.recieveData, true);
		/* Checking for encryption first since it will be the most common check
			- Parceler should send decrypted message ( -packet length -padding length -padding ) to transport.handle_dec()
			  from there it should be send to the relevant handler (auth/control)		*/
		if (this.encrypting) {
			this.inbound_buffer += r;
			this.decrypt();
			return;
		}

		/* If we don't have a remote_version then send our version and set the remote_version */
		if (!this.transport.remote_version) {
			this.transport.handler_table[0](this.transport, r);
			return;
		}

		this.inbound_buffer += r;
		this.decrypt(r);
	},
	// Decrypt messages from the SSH server
    decrypt: function() {
        // Since we cannot guarentee that we will be decyrpting zero, one or multiple packets we have to rely on this.read_ibuffer()
        var buffer = ' ';
        var header;
        while (buffer !== null) {
            // If there isn'ta previous header then we need to get one
            if (!this.prevHeader) {
				// Read [this.block_size] from the inbound buffer
                header = this.read_ibuffer();
                if (!header) { // just for safety
                    return;
                }
				// Only need to decrypt it if we've enabled encryption
				if(this.encrypting){
                	header = this.inbound_cipher.decrypt(header);
				}
            } else {
                header = this.prevHeader;
                this.prevHeader = '';
            }
			// Unpack the packet size from the decrypted header
            var packet_size = struct.unpack('I', header.substring(0, 4))[0];
            // We can store the start of our message for later now
            var leftover = header.substring(4);

			// Attempt to read [packet_size] from inbound buffer; returns null on failure
            buffer = this.read_ibuffer(packet_size + this.macSize - leftover.length);
            if (!buffer) {
				// Couldn't read [packet_size] so store the prevHeader
                this.prevHeader = header;
                return;
            }
			// Get the packet body and mac length from the buffer
            var packet = buffer.substring(0, packet_size - leftover.length);

			// Decrypt the packet
			if(this.encrypting){
				packet = this.inbound_cipher.decrypt(packet);
			}

			// Prepend our leftover header
            packet = leftover + packet;

            /*
             	Now lets verify the MAC - just to make sure!
            	- To do this we will get the MAC from the message and generate our own MAC, then compare the two.
            */
			if(this.macSize){
	            var mac = buffer.substring(packet_size - leftover.length);
	            var mac_payload = struct.pack('I', this.inbound_sequence_num) + struct.pack('I', packet_size) + packet;
	            var our_mac = SSHyClient.hash.HMAC(this.inbound_mac_key, mac_payload, this.hmacSHAVersion);
	            if (our_mac != mac) {
					// Oops something went wrong, lets close the connection
	                this.transport.disconnect();
	                throw "Inbound MAC verification failed - Mismatched MAC";
	            }
			}

            // Increment the sequence number
            this.inbound_sequence_num++;

            // calculate how much window size we have left
            this.windowSize -= packet_size;

			// If we've run out of window size then readjust it
            if (this.windowSize <= 0) {
                this.transport.winAdjust();
            }
			// Send the decoded packet to the transport handler
            this.transport.handle_dec(packet);
        }
    },
	// Read [bytes] from the inbound buffer
    read_ibuffer: function(bytes) { // if we don't feed it any arguments we are only wanting one block anyway
        bytes = bytes === undefined ? this.block_size : bytes;
        if (this.inbound_buffer.length < bytes) {
            return null;
        }

        var out = this.inbound_buffer.substring(0, bytes);
		// Remove the bytes we're taking from the buffer
        this.inbound_buffer = this.inbound_buffer.substring(bytes);
        return out;
    }
};
