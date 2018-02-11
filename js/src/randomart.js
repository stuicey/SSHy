/*
	Slightly modified version of [randomart](https://github.com/purpliminal/randomart)
	to run in web browsers based on SSH RSA keys
*/

var symbols = {
    "-2": "E",
    "-1": "S",
    "0": " ",
    "1": ".",
    "2": "o",
    "3": "+",
    "4": "=",
    "5": "*",
    "6": "B",
    "7": "O",
    "8": "X",
    "9": "@",
    "10": "%",
    "11": "&",
    "12": "#",
    "13": "/",
    "14": "^"
};

var bounds = {
    width: 17,
    height: 9
};

function createBoard(bounds) {
    var result = [];

    for (var i = 0; i < bounds.width; i++) {
        result[i] = [];
        for (var j = 0; j < bounds.height; j++) {
            result[i][j] = 0;
        }
    }
    return result;
}

function generateBoard(data) {
    var board = createBoard(bounds);

    var x = Math.floor(bounds.width / 2);
    var y = Math.floor(bounds.height / 2);

    board[x][y] = -1;

    data.forEach(
        function(b) {
            for (var s = 0; s < 8; s += 2) {
                var d = (b >> s) & 3;

                switch (d) {
                    case 0: // up
                    case 1:
                        if (y > 0) y--;
                        break;
                    case 2: // down
                    case 3:
                        if (y < (bounds.height - 1)) y++;
                        break;
                }
                switch (d) {
                    case 0: // left
                    case 2:
                        if (x > 0) x--;
                        break;
                    case 1: // right
                    case 3:
                        if (x < (bounds.width - 1)) x++;
                        break;
                }

                if (board[x][y] >= 0) board[x][y]++;
            }
        }
    );

    board[x][y] = -2;
    return board;
}

function boardToString(board) {
    result = [];

    for (var i = 0; i < bounds.height; i++) {
        result[i] = [];
        for (var j = 0; j < bounds.width; j++) {
            result[i][j] = symbols[board[j][i]] || symbols[0];
        }
        // Add | to start and end of result[i]
        result[i] = '|' + result[i].join('') + '|';
    }
    result.splice(0, 0, '\n+---[ RSA2048 ]---+');
    result.push('+-----------------+');
    return result.join('\n');
}

function randomart(data) {
	var buffer = [];
	for(var i = 0, length = data.length; i < length; i++){
		buffer.push('0x' + data[i]);
	}
	// Write the board to HTML
	document.getElementById('hostKeyImg').innerHTML = boardToString(generateBoard(buffer));
    return;
}
