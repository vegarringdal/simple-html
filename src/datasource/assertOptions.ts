/**
 * @internal
 * v6 replaced positional booleans with options objects. TypeScript catches an old call, plain
 * JavaScript does not - `setData(rows, true)` would quietly replace the rows instead of adding
 * them. This turns an old call into a clear error.
 * @param method the method name, for the message
 * @param options what was passed where v6 expects the options object
 * @param example the v6 way to write it, for the message
 */
export function assertOptions(method: string, options: unknown, example: string) {
    if (typeof options === 'boolean') {
        throw new TypeError(`${method}() takes an options object in v6, not a boolean: ${example}`);
    }
}
