import type { FilterExpression, FilterOperator } from '../datasource/filterExpression';
import type { GroupArgument } from '../datasource/groupArgument';
import type { SortArgument } from '../datasource/sortArgument';
import type { IDateConfig } from '../date/interfaces';
import type { Texts } from '../texts';

/**
 * The grid's config: the options of each column (`columns`), where the columns go (`layout`), sizes
 * and behaviour. It is what you write. What the user changes while working with the grid - column
 * order and widths, sorting, grouping, filters - is the {@link GridState}: read it with
 * `gridInterface.getState()`, set it with `setState()`, and give the state the grid starts in as
 * `initialState`.
 *
 * **It is plain JSON**: no functions, so it can be stored - in a backend, say - and given back as it
 * is. The functions of a grid (`isReadonly`, `cellClass`, `menus`) are {@link GridHooks}, given next
 * to the config: `createGrid(host, { config, datasource, hooks })`. A `Date` in `initialState`'s
 * filter is the one value that does not survive JSON as it was: it comes back as its ISO text, see
 * {@link GridState}.
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
 * const datasource = new Datasource({ fields: { name: { validate: ['required'] }, age: 'number', born: 'date' } });
 *
 * const config: GridConfig = {
 *     columns: {
 *         name: { label: 'Name', placeholderFilter: 'search' },
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
     * or clear. Set `false` to edit; the column's `readonly` and the `isReadonly` hook
     * ({@link GridHooks}) can still make cells readonly
     */
    readonly?: boolean;
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
     * shows the state of each row on its row number, default `true`: an icon for a new row (+), an
     * edited row (a pencil), a row marked for deletion (a trash can, the row number and the text of
     * its cells struck through) and a row with an error (!, with the red bar). The tooltip and a
     * screen reader get the state as text. One icon: deleted wins, then an error, then new or edited.
     * The row numbers are a little wider, to make room for the icon.
     *
     * `false` shows the plain row number. The classes `row-is-new`, `row-is-modified` and
     * `row-is-deleted` around the number, and the error bar (`simple-html-row-error`), are there
     * either way - for a look of your own. The colours are the theme's variables
     * (`--simple-html-grid-new-color` ...), see the theming guide
     *
     * @sample editing
     */
    rowStatus?: boolean;

    /**
     * shows a marker in the top left corner of an edited cell, default `true`: a small triangle on a
     * cell whose value differs from its original value (the datasource tracks it per field, see
     * `getChanges()`). Not on a new row, every cell of it is new. Its tooltip shows the original
     * value, and a click on it puts the original value back (`datasource.resetField()`, a step of the
     * undo history) - in an editable grid.
     *
     * `false` shows no marker. The cell element has the class `simple-html-cell-edited` either way,
     * for a look of your own. The colour is `--simple-html-grid-edited-color`
     *
     * @sample editing
     */
    editedMarker?: boolean;

    /**
     * renders the built in tooltip, default = true: on the buttons and icons of the filter editor,
     * and the validation messages on a cell with an error and on its row selector
     *
     * the `data-tooltip` attribute is always written to the elements, also when this is
     * false, so you can hook up your own tooltip library instead. The texts of the tooltips are
     * texts like the others, their ids end with `.tooltip`: see `texts`
     *
     * @sample tooltips
     * @sample validation
     */
    tooltips?: boolean;

    /**
     * The texts of this grid, by id: the ones to change. They win over the texts of the page
     * ({@link setTexts}), which win over the defaults ({@link TEXTS}, English). Plain JSON.
     *
     * - Every text the grid shows: the menus, the filter editor, the column chooser, the footer, the
     *   tooltips (ids ending with `.tooltip`) and the date picker. Not the texts the datasource makes -
     *   the validation messages, `getFilterString()` and the name of the group of blank values: they are
     *   set with `setTexts()` only.
     * - `updateConfig({ texts })` replaces them as a whole, and rebuilds the grid. A menu or the filter
     *   editor shows them the next time it opens.
     *
     * For one language on the whole page, `setTexts()` is enough: this is for a grid that differs.
     *
     * @sample translation
     * @example
     * ```ts
     * import type { GridConfig } from '@simple-html/grid';
     *
     * const config: GridConfig = {
     *     layout: { center: [{ fields: ['name'], width: 150 }] },
     *     texts: {
     *         'row.copy': 'Kopier:',
     *         'filterEditor.addCondition.tooltip': 'Legg til betingelse'
     *     }
     * };
     * ```
     */
    texts?: Texts;

    /**
     * the date picker of date cells and date header filters: only the fields to change. Of the
     * {@link IDateConfig} the grid reads `showWeek` (default true), `isoWeek` (true), `weekStart` (1,
     * monday), `rowHeight` (22), `monthWidth` (230), `monthMargin` (10), `hideDimmedDates` (false),
     * `showYearInMonth` (false) and `datepickerHeight` (317), and sets the rest itself. Its texts - the
     * names of the months and days, the buttons - are the grid's `texts` (`datePicker.*`)
     *
     * @example
     * ```ts
     * import type { GridConfig } from '@simple-html/grid';
     *
     * const config: GridConfig = {
     *     layout: { center: [{ fields: ['born'], width: 120 }] },
     *     datePickerConfig: { weekStart: 0, isoWeek: false } // weeks from sunday, the rest the defaults
     * };
     * ```
     */
    datePickerConfig?: Partial<IDateConfig>;

    /**
     * shows a column's `placeholderRow` on the current row (the current entity) only.
     * default = true, so you need to set this to false to display on all rows
     *
     * @sample required-placeholders
     */
    placeholderRowCurrentEntityOnly?: boolean;
};

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
 * datasource's `fields`, not here. So do the validation rules: a value the user has to fill in is the
 * field's `required` rule (`fields: { company: { validate: ['required'] } }`), which also gives its
 * empty editable cells the grid's blue stripes (`simple-html-mandatory`). It replaces v5's
 * `mandatory` column option.
 *
 * @sample basic-grid
 * @example
 * ```ts
 * import type { ColumnConfig } from '@simple-html/grid';
 *
 * const columns: Record<string, ColumnConfig> = {
 *     company: { label: 'Company', placeholderRow: 'required' },
 *     age: { operator: 'EQUAL', numberOverride: 'ZERO_TO_BLANK' },
 *     born: { placeholderFilter: 'from date', readonly: true },
 *     country: { focusButton: 'ALWAYS', allowPasteClearOnly: true }
 * };
 * ```
 */
