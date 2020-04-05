import { pathPatternType } from './pathPatternType';
import { PATH_ARGUMENT_REGEX } from './PATH_ARGUMENT_REGEX';
import { PATH_SLASH_REGEX } from './PATH_SLASH_REGEX';
import { getVariableName } from './getVariableName';
import { isVariable } from './isVariable';

export function parseUrlPattern(urlPattern: string) {
    const paths = urlPattern.split('/');
    const pathsConfig: pathPatternType[] = [];
    paths.forEach((path, index) => {
        if (
            index === paths.length - 1 &&
            path === '' &&
            urlPattern[urlPattern.length - 1] === PATH_SLASH_REGEX
        ) {
        } else {
            pathsConfig.push({
                staticType: !isVariable(path),
                variable: isVariable(path) ? getVariableName(path) : null,
                regex: isVariable(path) ? PATH_ARGUMENT_REGEX : path
            });
        }
    });
    return pathsConfig;
}
