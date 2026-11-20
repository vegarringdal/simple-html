import type { Entity } from '../datasource/entity';
import type { FilterExpression, FilterOperator } from '../datasource/filterExpression';
import type { GroupArgument } from '../datasource/groupArgument';
import type { SortArgument } from '../datasource/sortArgument';
import type { IDateConfig } from '../date/interfaces';
import type { GridMenus } from './gridMenus';

/**
 * The grid's config: the options of each column (`columns`), where the columns go (`layout`), sizes
 * and behaviour. It is what you write. What the user changes while working with the grid - column
 * order and widths, sorting, grouping, filters - is the {@link GridState}: read it with
 * `gridInterface.getState()`, set it with `setState()`, and give the state the grid starts in as
 * `initialState`.
 *
 * To change an option while the grid is shown, use `gridInterface.updateConfig()`.
 *
 * The grid does not change the object you pass in: it keeps its own copy of `columns`, `layout` and
 * `initialState`, the parts it changes while the user works.
 *
 * @sample basic-grid
 * @sample column-layout
 * @example
 * ```ts
 * import { createGrid, Datasource, type GridConfig } from '@simple-html/grid';
 *
 * const datasource = new Datasource({ fields: { age: 'number', born: 'date' } });
 *
 * const config: GridConfig = {
 *     columns: {
 *         name: { label: 'Name', placeholderFilter: 'search', mandatory: true },
 *         age: { readonly: true }
 *         // born is in the layout without an entry here: it gets the defaults
 *     },
 *     layout: {
 *         left: [{ fields: ['name'], width: 150 }], // pinned left
 *         center: [{ fields: ['age', 'born'], width: 100 }] // two fields stacked in one column
 *     },
 *     cellHeight: 22,
 *     readonly: false,
 *     initialState: { sorting: [{ attribute: 'name', ascending: true }] }
 * };
 *
 * const gridInterface = createGrid(document.getElementById('grid')!, { config, datasource });
 * ```
 */
