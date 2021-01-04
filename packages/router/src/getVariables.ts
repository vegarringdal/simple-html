import { pathPatternType } from './pathPatternType';
import { getUrlVars } from './getUrlVars';

export function getVariables(pathPattern: pathPatternType[], pattern: string) {
    // split away the query params if any
    const paths = pattern.split('?')[0].split('/');
    const args: { _paths: string[]; _query?: any } = {
        _paths: []
    };
    paths.forEach((path, i) => {
        if (pathPattern[i] && pathPattern[i].variable) {
            args[pathPattern[i].variable] = path;
        }
        if (i >= pathPattern.length - 1) {
            args._paths.push(path);
        }
    });
    args._query = getUrlVars(pattern);
    return args;
}
