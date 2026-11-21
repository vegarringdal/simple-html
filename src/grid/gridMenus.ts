import type { Datasource } from '../datasource/dataSource';
import type { Entity, GroupRow } from '../datasource/entity';
import type { GridInterface } from './gridInterface';

/**
 * One entry of a menu: an item to click, a section header, a separator line, or a block (an element
 * shown as it is). The grid's own menus are lists of these, see {@link GridMenus} to change them, and
 * `gridInterface.openMenu()` opens a menu of your own.
 *
 * Every entry has an `id`. The ids of the grid's own entries are listed in {@link MENU_IDS}; give
 * yours ids that do not clash with them.
 *
 * An entry with a `visible` callback that returns `false` is left out. A section header or separator
 * is shown as long as it is in the list: hide it together with the entries under it.
 *
 * @sample context-menu
 * @example
 * ```ts
 * import type { MenuEntry } from '@simple-html/grid';
 *
 * declare const pick: (fruit: string | null) => void;
 * declare const event: MouseEvent;
 *
 * const entries: MenuEntry[] = [
 *     { type: 'section', id: 'fruit', label: 'Pick a fruit:' },
 *     { id: 'fruit.apple', label: 'Apple', action: () => pick('Apple') },
 *     { id: 'fruit.banana', label: 'Banana', action: () => pick('Banana') },
 *     { type: 'separator', id: 'fruit.separator' },
 *     { id: 'fruit.none', label: 'None', hint: 'clears the cell', action: () => pick(null) }
 * ];
 * gridInterface.openMenu(event, entries);
 * ```
 */
export type MenuEntry = MenuItem | MenuSection | MenuSeparator | MenuBlock;

/**
 * An entry to click. Clicking it closes the menu, then calls `action`.
 *
 * `type` can be left out, an entry without one is an item.
 *
 * @sample context-menu
 * @example
 * ```ts
 * import { isGroupRow, type MenuItem } from '@simple-html/grid';
 *
 * const logRow: MenuItem = {
 *     id: 'my.logRow',
 *     label: 'Log row',
 *     hint: 'console',
 *     action: (context) => console.log(context.field, context.row),
 *     // only on data rows, and greyed out while nothing is selected
 *     visible: (context) => !isGroupRow(context.row),
 *     disabled: (context) => context.datasource.getSelectedRows().length === 0
 * };
 * ```
 */
export interface MenuItem {
    /** `'item'`, or left out */
    type?: 'item';
    /** a name for the entry, unique in its menu. See {@link MENU_IDS} for the grid's own */
    id: string;
    /** the text shown */
    label: string;
    /** shown after the label, in italics and in parentheses: `Paste cell (selected rows)` */
    hint?: string;
    /** called when the item is clicked, after the menu is closed */
    action: (context: MenuContext) => void;
    /** `false` leaves the item out of the menu. Called when the menu opens, left out it is shown */
    visible?: (context: MenuContext) => boolean;
    /** `true` shows the item greyed out, and clicking it does nothing. Called when the menu opens */
    disabled?: (context: MenuContext) => boolean;
    /**
     * `true` shows the item as the one picked now, as the header filter menu does with its operator.
     * Called when the menu opens
     */
    selected?: (context: MenuContext) => boolean;
}

/**
 * A section header, "Copy:" or "Filter:" in the grid's menus, with a line under it. Not clickable.
 *
 * @example
 * ```ts
 * import type { MenuSection } from '@simple-html/grid';
 *
 * const section: MenuSection = { type: 'section', id: 'my.export', label: 'Export:' };
 * ```
 */
export interface MenuSection {
    /** always `'section'` */
    type: 'section';
    /** a name for the entry, unique in its menu. See {@link MENU_IDS} for the grid's own */
    id: string;
    /** the text shown, the grid's own end with a colon */
    label: string;
    /** `false` leaves the header out of the menu. Called when the menu opens, left out it is shown */
    visible?: (context: MenuContext) => boolean;
}

/**
 * A dashed line between two entries.
 *
 * @example
 * ```ts
 * import type { MenuSeparator } from '@simple-html/grid';
 *
 * const separator: MenuSeparator = { type: 'separator', id: 'my.separator' };
 * ```
 */