export type GridConfig = {
    /**
     * The options of each column, keyed by the field name. A field in the `layout` without an entry
     * here gets the defaults. A field with an entry that is not in the layout is not shown, but the
     * user can add it from the column chooser.
     */
    columns?: Record<string, ColumnConfig>;
    /**
     * Where the columns go: pinned left, the scrolling center and pinned right. It is the layout the
     * grid starts with (unless `initialState.layout` is given) and `resetState()` goes back to. The
     * user changes it - drag/drop, pinning, the column chooser, resizing - those changes are in
     * `getState().layout`.
     *
     * @sample column-layout
     */
    layout: GridLayout;
    /**
     * The state the grid starts in, and `resetState()` goes back to: sorted, grouped, filtered ...
     * What is left out starts empty (no sorting, no filter ...), the layout is `layout`.
     *
     * The grid applies it to the datasource when it is made: a filter, sort or grouping set on the
     * datasource before is replaced, and cleared when `initialState` leaves it out.
     *
     * @sample grid-state
     * @example
     * ```ts
     * import { type GridConfig, where } from '@simple-html/grid';
     *
     * const config: GridConfig = {
     *     layout: { center: [{ fields: ['name'], width: 100 }, { fields: ['age'], width: 100 }] },
     *     initialState: {
     *         sorting: [{ attribute: 'age', ascending: false }],
     *         filter: where('age', 'GREATER_THAN', 18),
     *         headerFilters: { age: { value: 18, operator: 'GREATER_THAN' } } // what the header shows
     *     }
     * };
     * ```
     */
    initialState?: Partial<GridState>;

    /** height of a cell in px, default 22 */
    cellHeight?: number;
    /** height of the top panel (grouping) in px, default 25 */
    panelHeight?: number;
    /**
     * height of a header label cell in px, default `cellHeight`. Make it 2-3 times `cellHeight` for long
     * labels that wrap. `autoResizeColumns()` measures the label on one line
     */
    cellHeaderLabelHeight?: number;
    /** height of the footer in px, default 45 */
    footerHeight?: number;
    /** height of the column selector row under the header filters in px, default 18 */
    selectSizeHeight?: number;
    /** hides the row of header labels (the column names, click to sort), default false */
    hideLabels?: boolean;
    /** hides the row of header filters, default false */
    hideFilter?: boolean;
    /**
     * the whole grid is readonly, default `true`: no cell can be edited, and the row menu has no paste
     * or clear. Set `false` to edit; the column's `readonly` and `isReadonly` can still make cells
     * readonly
     */
    readonly?: boolean;
    /**
     * how rows can be selected, default `'multiple'` (ctrl+click, shift+click). The grid sets it on the
     * datasource every time it is built, so it replaces the datasource's own `selectionMode`
     *
     * @sample selection
     */
    selectionMode?: 'multiple' | 'single';

    /**
     * closes the open menu (the right click menus, `openMenu()`, the date picker ...) when the grid is
     * scrolled, default false. Leave it off where scrolling happens by accident, on a small touch screen
     */
    autoRemoveContextMenuOnScrollEvent?: boolean;

    /**
     * dims a cell when it repeats the value of the row above, so only the first row of a
     * run of equal values reads at full strength. Default = false.
     *
     * A cell always shows at full strength again at the start of a group, and blanks are
     * never dimmed. Can be toggled from the row context menu.
     *
     * @sample misc-options
     */
    dimRepeatedValues?: boolean;

    /**
     * renders the built in tooltip on buttons/icons, default = true
     *
     * the `data-tooltip` attribute is always written to the elements, also when this is
     * false, so you can hook up your own tooltip library instead
     *
     * @sample tooltips
     */
    tooltips?: boolean;

    /**
     * override the built in tooltip texts, keyed by tooltip id.
     * import `TOOLTIPS` to see the ids and their default text
     *
     * @sample tooltips
     */
    tooltipText?: Record<string, string>;

    /**
     * the date picker of date cells and date header filters. Of the {@link IDateConfig} the grid reads
     * `showWeek`, `isoWeek`, `weekHeader`, `monthHeader`, `weekStart`, `rowHeight`, `monthWidth`,
     * `monthMargin`, `hideDimmedDates`, `showYearInMonth` and `datepickerHeight`, and sets the rest
     * itself. The type wants every field. Left out: English names, weeks from monday, week numbers shown
     */
    datePickerConfig?: IDateConfig;

    /**
     * shows a column's `placeholderRow` on the current row (the current entity) only.
     * default = true, so you need to set this to false to display on all rows
     *
     * @sample mandatory-placeholders
     */
    placeholderRowCurrentEntityOnly?: boolean;

    /**
     * Makes a cell readonly, or editable, from the values of its row. Called every time a cell is
     * rendered, and by the row menu's paste and clear for each selected row.
     *
     * Return `true` (readonly) or `false` (editable). `null` or `undefined` leaves it to the config:
     * the column's `readonly` option, which is passed in as `readonlyByConfig`. The grid's own
     * `readonly: true` makes every cell readonly, whatever this returns.
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
     * import type { GridConfig } from '@simple-html/grid';
     *
     * const config: GridConfig = {
     *     readonly: false,
     *     layout: { center: [{ fields: ['company'], width: 150 }, { fields: ['isActive'], width: 80 }] },
     *     // company can not be edited on an inactive row, every other cell follows the config
     *     isReadonly: (row, field) => (field === 'company' && row.isActive === false ? true : null)
     * };
     * ```
     */
    isReadonly?: (row: Entity, field: string, readonlyByConfig: boolean) => boolean | null | undefined;

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
     * import type { GridConfig } from '@simple-html/grid';
     *
     * // .low { position: absolute; inset: 0; background: rgba(239, 68, 68, 0.25); }
     * const config: GridConfig = {
     *     layout: { center: [{ fields: ['name'], width: 150 }, { fields: ['balance'], width: 100 }] },
     *     cellClass: (row, field) => {
     *         if (field === 'balance' && row.balance < 0) {
     *             return { background: 'low', input: 'bold-text' };
     *         }
     *         return null;
     *     }
     * };
     * ```
     */
    cellClass?: (row: Entity, field: string) => CellClass | null | undefined;

    /**
     * Changes the grid's right click menus: hide entries, reorder them, change their labels, add your
     * own. One function per menu - `row` (a cell), `header` (a header label), `filter` (a header
     * filter) - that gets the grid's own entries and what the menu was opened on, and returns the
     * entries to show. Called every time the menu opens. A menu without a function shows its defaults.
     *
     * The ids of the grid's own entries are listed in `MENU_IDS`, see {@link GridMenus} and
     * {@link MenuEntry}. Set or remove the functions later with `gridInterface.updateConfig({ menus })`.
     *
     * Replaces v5's `contextMenuCustom()` for the grid's own menus; a menu of your own is opened with
     * `gridInterface.openMenu()`.
     *
     * @sample context-menu
     * @example
     * ```ts
     * import { type GridConfig, isGroupRow } from '@simple-html/grid';
     *
     * const config: GridConfig = {
     *     layout: { center: [{ fields: ['name'], width: 150 }, { fields: ['age'], width: 80 }] },
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
};

/**
 * The css classes `GridConfig.cellClass` adds to a cell. Each is one or more class names, separated
 * by spaces, the same as a `class` attribute.
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
     * is the cell's background - the grid draws the readonly and mandatory stripes there. On an
     * editable cell it has no size (the grid's readonly and mandatory classes give it one): give the
     * class `position: absolute; inset: 0`. Was `dimmedClass` in v5
     */
    background?: string;
}

