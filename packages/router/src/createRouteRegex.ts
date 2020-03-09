import { pathPatternType } from "./pathPatternType";
import { PATH_SLASH_REGEX } from "./PATH_SLASH_REGEX";

export function createRouteRegex(pathPattern: pathPatternType[], openEnd: boolean) {
    let regex = '';
    pathPattern.forEach((pattern, index) => {
        if ((pathPattern.length > 1 && index === 0) || pathPattern.length === 1) {
            regex = '^' + pattern.regex;
        }
        else {
            if (pattern.regex === PATH_SLASH_REGEX) {
                regex = regex + pattern.regex;
            }
            else {
                regex = regex + PATH_SLASH_REGEX + pattern.regex;
            }
        }
        if (!openEnd && pathPattern.length - 1 === index) {
            regex = regex + '($|/$)';
        }
    });
    return regex;
}