export interface MenuSeparator {
    /** always `'separator'` */
    type: 'separator';
    /** a name for the entry, unique in its menu. See {@link MENU_IDS} for the grid's own */
    id: string;
    /** `false` leaves the line out of the menu. Called when the menu opens, left out it is shown */
    visible?: (context: MenuContext) => boolean;
}

/**
 * An element shown in the menu as it is. The grid adds it to the menu and does nothing else with it:
 * the element handles its own clicks and input, and clicking in it does not close the menu - call
 * `gridInterface.closeMenu()` for that.
 *
 * The header filter menu's value list (search box, checkboxes, "Run Search") is a block of the grid's
 * own, `'filter.values'`: hide or move it as one entry, it is not built from items.
 *
 * Also for something bigger than a list of items in a menu of your own: a second grid as a dropdown,
 * which then closes with the grid's menus (outside click, scroll, another menu opening).
 *
 * @sample dropdown-grid
 * @example
 * ```ts
 * import { Datasource, type GridConfig, type GridElement, GridInterface } from '@simple-html/grid';
 *
 * declare const cell: HTMLElement;
 * declare const dropdownConfig: GridConfig;
 * const dropdownDatasource = new Datasource();
 *
 * // a grid to pick from, opened under a cell
 * const dropdown = document.createElement('simple-html-grid') as GridElement;
 * dropdown.style.width = '300px';
 * dropdown.style.height = '250px';
 * dropdown.connectInterface(new GridInterface(dropdownConfig, dropdownDatasource));
 * gridInterface.openMenu(cell, [{ type: 'block', id: 'company-picker', element: dropdown }]);
 * ```
 */
export interface MenuBlock {
    /** always `'block'` */
    type: 'block';
    /** a name for the entry, unique in its menu. See {@link MENU_IDS} for the grid's own */
    id: string;
    /** the element shown */
    element: HTMLElement;
    /** `false` leaves the block out of the menu. Called when the menu opens, left out it is shown */
    visible?: (context: MenuContext) => boolean;
}

/**
 * What a menu was opened on, handed to every callback of its entries (`action`, `visible`, `disabled`,
 * `selected`) and to the {@link GridMenus} functions.
 *
 * @example
 * ```ts
 * import { isGroupRow, type MenuItem } from '@simple-html/grid';
 *
 * const copyKey: MenuItem = {
 *     id: 'my.copyKey',
 *     label: 'Copy key',
 *     visible: (context) => context.row !== undefined && !isGroupRow(context.row),
 *     action: (context) => {
 *         if (context.row && !isGroupRow(context.row)) {
 *             navigator.clipboard.writeText(String(context.row.id));
 *         }
 *     }
 * };
 * ```
 */
export interface MenuContext {
    /**
     * which menu: `'row'` (right click on a cell), `'header'` (on a header label), `'filter'` (on a
     * header filter) or `'custom'` (opened with `gridInterface.openMenu()`)
     */
    menu: 'row' | 'header' | 'filter' | 'custom';
    /** the field of the cell the menu was opened on. `''` in a menu opened with `openMenu()` */
    field: string;
    /**
     * - row menu: the row of the cell, always a data row (a group row has no cells)
     * - header and filter menus: the first displayed row, a {@link GroupRow} when the datasource is
     *   grouped and `undefined` when no rows are shown - as `cell-header-focus` sends it
     * - `openMenu()`: `undefined`
     *
     * Check with `isGroupRow()` before reading it as a data row.
     */
    row: Entity | GroupRow | undefined;
    /**
     * the index of `row` in the displayed rows (`datasource.getRows()`): 0 in the header and filter
     * menus, -1 in a menu opened with `openMenu()`
     */
    rowIndex: number;
    /** the cell the menu was opened on, `undefined` in a menu opened with `openMenu()` */
    cell: HTMLElement | undefined;
    /** the grid */
    gridInterface: GridInterface<unknown>;
    /** the grid's datasource, `gridInterface.getDatasource()` */
    datasource: Datasource<unknown>;
}

