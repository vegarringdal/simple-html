import { parseUrlPattern } from './parseUrlPattern';
import { getVariables } from './getVariables';

export const getRouteParams = function (hash: string, locationhash = window.location.hash) {
    const pattern = parseUrlPattern(hash);
    return getVariables(pattern, locationhash);
};
