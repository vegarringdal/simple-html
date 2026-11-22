import type { AggregateFunction } from '../datasource/aggregate';
import type { FilterExpression, FilterOperator } from '../datasource/filterExpression';
import type { GroupArgument } from '../datasource/groupArgument';
import type { SortArgument } from '../datasource/sortArgument';
import type { IDateConfig } from '../date/interfaces';
import type { Texts } from '../texts';
import type { ColumnFormat } from './columnFormat';

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

    /**
     * height of a cell in px, default 22. A row is a line of cells this high, or one per field of a
     * column with stacked fields. `gridInterface.fitRows()` makes a row as many lines high as its
     * multiline cells need: the first line of a cell this high, each line after it
     * `multilineLineHeight`
     */
    cellHeight?: number;
    /**
     * the height in px of a line of text of a multiline cell, default `15`: in a row made taller
     * (`gridInterface.fitRows()`) the lines of a cell's text after its first are this far apart - the
     * first line is in the cell's input, `cellHeight` high. So the text reads as a paragraph, and a row
     * of a note of three lines is `cellHeight + 2 * multilineLineHeight` high (52px by default). The
     * editor of a multiline cell has the same line height.
     *
     * 15 is about 1.35 times the default font size (11px). With a larger font
     * (`--simple-html-grid-font-size`) make it larger too, as `cellHeight`: the grid needs it in px to
     * place the rows, it does not read the css.
     *
     * A whole number of 1 or more, anything else throws a `TypeError` when the grid is made or
     * `updateConfig()` is given it.
     *
     * @sample multiline
     * @example
     * ```ts
     * import type { GridConfig } from '@simple-html/grid';
     *
     * const config: GridConfig = {
     *     layout: { center: [{ fields: ['notes'], width: 200 }] },
     *     cellHeight: 28,
     *     multilineLineHeight: 18 // for --simple-html-grid-font-size: 13px
     * };
     * ```
     */
    multilineLineHeight?: number;
    /** height of the top panel (grouping) in px, default 25 */
    panelHeight?: number;
    /**
     * height of a header label cell in px, default `cellHeight`. Make it 2-3 times `cellHeight` for long
     * labels that wrap. `fitColumns()` measures the label on one line
     */
    cellHeaderLabelHeight?: number;
    /**
     * height of the footer in px, default 45: the row count, under it the filter (Clear and the chips) or
     * the button "No filter" that opens the filter editor. `0` hides it: no "No filter", no stop of Tab
     */
    footerHeight?: number;
    /**
     * height of the column selector row under the header filters in px, default 18; 0 hides it. Its
     * numbers select columns (`gridInterface.getSelectedColumns()`), a right click opens the column menu
     */
    selectSizeHeight?: number;
    /** hides the row of header labels (the column names, click to sort), default false */
    hideLabels?: boolean;
    /** hides the row of header filters, default false */
    hideFilter?: boolean;
    /**
     * shows the operator of each header filter in its cell, default `true`: a small symbol beside the
     * input - on the right of a text filter (and a lookup column's), on the left of a number or date
     * filter - `=`, `≠`, `<`, `≤`, `>`, `≥`, `a..b` (between), `*a*` (contains), `!*a*` (does not
     * contain), `a*` (begins with), `*a` (ends with). Its tooltip names the operator. A click (a tap, F4
     * in the filter) opens the operator choice under it: the operators of the filter menu's
     * Filter › Operator ›, picking one does what Operator › does. A column that offers one operator only
     * shows it, it can not be clicked. Not on a boolean column (a checkbox), nor on a column narrower
     * than 60px: the input keeps its room.
     *
     * The symbols are texts (`filter.indicator.<FilterOperator>`), the tooltip `filter.indicator.tooltip`.
     * `false` shows the plain inputs, and F4 opens nothing: the operator is picked in the filter menu
     * only. A lookup's dropdown grid has it `false`. See the filtering guide, "Header filters"
     *
     * @sample filtering
     */
    filterOperatorIndicator?: boolean;
    /**
     * shows the settings button, a gear at the right end of the footer, default `true`: it opens the
     * column settings dialog - each column's display format, a text column's template and link, applied
     * to the state (`GridState.formats`), so `getState()` keeps what the user set. Its name and tooltip
     * are the text `footer.settings`. Not in a footer of no height (`footerHeight: 0`); a lookup's
     * dropdown grid has it `false`.
     *
     * `false` hides the button only: the header menu still has *Column settings…* (`header.settings`,
     * take it out with the `menus` hook), and `gridInterface.openColumnSettings()` opens the dialog from
     * a button of your own. See the formatting guide, "The column settings dialog"
     */
    settingsButton?: boolean;
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
     * A field in conflict - the server changed it while the user had it edited, see
     * `datasource.getConflicts()` - has the conflict marker instead, with or without this option: its
     * colour is `--simple-html-grid-conflict-color`, its tooltip has the server's value, a click takes it
     * (in an editable grid). The cell element has the class `simple-html-cell-conflict`
     *
     * @sample editing
     */
    editedMarker?: boolean;

    /**
     * the cells a merge changed flash once, default `true`: a cell whose value `datasource.upsert()`
     * changed gets the class `simple-html-cell-merged` when it is rendered in the second after, and a
     * tint that fades out over that second (`--simple-html-grid-merged-color`). A field the user has
     * edited is not changed by a merge - it is a conflict, the cell has the conflict marker. `false`: no
     * flash. See the guide "Live data"
     *
     * @sample live-data
     */
    mergeHighlight?: boolean;

    /**
     * a copy of more than one cell starts with a header line of the column labels - ranges (Ctrl+C) and
     * the row menu's Column / Row / Range copies - in the text and in the html table, so a table pasted
     * into Word or Excel has its headers. Default `true`; `false` copies the values only. A single cell
     * copies its value only. Pasted into the grid, a first line of the grid's column labels is skipped.
     * See the guide "Selection and clipboard"
     */
    copyHeaders?: boolean;

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
     * the lines of a multiline cell's text its tooltip shows, default `5`: the first lines, then a
     * line that says how many more there are (`… 7 more lines`, the text `cell.multiline.moreLines`).
     * When only one line is left over, it is shown instead. The empty lines at the end of the text
     * are left out, a line of more than 100 characters is cut with `…`. The tooltip of the marker of
     * an edited cell shows the original value the same way.
     *
     * A whole number of 1 or more, anything else throws a `TypeError` when the grid is made or
     * `updateConfig()` is given it.
     *
     * @sample multiline
     * @example
     * ```ts
     * import type { GridConfig } from '@simple-html/grid';
     *
     * const config: GridConfig = {
     *     layout: { center: [{ fields: ['notes'], width: 200 }] },
     *     multilineTooltipLines: 10 // longer notes in the tooltip
     * };
     * ```
     */
    multilineTooltipLines?: number;

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
     *         'row.copy': 'Kopier',
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
     * `showYearInMonth` (false) and `datepickerHeight` (282), and sets the rest itself. Its texts - the
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

    /**
     * shows the aggregates of each column that has some (`ColumnConfig.aggregate`) in the group rows,
     * default `true`: in the column's place, over the group's rows - the rows of its sub groups and
     * of collapsed groups included.
     *
     * A group row with aggregates has its name on a line of its own, and the aggregates on the lines
     * under it - a line for each function of a column (`aggregate: ['sum', 'avg']` is two lines), so a
     * group row is 1 + n lines, n the most a column needs. `false` shows the name only, one line, as
     * without aggregates
     *
     * @sample aggregates
     */
    groupAggregates?: boolean;

    /**
     * shows the totals row under the rows, default `false`: the aggregate of each column that has one
     * (`ColumnConfig.aggregate`), over the rows the filter lets through - when grouped, the rows of
     * collapsed groups too. "Total" at the left (the text `aggregate.total`). It follows the columns
     * when they scroll sideways, and the values follow the filter and every change of a row: an edit,
     * undo, `upsert()`. The horizontal scrollbar is between the rows and the totals row. As many lines
     * as the column with the most functions needs.
     *
     * Part of the grid's state (`GridState.totalsRow`): the header menu turns it on and off
     *
     * @sample aggregates
     */
    totalsRow?: boolean;
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
     * the same label everywhere: header, column chooser, group chip, filter editor, footer filter, the
     * headers of the exports. The label the user gives the column in the column settings dialog
     * (`format.label`, {@link ColumnFormat}) wins
     */
    label?: string;
    /**
     * shown in an empty cell, see `GridConfig.placeholderRowCurrentEntityOnly`
     *
     * @sample required-placeholders
     */
    placeholderRow?: string;
    /**
     * shown in the empty header filter. Default: the formatter's placeholder (date fields), else the field's type: `Text` or `Number` (texts `filter.placeholder.*`).
     * The user's from the column settings dialog (`format.placeholder`, `format.placeholderLabel`) wins
     *
     * @sample required-placeholders
     */
    placeholderFilter?: string;
    /**
     * the operator the column's header filter starts with. Default `'GREATER_THAN_OR_EQUAL_TO'` for
     * number and date fields, `'EQUAL'` for the rest (the first of `filterOperators` when they do not
     * have it). For text `'EQUAL'` is the whole text, ignoring case: `ann` finds `Ann`, not `Anna`. Set
     * `'CONTAINS'` for a search anywhere in the text, `'BEGIN_WITH'` for the start. The operator the
     * user picks in the header filter's menu is state: `GridState.headerFilters[field].operator`.
     *
     * One the header filter's input can take, of the column's operators (`filterOperators`, else the
     * type's, see {@link operatorsFor}) - not `IN`, `NOT_IN`, `IS_BLANK` or `IS_NOT_BLANK`, those are
     * the value list's and the Blank submenu's. Anything else throws a `TypeError` when the grid is made
     * or `updateConfig()` is given the column. A lookup column (`editor`) filters as text.
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
     * the operators the column offers in the grid: in the header filter's menu (Operator ›, Blank ›,
     * the value list needs `IN`) and the filter editor's operator picker. A list of operators of the
     * column's type (see {@link operatorsFor}), shown in the type's order. Default: every operator of
     * the type.
     *
     * A `TypeError` when the grid is made or `updateConfig()` is given the column: an operator the type
     * does not have, an empty list, or one without an operator the header filter's input takes (any
     * but `IN`, `NOT_IN`, `IS_BLANK`, `IS_NOT_BLANK`). `operator` must be one of them. A lookup column
     * (`editor`) filters as text in its header; in the filter editor a lookup on a number field offers
     * the number operators. It limits what the user picks, not the filter: `datasource.filter()` and a
     * state from `setState()` can hold any condition.
     *
     * @sample filtering
     * @example
     * ```ts
     * import type { GridConfig } from '@simple-html/grid';
     *
     * const config: GridConfig = {
     *     columns: {
     *         name: { filterOperators: ['CONTAINS', 'BEGIN_WITH', 'IS_BLANK'] }, // starts with CONTAINS
     *         age: { filterOperators: ['EQUAL', 'BETWEEN'], operator: 'BETWEEN' }
     *     },
     *     layout: { center: [{ fields: ['name'], width: 150 }, { fields: ['age'], width: 80 }] }
     * };
     * ```
     */
    filterOperators?: FilterOperator[];
    /**
     * `true`: the grid's conditions on the column match case - `Ann` does not find `ANN`. The header
     * filter (the value typed and the value list) and the row menu's filter give their conditions
     * `caseSensitive: true`, the filter editor's toggle (Aa) is on for it and can not be turned off,
     * and so is the header menu's "Match case". Default `false`: the user turns "Match case" on per
     * column in the header filter's menu (`GridState.headerFilters[field].caseSensitive`). For a text
     * column (and a lookup column), `true` on another type throws a `TypeError` when the grid is made.
     * See {@link FilterCondition} `caseSensitive`
     *
     * @sample filtering
     */
    filterCaseSensitive?: boolean;
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
     * shows it. The user's from the column settings dialog (`format.numberOverride`, Show blank as 0,
     * Show 0 as blank) wins - its `'NONE'` turns this off
     *
     * @sample misc-options
     */
    numberOverride?: 'ZERO_TO_BLANK' | 'BLANK_TO_ZERO';

    /**
     * shows a `...` button at the right of the cell while it has focus; clicking it, or Space in the cell,
     * sends the `cell-focus-button-click` event - open a dialog or a dropdown of your own from there. When
     * it is shown: `'SHOW_IF_GRID_NOT_READONLY'` the grid is editable, `'SHOW_IF_GRID_AND_CELL_NOT_READONLY'`
     * the grid and the cell are editable, `'ALWAYS'` always. Not on a boolean (checkbox) cell.
     *
     * To pick the value from a list, `editor` does it all - its button, the keys, writing the value.
     * A column has one of the two: both throw a `TypeError`
     */
    focusButton?: 'SHOW_IF_GRID_NOT_READONLY' | 'SHOW_IF_GRID_AND_CELL_NOT_READONLY' | 'ALWAYS';

    /**
     * the cells can not be typed in, only changed by the row menu's paste and clear (and by your own
     * code, e.g. a dialog from `focusButton`). Typed text is undone right away. A column with an
     * `editor` is never typed in, its list opens as without this option
     *
     * @sample misc-options
     */
    allowPasteClearOnly?: boolean;

    /**
     * the value is picked from a list: a select or a dropdown grid, of the rows of a lookup registered
     * with {@link registerLookup} - see {@link ColumnEditor}. The cell stores the value of the picked
     * row (the lookup's `valueField`) and shows its label (`labelField`). For a `text` or `number`
     * field.
     *
     * The cell is not typed in: a character opens the list with it as the search, so do the button at
     * its right, Alt+ArrowDown, F4, F2, Space and a double click. Delete and Backspace empty the cell.
     * Not in a readonly grid or cell: there it shows the label only.
     *
     * Sorting the column sorts on the labels, typing in its header filter finds the rows whose label
     * matches, the filter menu's value list lists the labels, the CSV export and copy write the labels -
     * see the lookups guide.
     *
     * @sample lookups
     * @sample dropdown-grid
     * @example
     * ```ts
     * import type { GridConfig } from '@simple-html/grid';
     *
     * // registerLookup('countries', ...) and registerLookup('customers', ...) when the page loads
     * const config: GridConfig = {
     *     readonly: false,
     *     columns: {
     *         country: { label: 'Country', editor: { type: 'select', lookup: 'countries' } },
     *         customerId: { label: 'Customer', editor: { type: 'grid', lookup: 'customers', set: { customerName: 'name' } } }
     *     },
     *     layout: { center: [{ fields: ['country'], width: 120 }, { fields: ['customerId'], width: 180 }] }
     * };
     * ```
     */
    editor?: ColumnEditor;

    /**
     * sums the column up: `'sum'`, `'avg'`, `'min'`, `'max'` or `'count'` - one, or a list of them
     * (`['sum', 'avg']`), see {@link AggregateFunction}. The grid shows each in the column's place in
     * each group row (`GridConfig.groupAggregates`, on by default) and in the totals row
     * (`GridConfig.totalsRow`), a line each in the order sum, avg, min, max, count: the label at the
     * left, the value at the right - `Sum        1 234,50` (the texts `aggregate.*`). The datasource
     * computes them: `datasource.aggregate(field, fn)`.
     *
     * These are where the grid starts: the user turns functions on and off in the header menu (right
     * click a column label, "Aggregate:"), and they are part of the grid's state
     * (`GridState.aggregates`), `resetState()` goes back to these.
     *
     * - `sum`, `avg`, `min` and `max` are for a `number` field (the datasource's `fields`), anything
     *   else throws a `TypeError` when the grid is made or `updateConfig()` is given the column. They
     *   take the numbers, blanks and what is no number are left out. The value is shown with the
     *   field's formatter, not rounded: give the field a formatter with the decimals you want, or the
     *   column a display format with them (`format: { number: { decimals: 2 } }`).
     * - `count` counts the values that are not blank, in a field of any type. Shown as a whole number.
     *
     * @sample aggregates
     * @example
     * ```ts
     * import type { GridConfig } from '@simple-html/grid';
     *
     * const config: GridConfig = {
     *     columns: {
     *         balance: { aggregate: ['sum', 'avg'] },
     *         age: { aggregate: 'avg' },
     *         email: { aggregate: 'count' }
     *     },
     *     layout: { center: [{ fields: ['email'], width: 200 }, { fields: ['age'], width: 80 }, { fields: ['balance'], width: 120 }] },
     *     totalsRow: true
     * };
     * ```
     */
    aggregate?: AggregateFunction | AggregateFunction[];

    /**
     * how the column's cells show the value - a display format, see {@link ColumnFormat}: an object with
     * `date` for a `date` or `datetime` field, a {@link DateFormat} (`{ date: 'norwegian' }` 22.11.2026,
     * `{ date: 'weekIso' }` 2026-W47, `{ date: 'daysUntil' }` ...), `number` for a `number` field, a
     * {@link NumberFormat} (`{ number: { decimals: 2, thousands: ' ', decimal: ',' } }` 1 234 567,89),
     * `text` and `link` for a `text` field - a template of the text shown (`{ text: '{name} ({id})' }`)
     * and a link, see {@link LinkFormat} (`{ link: { url: 'mailto:{email}' } }`). Left out: the field's
     * formatter.
     *
     * The rest of what the column settings dialog sets is here too: `label`, the header filter's
     * `placeholder` / `placeholderLabel`, a number column's `numberOverride`, and `checkbox` - the cells
     * of a text or number column as checkboxes, see {@link CheckboxFormat}
     * (`{ checkbox: { checked: '1', unchecked: '0' } }`).
     *
     * Only the text shown changes: the cells, the aggregates of the column, the summary of the selected
     * cells, Find. The value is not changed, and editing, the header filter, sorting, grouping, copy and
     * the CSV export keep to the field's formatter - a cell shown as `2026-W47` is edited as
     * `2026-11-22`, a link's cell as its value. The Excel export writes the value with an Excel number
     * format like it, where Excel has one.
     *
     * This is where the grid starts: the user picks another one in the header menu (right click a column
     * label, "Format") or the column settings dialog (the gear in the footer), and it is part of the
     * grid's state (`GridState.formats`) - `resetState()` goes back to this one, and so does the dialog's
     * "Reset column". A format that does not fit the field's type, and a format on a lookup column
     * (`editor`), throw a `TypeError` when the grid is made or `updateConfig()` is given the column.
     *
     * @sample full-grid
     * @example
     * ```ts
     * import type { GridConfig } from '@simple-html/grid';
     *
     * const config: GridConfig = {
     *     columns: {
     *         born: { format: { date: 'norwegian' } }, // 22.11.2026
     *         due: { format: { date: 'daysUntil' } }, // 3: due in 3 days
     *         balance: { format: { number: { decimals: 2, thousands: ' ', decimal: ',' } } }, // 1 234 567,89
     *         email: { format: { link: { url: 'mailto:{email}' } } }, // a link that writes an email
     *         newsletter: { format: { label: 'News', checkbox: {} } } // '1' / '0' as checkboxes
     *     },
     *     layout: {
     *         center: [
     *             { fields: ['born'], width: 100 },
     *             { fields: ['due'], width: 80 },
     *             { fields: ['balance'], width: 120 },
     *             { fields: ['email'], width: 180 },
     *             { fields: ['newsletter'], width: 80 }
     *         ]
     *     }
     * };
     * ```
     */
    format?: ColumnFormat;

    /**
     * draws the column's cells with a renderer of your own - a badge, a progress bar, a link, a select:
     * the id it was registered under with {@link registerCellRenderer}, so the config stays plain JSON.
     * An id that is not registered throws a `TypeError` when the grid is made or `updateConfig()` is
     * given the column: register the renderer when the page loads, before the grid. So does a column
     * with an `editor` too: a lookup column draws its own cell.
     *
     * The cell keeps what the grid does on a cell: the keys, the focus ring, copy and paste, errors, the
     * edited marker, ranges, Find, the stripes and the `cellClass` hook. In a cell that can be edited,
     * Enter, F2, typing and a double click open the grid's text editor (a date cell's click the date
     * picker), unless the renderer edits the value itself. Not the default cell's `placeholderRow`,
     * `focusButton` and the lines of a multiline cell; `fitColumns()` measures the text of the field's
     * formatter, not what the renderer draws. See the guide "Custom cells"
     *
     * @sample custom-cells
     * @example
     * ```ts
     * import type { GridConfig } from '@simple-html/grid';
     *
     * const config: GridConfig = {
     *     columns: { status: { renderer: 'badge' }, progress: { renderer: 'progress', readonly: true } },
     *     layout: { center: [{ fields: ['status'], width: 100 }, { fields: ['progress'], width: 120 }] }
     * };
     * ```
     */
    renderer?: string;
};

