# SSH: HTML5 Based SSH Client

SSHy is a HTML5 SSHv2 web client implementing E2E encryption that runs well on modern web browsers.

## About

SSHy is a fast and responsive SSHv2 web client with end-to-end encryption supplied by [SJCL](https://github.com/bitwiseshiftleft/sjcl). SSHy implements a minimal subset of the SSHv2 protocol that provides and controls a pseudo-terminal. The terminal front-end interface is provided by [xterm.js](https://github.com/sourcelair/xterm.js/). Currently in use at http://SSHy.us & https://linuxzoo.net.

![](https://user-images.githubusercontent.com/6617743/28020547-bdf22000-657c-11e7-9de3-eb3281bd7379.png)
![](https://user-images.githubusercontent.com/6617743/28020557-c342c0f0-657c-11e7-8f54-8216e9485b24.png)
## Features

* 8 Preset color schemes & Xresources upload and import
* UTF-8 Character support
* Automatic local echo detection
* Customisable terminal & font size
* Copy and Paste support for Chrome & Firefox
* Network Traffic Monitor

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

This project is intended to be used with [wsProxy](http://github.com/stuicey/wsproxy) provided as a submodule in `wsproxy/`. More details on this application an be obtained from the related [README](https://github.com/stuicey/wsProxy/blob/master/README.md).

```
git submodule update --init --recursive
npm i -g  wsproxy/
wsproxy
```

## Compatability

SSHy was designed to be compatable with a majority of SSHv2 servers. SSHy should be able to connect to any standardly configured SSHv2 server that has the following algorithms enabled:
```
diffie-hellman-group-exchange, diffie-hellman-group14, diffie-hellman-group1
ssh-rsa
aes128-ctr
hmac
```
Both SHA1 and SHA256 are supported for diffie-hellman and hamc algorithms.
