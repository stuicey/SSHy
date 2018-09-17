export const pack = (n: number): string => {
    let result = '';
    result += String.fromCharCode(n >>> 24 & 0xff);
    result += String.fromCharCode(n >>> 16 & 0xff);
    result += String.fromCharCode(n >>> 8 & 0xff);
    result += String.fromCharCode(n & 0xff);
    return result;
};

export const unpack = (str: string): number[] => {
    const result = [];
    let t = 0;
    t += str.charCodeAt(0) << 24 >>> 0;
    t += str.charCodeAt(1) << 16 >>> 0;
    t += str.charCodeAt(2) << 8 >>> 0;
    t += str.charCodeAt(3) << 0 >>> 0;
    result.push(t);
    return result;
};
