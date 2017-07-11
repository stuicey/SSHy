SSHyClient.hash = {};

SSHyClient.hash.SHA1 = function(a) {
    this.data = a || "";
    this.digest_size = 20
};
SSHyClient.hash.SHA1.prototype = {
    digest: function() {
        var a = toByteArray(this.data),
            h = bytesToWords(a),
            f = 8 * a.length,
            a = [],
            g = 1732584193,
            c = -271733879,
            d = -1732584194,
            e = 271733878,
            k = -1009589776;
        h[f >> 5] |= 128 << 24 - f % 32;
        h[(f + 64 >>> 9 << 4) + 15] = f;
        for (f = 0; f < h.length; f += 16) {
            for (var m = g, n = c, p = d, q = e, r = k, b = 0; 80 > b; b++) {
                if (16 > b) a[b] = h[f + b];
                else {
                    var l = a[b - 3] ^ a[b - 8] ^ a[b - 14] ^ a[b - 16];
                    a[b] = l << 1 | l >>> 31
                }
                l = (g << 5 | g >>> 27) + k + (a[b] >>> 0) + (20 > b ? (c & d | ~c & e) + 1518500249 : 40 > b ? (c ^ d ^ e) + 1859775393 : 60 > b ? (c & d | c & e | d & e) - 1894007588 : (c ^ d ^ e) - 899497514);
                k = e;
                e = d;
                d = c << 30 | c >>> 2;
                c = g;
                g = l
            }
            g += m;
            c += n;
            d += p;
            e += q;
            k += r
        }
        return fromByteArray(wordsToBytes([g, c, d, e, k]))
    }
};

SSHyClient.hash.SHA256 = function(a) {
	this.data = a || ""
	this.digest_size = 32
}
SSHyClient.hash.SHA256.prototype = {
    digest: function() {
      var hashData = toByteArray(this.data);

      // Constants
      var K = [ 0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
          0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
          0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
          0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
          0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
          0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
          0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
          0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
          0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
          0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
          0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
          0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
          0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
          0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
          0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
          0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2 ];

      var m = bytesToWords(hashData),
          l = hashData.length * 8,
          H = [ 0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
                0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19 ],
          w = [],
          a, b, c, d, e, f, g, h, i, j,
          t1, t2;

      // Padding
      m[l >> 5] |= 0x80 << (24 - l % 32);
      m[((l + 64 >> 9) << 4) + 15] = l;

      for (var i = 0; i < m.length; i += 16) {
        a = H[0];
        b = H[1];
        c = H[2];
        d = H[3];
        e = H[4];
        f = H[5];
        g = H[6];
        h = H[7];

        for (var j = 0; j < 64; j++) {
          if (j < 16) {
            w[j] = m[j + i];
          } else {
            var gamma0x = w[j - 15],
                gamma1x = w[j - 2],
                gamma0  = ((gamma0x << 25) | (gamma0x >>>  7)) ^
                          ((gamma0x << 14) | (gamma0x >>> 18)) ^
                           (gamma0x >>> 3),
                gamma1  = ((gamma1x <<  15) | (gamma1x >>> 17)) ^
                          ((gamma1x <<  13) | (gamma1x >>> 19)) ^
                           (gamma1x >>> 10);

            w[j] = gamma0 + (w[j - 7] >>> 0) +
                   gamma1 + (w[j - 16] >>> 0);
          }

          var ch  = e & f ^ ~e & g,
              maj = a & b ^ a & c ^ b & c,
              sigma0 = ((a << 30) | (a >>>  2)) ^
                       ((a << 19) | (a >>> 13)) ^
                       ((a << 10) | (a >>> 22)),
              sigma1 = ((e << 26) | (e >>>  6)) ^
                       ((e << 21) | (e >>> 11)) ^
                       ((e <<  7) | (e >>> 25));

          t1 = (h >>> 0) + sigma1 + ch + (K[j]) + (w[j] >>> 0);
          t2 = sigma0 + maj;

          h = g;
          g = f;
          f = e;
          e = (d + t1) >>> 0;
          d = c;
          c = b;
          b = a;
          a = (t1 + t2) >>> 0;
        }

        H[0] += a;
        H[1] += b;
        H[2] += c;
        H[3] += d;
        H[4] += e;
        H[5] += f;
        H[6] += g;
        H[7] += h;
      }

      return fromByteArray(wordsToBytes(H));
    }
  }

