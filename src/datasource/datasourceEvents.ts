import type { Entity } from './entity';
import type { GroupArgument } from './groupArgument';

/**
 * The events of a {@link Datasource}: event name -> the payload its handler gets.
 *
 * Subscribe with `datasource.on(name, handler)`, the payload is typed from this map.
 * `on()` returns a function that unsubscribes. Events with nothing to tell send an empty object.
 *
 * @example
 * ```ts
 * const off = datasource.on('collection-filtered', (data) => {
 *     console.log(data.info, datasource.length(true), 'rows left');
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
     * - `clearMarkedForDeletion()`: `{ removed: true, info: 'clearMarkedForDeletion' }`
     */
    'collection-changed': {
        added?: boolean;
        removed?: true;
        info?: 'removeData' | 'clearMarkedForDeletion';
        data?: Entity | Entity[] | null;
    };

    /**
     * The displayed rows were rebuilt. `info` says by what:
     *
     * - `'filter'`: `filter()` or `reloadDatasource()`
     * - `'resetData'`: `resetData()` or `resetDataSelectionOnly()`
     * - `'markForDeletion'`: `markForDeletion()`
     * - `'__internalUpdate, forced'`: `setData()` or `addNewEmpty()` while there is no filter,
     *   sorting or grouping. Sent before their `collection-changed`.
     */
    'collection-filtered': {
        info: 'filter' | 'resetData' | 'markForDeletion' | '__internalUpdate, forced';
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
        info: 'group' | 'removeGroup';
        groupings?: GroupArgument[];
    };

    /**
     * `expandGroup()` expanded one or all groups. Empty payload.
     */
    'collection-expand': Record<string, never>;

    /**
     * `collapseGroup()` collapsed one or all groups. Empty payload.
     */
    'collection-collapse': Record<string, never>;

    /**
     * `datasource.currentEntity` was set: a row was clicked or selected, or
     * `setRowAsCurrentEntity()` was called. Empty payload, read `datasource.currentEntity`.
     * Was `currentEntity` in v5.
     */
    'current-entity': Record<string, never>;

    /**
     * The selected rows changed. Empty payload, read `datasource.getSelectedRows()`.
     * Was `selectionChange` in v5.
     */
    'selection-change': Record<string, never>;

    /**
     * A row was selected from code, the grid scrolls it into view.
     *
     * - `row`: index in the displayed rows (`datasource.getRows()`), 0 based
     * - `info`: what selected it - `select(row, true)` sends `'select-first'`, `selectFirst()`
     *   `'select-first'`, `selectPrev()` `'select-prev'`, `selectNext()` `'select-next'`,
     *   `selectLast()` `'select-last'`
     */
    select: {
        info: 'select-first' | 'select-prev' | 'select-next' | 'select-last';
        row: number;
    };
}
