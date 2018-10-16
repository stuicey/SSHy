/*
  Implementation of SSHv2 Message

  Each packet is a stream of bytes that encode a combinatiuon of strings, integers, booleans
  and multipoint integers.

  This class builds or breaks down a bytes stream with the implemented functions

*/

import { BigInteger } from 'jsbn';
import { deflate_long, inflate_long } from './lib/utilities';
import * as struct from './lib/struct';

export class SSHyClientMessage {
    position: number;
    packet: string;

    constructor(content?: string) {
        this.position = 0;

        this.packet = content === undefined ? String() : String(content);
    };

    toString() {
        return this.packet;
    }

    get_bytes(n: number) {
        const b = this.packet.substring(this.position, this.position + n);
        this.position += n;
        if (b.length < n && n < 1048576) { // n < 1Mb
            return b + new Array(n - b.length + 1).join('\x00');
        }
        return b;
    }

    get_int() {
        return struct.unpack(this.get_bytes(4))[0];
    }

    get_string() {
        return this.get_bytes(this.get_int());
    }

    get_mpint(): BigInteger {
        return inflate_long(this.get_string());
    }

    add_bytes(d: string) {
        this.packet += d;
        return this;
    }

    add_boolean(b) {
        this.add_bytes(b === true ? '\x01' : '\x00');
        return this;
    }

    add_int(i) {
        this.packet += struct.pack(i);
        return this;
    }

    add_mpint(d) {
        this.add_string(deflate_long(d));
        return this;
    }

    add_string(d) {
        this.add_int(d.length);
        this.packet += d;
        return this;
    }
}
