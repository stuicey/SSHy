SSHyClient.dhGroup1 = function(transport, group, SHAVersion) {
    this.transport = transport;
	this.SHAVersion = SHAVersion;
    this.x = new BigInteger("0", 10); // random number
    this.e = new BigInteger("0", 10); // client generated modPow
    this.f = new BigInteger("0", 10); // server generated modPow

    if (group == 1) {
        // Group 1 - second oakley group
        this.P = new BigInteger("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE65381FFFFFFFFFFFFFFFF", 16);
    } else {
        // Group 14 - oakley group 14
        this.P = new BigInteger("FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF", 16);
    }
    this.G = new BigInteger("2", 10);
};

SSHyClient.dhGroup1.prototype = {
    start: function() {
        // generates our 128 bit random number
        this.x = inflate_long(read_rng(128));

        // Now we calculate e = (g=2) ^ x mod p
        this.e = this.G.modPow(this.x, this.P);

        // Now we create the message and send it
        var m = new SSHyClient.Message();
        m.add_bytes(String.fromCharCode(SSHyClient.MSG_KEXDH_INIT));
        m.add_mpint(this.e);

        this.transport.send_packet(m);
    },

    parse_reply: function(ptype, r) {
        // convert r into message format for deconstruction
        r = new SSHyClient.Message(r);

        // get the host key, f and signature from the message
        var host_key = r.get_string();

        this.f = r.get_mpint();

        var sig = r.get_string();
        // calculate our shared secret key (K) using f
        var K = this.f.modPow(this.x, this.P);

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
        m.add_mpint(this.e);
        m.add_mpint(this.f);
        m.add_mpint(K);

        // TODO: Verify host key and Signature
        this.transport.K = K;
        this.transport.session_id = this.transport.H = this.SHAVersion == 'SHA-1' ? new SSHyClient.hash.SHA1(m.toString()).digest() : new SSHyClient.hash.SHA256(m.toString()).digest();

        this.transport.send_new_keys(this.SHAVersion);
    }
};
