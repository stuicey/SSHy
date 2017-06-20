SSHyClient.dhGroupEx = function(transport, SHAVersion) {
    this.transport = transport;
    this.SHAVersion = SHAVersion;
    this.p = null;
    this.q = null;
    this.g = null;
    this.x = null;
    this.e = null;
    this.f = null;

    this.min_bits = 1024;
    this.max_bits = 8192;
    this.preferred_bits = 2048;
};

SSHyClient.dhGroupEx.prototype = {
    // start Group Exchange by sending the initialisation packet
    start: function() {
        var m = new SSHyClient.Message();
        m.add_bytes(String.fromCharCode(SSHyClient.MSG_KEXDH_GEX_REQUEST));
        m.add_int(this.min_bits);
        m.add_int(this.preferred_bits);
        m.add_int(this.max_bits);

        this.transport.send_packet(m);
    },
    // Distinguish which type of message the SSH server has sent and parse it properly
    parse_reply: function(ptype, m) {
        if (ptype == SSHyClient.MSG_KEXDH_GEX_GROUP) {
            this.parse_gex_group(m);
        } else if (ptype == SSHyClient.MSG_KEXDH_GEX_REPLY) {
            this.parse_gex_reply(m);
        }
    },
    // generates our secret x
    generate_x: function() {
        var q = this.p.subtract(BigInteger.ONE);
        q = q.divide(new BigInteger("2", 10));

        var qnorm = deflate_long(q, 0);
        var qhbyte = qnorm[0].charCodeAt(0);
        var bytes = qnorm.length;
        var qmask = 0xff;
        while (!(qhbyte & 0x80)) {
            qhbyte <<= 1;
            qmask >>= 1;
        }
        var x;
        while (true) {
            var x_bytes = read_rng(bytes);
            x_bytes = String.fromCharCode(x_bytes[0].charCodeAt(0) & qmask) + x_bytes.substring(1);
            x = inflate_long(x_bytes, 1);
            if (x.compareTo(BigInteger.ONE) > 0 && q.compareTo(x) > 0) {
                break;
            }
        }
        this.x = x;
    },
    // gets the prime and group from parse_reply and generates our secret number e
    parse_gex_group: function(m) {
        m = new SSHyClient.Message(m);
        this.p = m.get_mpint();
        this.g = m.get_mpint();

        this.generate_x();

        this.e = this.g.modPow(this.x, this.p);

        m = new SSHyClient.Message();
        m.add_bytes(String.fromCharCode(SSHyClient.MSG_KEXDH_GEX_INIT));
        m.add_mpint(this.e);
        this.transport.send_packet(m);
    },
    // parses the second reply from the server and calculates K & H
    parse_gex_reply: function(r) {
        // convert r into message format for deconstruction
        r = new SSHyClient.Message(r);

        // get the host key, f and signature from the message
        var host_key = r.get_string();

        this.f = r.get_mpint();

        var sig = r.get_string();
        // calculate our shared secret key (K) using f
        var K = this.f.modPow(this.x, this.p);

        /*
        	Now we need to generate H = hash(V_C || V_S || I_C || I_S || K_S || e || f || K)
        	where	V_ = identification string,	K_ = public host key,	I_ = SSH_MSG_KEXINIT message
        */
        var m = new SSHyClient.Message();
        m.add_string(this.transport.local_version);
        m.add_string(this.transport.remote_version);
        m.add_string(this.transport.local_kex_message);
        m.add_string(this.transport.remote_kex_message);
        m.add_string(host_key);
        m.add_int(this.min_bits);
        m.add_int(this.preferred_bits);
        m.add_int(this.max_bits);
        m.add_mpint(this.p);
        m.add_mpint(this.g);
        m.add_mpint(this.e);
        m.add_mpint(this.f);
        m.add_mpint(K);

        // TODO: Verify host key and Signature
        this.transport.K = K;
        this.transport.session_id = this.transport.H = this.SHAVersion == 'SHA-1' ? new SSHyClient.hash.SHA1(m.toString()).digest() : new SSHyClient.hash.SHA256(m.toString()).digest();
        this.transport.send_new_keys(this.SHAVersion);
    }
};
