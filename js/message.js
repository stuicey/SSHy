/*
  Implementation of SSHv2 Message

  Each packet is a stream of bytes that encode a combinatiuon of strings, integers, booleans
  and multipoint integers.

  This class builds or breaks down a bytes stream with the implemented functions

*/

SSHyClient.Message = function(content) {
    this.position = 0;

    this.packet = content === undefined ? String() : String(content);
};

SSHyClient.Message.prototype = {
    toString: function() {
        return this.packet;
    },

    get_bytes: function(n) {
        var b = this.packet.substring(this.position, this.position + n);
        this.position += n;
        if (b.length < n && n < 1048576) { // n < 1Mb
            return b + new Array(n - b.length + 1).join('\x00');
        }
        return b;
    },

    get_int: function() {
        return struct.unpack('I', this.get_bytes(4))[0];
    },

    get_string: function() {
        return this.get_bytes(this.get_int());
    },

    get_mpint: function() {
        return inflate_long(this.get_string());
    },

    add_bytes: function(d) {
        this.packet += d;
        return this;
    },

    add_boolean: function(b) {
        this.add_bytes(b === true ? '\x01' : '\x00');
        return this;
    },

    add_int: function(i) {
        this.packet += struct.pack('I', i);
        return this;
    },

    add_mpint: function(d) {
        this.add_string(deflate_long(d));
        return this;
    },

    add_string: function(d) {
        this.add_int(d.length);
        this.packet += d;
        return this;
    }
};