SSHyClient.hash.HMAC = function(a, g, SHAVersion) {
	var b = digestmod = SHAVersion == 'SHA-1' ? SSHyClient.hash.SHA1 : SSHyClient.hash.SHA256,
		d = new b,
		e = new b;
	64 < a.length && (a = (new b(a)).digest());
	a += Array(64 - a.length + 1).join("\x00");
	for (var b = toByteArray(a).slice(0), f = toByteArray(a).slice(0), c = 0; 64 > c; ++c) b[c] ^= 92, f[c] ^= 54;
	d.data += fromByteArray(b)
	e.data += fromByteArray(f);
	e.data += g;
	d.data += e.digest();
	return d.digest()
};

SSHyClient.hash.MD5 = function(data){
	var hashData = toByteArray(data);

	var m = bytesToWords(hashData),
		l = hashData.length * 8,
		a =  1732584193,
		b = -271733879,
		c = -1732584194,
		d =  271733878;

	// Swap endian
	for (var i = 0; i < m.length; i++) {
		m[i] = ((m[i] <<  8) | (m[i] >>> 24)) & 0x00FF00FF |
			   ((m[i] << 24) | (m[i] >>>  8)) & 0xFF00FF00;
	}

	// Padding
	m[l >>> 5] |= 0x80 << (l % 32);
	m[(((l + 64) >>> 9) << 4) + 14] = l;

	// Method shortcuts
	var FF = function (a, b, c, d, x, s, t) {
	  var n = a + (b & c | ~b & d) + (x >>> 0) + t;
	  return ((n << s) | (n >>> (32 - s))) + b;
	};
	var GG = function (a, b, c, d, x, s, t) {
	  var n = a + (b & d | c & ~d) + (x >>> 0) + t;
	  return ((n << s) | (n >>> (32 - s))) + b;
	};
	var HH = function (a, b, c, d, x, s, t) {
	  var n = a + (b ^ c ^ d) + (x >>> 0) + t;
	  return ((n << s) | (n >>> (32 - s))) + b;
	};
	var II = function (a, b, c, d, x, s, t) {
	  var n = a + (c ^ (b | ~d)) + (x >>> 0) + t;
	  return ((n << s) | (n >>> (32 - s))) + b;
	};

	for (var i = 0; i < m.length; i += 16) {
	  var aa = a,
		  bb = b,
		  cc = c,
		  dd = d;

	  a = FF(a, b, c, d, m[i+ 0],  7, -680876936);
	  d = FF(d, a, b, c, m[i+ 1], 12, -389564586);
	  c = FF(c, d, a, b, m[i+ 2], 17,  606105819);
	  b = FF(b, c, d, a, m[i+ 3], 22, -1044525330);
	  a = FF(a, b, c, d, m[i+ 4],  7, -176418897);
	  d = FF(d, a, b, c, m[i+ 5], 12,  1200080426);
	  c = FF(c, d, a, b, m[i+ 6], 17, -1473231341);
	  b = FF(b, c, d, a, m[i+ 7], 22, -45705983);
	  a = FF(a, b, c, d, m[i+ 8],  7,  1770035416);
	  d = FF(d, a, b, c, m[i+ 9], 12, -1958414417);
	  c = FF(c, d, a, b, m[i+10], 17, -42063);
	  b = FF(b, c, d, a, m[i+11], 22, -1990404162);
	  a = FF(a, b, c, d, m[i+12],  7,  1804603682);
	  d = FF(d, a, b, c, m[i+13], 12, -40341101);
	  c = FF(c, d, a, b, m[i+14], 17, -1502002290);
	  b = FF(b, c, d, a, m[i+15], 22,  1236535329);

	  a = GG(a, b, c, d, m[i+ 1],  5, -165796510);
	  d = GG(d, a, b, c, m[i+ 6],  9, -1069501632);
	  c = GG(c, d, a, b, m[i+11], 14,  643717713);
	  b = GG(b, c, d, a, m[i+ 0], 20, -373897302);
	  a = GG(a, b, c, d, m[i+ 5],  5, -701558691);
	  d = GG(d, a, b, c, m[i+10],  9,  38016083);
	  c = GG(c, d, a, b, m[i+15], 14, -660478335);
	  b = GG(b, c, d, a, m[i+ 4], 20, -405537848);
	  a = GG(a, b, c, d, m[i+ 9],  5,  568446438);
	  d = GG(d, a, b, c, m[i+14],  9, -1019803690);
	  c = GG(c, d, a, b, m[i+ 3], 14, -187363961);
	  b = GG(b, c, d, a, m[i+ 8], 20,  1163531501);
	  a = GG(a, b, c, d, m[i+13],  5, -1444681467);
	  d = GG(d, a, b, c, m[i+ 2],  9, -51403784);
	  c = GG(c, d, a, b, m[i+ 7], 14,  1735328473);
	  b = GG(b, c, d, a, m[i+12], 20, -1926607734);

	  a = HH(a, b, c, d, m[i+ 5],  4, -378558);
	  d = HH(d, a, b, c, m[i+ 8], 11, -2022574463);
	  c = HH(c, d, a, b, m[i+11], 16,  1839030562);
	  b = HH(b, c, d, a, m[i+14], 23, -35309556);
	  a = HH(a, b, c, d, m[i+ 1],  4, -1530992060);
	  d = HH(d, a, b, c, m[i+ 4], 11,  1272893353);
	  c = HH(c, d, a, b, m[i+ 7], 16, -155497632);
	  b = HH(b, c, d, a, m[i+10], 23, -1094730640);
	  a = HH(a, b, c, d, m[i+13],  4,  681279174);
	  d = HH(d, a, b, c, m[i+ 0], 11, -358537222);
	  c = HH(c, d, a, b, m[i+ 3], 16, -722521979);
	  b = HH(b, c, d, a, m[i+ 6], 23,  76029189);
	  a = HH(a, b, c, d, m[i+ 9],  4, -640364487);
	  d = HH(d, a, b, c, m[i+12], 11, -421815835);
	  c = HH(c, d, a, b, m[i+15], 16,  530742520);
	  b = HH(b, c, d, a, m[i+ 2], 23, -995338651);

	  a = II(a, b, c, d, m[i+ 0],  6, -198630844);
	  d = II(d, a, b, c, m[i+ 7], 10,  1126891415);
	  c = II(c, d, a, b, m[i+14], 15, -1416354905);
	  b = II(b, c, d, a, m[i+ 5], 21, -57434055);
	  a = II(a, b, c, d, m[i+12],  6,  1700485571);
	  d = II(d, a, b, c, m[i+ 3], 10, -1894986606);
	  c = II(c, d, a, b, m[i+10], 15, -1051523);
	  b = II(b, c, d, a, m[i+ 1], 21, -2054922799);
	  a = II(a, b, c, d, m[i+ 8],  6,  1873313359);
	  d = II(d, a, b, c, m[i+15], 10, -30611744);
	  c = II(c, d, a, b, m[i+ 6], 15, -1560198380);
	  b = II(b, c, d, a, m[i+13], 21,  1309151649);
	  a = II(a, b, c, d, m[i+ 4],  6, -145523070);
	  d = II(d, a, b, c, m[i+11], 10, -1120210379);
	  c = II(c, d, a, b, m[i+ 2], 15,  718787259);
	  b = II(b, c, d, a, m[i+ 9], 21, -343485551);

	  a = (a + aa) >>> 0;
	  b = (b + bb) >>> 0;
	  c = (c + cc) >>> 0;
	  d = (d + dd) >>> 0;
	}

	var rotl = function (n, b) {
	  return (n << b) | (n >>> (32 - b));
	};

	var endian = function (n) {
	  // If number given, swap endian
	  if (n.constructor == Number) {
		return rotl(n,  8) & 0x00FF00FF |
			   rotl(n, 24) & 0xFF00FF00;
	  }

	  // Else, assume array and swap all items
	  for (var i = 0; i < n.length; i++) {
		n[i] = endian(n[i]);
	  }
	  return n;
	};

	return fromByteArray(wordsToBytes(endian([a, b, c, d])));
};
