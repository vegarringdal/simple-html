/**
 * The errors of a filter that came from outside - its shape, its values, its limits - marked, so a
 * backend can answer them with a 400 in one check: isSqlFilterError in sql.ts. An error of the options
 * (a mistake of the backend's code) is not marked: it is a 500.
 *
 * The mark is a symbol of the global registry: two copies of the package loaded mark alike.
 */
const MARK = Symbol.for('@simple-html/grid/sql-filter-error');

/**
 * Runs `read` and marks the `TypeError` or `RangeError` it throws as an error of the filter, then throws it
 * on: its class and message stay
 */
export function markFilterError<T>(read: () => T): T {
    try {
        return read();
    } catch (error) {
        if (error instanceof TypeError || error instanceof RangeError) {
            Object.defineProperty(error, MARK, { value: true });
        }
        throw error;
    }
}

/** true for an error markFilterError marked */
export function isMarkedFilterError(error: unknown): boolean {
    return (typeof error === 'object' || typeof error === 'function') && error !== null && Object.hasOwn(error, MARK);
}
