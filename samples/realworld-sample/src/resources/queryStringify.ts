/*

TODO - TODO: replace with https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams

The MIT License (MIT)

Copyright (c) 2015 Unshift.io, Arnout Kazemier,  the Contributors.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/*
Source:https://github.com/unshiftio/querystringify
Its so small and useful I decided to include it
renamed a few parts and added types
TODO: replace with https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams ?
*/

const has = Object.prototype.hasOwnProperty;

/**
 * Decode a URI encoded string.
 *
 * @param {String} input The URI encoded string.
 * @returns {String} The decoded string.
 * @api private
 */
function decode(input: string) {
    return decodeURIComponent(input.replace(/\+/g, ' '));
}

/**
 * Simple query string parser.
 *
 * @param {String} query The query string that needs to be parsed.
 * @returns {Object}
 * @api public
 */
export function urlQueryParse(query: string): Object {
    const parser = /([^=?&]+)=?([^&]*)/g;
    const result = {};
    let part: any;

    //
    // Little nifty parsing hack, leverage the fact that RegExp.exec increments
    // the lastIndex property so we can continue executing this loop until we've
    // parsed all results.
    //

    // @ts-ignore
    // tslint:disable-next-line:curly
    for (; (part = parser.exec(query)); result[decode(part[1])] = decode(part[2]));

    return result;
}

/**
 * Transform a query string to an object.
 *
 * @param {Object} obj Object that should be transformed.
 * @param {String} prefix Optional prefix.
 * @returns {String}
 * @api public
 */
export function urlqueryStringify(obj: Object, prefix?: string) {
    prefix = prefix || '';

    const pairs = [];

    //
    // Optionally prefix with a '?' if needed
    //
    if ('string' !== typeof prefix) {
        prefix = '?';
    }

    for (const key in obj) {
        if (has.call(obj, key)) {
            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
        }
    }

    return pairs.length ? prefix + pairs.join('&') : '';
}