/**
 * Where `gridInterface.openMenu()` opens a menu: a point in the window, in px from its left and top
 * edges - the same as a mouse event's `clientX` / `clientY`.
 *
 * @example
 * ```ts
 * import type { MenuEntry, MenuPosition } from '@simple-html/grid';
 *
 * declare const button: HTMLButtonElement;
 * declare const entries: MenuEntry[];
 *
 * const rect = button.getBoundingClientRect();
 * const position: MenuPosition = { x: rect.left, y: rect.bottom };
 * gridInterface.openMenu(position, entries);
 * ```
 */
export interface MenuPosition {
    /** px from the left edge of the window */
    x: number;
    /** px from the top edge of the window */
    y: number;
}

/**
 * Changes the grid's right click menus: the `menus` hook ({@link GridHooks}). Each function gets the
 * grid's own entries for that menu (`defaults`, in the order shown in {@link MENU_IDS}) and what the
 * menu was opened on, and returns the entries to show - hide some, reorder them, change them, add
 * your own. Called every time the menu opens.
 *
 * - `row`: right click on a cell - copy, filter on the value, paste, clear, summary ...
 * - `header`: right click on a header label - pin, hide, column chooser, sizes, grouping
 * - `filter`: right click on a header filter - clear, is blank, operator, the value list
 *
 * The grid's own entries are new objects every time, change them as you like. Left out, a menu shows
 * its defaults. Change the functions while the grid is shown with `gridInterface.updateHooks({ menus })`.
 *
 * @sample context-menu
 * @example
 * ```ts
 * import type { GridMenus } from '@simple-html/grid';
 *
 * // createGrid(host, { config, datasource, hooks: { menus } })
 * const menus: GridMenus = {
 *     row: (defaults, context) => [
 *         // no summary
 *         ...defaults.filter((entry) => !entry.id.startsWith('row.summary')),
 *         { type: 'section', id: 'my.section', label: 'Mine:' },
 *         { id: 'my.logRow', label: 'Log row', action: () => console.log(context.field, context.row) }
 *     ],
 *     // the value list first, then the rest
 *     filter: (defaults) => [
 *         ...defaults.filter((entry) => entry.id === 'filter.values'),
 *         ...defaults.filter((entry) => entry.id !== 'filter.values')
 *     ],
 *     // a label of your own
 *     header: (defaults) =>
 *         defaults.map((entry) => (entry.id === 'header.column.hide' ? { ...entry, label: 'Hide column' } : entry))
 * };
 * ```
 */
export interface GridMenus {
    /** the menu of a cell */
    row?: (defaults: MenuEntry[], context: MenuContext) => MenuEntry[];
    /** the menu of a header label */
    header?: (defaults: MenuEntry[], context: MenuContext) => MenuEntry[];
    /** the menu of a header filter */
    filter?: (defaults: MenuEntry[], context: MenuContext) => MenuEntry[];
}

