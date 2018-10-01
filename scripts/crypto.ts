import * as sjcl from 'sjcl';
import { SjclCipher } from 'sjcl';
import { SSHyClientDefines } from './defines';
import { BigInteger } from 'jsbn';
import { deflate_long, fromByteArray, setCharAt, toByteArray } from './lib/utilities';

export class SSHyClientCrypto {
    mode!: number;
    blocksize!: number;
    overflow?: number;
    iv?: Uint8Array;
    value!: string;
    cipher!: SjclCipher;
    private _counter!: number;

    // AES wrapper for Libs/aes.min.js (SJCL)
    AES(key: string, mode: number, iv: string, counter: number) {
        // Setup our cipher and give it the key and mode
        this.cipher = new sjcl.cipher.aes(sjcl.codec.bytes.toBits(toByteArray(key)), mode);
        this.mode = mode;
        // some support for CBC mode - however not fully implemented
        if (this.mode == SSHyClientDefines.AES_CBC) {
            this.iv = toByteArray(iv);
        }
        this._counter = counter;
    }

    public encrypt(plaintext: string) {
        // encrypt the plaintext!
        const ciphertext = this.cipher.encrypt(toByteArray(plaintext), this.iv, this._counter);
        if (this.mode == SSHyClientDefines.AES_CBC) {
            // take the last 16 bytes for our IV
            this.iv = ciphertext.slice(-16);
        }
        // convert the ciphertext from an array of bytes back into text
        return fromByteArray(ciphertext);
    }

    public decrypt(ciphertext: Uint8Array) {
        let plaintext;
        ciphertext = toByteArray(ciphertext);
        // do different stuff for CTR & CBC mode
        if (this.mode == SSHyClientDefines.AES_CBC) {
            plaintext = this.cipher.decrypt(ciphertext, this.iv);
            this.iv = ciphertext.slice(-16);
        } else {
            plaintext = this.cipher.encrypt(ciphertext, this.iv, this._counter);
        }
        return fromByteArray(plaintext);
    }

    // Defines our custom counter
    counter(num: number, init: BigInteger) {
        init = init === undefined ? BigInteger.ONE : init;

        this.blocksize = num / 8;
        this.overflow = 0;

        // setup the initial counter value depending on if we recieved a number or not.
        if (init === BigInteger.ZERO) {
            this.value = new Array(this.blocksize + 1).join('\xFF');
        } else {
            const val = deflate_long(init.subtract(BigInteger.ONE), false);
            this.value = new Array(this.blocksize - val.length + 1).join('\x00') + val;
        }
    };

    // increment the current counter
    increment() {
        let i: number = this.blocksize;
        while (i--) {
            const count = String.fromCharCode((this.value.charCodeAt(i) + 1) % 256);
            this.value = setCharAt(this.value, i, count);
            if (count != '\x00') {
                return this.value;
            }
        }

        // Deals with counter resetting / overflowing
        let x = deflate_long(this.overflow, false);
        this.value = new Array(this.blocksize - x.length + 1).join('\x00') + x;
        return this.value;

    }
}

// SSHyClientCrypto = {};
