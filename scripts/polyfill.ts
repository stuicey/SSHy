// Test IE 11
if (window.msCrypto) {
    // Redirect window.crypto.getRandomValues() -> window.msCrypto.getRandomValues()
    window.crypto = {};
    window.crypto.getRandomValues = window.msCrypto.getRandomValues;

    // PolyFill Uint8Array.slice() for IE 11 for sjcl AES
    if (!Uint8Array.prototype.slice) {
        Object.defineProperty(Uint8Array.prototype, 'slice', {
            value: Array.prototype.slice
        });
    }
}
