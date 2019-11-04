const PATH_ARGUMENT_REGEX = '[a-zA-Z0-9\\_\\-\\:]+';
const PATH_SLASH_REGEX = '\\/';

const isVariable = (path: string): boolean => {
    if (path && typeof path === 'string' && path[0] === ':') {
        if (path.split(':').length > 2) {
            console.error(`route argument contains illigal string: ${path}, please fix`);
        }
        return true;
    } else {
        return false;
    }
};

const getVariableName = (path: string) => {
    return path.substring(1, path.length);
};

type pathPattern = { staticType: boolean; variable: string | null; regex: string };

export const parsePattern = (pattern: string) => {
    const paths = pattern.split('/');
    const pathsConfig: pathPattern[] = [];
    paths.forEach((path, index) => {
        if (
            index === paths.length - 1 &&
            path === '' &&
            pattern[pattern.length - 1] === PATH_SLASH_REGEX
        ) {
            /* pathsConfig.push({
                staticType: false,
                variable: null,
                regex: PATH_SLASH_REGEX
            }); */
        } else {
            pathsConfig.push({
                staticType: !isVariable(path),
                variable: isVariable(path) ? getVariableName(path) : null,
                regex: isVariable(path) ? PATH_ARGUMENT_REGEX : path
            });
        }
    });
    return pathsConfig;
};
export const createRouteRegex = (pathPattern: pathPattern[], openEnd: boolean) => {
    let regex = '';
    pathPattern.forEach((pattern, index) => {
        if ((pathPattern.length > 1 && index === 0) || pathPattern.length === 1) {
            regex = '^' + pattern.regex;
        } else {
            if (pattern.regex === PATH_SLASH_REGEX) {
                regex = regex + pattern.regex;
            } else {
                regex = regex + PATH_SLASH_REGEX + pattern.regex;
            }
        }

        if (!openEnd && pathPattern.length - 1 === index) {
            regex = regex + '($|/$)';
        }
    });
    return regex;
};

export const getVariables = (pathPattern: pathPattern[], pattern: string) => {
    const paths = pattern.split('/');
    const args: any = {};
    paths.forEach((path, i) => {
        if (pathPattern[i] && pathPattern[i].variable) {
            args[pathPattern[i].variable] = path;
        }
        if (i > pathPattern.length - 1) {
            if (!args._paths) {
                args._paths = [];
            }
            args._paths.push(path);
        }
    });

    return args;
};

let loggerStatus = false;

export const logger = (...message: any) => {
    if (loggerStatus) {
        console.log('[simple-router]', message);
    }
};

export const enableLogger = () => {
    loggerStatus = true;
};

export const disableLogger = () => {
    loggerStatus = false;
};