export type ColumnConfig = {
    /**
     * the column's header text. Left out, the label of the datasource field (`FieldConfig.label`) is
     * used, and without that the field name prettified (`first_name` is `First Name`). The grid shows
     * the same label everywhere: header, column chooser, group chip, filter editor, footer filter
     */
    label?: string;
    /**
     * shown in an empty cell, see `GridConfig.placeholderRowCurrentEntityOnly`
     *
     * @sample required-placeholders
     */
    placeholderRow?: string;
    /**
     * shown in the empty header filter. Default: the formatter's placeholder (date fields), else the field's type: `Text` or `Number` (texts `filter.placeholder.*`)
     *
     * @sample required-placeholders
     */
    placeholderFilter?: string;
    /**
     * the operator the column's header filter starts with. Default `'GREATER_THAN_OR_EQUAL_TO'` for
     * number and date fields, `'EQUAL'` for the rest. For text `'EQUAL'` is the whole text, ignoring
     * case: `ann` finds `Ann`, not `Anna`. Set `'CONTAINS'` for a search anywhere in the text,
     * `'BEGIN_WITH'` for the start. The operator the user picks in the header filter's menu is state:
     * `GridState.headerFilters[field].operator`
     *
     * @sample filter-operator-header
     * @example
     * ```ts
     * import type { GridConfig } from '@simple-html/grid';
     *
     * const config: GridConfig = {
     *     columns: { name: { operator: 'CONTAINS' } }, // `ann` finds Ann, Anna and Joanna
     *     layout: { center: [{ fields: ['name'], width: 150 }] }
     * };
     * ```
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
     * grid draws red stripes behind them. The `isReadonly` hook ({@link GridHooks}) can decide per row
     * instead
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
 * It is plain data, so it can be stored, e.g. as JSON. The one value JSON changes is a `Date` in the
 * filter or a header filter: it comes back as its ISO text, and `setState()` keeps it as text. A
 * `date` or `datetime` field reads the text as the same moment - the same rows, the same date in the
 * header filter. A field not listed as `date` / `datetime` in the datasource's `fields` filters on a
 * `Date` as a date only while it is a `Date`, after JSON it compares the text: list its type.
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
            | 'tooltips'
            | 'rowStatus'
            | 'editedMarker'
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
