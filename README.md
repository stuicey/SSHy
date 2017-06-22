# SSH: HTML5 Based SSH Client

SSHy is a HTML5 SSHv2 web client implementing E2E encryption that runs well on modern web browsers.

## About

SSHy is a fast and responsive SSHv2 web client with end-to-end encryption supplied by [SJCL](https://github.com/bitwiseshiftleft/sjcl). The terminal front-end interface is provided by [xterm.js](https://github.com/sourcelair/xterm.js/).

## Installation

Either copy or clone the repository into a directory being currently served by a web server and navigate to `index.html`.

The required files are:
```
css/*
fonts/*
js/*
index.html
```

For best performance it is recommended to host a websocket proxy close to the traffic origin or destination. This can be done by modifying `wsproxyURL` near the top of `index.html` to the IP or domain of a personal websocket proxy.

This project is intended to be used with [wsProxy](http://github.com/stuicey/wsproxy) provided as a submodule in `wsproxy/`. More details on this application an be obtained from the related README.

```
cd wsproxy  
npm install wsproxy -g
wsproxy
```

## Compatability

SSHy is compatable with any SSHv2 server that has the following algorithms enabled:
```
diffie-hellman-group-exchange, diffie-hellman-group14, diffie-hellman-group1
ssh-rsa
aes128-ctr
hmac
```
Both SHA1 and SHA256 are supported for diffie-hellman and hamc algorithms.
