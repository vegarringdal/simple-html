import { parseUrlPattern } from './parseUrlPattern';
import { createRouteRegex } from './createRouteRegex';
import { TemplateResult, directive } from 'lit-html';

const resolvePromise = directive(
    (promise: Promise<null>, htmlTemplate: TemplateResult) => (part: any) => {
        // This first setValue call is synchronous, so
        // doesn't need the commit
        part.setValue('Waiting for promise to resolve.');

        Promise.resolve(promise).then(() => {
            part.setValue(htmlTemplate);
            part.commit();
        });
    }
);

export const routeMatchAsync = function(
    hash = '',
    importStatement: Promise<any>,
    htmlTemplate: TemplateResult
) {
    if (routeMatch(hash)) {
        return resolvePromise(importStatement, htmlTemplate);
    } else {
        return '';
    }
};

export const routeMatch = function(hash = '', locationhash = window.location.hash) {
    if (!hash && (locationhash === '' || locationhash === '#')) {
        return true;
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
