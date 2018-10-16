import { SSHyClientRSAKey } from './rsaKey';
import { SSHyClientMessage } from './message';
import { ascii2hex, deflate_long, inflate_long, read_rng } from './lib/utilities';
import { SSHyClientDefines } from './defines';
import { BigInteger } from 'jsbn';
import { SSHyClientTransport } from './transport';
import { randomart } from './lib/randomart';
import { wsproxyURL } from './frontend';
import * as hash from './lib/Hash';
import { ws } from './SSHyClient';

// SSHyClient.kex

export class DiffieHellman {
    K?: BigInteger; 		// Our secret key K generated by our preferred_kex algorithm
    H?: string; 		// A hash used for encryption key generation by the preferred_keys algorithm
    sessionId?: string; // Session identifier; should be the same as H until a rekey event
    minBits?: number;
    maxBits?: number;
    preferredBits?: number;
    p?: BigInteger;
    q?: BigInteger;
    x?: BigInteger;
    e?: BigInteger;
    f?: BigInteger;
    g?: BigInteger;
    P?: BigInteger;
    G?: BigInteger;


    constructor(public transport: SSHyClientTransport, public group: number, public SHAVersion: string) {
        // Using group to determine what type of DH; 0= GEX; 1=g1; 14=g14
        if (this.group === undefined) {
            this.p = this.q = this.g = this.x = this.e = this.f = undefined;

            this.minBits = 1024;
            this.maxBits = 8192;
            this.preferredBits = 2048;
            return;
        } else if (this.group === 1) {
            this.P = new BigInteger('FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE65381FFFFFFFFFFFFFFFF', 16);
        } else if (this.group === 14) {
            this.P = new BigInteger('FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF', 16);
        }

        // These only apply to DH group 1 and 14
        this.x = this.e = this.f = new BigInteger('0', 10);
        this.G = new BigInteger('2', 10);
    };

    verifyKey(host_key: string, sig: string) {
        const rsa = new SSHyClientRSAKey(new SSHyClientMessage(host_key));
        if (!rsa.verify(this.H, new SSHyClientMessage(sig))) {
            this.transport.disconnect();
            throw 'RSA signature verification failed, disconnecting.';
        }
    }

    start() {
        const m = new SSHyClientMessage();

        if (this.group === undefined) {
            m.add_bytes(String.fromCharCode(SSHyClientDefines.MSG_KEXDH_GEX_REQUEST));
            m.add_int(this.minBits);
            m.add_int(this.preferredBits);
            m.add_int(this.maxBits);
        } else {
            // generates our 128 bit random number
            this.x = inflate_long(read_rng(128));

            // Now we calculate e = (g=2) ^ x mod p
            this.e = (this.G as BigInteger).modPow(this.x, this.P as BigInteger);

            // Now we create the message and send it
            m.add_bytes(String.fromCharCode(SSHyClientDefines.MSG_KEXDH_INIT));
            m.add_mpint(this.e);
        }

        this.transport.send_packet(m);
    };

    parse_reply(ptype: number, r: string) {
        if (this.group === undefined && ptype == SSHyClientDefines.MSG_KEXDH_GEX_GROUP) {
            this.parse_gex_group(r);
            return;
        }
        this.handleDHReply(r);
    };

