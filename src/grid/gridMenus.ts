import type { Datasource } from '../datasource/dataSource';
import type { Entity, GroupRow } from '../datasource/entity';
import type { GridInterface } from './gridInterface';

/**
 * One entry of a menu: an item to click, a submenu, a section header, a separator line, or a block
 * (an element shown as it is). The grid's own menus are lists of these, see {@link GridMenus} to
 * change them, and `gridInterface.openMenu()` opens a menu of your own.
 *
 * Every entry has an `id`. The ids of the grid's own entries are listed in {@link MENU_IDS}; give
 * yours ids that do not clash with them.
 *
 * An entry with a `visible` callback that returns `false` is left out. A section header or separator
 * is shown as long as it is in the list: hide it together with the entries under it. A submenu with
 * no item, submenu or block left to show is left out too.
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
 *     {
 *         type: 'submenu',
 *         id: 'fruit.more',
 *         label: 'More',
 *         entries: [
 *             { id: 'fruit.kiwi', label: 'Kiwi', action: () => pick('Kiwi') },
 *             { id: 'fruit.mango', label: 'Mango', action: () => pick('Mango') }
 *         ]
 *     },
 *     { type: 'separator', id: 'fruit.separator' },
 *     { id: 'fruit.none', label: 'None', hint: 'clears the cell', action: () => pick(null) }
 * ];
 * gridInterface.openMenu(event, entries);
 * ```
 */
export type MenuEntry = MenuItem | MenuSubmenu | MenuSection | MenuSeparator | MenuBlock;

/**
 * An entry to click. Clicking it - or Enter or Space on it - closes the menu and its submenus, then
 * calls `action`.
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
    /**
     * `true` shows the item greyed out, and clicking it does nothing. The keyboard still gets to it,
     * as the ARIA menu pattern has it. Called when the menu opens
     */
    disabled?: (context: MenuContext) => boolean;
    /**
     * A toggle or a choice: `true` shows a ✓ in front of the label - the aggregates of the header
     * menu, the operator in use in the filter menu. With it the item is a `menuitemcheckbox` for a
     * screen reader, `aria-checked` says whether it is on. Called when the menu opens
     */
    selected?: (context: MenuContext) => boolean;
}

/**
 * An entry that opens a menu of its own: shown with a `›` after the label, its `entries` open beside
 * it - on its right, on its left when there is no room on the right, kept in the window. It opens when
 * the pointer rests on it (150ms, so moving the pointer across it to an open submenu does not swap
 * them), on a click, and with ArrowRight, Enter or Space. ArrowLeft and Esc close it again.
 *
 * One submenu is open at a time in a menu: moving to another entry closes it. A click on an item in
 * a submenu closes the whole menu, then calls its action. Submenus can hold submenus.
 *
 * A submenu with nothing to show - every item, submenu and block in it hidden by `visible` - is left
 * out of the menu.
 *
 * The grid's own menus have their entries in submenus (`row.copy`, `header.size`, ...): change one
 * with `map`, see {@link GridMenus}.
 *
 * @sample context-menu
 * @example
 * ```ts
 * import type { MenuSubmenu } from '@simple-html/grid';
 *
 * declare const exportAs: (format: string) => void;
 *
 * const exportMenu: MenuSubmenu = {
 *     type: 'submenu',
 *     id: 'my.export',
 *     label: 'Export as',
 *     entries: [
 *         { id: 'my.export.csv', label: 'CSV', action: () => exportAs('csv') },
 *         { id: 'my.export.json', label: 'JSON', action: () => exportAs('json') }
 *     ]
 * };
 * ```
 */
export interface MenuSubmenu {
    /** always `'submenu'` */
    type: 'submenu';
    /** a name for the entry, unique in its menu. See {@link MENU_IDS} for the grid's own */
    id: string;
    /** the text shown, a `›` is put after it */
    label: string;
    /** what the submenu shows, in order: the same entries a menu has */
    entries: MenuEntry[];
    /** `false` leaves the submenu out of the menu. Called when the menu opens, left out it is shown */
    visible?: (context: MenuContext) => boolean;
}

