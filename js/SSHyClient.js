var ws, transport, term = null

// Since firefox renders at a different resolution to the rest we can identify it and apply special rules
var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
var isWrapper = true

var termCols = Math.floor(window.innerWidth / 10) - (isFirefox ? -2 : 0)
var	termRows = Math.floor(window.innerHeight / 19) - (isFirefox ? 1 : -2)

var termUsername = ''
var termPassword

var failedAttempts = 0

window.onload = function() {
	setColorScheme(colorScheme_ashes)
	startSSHy()
};

// Run every time the webpage is resized
window.onresize = function resize() {
	// recalculate the termCols and rows
	termCols = Math.floor(window.innerWidth / 10) - (isFirefox ? -2 : 0)
	termRows = Math.floor(window.innerHeight / 19) - (isFirefox ? 1 : -1)

	if (ws && transport) {
		term.resize(termCols, termRows)
		transport.auth.resize_pty(termCols, termRows)
	}
}
// Called on unsuccessful SSH connection authentication
function auth_failure() {
	term.write("Access Denied\r\n")
	if(++failedAttempts >= 5){
		term.write("Too many failed authentication attempts")
		transport.disconnect()
		return
	}
	term.write(termUsername + '@' + wsproxyURL.split('/')[2].split(':')[0] + '\'s password:')
	termPassword = ''
   }

// Starts the SSH client in scripts/transport.js
function startSSHy() {
	// Initialise the window title
	document.title = "SSHy Client"
	// Opens the websocket!
	ws = new WebSocket(wsproxyURL, 'base64')

	// Sets up websocket listeners
	ws.onopen = function(e) {
		transport = new SSHyClient.Transport(ws)
	}

	ws.onmessage = function(e) {
		transport.handle(atob(e.data))
	}

	ws.onclose = function(e){
		// Check if term exists - if not then no SSH connection was made
		if(!term){
			termInit()
			term.write('WebSocket connection failed: Error in connection establishment: code ' + e.code)
		}
	}
}

function termInit() {
	// Define the terminal rows/cols
	term = new Terminal({
		cols: termCols,
		rows: termRows
	})
	// start xterm.js
	term.open(document.getElementById('terminal'), true)
}

function startxtermjs() {
	termInit()

	// if we haven't authenticated yet we're doing an interactive login
	if(!transport.auth.authenticated){
		term.write('Login as: ')
	}

	// sets up some listeners for the terminal (keydown, paste)
	term.textarea.onkeydown = function(e) {
		if (!ws || !transport || failedAttempts >= 5 || transport.auth.awaitingAuthentication) { // Sanity Checks
			return
		}

		// So we don't spam single control characters
		if (e.key.length > 1 && (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) && e.key != "Backspace") {
			return
		}

		if(!transport.auth.authenticated){
			// putty doesn't allow control characters during authentication
			if(e.altKey || e.ctrlKey || e.metaKey){
				return
			}

			switch(e.keyCode){
				case 8:	 // backspace
					if(termPassword == undefined){
						if(termUsername.length > 0){
							term.write('\b')
							term.eraseRight(term.x - 1, term.y)
							termUsername = termUsername.slice(0,termUsername.length - 1)
						}
					} else {
						termPassword = termPassword.slice(0,termPassword.length - 1)
					}

					break
				case 13: // enter
					if(termPassword == undefined){
						term.write("\n\r" + termUsername + '@' + wsproxyURL.split('/')[2].split(':')[0] + '\'s password:')
						termPassword = ''
					} else {
						term.write('\n\r')
						transport.auth.ssh_connection()
						return
					}
					break
				default:
					if(termPassword == undefined){
						termUsername += e.key
						term.write(e.key)
					} else {
						termPassword += e.key
					}
			}
			return
		}

		var command

		// Decides if the keypress is an alphanumeric character or needs escaping
		if (e.key.length == 1 && !(e.altKey || e.ctrlKey || e.metaKey)) {
			command = e.key
		} else if(e.key.length == 1 && (e.shiftKey && e.ctrlKey)){
			// allows ctrl + shift + v for pasting
			if(e.key != 'V'){
				e.preventDefault()
			}
		} else {
			//xtermjs is kind enough to evaluate our special characters instead of having to translate every char ourself
			command = term.evaluateKeyEscapeSequence(e).key
		}
		
		return command == null ? null : transport.expect_key(command)
	}

	//TODO: Find work around for firefox
	term.textarea.onpaste = function(ev) {
		if (ev.clipboardData) {
			var text = ev.clipboardData.getData('text/plain');

			transport.expect_key(text)
		}
	}
}
