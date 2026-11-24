import type { Entity } from './entity';
import type { GroupArgument } from './groupArgument';
import type { ValidationError } from './validator';

/**
 * The events of a {@link Datasource}: event name -> the payload its handler gets.
 *
 * Subscribe with `datasource.on(name, handler)`, the payload is typed from this map.
 * `on()` returns a function that unsubscribes. Events with nothing to tell send an empty object.
 *
 * @sample events
 * @example
 * ```ts
 * const off = datasource.on('collection-filtered', (data) => {
 *     console.log(data.info, datasource.getDataRows().length, 'rows left');
 * });
 * datasource.on('selection-change', () => {
 *     console.log(datasource.getSelectedRows().length, 'rows selected');
 * });
 * off(); // unsubscribe
 * ```
 */
export interface DatasourceEvents {
    /**
     * Rows were added, replaced or removed.
     *
     * - `setData()`: `{ added }` - `true` when rows were added, `false` when they replaced the data
     * - `addNewEmpty()`: `{ added: true }`
     * - `removeData()`: `{ removed: true, info: 'removeData', data }` - `data` is what was passed in
     * - `removeAllData()`: `{ removed: true, info: 'removeData', data: null }`
     * - `clearMarkedForDeletion()`: `{ removed: true, info: 'clearMarkedForDeletion' }`
     * - `upsert()`: `{ info: 'upsert', added }`, with `removed: true` when it removed rows. Only when it
     *   added or removed rows, or the displayed rows changed (the filter, the sort order or the groups).
     *   An upsert that only changed values sends none: `rows-changed` has the rows
     */
    'collection-changed': {
        /**
         * `setData()` / `addNewEmpty()`: `true` when rows were added, `false` when the data was replaced.
         * `upsert()`: `true` when it added rows
         */
        added?: boolean;
        /** `true` when rows were removed */
        removed?: true;
        /** which method removed rows, or `'upsert'` */
        info?: 'removeData' | 'clearMarkedForDeletion' | 'upsert';
        /** `removeData()`: the rows passed in. `removeAllData()`: `null` */
        data?: Entity | Entity[] | null;
    };

    /**
     * The displayed rows were rebuilt. `info` says by what:
     *
     * - `'filter'`: `filter()` or `reloadDatasource()`
     * - `'resetData'`: `resetData()` or `resetDataSelectionOnly()`
     * - `'markForDeletion'`: `markForDeletion()` or `markAllForDeletion()`
     * - `'unmarkForDeletion'`: `unmarkForDeletion()` or `unmarkAllForDeletion()`
     * - `'acceptChanges'`: `acceptChanges()` - also when it removed rows, it sends no `collection-changed`
     * - `'__internalUpdate, forced'`: `setData(rows, { refilter: false })` or `addNewEmpty()` while
     *   there is no filter, sorting or grouping. Sent before their `collection-changed`. A `setData()`
     *   that runs the filter (the default) sends only `collection-changed`.
     */
    'collection-filtered': {
        /** what rebuilt the displayed rows, see above */
        info: 'filter' | 'resetData' | 'markForDeletion' | 'unmarkForDeletion' | 'acceptChanges' | '__internalUpdate, forced';
    };

    /**
     * `sort()` ran. Empty payload.
     */
    'collection-sorted': Record<string, never>;

    /**
     * The grouping changed.
     *
     * - `group()`: `{ info: 'group', groupings }` - the grouping now applied
     * - `removeGroup()`: `{ info: 'removeGroup' }`, after the `'group'` event of the grouping that is left
     */
    'collection-grouped': {
        /** `'group'` from `group()`, `'removeGroup'` from `removeGroup()` */
        info: 'group' | 'removeGroup';
        /** the grouping now applied, with `info: 'group'`. `[]` when the grouping was removed */
        groupings?: GroupArgument[];
    };

    /**
     * `expandGroup()` expanded one or all groups. Empty payload.
     */
    'collection-expand': Record<string, never>;

    /**
     * `setFields()` replaced the fields: their types, labels, formatters and rules. Sent before the rows
     * are filtered, sorted and grouped again by them (`collection-filtered`). Empty payload, read
     * `getField()`.
     */
    'fields-change': Record<string, never>;

    /**
     * `collapseGroup()` collapsed one or all groups. Empty payload.
     */
    'collection-collapse': Record<string, never>;

    /**
     * `datasource.currentEntity` was set: a row was clicked or selected, or
     * `setRowAsCurrentEntity()` was called. Also when `setData()` set it to `null` because the current
     * row is no longer in the data, and when a method that removes rows removed it (`removeData()`,
     * `removeAllData()`, `clearMarkedForDeletion()`, `acceptChanges()`, `resetData()`,
     * `resetDataSelectionOnly()`) - sent after their own event. Empty payload, read
     * `datasource.currentEntity`.
     * Was `currentEntity` in v5.
     */
    'current-entity': Record<string, never>;