/**
 * Where the columns go. Each list is a list of columns from left to right; a column shows one field,
 * or several stacked on top of each other.
 *
 * - `left` - pinned to the left, does not scroll sideways
 * - `center` - scrolls sideways
 * - `right` - pinned to the right
 *
 * @sample column-layout
 * @example
 * ```ts
 * import type { GridLayout } from '@simple-html/grid';
 *
 * const layout: GridLayout = {
 *     left: [{ fields: ['name'], width: 150 }],
 *     center: [
 *         { fields: ['age', 'born'], width: 100 }, // two fields stacked in one column
 *         { fields: ['company'], width: 200 }
 *     ],
 *     right: [] // the same as leaving it out
 * };
 * ```
 */
export interface GridLayout {
    /** the columns pinned to the left, default none */
    left?: LayoutColumn[];
    /** the columns that scroll sideways */
    center: LayoutColumn[];
    /** the columns pinned to the right, default none */
    right?: LayoutColumn[];
}

/**
 * One column of the {@link GridLayout}: the fields it shows, stacked from top to bottom, and its
 * width. The options of a field (label, placeholders, readonly ...) are in `GridConfig.columns`, its
 * type and default label in the datasource's `fields`.
 *
 * Every column gets as many cells as the column with the most fields; a column with fewer fields
 * leaves the rest empty. A column without fields is left out.
 *
 * @sample column-layout
 * @example
 * ```ts
 * import type { LayoutColumn } from '@simple-html/grid';
 *
 * const single: LayoutColumn = { fields: ['name'], width: 150 };
 * const stacked: LayoutColumn = { fields: ['firstName', 'lastName'], width: 120 };
 * ```
 */
export interface LayoutColumn {
    /** the fields shown in this column, top to bottom */
    fields: string[];
    /** width in px */
    width: number;
}

/**
 * The options of one column, in `GridConfig.columns` under the field's name. Every option is
 * optional, a field without an entry gets the defaults.
 *
 * The type of the column comes from the datasource (`datasource.getField(field).type`), set it in the
 * datasource's `fields`, not here.
 *
 * @sample basic-grid
 * @example
 * ```ts
 * import type { ColumnConfig } from '@simple-html/grid';
 *
 * const columns: Record<string, ColumnConfig> = {
 *     company: { label: 'Company', mandatory: true, placeholderRow: 'required' },
 *     age: { operator: 'EQUAL', numberOverride: 'ZERO_TO_BLANK' },
 *     born: { placeholderFilter: 'from date', readonly: true },
 *     country: { focusButton: 'ALWAYS', allowPasteClearOnly: true }
 * };
 * ```
 */
