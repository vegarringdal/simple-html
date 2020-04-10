import { parseUrlPattern } from './parseUrlPattern';
import { createRouteRegex } from './createRouteRegex';

export const routeMatch = function (hash = '', locationhash = window.location.hash) {
    if (!hash && (locationhash === '' || locationhash === '#')) {
        return true;
    }

    if (locationhash.indexOf('?') !== -1) {
        locationhash = locationhash.split('?')[0];
    }

    let openEnd = false;
    if (hash[hash.length - 1] === '*') {
        hash = hash.substring(0, hash.length - 1);
        openEnd = true;
    }
    const pattern = parseUrlPattern(hash);
    const regexString = createRouteRegex(pattern, openEnd);
    const regex = new RegExp(regexString);
    return regex.test(locationhash);
};