/**
 * How a column's value is picked from a list, `ColumnConfig.editor`. Plain JSON: the list is a lookup
 * registered with {@link registerLookup}, named by its id.
 *
 * - `type: 'select'` - a list under the cell, with a search field on top: typing finds the rows whose
 *   label has the text (ignoring case), ArrowUp / ArrowDown, Home / End, PageUp / PageDown move,
 *   Enter or a click picks, Tab picks and goes to the next cell, Esc closes it.
 * - `type: 'grid'` - a dropdown grid under the cell: the lookup's datasource in a small grid of its
 *   own (`Lookup.config`), or the grid interface it links. The filter row searches as you type,
 *   Enter picks the highlighted row (the first one found), ArrowDown goes to it and the arrows move
 *   between the rows, Enter or a click on a row picks it, Esc closes it.
 *
 * Picking writes the value, and the fields of `set`, in one go: one step of the undo history, Ctrl+Z
 * takes it back.
 *
 * @sample lookups
 * @example
 * ```ts
 * import type { ColumnEditor } from '@simple-html/grid';
 *
 * const country: ColumnEditor = { type: 'select', lookup: 'countries' };
 * // the row's customerName gets the picked customer's name, its city the customer's city
 * const customer: ColumnEditor = { type: 'grid', lookup: 'customers', set: { customerName: 'name', city: 'city' } };
 * ```
 */
