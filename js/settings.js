SSHyClient.settings = function(){
	// Local echo reduces latency on regular key presses to aruond 0.04s compared to ~0.2s without it
	this.localEcho = 0			// 0 - off; 1 - on; 3 - auto

	this.blockedKeys = [':']
}

SSHyClient.settings.prototype = {
	// Parses a given message (r) for signs to enable or disable local echo
	parseLocalEcho: function(r){

	},
	// Parses a keydown event to determine if we can safely echo the key.
	parseKey: function(e){
		if(e.key.length > 1 || this.blockedKeys.includes(e.key)){
			return
		}
		transport.lastKey = e.key
		term.write(e.key)
	}
}
