import type { EntityUnion } from '../datasource/dataSource';
import type { GridMenus } from './gridMenus';

/**
 * The functions of a grid: what can not be written as data. They are kept apart from the
 * {@link GridConfig}, so the config is plain JSON and can be stored - in a backend, say - while the
 * hooks stay in your code.
 *
 * - `isReadonly` - makes a cell readonly, or editable, from the values of its row
 * - `cellClass` - adds css classes to a cell, from the values of its row
 * - `rowClass` - adds css classes to a row, from its values: a late order, a blocked customer
 * - `menus` - changes the grid's right click menus, see {@link GridMenus}
 *
 * Give them to `createGrid(host, { config, datasource, hooks })` (or `new GridInterface(config,
 * datasource, hooks)`), and change them while the grid is shown with `gridInterface.updateHooks()`.
 * All of them are optional.
 *
 * Do not use `this` in them: the grid calls them on its own copy of the hooks object.
 *
 * @typeParam T the type of the rows, from the datasource: the row the hooks get is an
 * {@link EntityUnion}`<T>`
 *
 * @sample cell-styling
 * @sample context-menu
 * @example
 * ```ts
 * import { createGrid, type GridConfig, type GridHooks } from '@simple-html/grid';
 *
 * interface Account {
 *     company: string;
 *     balance: number;
 *     isActive: boolean;
 * }
 *
 * // the config is plain JSON: it can come from a backend
 * const config: GridConfig = JSON.parse(
 *     '{"readonly": false, "layout": {"center": [{"fields": ["company"], "width": 150}, {"fields": ["balance"], "width": 100}]}}'
 * );
 *
 * // the hooks are code
 * const hooks: GridHooks<Account> = {
 *     // company can not be edited on an inactive row, every other cell follows the config
 *     isReadonly: (row, field) => (field === 'company' && !row.isActive ? true : null),
 *     // .negative { position: absolute; inset: 0; background: rgba(239, 68, 68, 0.25); }
 *     cellClass: (row, field) => (field === 'balance' && row.balance < 0 ? { background: 'negative' } : null),
 *     // no summary in the row menu
 *     menus: { row: (defaults) => defaults.filter((entry) => !entry.id.startsWith('row.export')) }
 * };
 *
 * const gridInterface = createGrid(host, { config, datasource, hooks });
 * ```
 */
export interface GridHooks<T = unknown> {
    /**
     * Makes a cell readonly, or editable, from the values of its row. Called every time a cell is
     * rendered, and by the row menu's paste, clear and delete for each selected row.
     *
     * Return `true` (readonly) or `false` (editable). `null` or `undefined` leaves it to the config:
     * the column's `readonly` option, which is passed in as `readonlyByConfig`. The grid's own
     * `readonly: true` makes every cell readonly, whatever this returns - and so do a locked field
     * (`FieldConfig.readonly`, the hook is not asked for it), a calculated column and the edit
     * permissions on a row they lock (`GridConfig.edit`: `change: false` and a row that is not new).
     *
     * A row it returns `true` for in every column of the layout is locked: the row menu's delete
     * (`row.delete.rows`) skips it. The column's `readonly` option does not lock a row.
     *
     * Called often: keep it fast. When what it reads changes, call `gridInterface.refresh()` to render
     * the cells again.
     *
     * Replaces v5's `gridInterface.readonlySetter(callback)`; the row comes first now.
     *
     * @param row the cell's row. Always a data row: a group row has no cells
     * @param field the cell's field
     * @param readonlyByConfig the column's `readonly` option, `false` when it is not set
     *
     * @sample cell-styling
     * @example
     * ```ts
     * import type { GridHooks } from '@simple-html/grid';
     *
     * // company can not be edited on an inactive row, every other cell follows the config
     * const hooks: GridHooks = {
     *     isReadonly: (row, field) => (field === 'company' && row.isActive === false ? true : null)
     * };
     * ```
     */
    isReadonly?(row: EntityUnion<T>, field: string, readonlyByConfig: boolean): boolean | null | undefined;

