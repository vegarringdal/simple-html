import { getLoggerSymbol, getLoggerCountSymbol } from './symbols';

// maybe weird, but I need it to check everything is behaving correctly during render and hmr
// but this will give

let log = false;
let skipElements: string[] = [];

if (!(<any>globalThis)[getLoggerSymbol()]) {
    (<any>globalThis)[getLoggerSymbol()] = new WeakMap();
    (<any>globalThis)[getLoggerCountSymbol()] = 0;
}

export function enableInternalLogger(skip: string[] = []) {
    skipElements = skip;
    log = true;
}

export function disableInternalLogger() {
    log = false;
}

function registerLoggerContext(context: any) {
    if (log) {
        const map = (<any>globalThis)[getLoggerSymbol()];
        if (map.has(context)) {
            throw 'contxt duplicate';
        }

        let count = (<any>globalThis)[getLoggerCountSymbol()] + 1;
        (<any>globalThis)[getLoggerCountSymbol()] = count;

        map.set(context, count);
    }
}

function getID(ctx: any) {
    if (log) {
        const map = (<any>globalThis)[getLoggerSymbol()];
        return map.get(ctx);
    }
}

export function logger(name: string, ctx: any, tag: string) {
    if (log && skipElements.indexOf(tag) === -1) {
        let id = getID(ctx);
        if (!id) {
            registerLoggerContext(ctx);
        }
        id = getID(ctx);

        // some weird parths, but want it to stay as a table

        // find text length
        let text = name || '??' + '' + (id || '?');
        let x = 25 - Math.floor(text.length);

        // find id length
        let idOnly = '' + (id || '?');
        let y = 6 - Math.floor(idOnly.length);

        // show it
        console.log(
            `@SIMPLE-HTML/core | ${name}${Array(x).join(' ')}| id:${id || '?'}${Array(y).join(
                ' '
            )} | IsConnected:${ctx && ctx.isConnected === true ? 'Y' : 'N'} |  ${tag}`
        );
    }
}
