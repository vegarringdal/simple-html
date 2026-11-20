/**
 * A listener for `addEventListener` on the Datasource, GridInterface and DateInterface: a function,
 * or an object with a `handleEvent` method, like a DOM listener.
 *
 * It is called with `{ type, data }`. **Return `true` to keep listening** - anything else,
 * including returning nothing, removes the listener after that event.
 *
 * @example
 * ```ts
 * datasource.addEventListener((event) => {
 *     if (event.type === 'collection-filtered') {
 *         console.log('filtered', event.data);
 *     }
 *     return true; // keep listening
 * });
 * ```
 */
export type Listener = ((...args: any[]) => any) | { handleEvent: (...args: any[]) => any };
