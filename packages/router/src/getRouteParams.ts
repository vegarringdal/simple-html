import { parseUrlPattern } from './parseUrlPattern';
import { getVariables } from './getVariables';

export const getRouteParams = function (
    hash: string,
    locationhash = window.location.hash
): { _paths: string[]; _query?: any } | any {
    const pattern = parseUrlPattern(hash);
    return getVariables(pattern, locationhash);
};
