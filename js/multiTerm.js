// stores a reference of terminal windows -> divs
var terms = []

// Glue object for termDivs , xtermjs and websockets
termObj = function (termDiv, xtermRef, websocketRef, termWidth, termHeight){
	this.termDiv = termDiv
	this.xtermRef = xtermRef
	this.websocketRef = websocketRef
	this.termWidth = termWidth
	this.termHeight = termHeight
}

function spawnTerminalDiv(){
	if(terms.length >= 4){
		return console.log("Only 4 terminals are permitted.")
	}
	if(!terms.length){
		var div = document.createElement('div')
		document.body.appendChild(div)
		div.style.display = 'inline-block'
		div.style.background = '#333'
		div.style.width = '100%'
		div.style.height = '98%'
		div.style.position = 'absolute'
		div.style.top = '2%'
		div.id = 'term' + terms.length
	} else {
		var origional = terms[terms.length-1]
		var div = origional.cloneNode(true); // "deep" clone
		div.id = 'term' + terms.length;
		document.body.appendChild(div);
	}

	addTerminalWindow(div)
}

function addTerminalWindow(termWindow){
	if(terms.push(termWindow) && terms.length <= 1 ) {
		return
	}

	// 0 = horizontal split, 1 = vertical split
	var split = terms.length % 2
	if(!split){
		var mov = Math.ceil(parseInt(terms[terms.length - 1].style.width) / 2) - 1
		terms[terms.length - 2].style.width = mov + '%'
		terms[terms.length - 1].style.width = mov + '%'
		if(terms.length <= 2) {
			terms[terms.length - 1].style.marginLeft = '0%'
			terms[terms.length - 1].style.width = '49%'
		}
		terms[terms.length - 1].style.marginLeft = Math.ceil(parseInt(terms[terms.length - 1].style.marginLeft)) + mov + 1 + '%'
	} else {
		var mov = Math.ceil(parseInt(terms[terms.length - 1].style.height) / 2) - 1
		terms[terms.length - 2].style.height = mov + '%'
		terms[terms.length - 1].style.height = mov + '%'
		if(terms.length <= 3){
			terms[terms.length - 1].style.top = '2%'
		}
		terms[terms.length - 1].style.top = Math.ceil(parseInt(terms[terms.length - 1].style.top)) + mov + 2 + '%'
	}
}

function deleteTerminalWindow(index){
	terms.splice(index, 1)
	document.body.removeChild(document.getElementById('term'+index))
	fixTerminalWindows()
}

function fixTerminalWindows(){
	var termsBackup = terms
	terms = []

	for(var i = 0; i < termsBackup.length; i++){
		termsBackup[i].style.width = i == 2 ? '49%' : '100%'
		termsBackup[i].style.height = '98%'
		termsBackup[i].style.marginLeft = i == 2? '50%' : '0%'
		termsBackup[i].style.top = '0%'

		addTerminalWindow(termsBackup[i])
	}
}

var windowInnerWidth = window.innerWidth / 10 - 4
var windowInnerHeight = window.innerHeight / 19 - 1

// Run every time the webpage is resized
window.onresize = function resize() {
	// recalculate the term_cols and rows
	windowInnerWidth = window.innerWidth / 10 - 4
	windowInnerHeight = window.innerHeight / 19 - 1

	// TODO: Setup pty resizing
	/*
	for(var i = 0; i < terms.length; i++){
		var size = getTermSize(terms[i])
		term.resize(size[0], size[1])
		transport.auth.resize_pty(term_cols, term_rows)
	}
	*/
}

function getTermSize(term){
	// get width / height as a decimal
	var width = parseInt(term.style.width) / 100
	var height = parseInt(term.style.height) / 100
	// multiply width/height by total number of row / col
	width = Math.floor( windowInnerWidth* width)
	height = Math.floor( windowInnerHeight* height)

	console.log(width + ' x ' + height)
	return [width, height]
}