    handleDHReply(reply: string) {
        // convert r into message format for deconstruction
        const r = new SSHyClientMessage(reply);

        // get the host key, f and signature from the message
        const host_key = r.get_string();
        if (this.transport.settings.rsaCheckEnabled) {
            // Now lets make sure that the host_key is recognised, firstly we'll pre-fetch all the data we require (ip/port/rsaKey)
            const key = wsproxyURL.split('/')[3];
            // Cache the hexified host key
            const hexHostKey = ascii2hex(host_key);
            // Generate the short MD5'd key for randomart and confirm
            const shortKey = ascii2hex(hash.MD5(host_key)).match(/.{2}/g) as RegExpMatchArray;

            // Create the randomArt image
            randomart(shortKey);

            // Since we've got everthing we need lets see if the key exists already
            const localObj = localStorage.getItem(key);

            if (localObj) {
                // Check all the details match.. they should but Sanity
                if (localObj != hexHostKey) {
                    if (confirm('WARNING - POTENTIAL SECURITY BREACH!\r\n\nThe server\s host key does not match the one SSHy has cached in local storage. This means that either the server administrator has changed the host key, or you have actually connected to another computer pretending to be the server.\r\nThe new rsa2 key fingerprint is:\r\nssh-rsa 2048 ' + shortKey.join(':') + '\r\nIf you were expecting this change and trust the new key, hit `Ok` to add the key to SSHy\'s cache and carry on connecting.\r\nIf you do not trust this new key, hit `Cancel` to abandon the connection')) {
                        // User has agree'd to the new host key so lets save it for them
                        localStorage.setItem(key, hexHostKey);
                    } else {
                        // Close the connection
                        ws.close();
                        throw 'Error: Locally stored rsa key does not match remote key';
                    }
                }
            } else {
                // Prompt the user just like they are in puTTy
                if (confirm('The server\'s host key is not cached in local storage. You have no guarentee that the server is the computer you think it is.\n\rThe server\'s rsa2 key finterprint is:\r\nssh-rsa 2048 ' + shortKey.join(':') + '\r\nIf you trust the host, hit `Ok` to add the key to SSHy\'s cache and carry on connecting.\r\nIf you do not trust this host, hit `Cancel` to abandon the connection')) {
                    // User has confirmed it is correct so save the RSA key
                    localStorage.setItem(key, hexHostKey);
                } else {
                    // need to disconnect and kill the connection
                    ws.close();
                    throw 'User has declined the rsa-key and closed the connection';
                }
            }
        }

        this.f = r.get_mpint();

        const sig = r.get_string();
        // calculate our shared secret key (K) using f
        const K = this.f.modPow(this.x as BigInteger, this.p as BigInteger);

        /*
               Now we need to generate H = hash(V_C || V_S || I_C || I_S || K_S || e || f || K)
               where	V_ = identification string,	K_ = public host key,	I_ = SSH_MSG_KEXINIT message
            */
        const m = new SSHyClientMessage();
        m.add_string(this.transport.local_version);
        m.add_string(this.transport.remote_version);
        m.add_string(this.transport.local_kex_message);
        m.add_string(this.transport.remote_kex_message);
        m.add_string(host_key);
        // Only add these if we're using DH GEX
        if (this.group === undefined) {
            m.add_int(this.minBits);
            m.add_int(this.preferredBits);
            m.add_int(this.maxBits);
            m.add_mpint(this.p);
            m.add_mpint(this.g);
        }
        m.add_mpint(this.e);
        m.add_mpint(this.f);
        m.add_mpint(K);

        this.K = K;
        (this.sessionId as string) = (this.H as string) = (this.SHAVersion == 'SHA-1' ?
            new hash.SHA1(m.toString()) : new hash.SHA256(m.toString())
        ).digest() as string;
        if (this.transport.settings.rsaCheckEnabled) {
            this.verifyKey(host_key, sig);
        }
        this.transport.send_new_keys();
    };

    // generates our secret x
    generate_x() {
        let q = (this.p as BigInteger).subtract(BigInteger.ONE);
        q = q.divide(new BigInteger('2', 10));

        let qnorm = deflate_long(q, 0);
        let qhbyte = qnorm[0].charCodeAt(0);
        let bytes = qnorm.length;
        let qmask = 0xff;
        while (!(qhbyte & 0x80)) {
            qhbyte <<= 1;
            qmask >>= 1;
        }
        let x;
        while (true) {
            let x_bytes = read_rng(bytes);
            x_bytes = String.fromCharCode(x_bytes[0].charCodeAt(0) & qmask) + x_bytes.substring(1);
            x = inflate_long(x_bytes, 1);
            if (x.compareTo(BigInteger.ONE) > 0 && q.compareTo(x) > 0) {
                break;
            }
        }
        this.x = x;
    };

    // gets the prime and group from parse_reply and generates our secret number e
    parse_gex_group(msg: string) {
        let m = new SSHyClientMessage(msg);
        this.p = m.get_mpint();
        this.g = m.get_mpint();

        this.generate_x();

        this.e = this.g.modPow(this.x as BigInteger, this.p);

        m = new SSHyClientMessage();
        m.add_bytes(String.fromCharCode(SSHyClientDefines.MSG_KEXDH_GEX_INIT));
        m.add_mpint(this.e);
        this.transport.send_packet(m);
    }
}
