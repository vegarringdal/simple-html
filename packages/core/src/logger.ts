import { getLoggerSymbol, getLoggerCountSymbol } from './symbols';

// maybe weird, but I need it to check everything is behaving correctly during render and hmr
// but this will give

let log = false;
let skipElements: string[] = [];

if (!(globalThis as any)[getLoggerSymbol()]) {
    (globalThis as any)[getLoggerSymbol()] = new WeakMap();
    (globalThis as any)[getLoggerCountSymbol()] = 0;
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
        const map = (globalThis as any)[getLoggerSymbol()];
        if (map.has(context)) {
            throw 'contxt duplicate';
        }

        const count = (globalThis as any)[getLoggerCountSymbol()] + 1;
        (globalThis as any)[getLoggerCountSymbol()] = count;

        map.set(context, count);
    }
}

function getID(ctx: any) {
    if (log) {
        const map = (globalThis as any)[getLoggerSymbol()];
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
        const text = name || '??' + '' + (id || '?');
        const x = 25 - Math.floor(text.length);

        // find id length
        const idOnly = '' + (id || '?');
        const y = 6 - Math.floor(idOnly.length);

        // show it
        console.log(
            `@SIMPLE-HTML/core | ${name}${Array(x).join(' ')}| id:${id || '?'}${Array(y).join(
                ' '
            )} | IsConnected:${ctx && ctx.isConnected === true ? 'Y' : 'N'} |  ${tag}`
        );
    }
}