export interface ColumnEditor {
    /** `'select'`: a list with a search field, `'grid'`: a dropdown grid */
    type: 'select' | 'grid';
    /** the id of the lookup, see {@link registerLookup}. One that is not registered throws a `TypeError` when the grid is made */
    lookup: string;
    /**
     * more fields to copy from the picked row into the edited row: `{ <field of the row>: <field of the
     * picked row> }`. `{ customerName: 'name' }` gives the row's `customerName` the picked row's `name`.
     * Emptying the cell empties them too. Written as data, also where those cells are readonly
     */
    set?: Record<string, string>;
}

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
     * what the header filter cells show, keyed by field: the value typed or picked, the operator
     * picked in the header filter's menu and whether its "Match case" is on. Only the columns that have
     * one of them are listed.
     *
     * The rows are filtered by `filter`: these are what the header shows, the conditions they made are
     * in `filter` already. A state from `getState()` has both.
     */
    headerFilters: Record<string, HeaderFilter>;
    /**
     * the aggregate functions of the columns, keyed by field - what `ColumnConfig.aggregate` starts
     * with and the header menu changes: `{ balance: ['sum', 'avg'] }`. Only the fields that have some are
     * listed; a field left out has none. See `ColumnConfig.aggregate`
     */
    aggregates: Record<string, AggregateFunction[]>;
    /** whether the totals row is shown, `GridConfig.totalsRow` */
    totalsRow: boolean;
    /**
     * the display formats of the columns, keyed by field - what `ColumnConfig.format` starts with and
     * the header menu (Format ›) and the column settings dialog change:
     * `{ born: { date: 'weekIso' }, balance: { number: { decimals: 2 } }, email: { link: { url: 'mailto:{email}' } } }`.
     * Only the fields that have one are listed; a field left out shows its field's formatter. With the
     * rest of the column settings: the label, the placeholder, blank / 0, the checkboxes
     * (`{ company: { label: 'Firm' }, newsletter: { checkbox: {} } }`). See {@link ColumnFormat}. Its
     * templates are text, not code: a state from storage runs nothing
     */
    formats: Record<string, ColumnFormat>;
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
 *     name: { value: 'Ann*', caseSensitive: true }, // typed in the name column, "Match case" on
 *     age: { value: 30, operator: 'LESS_THAN_OR_EQUAL_TO' }, // the operator picked in the menu
 *     balance: { value: [1000, 5000], operator: 'BETWEEN' }, // typed as 1000..5000
 *     active: { value: true } // a boolean column's checkbox
 * };
 * ```
 */
export interface HeaderFilter {
    /**
     * what the header filter cell shows: the text typed, the date picked, `true`/`false` for a
     * checkbox, `[from, to]` for `BETWEEN` (an open end null). null is empty
     */
    value: unknown;
    /**
     * the operator picked in the header filter's menu. Left out, the column's `operator` is used - and
     * so it is when the column does not offer this one (`filterOperators`)
     */
    operator?: FilterOperator;
    /** `true` when "Match case" is on in the header filter's menu, see `ColumnConfig.filterCaseSensitive` */
    caseSensitive?: boolean;
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
            | 'multilineLineHeight'
            | 'cellHeaderLabelHeight'
            | 'panelHeight'
            | 'footerHeight'
            | 'selectSizeHeight'
            | 'readonly'
            | 'tooltips'
            | 'multilineTooltipLines'
            | 'rowStatus'
            | 'editedMarker'
            | 'mergeHighlight'
            | 'copyHeaders'
            | 'filterOperatorIndicator'
            | 'settingsButton'
            | 'placeholderRowCurrentEntityOnly'
            | 'groupAggregates'
            | 'totalsRow'
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
    /** the height of a group row: one line, more for the aggregates of stacked fields (see aggregates.ts) */
    __groupRowHeight: number;
    /** the height of the cells of the totals row, 0 when it is not shown (see aggregates.ts) */
    __totalsRowHeight: number;
};