    /**
     * The selected rows changed. Also when a method that removes rows removed a selected one (see
     * `current-entity`), sent after its own event. Empty payload, read `datasource.getSelectedRows()`.
     * Was `selectionChange` in v5.
     */
    'selection-change': Record<string, never>;

    /**
     * `datasource.validate()` ran: `errors` is what it returned. The grid renders its rows again, to
     * show the errors. An edit sends no event, though it is validated: read `getErrors()` when you
     * need them.
     */
    validate: {
        /** the errors `validate()` found, `[]` when the rows it checked are valid */
        errors: ValidationError[];
    };

    /**
     * A row was selected from code, the grid scrolls it into view.
     *
     * - `row`: index in the displayed rows (`datasource.getRows()`), 0 based
     * - `info`: what selected it - `select(row, { notify: true })` sends `'select-first'`, `selectFirst()`
     *   `'select-first'`, `selectPrev()` `'select-prev'`, `selectNext()` `'select-next'`,
     *   `selectLast()` `'select-last'`
     */
    select: {
        /** what selected it, see above */
        info: 'select-first' | 'select-prev' | 'select-next' | 'select-last';
        /** the index of the row in the displayed rows, 0 based */
        row: number;
    };

    /**
     * The undo/redo history changed: read `canUndo()` and `canRedo()`, e.g. to enable Undo and Redo
     * buttons of your own. `info` says what changed it:
     *
     * - `'edit'`: a step was recorded - an edit, a paste, a clear, a (un)mark for deletion, a revert.
     *   Sent once the code that made it is done (in a microtask): one event per step, also for a paste
     *   over many rows. Also when what the user typed in a cell went back to the value it started from,
     *   and its step was dropped
     * - `'undo'`: `undo()` took a step back. The grid renders its cells again
     * - `'redo'`: `redo()` did a step again. The grid renders its cells again
     * - `'clear'`: the history was emptied - `clearHistory()`, `setData()` without `add`,
     *   `removeAllData()`, `resetData()`, `acceptChanges()`. Only when there was something in it
     * - `'remove'`: rows were removed for good (`removeData()`, `clearMarkedForDeletion()`, a new row
     *   removed by `resetDataSelectionOnly()`, `upsert(rows, { removeMissing: true })`) and their changes
     *   left the history. Or `upsert()` gave fields the server's value as their original, and a change
     *   that does nothing now was dropped (see `upsert()`)
     *
     * The history is the data container's: every datasource on the same container sends it, for a
     * change made through any of them.
     */
    'history-changed': {
        /** what changed the history, see above */
        info: 'edit' | 'undo' | 'redo' | 'clear' | 'remove';
    };

    /**
     * Values of rows changed, or what the grid shows of them: sent once the code that changed them is
     * done (in a microtask) - one event however many rows and fields it set. The grid renders the rows
     * of it that are on screen, in the next animation frame: a value set from code shows without
     * `gridInterface.refresh()`.
     *
     * A row is in it when:
     * - a field was set on it: from code (`row.price = 10`), by the user in the grid, by `undo()` /
     *   `redo()`, `resetField()`, `resetRows()`, `resetData()`, `resolveConflict()`, or by `upsert()`
     * - its deletion mark changed (`markForDeletion()`, undo ...) or its server error (`setErrors()`)
     * - one of its conflicts came or went
     *
     * The rows `upsert()` or `setData()` added and the rows removed are not in it: `collection-changed`
     * tells those. A row in it can have left the data since it changed.
     *
     * The rows are the data container's: every datasource on the same `DataContainer` sends it, for a
     * change made through any of them.
     */
    'rows-changed': {
        /** the rows, each once, in the order they first changed */
        rows: Entity[];
        /**
         * the fields set on each row: `fields.get(row)`. Empty for a row whose deletion mark or server
         * error changed, or whose conflict about the whole row came or went
         */
        fields: ReadonlyMap<Entity, ReadonlySet<string>>;
    };

    /**
     * The conflicts changed: `upsert()` made one, or one went - resolved with `resolveConflict()`, the
     * field is not edited any more, the row was saved (`acceptChanges()`), reset, or left the data.
     * Sent once the code that changed them is done (in a microtask), after `rows-changed`. Empty
     * payload, read `datasource.getConflicts()`.
     *
     * The conflicts are the data container's: every datasource on the same `DataContainer` sends it.
     */
    'conflicts-changed': Record<string, never>;
}