/**
 * The ids of the grid's own menu entries, per menu, in the order the menus show them - the `defaults`
 * a {@link GridMenus} function gets. Every entry is always in `defaults`: the ones that do not apply
 * (paste on a readonly cell, the summary of a text column ...) have a `visible` callback that hides
 * them. Ids are `menu.section` for a section header and `menu.section.entry` for what is under it.
 *
 * The ids stay the same between versions, so a menu changed by id keeps working. They are text ids
 * too: the label of an entry is the text of its id, its hint the text `<id>.hint` - see {@link TEXTS}
 * and {@link setTexts}. The "shown as" below is the English text; the separators and `filter.values`
 * have no text of their own.
 *
 * Row menu (`GridMenus.row`), right click on a cell:
 *
 * | id | shown as | shown when |
 * | --- | --- | --- |
 * | `row.edit` | Edit: - first in the menu | the grid is editable |
 * | `row.edit.undo` | Undo last change (Ctrl+Z) - `datasource.undo()`, the last edit, paste, clear, delete or revert. Greyed out when there is nothing to undo | the grid is editable |
 * | `row.edit.redo` | Redo (Ctrl+Y) - `datasource.redo()`. Greyed out when there is nothing to redo | the grid is editable |
 * | `row.edit.revertCell` | Undo cell edit - the cell's original value (`datasource.resetField()`). Greyed out when the cell is not edited | the grid is editable |
 * | `row.edit.revertRow` | Undo row edits - the row right clicked back to its original values, unmarked for deletion (`datasource.resetRows(row)`), no selection needed. Greyed out when the row is not edited or marked | the grid is editable |
 * | `row.edit.revertRows` | Undo row edits (selected rows) - the selected rows back, unmarked for deletion (`datasource.resetRows()`). Greyed out when no selected row is edited or marked | the grid is editable |
 * | `row.copy` | Copy: | |
 * | `row.copy.cell` | Cell Value | |
 * | `row.copy.column` | Column (selected rows) | |
 * | `row.copy.row` | Row (selected rows) | |
 * | `row.copy.selectedColumns` | Row (selected rows/col) - the selected columns, all when none is selected | |
 * | `row.filter` | Filter: | |
 * | `row.filter.replace` | Replace filter (all) | |
 * | `row.filter.add` | Add to filter (and) | |
 * | `row.view` | View: | |
 * | `row.view.dimRepeatedValues` | Use dimmed values, with a ✓ when on | |
 * | `row.view.changedOnly` | Changed rows only, with a ✓ when on - the new, edited and deleted rows of the filter (`datasource.filterChangedOnly()`) | |
 * | `row.paste` | Paste: | the grid and the cell are editable |
 * | `row.paste.cell` | Paste cell (selected rows) | the grid and the cell are editable |
 * | `row.clear` | Clear: | the grid and the cell are editable |
 * | `row.clear.cell` | Clear cell (selected rows) - sets the field to `null`, also a number field (emptying the cell stores 0) | the grid and the cell are editable |
 * | `row.delete` | Delete: | the grid is editable |
 * | `row.delete.rows` | Rows (selected rows) - marks them for deletion (`markForDeletion()`), they stay in the grid until the changes are accepted. Skips a row the `isReadonly` hook returns `true` for in every column of the layout. Greyed out when no selected row is left to mark | the grid is editable |
 * | `row.delete.undo` | Undo (selected rows) - takes the mark off the selected rows marked for deletion (`unmarkForDeletion()`) | the grid is editable, and a selected row is marked for deletion |
 * | `row.summary` | Summary: | a number field |
 * | `row.summary.count` | Count: 3 - of the selected rows, click to copy | a number field |
 * | `row.summary.sum` | Sum: 60 | a number field |
 * | `row.summary.max` | Max: 30 | a number field |
 * | `row.summary.min` | Min: 10 | a number field |
 * | `row.summary.avg` | Avg: 20 | a number field |
 * | `row.export` | Export: | |
 * | `row.export.csv` | CSV, all rows - `gridInterface.downloadCsv()`: the rows the filter lets through, as the grid shows them | |
 * | `row.export.csvSelected` | CSV, selected rows - `downloadCsv('export.csv', { rows: 'selected' })`. Greyed out when no row is selected | |
 *
 * Header menu (`GridMenus.header`), right click on a header label:
 *
 * | id | shown as | shown when |
 * | --- | --- | --- |
 * | `header.column` | Column: | |
 * | `header.column.pinLeft` | Pin left | not pinned left |
 * | `header.column.pinLeftCopy` | Pin left (copy) | not pinned left |
 * | `header.column.pinRight` | Pin right | not pinned right |
 * | `header.column.pinRightCopy` | Pin right (copy) | not pinned right |
 * | `header.column.unpin` | Unpin | pinned |
 * | `header.column.hide` | Hide | |
 * | `header.column.removeSorting` | Remove sorting - keeps the sort of the grouped fields | |
 * | `header.column.chooserSeparator` | a line | |
 * | `header.column.chooser` | Column chooser | |
 * | `header.size` | Size: | |
 * | `header.size.column` | Resize Column | |
 * | `header.size.all` | Resize all columns | |
 * | `header.grouping` | Grouping: | |
 * | `header.grouping.expandAll` | Expand all | |
 * | `header.grouping.collapseAll` | Collapse all | |
 * | `header.grouping.clear` | Clear all | |
 *
 * Filter menu (`GridMenus.filter`), right click on a header filter:
 *
 * | id | shown as | shown when |
 * | --- | --- | --- |
 * | `filter.filter` | Filter: | |
 * | `filter.filter.clear` | Clear Filter - the column's conditions | |
 * | `filter.filter.clearAll` | Clear All Filters | |
 * | `filter.filter.blankSeparator` | a line | |
 * | `filter.filter.isBlank` | Set "Is Blank" | |
 * | `filter.filter.isNotBlank` | Set "Is Not Blank" | |
 * | `filter.filter.advancedSeparator` | a line | |
 * | `filter.filter.advanced` | Advanced Filter - the filter editor | |
 * | `filter.operator` | Set Operator: | not a boolean field |
 * | `filter.operator.greaterThanOrEqualTo` | Greater than or equal | a number, date or datetime field |
 * | `filter.operator.lessThanOrEqualTo` | Less than or equal | a number, date or datetime field |
 * | `filter.operator.equal` | Equal | not a boolean field |
 * | `filter.operator.notEqualTo` | Not Equal | a text field |
 * | `filter.operator.contains` | Contains | a text field |
 * | `filter.values` | the value list: "Search:", search box, a checkbox per value, "Run Search" - a {@link MenuBlock}, its texts are `filter.values.*` | a text field |
 *
 * @sample context-menu
 * @example
 * ```ts
 * import { type GridHooks, MENU_IDS } from '@simple-html/grid';
 *
 * // a row menu without the copy entries
 * const hooks: GridHooks = {
 *     menus: { row: (defaults) => defaults.filter((entry) => !entry.id.startsWith('row.copy')) }
 * };
 *
 * MENU_IDS.row.includes('row.paste.cell'); // true
 * ```
 */
