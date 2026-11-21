import type { EntityUnion } from './dataSource';

/**
 * A field in conflict: `datasource.upsert()` brought a new value from the server for a field the user
 * has edited and not saved (or is typing in). The user's value is kept in the row, the server's is
 * the field's original now - so `getChanges()` sends the user's value, as an edit of what the server
 * has now.
 *
 * Part of {@link Conflict}, see there. `getConflicts()` makes the objects: `local` is the value the row
 * has when it is called.
 *
 * @typeParam T the type of the rows, the `T` of `Datasource<T>`
 *
 * @example
 * ```ts
 * import type { ValueConflict } from '@simple-html/grid';
 *
 * const describe = (conflict: ValueConflict) =>
 *     `${conflict.field}: yours ${conflict.local}, the server's ${conflict.remote} (it was ${conflict.original})`;
 * ```
 */
export interface ValueConflict<T = any> {
    /** the row, the one the datasource handed out */
    row: EntityUnion<T>;
    /** the field in conflict */
    field: string;
    /** the user's value: the value the row has, kept by the merge */
    local: unknown;
    /** the server's value: the field's original now, what `resolveConflict(row, field, 'remote')` takes */
    remote: unknown;
    /**
     * the value the user's edit started from: the original before the server changed it. A second
     * merge that changes the field again keeps it, it gives `remote` the newer value
     */
    original: unknown;
}

/**
 * A row in conflict as a whole: `datasource.upsert(rows, { removeMissing: true })` did not get it from
 * the server, but the row has local changes - edits, a deletion mark, or the user is typing in it. It
 * is kept, with this conflict, instead of being removed.
 *
 * Part of {@link Conflict}, see there.
 *
 * @typeParam T the type of the rows, the `T` of `Datasource<T>`
 *
 * @example
 * ```ts
 * import type { RemovedConflict } from '@simple-html/grid';
 *
 * const describe = (conflict: RemovedConflict) => `row ${conflict.row.__KEY} is no longer on the server`;
 * ```
 */
export interface RemovedConflict<T = any> {
    /** the row, the one the datasource handed out */
    row: EntityUnion<T>;
    /** always `null`: the row as a whole, not a field. Tells it from a {@link ValueConflict} */
    field: null;
    /** always `'removed'`: the server no longer has the row */
    remote: 'removed';
}

/**
 * What `datasource.getConflicts()` lists: a server value that `upsert()` did not write because the user
 * changed the same thing. Tell the two kinds apart by `field`:
 *
 * - {@link ValueConflict} (`field` is the field's name): the server changed a field the user has
 *   edited. The user's value stays, the server's is the original now
 * - {@link RemovedConflict} (`field` is `null`): the server no longer has a row that has local
 *   changes, `upsert(rows, { removeMissing: true })` kept it
 *
 * Resolve one with `datasource.resolveConflict(row, field, 'local' | 'remote')`. A conflict also goes
 * when what it is about goes: the field is not edited any more (reverted, undone, typed back to the
 * server's value, saved with `acceptChanges()`), the row has no local changes any more, or it leaves
 * the data.
 *
 * @typeParam T the type of the rows, the `T` of `Datasource<T>`
 *
 * @sample live-data
 * @example
 * ```ts
 * for (const conflict of datasource.getConflicts()) {
 *     if (conflict.field === null) {
 *         console.log(`row ${conflict.row.__KEY} was removed on the server, it has changes here`);
 *     } else {
 *         console.log(`${conflict.field}: yours ${conflict.local}, the server's ${conflict.remote}`);
 *     }
 * }
 * ```
 */
export type Conflict<T = any> = ValueConflict<T> | RemovedConflict<T>;

/**
 * The options of `datasource.upsert(rows, options)`. Both are optional.
 *
 * @example
 * ```ts
 * import type { UpsertOptions } from '@simple-html/grid';
 *
 * declare const rowsFromServer: object[];
 *
 * // the server sent every row: the rows it did not send are gone there
 * const options: UpsertOptions = { removeMissing: true };
 * datasource.upsert(rowsFromServer, options);
 * ```
 */
export interface UpsertOptions {
    /**
     * `true` when the rows are every row there is (a full poll): a row whose key is not among them
     * is removed. Default `false`, the rows are changes only (a push of what changed). A row with
     * local changes is not removed, it gets a {@link RemovedConflict}; a new row (`addNewEmpty()`)
     * is never removed, the server does not have it yet
     */
    removeMissing?: boolean;
    /**
     * `false` to leave the filter out, default `true`: the filter runs on the rows, so a row whose new
     * values the filter leaves out is no longer shown. With `false` the rows shown stay shown (the
     * rows added are shown too) until the filter runs again - the sorting and grouping still run, as
     * for `setData(rows, { refilter: false })`
     */
    refilter?: boolean;
}

/**
 * What `datasource.upsert()` did, the rows themselves (not copies).
 *
 * @typeParam T the type of the rows, the `T` of `Datasource<T>`
 *
 * @example
 * ```ts
 * declare const rowsFromServer: object[];
 *
 * const { added, updated, removed, conflicts } = datasource.upsert(rowsFromServer, { removeMissing: true });
 * console.log(`${added.length} new, ${updated.length} changed, ${removed.length} removed, ${conflicts.length} conflicts`);
 * ```
 */
export interface UpsertResult<T = any> {
    /** the rows of keys that were not in the data: added, as loaded rows (not new, not edited) */
    added: EntityUnion<T>[];
    /** the rows a value of the server changed, or that got a conflict - each once */
    updated: EntityUnion<T>[];
    /** the rows `removeMissing` removed */
    removed: EntityUnion<T>[];
    /** the conflicts this upsert made, or gave a newer server value. `getConflicts()` has every one */
    conflicts: Conflict<T>[];
}