/**
 * A section header, "Pick a fruit:", with a line under it. Not clickable, the keyboard passes it by.
 * The grid's own menus have submenus instead of sections.
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
    /** the text shown */
    label: string;
    /** `false` leaves the header out of the menu. Called when the menu opens, left out it is shown */
    visible?: (context: MenuContext) => boolean;
}

/**
 * A dashed line between two entries. Not clickable, the keyboard passes it by.
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
 * the element handles its own clicks, input and keys, and clicking in it does not close the menu -
 * call `gridInterface.closeMenu()` for that. The arrow keys of the menu pass it by: Tab gets into it,
 * from an item of its menu.
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
 * grid's own entries for that menu (`defaults`, the tree shown in {@link MENU_IDS}) and what the menu
 * was opened on, and returns the entries to show - hide some, reorder them, change them, add your
 * own. Called every time the menu opens.
 *
 * - `row`: right click on a cell - undo, then the submenus copy, paste, clear, delete, filter, view,
 *   size, export
 * - `header`: right click on a header label - pin, hide, remove sorting, column chooser, then the
 *   submenus size, aggregate, grouping
 * - `filter`: right click on a header filter - clear, the submenus blank and operator, the filter
 *   editor, the value list
 *
 * `defaults` is a tree: most entries are in a submenu ({@link MenuSubmenu}), whose id is the start of
 * theirs - `row.copy.cell` is in `row.copy`. A filter on `defaults` sees the top of the menu: hiding
 * `row.copy` hides the submenu with what is in it. An entry in a submenu is changed in its
 * submenu's `entries`, with `map`.
 *
 * The grid's own entries are new objects every time, change them as you like. Left out, a menu shows
 * its defaults. Change the functions while the grid is shown with `gridInterface.updateHooks({ menus })`.
 *
 * @sample context-menu
 * @example
 * ```ts
 * import type { GridMenus, MenuEntry } from '@simple-html/grid';
 *
 * // createGrid(host, { config, datasource, hooks: { menus } })
 * const menus: GridMenus = {
 *     row: (defaults, context) => [
 *         // no export: the submenu and what is in it
 *         ...defaults.filter((entry) => !entry.id.startsWith('row.export')),
 *         { id: 'my.logRow', label: 'Log row', action: () => console.log(context.field, context.row) }
 *     ],
 *     // the value list first, then the rest
 *     filter: (defaults) => [
 *         ...defaults.filter((entry) => entry.id === 'filter.values'),
 *         ...defaults.filter((entry) => entry.id !== 'filter.values')
 *     ],
 *     // in the size submenu: one entry less, and one of your own
 *     header: (defaults, context) =>
 *         defaults.map((entry): MenuEntry => {
 *             if (entry.type !== 'submenu' || entry.id !== 'header.size') {
 *                 return entry;
 *             }
 *             return {
 *                 ...entry,
 *                 entries: [
 *                     ...entry.entries.filter((inner) => inner.id !== 'header.size.resetAll'),
 *                     { id: 'my.wide', label: 'Wide', action: () => console.log('wide', context.field) }
 *                 ]
 *             };
 *         })
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
 * The ids of the grid's own menu entries, per menu: the `defaults` a {@link GridMenus} function
 * gets. The lists are flat, in the order of the tree: a submenu, then what is in it. Every entry is
 * always in `defaults`: the ones that do not apply (paste on a readonly cell, the range entries
 * without a range ...) have a `visible` callback that hides them, and a submenu with nothing left to show is
 * hidden too.
 *
 * The ids are `menu.part.entry`: an entry in a submenu starts with the id of the submenu
 * (`row.copy.cell` is in `row.copy`), and the entries of a part of the menu share its start
 * (`header.column.*`: pin, hide, remove sorting, the column chooser). The ids stay the same between
 * versions, so a menu changed by id keeps working. They are text ids too: the label of an entry is
 * the text of its id, its hint the text `<id>.hint` - see {@link TEXTS} and {@link setTexts}. The
 * "shown as" below is the English text; the separators and `filter.values` have no text of their own.
 *
 * The menus as they open, a `›` is a submenu:
 *
 * ```text
 * row menu                          header menu                     filter menu
 * Undo last change (Ctrl+Z)         Pin ›                           Clear Filter
 * Redo (Ctrl+Y)                     Hide column                     Clear All Filters
 * Undo cell edit                    Remove sorting                  ----
 * Undo row edits                    ----                            Blank ›
 * Undo row edits (selected rows)    Column chooser…                 Operator ›
 * ----                              Size ›                          ----
 * Copy ›                            Aggregate ›                     Advanced Filter…
 * Paste ›                           Grouping ›                      Search: the value list
 * Clear ›
 * Delete ›
 * Filter ›
 * View ›
 * Size ›
 * Export ›
 * ```
 *
 * Row menu (`GridMenus.row`), right click on a cell:
 *
 * | id | shown as | shown when |
 * | --- | --- | --- |
 * | `row.edit.undo` | Undo last change (Ctrl+Z) - `datasource.undo()`, the last edit, paste, clear, delete or revert. Greyed out when there is nothing to undo | the grid is editable |
 * | `row.edit.redo` | Redo (Ctrl+Y) - `datasource.redo()`. Greyed out when there is nothing to redo | the grid is editable |
 * | `row.edit.revertCell` | Undo cell edit - the cell's original value (`datasource.resetField()`). Greyed out when the cell is not edited | the grid is editable |
 * | `row.edit.revertRow` | Undo row edits - the row right clicked back to its original values, unmarked for deletion (`datasource.resetRows(row)`), no selection needed. Greyed out when the row is not edited or marked | the grid is editable |
 * | `row.edit.revertRows` | Undo row edits (selected rows) - the selected rows back, unmarked for deletion (`datasource.resetRows()`). Greyed out when no selected row is edited or marked | the grid is editable |
 * | `row.edit.separator` | a line | the grid is editable |
 * | `row.copy` | Copy › - a submenu | |
 * | `row.copy.cell` | Cell Value | |
 * | `row.copy.column` | Column (selected rows) | |
 * | `row.copy.row` | Row (selected rows) | |
 * | `row.copy.selectedColumns` | Row (selected rows/col) - the selected columns, all when none is selected | |
 * | `row.copy.range` | Range - the last range of cells, as Ctrl+C copies it: tab separated text and an html table | there are ranges of cells |
 * | `row.paste` | Paste › - a submenu | the grid and the cell are editable, or the grid is and there are ranges of cells |
 * | `row.paste.cell` | Paste cell (selected rows) | the grid and the cell are editable |
 * | `row.paste.range` | Paste range - the clipboard as Ctrl+V pastes it with ranges: one value into every cell of them, a block from the top left of the last one | the grid is editable, there are ranges of cells |
 * | `row.clear` | Clear › - a submenu | the grid and the cell are editable, or the grid is and there are ranges of cells |
 * | `row.clear.cell` | Clear cell (selected rows) - sets the field to `null`, also a number field (emptying the cell stores 0) | the grid and the cell are editable |
 * | `row.clear.range` | Clear range - every cell of the ranges, as Delete: `null`, the readonly cells skipped | the grid is editable, there are ranges of cells |
 * | `row.delete` | Delete › - a submenu | the grid is editable |
 * | `row.delete.rows` | Rows (selected rows) - marks them for deletion (`markForDeletion()`), they stay in the grid until the changes are accepted. Skips a row the `isReadonly` hook returns `true` for in every column of the layout. Greyed out when no selected row is left to mark | the grid is editable |
 * | `row.delete.undo` | Undo (selected rows) - takes the mark off the selected rows marked for deletion (`unmarkForDeletion()`) | the grid is editable, and a selected row is marked for deletion |
 * | `row.filter` | Filter › - a submenu | |
 * | `row.filter.replace` | Replace filter (all) | |
 * | `row.filter.add` | Add to filter (and) | |
 * | `row.view` | View › - a submenu | |
 * | `row.view.dimRepeatedValues` | Use dimmed values, a toggle with a ✓ when on | |
 * | `row.view.changedOnly` | Changed rows only, a toggle with a ✓ when on - the new, edited and deleted rows of the filter (`datasource.filterChangedOnly()`) | |
 * | `row.size` | Size › - a submenu | |
 * | `row.size.fitColumn` | Fit column to this cell - the column as wide as the cell's text (`gridInterface.fitColumns([field], { rows: [row] })`) | |
 * | `row.size.fitRow` | Fit row height - the row right clicked as high as its multiline cells need (`gridInterface.fitRows(row)`) | |
 * | `row.size.fitRows` | Fit row height (selected rows) - the selected rows and the rows of the ranges of cells | rows are selected, or there are ranges of cells |
 * | `row.size.fitAllRows` | Fit all rows - every row the filter lets through (`fitRows()`) | |
 * | `row.size.resetRow` | Reset row height - the row right clicked (`resetRowHeights(row)`). Greyed out when it has the height of the layout | |
 * | `row.size.resetAllRows` | Reset all row heights (`resetRowHeights()`). Greyed out when no row has a height of its own | |
 * | `row.export` | Export › - a submenu | |
 * | `row.export.excel` | Excel, all rows - `gridInterface.downloadExcel()`: the rows the filter lets through, as an .xlsx file | |
 * | `row.export.excelSelected` | Excel, selected rows - `downloadExcel('export.xlsx', { rows: 'selected' })`. Greyed out when no row is selected | |
 *
 * Header menu (`GridMenus.header`), right click on a header label:
 *
 * | id | shown as | shown when |
 * | --- | --- | --- |
 * | `header.column.pin` | Pin › - a submenu | |
 * | `header.column.pinLeft` | Pin left | not pinned left |
 * | `header.column.pinLeftCopy` | Pin left (copy) | not pinned left |
 * | `header.column.pinRight` | Pin right | not pinned right |
 * | `header.column.pinRightCopy` | Pin right (copy) | not pinned right |
 * | `header.column.unpin` | Unpin | pinned |
 * | `header.column.hide` | Hide column | |
 * | `header.column.removeSorting` | Remove sorting - keeps the sort of the grouped fields | |
 * | `header.column.chooserSeparator` | a line | |
 * | `header.column.chooser` | Column chooser… | |
 * | `header.size` | Size › - a submenu | |
 * | `header.size.column` | Fit column width - to its content and label (`gridInterface.fitColumns([field])`) | |
 * | `header.size.all` | Fit all columns (`fitColumns()`) | |
 * | `header.size.resetColumn` | Reset column width - the width of the config (`resetColumnWidths([field])`) | |
 * | `header.size.resetAll` | Reset all column widths (`resetColumnWidths()`) | |
 * | `header.aggregate` | Aggregate › - a submenu | |
 * | `header.aggregate.sum` | Sum - a toggle with a ✓ when on: the column's sum in the group rows and the totals row (`GridState.aggregates`) | a number field |
 * | `header.aggregate.avg` | Average, a toggle | a number field |
 * | `header.aggregate.min` | Min, a toggle | a number field |
 * | `header.aggregate.max` | Max, a toggle | a number field |
 * | `header.aggregate.count` | Count, a toggle: the values that are not blank | |
 * | `header.aggregate.totalsSeparator` | a line | |
 * | `header.aggregate.totalsRow` | Totals row, a toggle (`GridState.totalsRow`) | |
 * | `header.grouping` | Grouping › - a submenu | |
 * | `header.grouping.expandAll` | Expand all | |
 * | `header.grouping.collapseAll` | Collapse all | |
 * | `header.grouping.clear` | Clear all | |
 *
 * Filter menu (`GridMenus.filter`), right click on a header filter:
 *
 * | id | shown as | shown when |
 * | --- | --- | --- |
 * | `filter.filter.clear` | Clear Filter - the column's conditions | |
 * | `filter.filter.clearAll` | Clear All Filters | |
 * | `filter.filter.blankSeparator` | a line | |
 * | `filter.filter.blank` | Blank › - a submenu | |
 * | `filter.filter.isBlank` | Is blank - the column's conditions replaced with `IS_BLANK` | |
 * | `filter.filter.isNotBlank` | Is not blank | |
 * | `filter.operator` | Operator › - a submenu, the operator in use has a ✓ | not a boolean field |
 * | `filter.operator.greaterThanOrEqualTo` | Greater than or equal | a number, date or datetime field |
 * | `filter.operator.lessThanOrEqualTo` | Less than or equal | a number, date or datetime field |
 * | `filter.operator.equal` | Equal | not a boolean field |
 * | `filter.operator.notEqualTo` | Not Equal | a text field |
 * | `filter.operator.contains` | Contains | a text field |
 * | `filter.filter.advancedSeparator` | a line | |
 * | `filter.filter.advanced` | Advanced Filter… - the filter editor | |
 * | `filter.values` | the value list: "Search:", search box, a checkbox per value, "Run Search" - a {@link MenuBlock}, its texts are `filter.values.*` | a text field |
 *
 * @sample context-menu
 * @example
 * ```ts
 * import { type GridHooks, MENU_IDS } from '@simple-html/grid';
 *
 * // a row menu without the copy submenu
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
        'row.edit.undo',
        'row.edit.redo',
        'row.edit.revertCell',
        'row.edit.revertRow',
        'row.edit.revertRows',
        'row.edit.separator',
        'row.copy',
        'row.copy.cell',
        'row.copy.column',
        'row.copy.row',
        'row.copy.selectedColumns',
        'row.copy.range',
        'row.paste',
        'row.paste.cell',
        'row.paste.range',
        'row.clear',
        'row.clear.cell',
        'row.clear.range',
        'row.delete',
        'row.delete.rows',
        'row.delete.undo',
        'row.filter',
        'row.filter.replace',
        'row.filter.add',
        'row.view',
        'row.view.dimRepeatedValues',
        'row.view.changedOnly',
        'row.size',
        'row.size.fitColumn',
        'row.size.fitRow',
        'row.size.fitRows',
        'row.size.fitAllRows',
        'row.size.resetRow',
        'row.size.resetAllRows',
        'row.export',
        'row.export.excel',
        'row.export.excelSelected'
    ],
    /** the header menu's ids, right click on a header label */
    header: [
        'header.column.pin',
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
        'header.size.resetColumn',
        'header.size.resetAll',
        'header.aggregate',
        'header.aggregate.sum',
        'header.aggregate.avg',
        'header.aggregate.min',
        'header.aggregate.max',
        'header.aggregate.count',
        'header.aggregate.totalsSeparator',
        'header.aggregate.totalsRow',
        'header.grouping',
        'header.grouping.expandAll',
        'header.grouping.collapseAll',
        'header.grouping.clear'
    ],
    /** the filter menu's ids, right click on a header filter */
    filter: [
        'filter.filter.clear',
        'filter.filter.clearAll',
        'filter.filter.blankSeparator',
        'filter.filter.blank',
        'filter.filter.isBlank',
        'filter.filter.isNotBlank',
        'filter.operator',
        'filter.operator.greaterThanOrEqualTo',
        'filter.operator.lessThanOrEqualTo',
        'filter.operator.equal',
        'filter.operator.notEqualTo',
        'filter.operator.contains',
        'filter.filter.advancedSeparator',
        'filter.filter.advanced',
        'filter.values'
    ]
} as const;
