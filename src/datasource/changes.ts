/**
 * One edited row in {@link Changes}: the row's key and the fields whose value differs from the
 * original, with their new value.
 *
 * The key is under the name of the key field (`id` with `new Datasource({ key: 'id' })`), or under
 * `__KEY` when the datasource has no key - then it is a generated negative number, a server can not
 * use it.
 *
 * A field edited back to its original value is not in it, and a row with no field left that
 * differs is not edited. When a value differs depends on the field's type, see {@link Changes}.
 *
 * @example
 * ```ts
 * import { Datasource } from '@simple-html/grid';
 *
 * interface Person {
 *     id: number;
 *     name: string;
 *     city: string;
 * }
 *
 * const datasource = new Datasource<Person>({ key: 'id' });
 * datasource.setData([{ id: 7, name: 'Ann', city: 'Oslo' }]);
 * datasource.getDataRows()[0].city = 'Bergen';
 *
 * datasource.getChanges().modifiedEntities; // [{ id: 7, city: 'Bergen' }]
 * ```
 */
export type ModifiedEntity<T> = Partial<T> & {
    /** the generated key, only when the datasource has no key field */
    __KEY?: string | number;
};

/**
 * What `datasource.getChanges()` returns: the rows added, edited and marked for deletion since the
 * data was set - what to send to a server.
 *
 * - `newEntities` - rows added with `addNewEmpty()`, edits to them included
 * - `modifiedEntities` - one entry per edited row: its key and the changed fields, see
 *   {@link ModifiedEntity}
 * - `deletedEntities` - rows marked with `markForDeletion()` / `markAllForDeletion()`. A new row
 *   that is marked for deletion is dropped, it is in none of the lists.
 *
 * Every entry is a copy, a plain object: changing it does not change the row. It is a shallow copy -
 * a `Date` stays a `Date`, an object in a field is the row's own object.
 *
 * When an edit counts: a field is edited when its value differs from the original. A field set back
 * to its original value is not edited any more. Setting a blank field (`null` / `undefined`) to `''`
 * is no edit. Two `Date`s are compared by the field's type in the datasource's `fields`:
 *
 * - `date` - on the day. A date typed into a cell gets the current time of day, so typing the same
 *   day again is no edit.
 * - `datetime`, and every other field - to the second, the milliseconds are ignored (they are not
 *   shown, and typing a time stamps the current ones). A time only change is an edit.
 *
 * @sample editing
 * @example
 * ```ts
 * import { Datasource } from '@simple-html/grid';
 *
 * interface Person {
 *     id: number;
 *     name: string;
 *     born: Date | null;
 *     lastLogin: Date | null;
 * }
 * declare const rowsFromServer: Person[];
 *
 * const datasource = new Datasource<Person>({ key: 'id', fields: { born: 'date', lastLogin: 'datetime' } });
 * datasource.setData(rowsFromServer);
 * // ... the user edits, adds and deletes rows in the grid
 *
 * const { newEntities, modifiedEntities, deletedEntities } = datasource.getChanges();
 * await fetch('/api/people', {
 *     method: 'POST',
 *     body: JSON.stringify({ newEntities, modifiedEntities, deletedEntities }) // a Date becomes its ISO text
 * });
 * ```
 */
export interface Changes<T = Record<string, unknown>> {
    /** the rows added with `addNewEmpty()` (or the container's `setData(rows, { add: true, isNew: true })`), with the values they have now */
    newEntities: T[];
    /** one entry per edited row: its key and the fields that changed */
    modifiedEntities: ModifiedEntity<T>[];
    /** the rows marked for deletion, with the values they have now */
    deletedEntities: T[];
}
