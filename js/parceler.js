SSHyClient.parceler = function(web_socket, transport) {
    this.socket = web_socket;
    this.transport = transport;
    this.encrypting = false;

    // Encryption & Mac variables
    this.outbound_enc_iv = null;
    this.outbound_enc_key = null;
    this.outbound_mac_key = null;

    this.outbound_cipher = null;

    this.inbound_iv = null;
    this.inbound_enc_key = null;
    this.inbound_mac_key = null;

    this.inbound_cipher = null;

	this.hmacSHAVersion	= null;
	this.macSize = null;

    this.outbound_sequence_num = 0;
    this.inbound_sequence_num = 0;
    this.block_size = 8;

    this.decrypted_header = '';
    this.inbound_buffer = '';
};

SSHyClient.parceler.prototype = {
    send: function(data, initial) {
		initial = initial === undefined ? false : true;
        // Much easier to just deal with a string here instead of an object
        data = data.toString();
        // We don't need to pack the initial message
        if (initial) {
            this.socket.send(btoa(data));
            return;
        } else if (this.encrypting) {
            var packet = this.pack_message(data);

            var encrypted_packet = this.outbound_cipher.encrypt(packet);

            // we still need to add the mac hash & pack the sequence number
            encrypted_packet += SSHyClient.hash.HMAC(this.outbound_mac_key, struct.pack('I', this.outbound_sequence_num) + packet, this.hmacSHAVersion);

            // now send it as a base64 string
            this.socket.send(btoa(encrypted_packet));
        } else {
            // There are some situations such as KEX where we don't need to encrypt or add MAC
            this.socket.send(btoa(this.pack_message(data)));
        }
        this.outbound_sequence_num++;
    },

    // Calculates and adds the packet length, padding length and padding to the message
    pack_message: function(data) {
        var padding = 3 + this.block_size - ((data.length + 8) % this.block_size);

        // Adds the message length, padding length and data together
        var packet = struct.pack('I', data.length + padding + 1) + struct.pack('B', padding) + data;

        // RFC says we should use random bytes but we should only need if  we are encrypting. Otherwise it is a waste of time
        packet += this.encrypting ? read_rng(padding) : new Array(padding + 1).join('\x00');

        return packet;
    },

    decrypt: function() {
        // Since we cannot guarentee that we will be decyrpting zero, one or multiple packets we have to rely on this.read_ibuffer()
        var buffer = ' ';
		var header;
        while (buffer !== null) {
            // First lets decrypt the first block and get the packet length
            if (!this.decrypted_header) {
                header = this.read_ibuffer();
                if (!header) { // just for safety
                    return;
                }
                header = this.inbound_cipher.decrypt(header);
            } else {
                header = this.decrypted_header;
                this.decrypted_header = '';
            }

            var packet_size = struct.unpack('I', header.substring(0, 4))[0];
            // We can store the start of our message for later now
            var leftover = header.substring(4);

            buffer = this.read_ibuffer(packet_size + this.macSize - leftover.length);
            if (!buffer) {
                this.decrypted_header = header;
                return;
            }

            var packet = buffer.substring(0, packet_size - leftover.length);
            var mac = buffer.substring(packet_size - leftover.length);

            packet = leftover + this.inbound_cipher.decrypt(packet);

            /*
             	Now lets verify the MAC - just to make sure!
            	- To do this we will get the MAC from the message and generate our own MAC, then compare the two.
            */

            var mac_payload = struct.pack('I', this.inbound_sequence_num) + struct.pack('I', packet_size) + packet;
            var our_mac = SSHyClient.hash.HMAC(this.inbound_mac_key, mac_payload, this.hmacSHAVersion);
            if (our_mac != mac) {
                display_error("Inbound MAC verification failed - Mismatched MAC");
                throw "Inbound MAC verification failed - Mismatched MAC";
            }

            // increment the seq number
            this.inbound_sequence_num++;
			// calculate how much WINDOW_SIZE we have left
			SSHyClient.WINDOW_SIZE -= packet_size;

			if(SSHyClient.WINDOW_SIZE <= 0){
				this.transport.winAdjust();
			}
            this.transport.handle_dec(packet);
        }
    },

    read_ibuffer: function(bytes) { // if we don't feed it any arguments we are only wanting one block anyway
		bytes = bytes === undefined ? this.block_size : bytes;
		if (this.inbound_buffer.length < bytes) {
            return null;
        }

        var out = this.inbound_buffer.substring(0, bytes);
        this.inbound_buffer = this.inbound_buffer.substring(bytes);
        return out;
    }
};
