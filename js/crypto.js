SSHyClient.crypto = {};

// AES wrapper for Libs/aes.min.js (SJCL)
SSHyClient.crypto.AES = function(key, mode, iv, counter) {
    // Setup our cipher and give it the key and mode
    this.cipher = new sjcl.cipher.aes(sjcl.codec.bytes.toBits(toByteArray(key)), mode);
    this.mode = mode;
    // some support for CBC mode - however not fully implemented
    if (this.mode == SSHyClient.AES_CBC) {
        this.iv = toByteArray(iv);
    }
    this.counter = counter;
};

SSHyClient.crypto.AES.prototype = {
    encrypt: function(plaintext) {
        // encrypt the plaintext!
        var ciphertext = this.cipher.encrypt(toByteArray(plaintext), this.iv, this.counter);
        if (this.mode == SSHyClient.AES_CBC) {
            // take the last 16 bytes for our IV
            this.iv = ciphertext.slice(-16);
        }
        // convert the ciphertext from an array of bytes back into text
        return fromByteArray(ciphertext);
    },

    decrypt: function(ciphertext) {
        var plaintext;
        ciphertext = toByteArray(ciphertext);
        // do different stuff for CTR & CBC mode
        if (this.mode == SSHyClient.AES_CBC) {
            plaintext = this.cipher.decrypt(ciphertext, this.iv);
            this.iv = ciphertext.slice(-16);
        } else {
            plaintext = this.cipher.encrypt(ciphertext, this.iv, this.counter);
        }
        return fromByteArray(plaintext);
    }
};
// Defines our custom counter
SSHyClient.crypto.counter = function(num, init) {
    init = init === undefined ? 1 : init;

    this.blocksize = num / 8;
    this.overflow = 0;

    // setup the initial counter value depending on if we recieved a number or not.
    if (init === 0) {
        this.value = new array(this.blocksize + 1).join('\xFF');
    } else {
        var val = deflate_long(init.subtract(BigInteger.ONE), false);
        this.value = new Array(this.blocksize - val.length + 1).join('\x00') + val;
    }
};

SSHyClient.crypto.counter.prototype = {
    // increment the current counter
    increment: function() {
        var i = this.blocksize;
        while (i--) {
            var count = String.fromCharCode((this.value.charCodeAt(i) + 1) % 256);
            this.value = setCharAt(this.value, i, count);
            if (count != '\x00') {
                return this.value;
            }
        }

        // Deals with counter resetting / overflowing
		var x = deflate_long(this.overflow, false);
		this.value = new Array(this.blocksize - x.length + 1).join('\x00') + x;
        return this.value;

    }
};
