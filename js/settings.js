SSHyClient.settings = function() {
    // Local echo reduces latency on regular key presses to aruond 0.04s compared to ~0.2s without it
    this.localEcho = 1; // 0 - off; 1 - auto; 2 - on
	this.fsHintEnter = fromByteArray([27, 91, 63, 49]);
	this.fsHintLeave = fromByteArray([27, 91, 51, 50]);
	this.autoEchoState = 1;		// 0 = no echoing ; 1 = echoing
	this.autoEchoTimeout = 0;

    this.blockedKeys = [':'];

	this.keepAliveInterval = undefined;

	this.fontSize = 16;
};

SSHyClient.settings.prototype = {
    // Parses a given message (r) for signs to enable or disable local echo
    parseLocalEcho: function(r) {
		if(this.localEcho === 1 && (performance.now() - this.autoEchoTimeout) > 100){
			if(!this.autoEchoState){
				// Search for '@' aswell so we catch on 'user@hostname' aswell
				if(r.indexOf(this.fsHintLeave) != -1 && r.indexOf('@') != -1 ){
					this.autoEchoState = 1;
					this.autoEchoTimeout = performance.now();
				}
			} else {
				if(r.indexOf(this.fsHintEnter) != -1){
					this.autoEchoState = 0;
					this.autoEchoTimeout = performance.now();
				}
			}
		}
		return;
    },
    // Parses a keydown event to determine if we can safely echo the key.
    parseKey: function(e) {
		// Don't continue to write the key if auto echoing is disabled
		if(this.localEcho === 1 && this.autoEchoState === 0){
			return;
		}
        if (e.key.length > 1 || this.blockedKeys.includes(e.key) || (e.altKey || e.ctrlKey || e.metaKey)) {
            return;
        }
		// Incase someone is typing very fast; to perserve servers formatting.
		if(!transport.lastKey){
			term.write(e.key);
		}
        transport.lastKey += e.key;
    },

	setKeepAlive: function(time) {
		time = time === undefined ? 0 : time * 1000;
		if(time === 0 || this.keepAliveInterval !== undefined){
			clearInterval(this.keepAliveInterval);
			this.keepAliveInterval = undefined;
			if(time){
				this.keepAliveInterval = setInterval(transport.keepAlive, time);
			}
		} else {
			this.keepAliveInterval = setInterval(transport.keepAlive, time);
		}
	}
};
