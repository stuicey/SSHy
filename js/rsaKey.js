SSHyClient.RSAKey = function(msg){
	msg.get_string();
	this.e = msg.get_mpint();
	this.n = msg.get_mpint();
};

SSHyClient.RSAKey.prototype = {
	/*	Turn a 20-byte SHA1 hash into a blob of data as large as the key's N,
		using PKCS1's \"emsa-pkcs1-v1_5\" encoding.	*/
	pkcs1imify : function(data) {
		var SHA1_DIGESTINFO = '\x30\x21\x30\x09\x06\x05\x2b\x0e\x03\x02\x1a\x05\x00\x04\x14';
		var filler = new Array(deflate_long(this.n, 0).length - SHA1_DIGESTINFO.length - data.length - 3 + 1).join('\xff');
		return '\x00\x01' + filler + '\x00' + SHA1_DIGESTINFO + data;
	},
	/* 	Compares data (hash H) with the SSH server's signature
		returns true if match, false otherwise.*/
	verify : function(data, SSHsig) {
		if (SSHsig.get_string() != 'ssh-rsa') {
			return false;
		}
		var sigData = inflate_long(SSHsig.get_string(), true);
		var hashObj = inflate_long(this.pkcs1imify(new SSHyClient.hash.SHA1(data).digest()), true);

	 	return sigData.modPow(this.e, this.n).equals(hashObj);
	},
};
