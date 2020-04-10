import { TemplateResult, directive } from 'lit-html';
import { routeMatch } from './routeMatch';

export const resolvePromise = directive(
    (promise: Promise<null>, htmlTemplate: TemplateResult) => (part: any) => {
        Promise.resolve(promise).then(() => {
            part.setValue(htmlTemplate);
            part.commit();
        });
    }
);

export const routeMatchAsync = function (
    hash = '',
    importStatement: () => Promise<any>,
    htmlTemplate: TemplateResult
) {
    if (routeMatch(hash)) {
        return resolvePromise(importStatement(), htmlTemplate);
    } else {
        return '';
    }
};