export const MENU_IDS = {
    /** the row menu's ids, right click on a cell */
    row: [
        'row.edit',
        'row.edit.undo',
        'row.edit.redo',
        'row.edit.revertCell',
        'row.edit.revertRow',
        'row.edit.revertRows',
        'row.copy',
        'row.copy.cell',
        'row.copy.column',
        'row.copy.row',
        'row.copy.selectedColumns',
        'row.filter',
        'row.filter.replace',
        'row.filter.add',
        'row.view',
        'row.view.dimRepeatedValues',
        'row.view.changedOnly',
        'row.paste',
        'row.paste.cell',
        'row.clear',
        'row.clear.cell',
        'row.delete',
        'row.delete.rows',
        'row.delete.undo',
        'row.summary',
        'row.summary.count',
        'row.summary.sum',
        'row.summary.max',
        'row.summary.min',
        'row.summary.avg',
        'row.export',
        'row.export.csv',
        'row.export.csvSelected'
    ],
    /** the header menu's ids, right click on a header label */
    header: [
        'header.column',
        'header.column.pinLeft',
        'header.column.pinLeftCopy',
        'header.column.pinRight',
        'header.column.pinRightCopy',
        'header.column.unpin',
        'header.column.hide',
        'header.column.removeSorting',
        'header.column.chooserSeparator',
        'header.column.chooser',
        'header.size',
        'header.size.column',
        'header.size.all',
        'header.grouping',
        'header.grouping.expandAll',
        'header.grouping.collapseAll',
        'header.grouping.clear'
    ],
    /** the filter menu's ids, right click on a header filter */
    filter: [
        'filter.filter',
        'filter.filter.clear',
        'filter.filter.clearAll',
        'filter.filter.blankSeparator',
        'filter.filter.isBlank',
        'filter.filter.isNotBlank',
        'filter.filter.advancedSeparator',
        'filter.filter.advanced',
        'filter.operator',
        'filter.operator.greaterThanOrEqualTo',
        'filter.operator.lessThanOrEqualTo',
        'filter.operator.equal',
        'filter.operator.notEqualTo',
        'filter.operator.contains',
        'filter.values'
    ]
} as const;