export type ColumnConfig = {
    /**
     * the column's header text. Left out, the label of the datasource field (`FieldConfig.label`) is
     * used, and without that the field name
     */
    label?: string;
    /**
     * shown in an empty cell, see `GridConfig.placeholderRowCurrentEntityOnly`
     *
     * @sample mandatory-placeholders
     */
    placeholderRow?: string;
    /**
     * shown in the empty header filter. Default: the formatter's placeholder (date fields), else a search icon
     *
     * @sample mandatory-placeholders
     */
    placeholderFilter?: string;
    /**
     * the operator the column's header filter starts with. Default `'GREATER_THAN_OR_EQUAL_TO'` for
     * number and date fields, `'EQUAL'` for the rest. The operator the user picks in the header
     * filter's menu is state: `GridState.headerFilters[field].operator`
     *
     * @sample filter-operator-header
     */
    operator?: FilterOperator;
    /**
     * the name of another column whose value in the row is the type of this cell -
     * `'text' | 'number' | 'boolean' | 'date' | 'datetime'`. A number/text/date etc in the same
     * column, for property/value style data. Only for a `text` field (the default), and a value that
     * is no type leaves the cell `text`.
     * PS! sorting, grouping and filtering still use the field's own type
     *
     * @sample dynamic-cell-types
     */
    dynamicCellTypeColumn?: string;

    /**
     * makes the column's cells readonly while the grid is editable (`GridConfig.readonly: false`). The
     * grid draws red stripes behind them. `GridConfig.isReadonly` can decide per row instead
     */
    readonly?: boolean;

    /**
     * for a number field, what a cell shows - the value is not changed: `'ZERO_TO_BLANK'` shows 0 as an
     * empty cell, `'BLANK_TO_ZERO'` shows an empty value as `0`. Default: the value as the formatter
     * shows it
     *
     * @sample misc-options
     */
    numberOverride?: 'ZERO_TO_BLANK' | 'BLANK_TO_ZERO';

    /**
     * shows a `...` button at the right of the cell while it has focus; clicking it, or Space in the cell,
     * sends the `cell-focus-button-click` event - open a dialog or a dropdown from there. When it is
     * shown: `'SHOW_IF_GRID_NOT_READONLY'` the grid is editable, `'SHOW_IF_GRID_AND_CELL_NOT_READONLY'`
     * the grid and the cell are editable, `'ALWAYS'` always. Not on a boolean (checkbox) cell
     *
     * @sample dropdown-grid
     */
    focusButton?: 'SHOW_IF_GRID_NOT_READONLY' | 'SHOW_IF_GRID_AND_CELL_NOT_READONLY' | 'ALWAYS';

    /**
     * marks the empty cells of the column with blue stripes while the grid and the cell are editable: a
     * value the user has to fill in. The mark is gone once the cell has a value (a checked checkbox for
     * a boolean). Restyle it with the `simple-html-mandatory` class. It does not stop a save, check the
     * values yourself
     *
     * @sample mandatory-placeholders
     */
    mandatory?: boolean;

    /**
     * has no effect: `mandatory` marks only the empty cells already. Kept so v5 configs compile
     */
    mandatoryOnlyIfEmpty?: boolean;

    /**
     * the cells can not be typed in, only changed by the row menu's paste and clear (and by your own
     * code, e.g. a dropdown from `focusButton`). Typed text is undone right away
     *
     * @sample misc-options
     */
    allowPasteClearOnly?: boolean;
};

