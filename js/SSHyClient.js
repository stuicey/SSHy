var ws, transport, term = null

// Since firefox renders at a different resolution to the rest we can identify it and apply special rules
var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

var termCols = Math.floor(window.innerWidth / 10) - (isFirefox ? -2 : 0)
var	termRows = Math.floor(window.innerHeight / 19) - (isFirefox ? 1 : -2)

var termUsername = ''
var termPassword = ''

window.onload = function() {
	setColorScheme(colorScheme_ashes)
	startSSHy()
};

// Run every time the webpage is resized
window.onresize = function resize() {
	// recalculate the termCols and rows
	termCols = Math.floor(window.innerWidth / 10) - (isFirefox ? -2 : 0)
	termRows = Math.floor(window.innerHeight / 19) - (isFirefox ? 1 : -2)

	if (ws && transport) {
		term.resize(termCols, termRows)
		transport.auth.resize_pty(termCols, termRows)
	}
}

// Starts the SSH client in scripts/transport.js
function startSSHy() {
	// Opens the websocket!
	ws = new WebSocket(wsproxyURL, 'base64')

	// Sets up websocket listeners
	ws.onopen = function(e) {
		transport = new SSHyClient.Transport(ws)
	}

	ws.onmessage = function(e) {
		transport.handle(atob(e.data))
	}
}

function startxtermjs() {
	// Define the terminal rows/cols
	term = new Terminal({
		cols: termCols,
		rows: termRows
	})
	// start xterm.js
	term.open(document.getElementById('terminal'), true)

	// sets up some listeners for the terminal (keydown, paste)
	term.textarea.onkeydown = function(e) {
		if (!ws || !transport) { // check for websocket..
			return
		}

		// So we don't spam single control characters
		if (e.key.length > 1 && (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) {
			return
		}
		var command = {
			key: null
		}

		// Decides if the keypress is an alphanumeric character or needs escaping
		if (e.key.length == 1 && !(e.altKey || e.ctrlKey || e.metaKey)) {
			command.key = e.key
		} else if(e.key.length == 1 && (e.shiftKey && e.ctrlKey)){
			// allows ctrl + shift + v for pasting
			if(e.key != 'V'){
				e.preventDefault()
			}
		} else {
			//xtermjs is kind enough to evaluate our special characters instead of having to translate every char ourself
			command = term.evaluateKeyEscapeSequence(e)
		}

		return command.key == null ? null : transport.expect_key(command.key)
	}

	//TODO: Find work around for firefox
	term.textarea.onpaste = function(ev) {
		if (ev.clipboardData) {
			var text = ev.clipboardData.getData('text/plain');

			transport.expect_key(text)
		}
	}
}