    /**
     * Adds css classes to a cell, from the values of its row: to color a cell by its value, say. Called
     * every time a cell is rendered, keep it fast. See {@link CellClass} for where each class goes.
     *
     * Return `null` or `undefined` for no classes of your own.
     *
     * Replaces v5's `gridInterface.cellAppendClassSetter(callback)`: `inputClass` is `input`,
     * `dimmedClass` is `background`, the row comes first and the third argument (readonly) is gone.
     *
     * @param row the cell's row. Always a data row: a group row has no cells
     * @param field the cell's field
     *
     * @sample cell-styling
     * @example
     * ```ts
     * import type { GridHooks } from '@simple-html/grid';
     *
     * // .low { position: absolute; inset: 0; background: rgba(239, 68, 68, 0.25); }
     * const hooks: GridHooks = {
     *     cellClass: (row, field) => {
     *         if (field === 'balance' && row.balance < 0) {
     *             return { background: 'low', input: 'bold-text' };
     *         }
     *         return null;
     *     }
     * };
     * ```
     */
    cellClass?(row: EntityUnion<T>, field: string): CellClass | null | undefined;

    /**
     * Adds css classes to a whole row, from its values: a late order, a blocked customer, a row to look
     * at. Return one or more class names separated by spaces, or `null` / `undefined` / `''` for none.
     *
     * The classes go on the row's element in every section - the row number, the pinned left, middle
     * and pinned right columns - so a selector like `.late .simple-html-grid-col-cell` reaches every
     * cell of the row, and `.late` alone the row (it is behind its cells: the cells' inputs are
     * transparent, so a background on the row shows). They follow the row: called every time the row
     * is rendered - scrolled in, `refresh()`, and after its values changed (an edit, an upsert, an undo),
     * in the next frame. Not called for a group row.
     *
     * @param row the row. Always a data row
     * @param rowIndex its index in the displayed rows, as in the grid's events
     *
     * @sample cell-styling
     * @example
     * ```ts
     * import type { GridHooks } from '@simple-html/grid';
     *
     * interface Order {
     *     due: Date;
     *     shipped: boolean;
     * }
     *
     * // .late .simple-html-grid-col-cell { box-shadow: inset 0 -2px 0 #dc2626; }
     * const hooks: GridHooks<Order> = {
     *     rowClass: (row) => (!row.shipped && row.due < new Date() ? 'late' : null)
     * };
     * ```
     */
    rowClass?(row: EntityUnion<T>, rowIndex: number): string | null | undefined;

    /**
     * Changes the grid's right click menus: hide entries, reorder them, change their labels, add your
     * own. One function per menu - `row` (a cell), `header` (a header label), `filter` (a header
     * filter), `column` (a column number, under the header filters) - that gets the grid's own entries
     * and what the menu was opened on, and returns the entries to show. Called every time the menu opens. A menu without a function shows its defaults.
     *
     * The ids of the grid's own entries are listed in `MENU_IDS`, see {@link GridMenus} and
     * {@link MenuEntry}. Set or remove the functions later with `gridInterface.updateHooks({ menus })`.
     *
     * Replaces v5's `contextMenuCustom()` for the grid's own menus; a menu of your own is opened with
     * `gridInterface.openMenu()`.
     *
     * @sample context-menu
     * @example
     * ```ts
     * import { type GridHooks, isGroupRow } from '@simple-html/grid';
     *
     * const hooks: GridHooks = {
     *     menus: {
     *         // no "Clear:" in the row menu, and an entry of your own at the end
     *         row: (defaults, context) => [
     *             ...defaults.filter((entry) => entry.id !== 'row.clear' && entry.id !== 'row.clear.cell'),
     *             { type: 'section', id: 'my.section', label: 'Row:' },
     *             {
     *                 id: 'my.logRow',
     *                 label: 'Log row',
     *                 visible: () => !isGroupRow(context.row),
     *                 action: () => console.log(context.field, context.row)
     *             }
     *         ],
     *         // the header menu without the grouping part
     *         header: (defaults) => defaults.filter((entry) => !entry.id.startsWith('header.grouping'))
     *     }
     * };
     * ```
     */
    menus?: GridMenus;
}

/**
 * The css classes the `cellClass` hook ({@link GridHooks}) adds to a cell. Each is one or more class
 * names, separated by spaces, the same as a `class` attribute.
 *
 * @sample cell-styling
 * @example
 * ```ts
 * import type { CellClass } from '@simple-html/grid';
 *
 * const negative: CellClass = { input: 'negative-text', background: 'negative-background' };
 * ```
 */
export interface CellClass {
    /** added to the cell's `<input>`: the text. Was `inputClass` in v5 */
    input?: string;
    /**
     * added to the element behind the input, which fills the cell. The input is transparent, so this
     * is the cell's background - the grid draws the readonly and required stripes there. On an
     * editable cell it has no size (the grid's readonly and required classes give it one): give the
     * class `position: absolute; inset: 0`. Was `dimmedClass` in v5
     */
    background?: string;
}