/**
 * What the user changes while working with the grid: `gridInterface.getState()` reads it,
 * `setState()` sets it, `resetState()` goes back to the one the grid started with
 * (`GridConfig.initialState`, and the config's `layout`).
 *
 * It is plain data (`Date`s in the filter and header filters aside), so it can be stored, e.g. as
 * JSON. A `Date` then comes back as its ISO text, which a `date` or `datetime` field filters on the
 * same.
 *
 * @sample grid-state
 * @example
 * ```ts
 * import type { GridState } from '@simple-html/grid';
 *
 * // keep what the user did, and give it back next time
 * localStorage.setItem('my-grid', JSON.stringify(gridInterface.getState()));
 *
 * const saved: GridState | null = JSON.parse(localStorage.getItem('my-grid') ?? 'null');
 * if (saved) {
 *     gridInterface.setState(saved);
 * }
 * ```
 */
export interface GridState {
    /** column order, pinning and widths */
    layout: GridLayout;
    /** the sort, `datasource.getLastSorting()`. When grouped, the grouped fields come first */
    sorting: SortArgument[];
    /** the grouping, `datasource.getGrouping()` */
    grouping: GroupArgument[];
    /** the ids of the expanded groups, `datasource.getExpanded()` */
    expandedGroups: string[];
    /** the filter, `datasource.getFilter()`: the header filters' conditions are part of it */
    filter: FilterExpression | null;
    /**
     * what the header filter cells show, keyed by field: the value typed or picked, and the operator
     * picked in the header filter's menu. Only the columns that have one are listed.
     *
     * The rows are filtered by `filter`: these are what the header shows, the conditions they made are
     * in `filter` already. A state from `getState()` has both.
     */
    headerFilters: Record<string, HeaderFilter>;
}

/**
 * The header filter of one column, see `GridState.headerFilters`.
 *
 * @sample grid-state
 * @example
 * ```ts
 * import type { HeaderFilter } from '@simple-html/grid';
 *
 * const headerFilters: Record<string, HeaderFilter> = {
 *     name: { value: 'ann*' }, // typed in the name column, with the column's operator
 *     age: { value: 30, operator: 'LESS_THAN_OR_EQUAL_TO' }, // the operator picked in the menu
 *     active: { value: true } // a boolean column's checkbox
 * };
 * ```
 */
export interface HeaderFilter {
    /** what the header filter cell shows: the text typed, the date picked, `true`/`false` for a checkbox. null is empty */
    value: unknown;
    /** the operator picked in the header filter's menu. Left out, the column's `operator` is used */
    operator?: FilterOperator;
}

/**
 * @internal
 * The options of the config: all of it but `columns`, `layout` and `initialState`, the parts the grid
 * copies and changes.
 */
export type GridOptions = Omit<GridConfig, 'columns' | 'layout' | 'initialState'>;

/**
 * @internal
 * The options with every default filled in, so these are never undefined.
 */
export type ParsedGridOptions = GridOptions &
    Required<
        Pick<
            GridConfig,
            | 'cellHeight'
            | 'cellHeaderLabelHeight'
            | 'panelHeight'
            | 'footerHeight'
            | 'selectSizeHeight'
            | 'readonly'
            | 'selectionMode'
            | 'tooltips'
            | 'placeholderRowCurrentEntityOnly'
        >
    >;

/**
 * @internal
 * The config as the grid works with it: the options with every default filled in, and the internal
 * sizes `GridInterface.__parseConfig()` computes. `columns` has an entry for every field of the layout.
 *
 * `layout` is the grid's own copy, the user changes it (drag/drop, pinning, the column chooser,
 * resizing) - it is the state's layout, `getState()` hands out a copy of it.
 */
export type ParsedGridConfig = ParsedGridOptions & {
    columns: Record<string, ColumnConfig>;
    layout: Required<GridLayout>;
    __rowHeight: number;
    __rowHeaderHeight: number;
    __columnCells: number;
    __leftWidth: number;
    __rightWidth: number;
    __scrollbarSize: number;
    __selectSizeWidth: number;
};
