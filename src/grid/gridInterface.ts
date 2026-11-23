import { AGGREGATE_FUNCTIONS, type AggregateFunction, isAggregateFunction } from '../datasource/aggregate';
import { assertOptions } from '../datasource/assertOptions';
import type { Datasource, EntityUnion } from '../datasource/dataSource';
import type { DatasourceEvents } from '../datasource/datasourceEvents';
import { type Entity, isGroupRow } from '../datasource/entity';
import type { FieldType } from '../datasource/field';
import { type FilterExpression, type FilterOperator, operatorsFor } from '../datasource/filterExpression';
import type { Formatter } from '../datasource/formatter';
import { Emitter, type EventHandler } from '../emitter';
import { assertTexts } from '../texts';
import type { CellRange } from './cellRange';
import { getCellRenderer } from './cellRendererRegistry';
import { cellFieldText, type FieldText, fieldTextOf, type LinkResult, linkOf, templateFormatter } from './cellTemplate';
import {
    assertColumnFormat,
    type ColumnFormat,
    displayFormatter,
    formatTexts,
    hasDisplayFormat,
    hasValueFormat,
    readonlyOf
} from './columnFormat';
import type { CsvOptions } from './csv';
import type { FindResult } from './findResult';
import type { Grid } from './grid';
import type {
    ColumnConfig,
    DetailForm,
    GridConfig,
    GridLayout,
    GridOptions,
    GridState,
    HeaderFilter,
    LayoutColumn,
    ParsedGridConfig,
    ParsedGridOptions
} from './gridConfig';
import type { GridEvents } from './gridEvents';
import { aggregateRowHeights, normalizeAggregates } from './gridFunctions/aggregates';
import { assertRanges, layoutKey, type RangeState, rangeState, sameRanges } from './gridFunctions/cellRanges';
import { headerOperators, isHeaderOperator } from './gridFunctions/columnFilterOptions';
import { renderColumnNumbers } from './gridFunctions/columnNumbers';
import { type ColumnSelection, clickColumn, NO_COLUMNS, numberedColumns } from './gridFunctions/columnSelection';
import { openColumnSettings } from './gridFunctions/columnSettings';
import { assertDetailForm, copyDetailForm, noDetailForm } from './gridFunctions/detailForm';
import {
    assertEditPermissions,
    editPermissionsOf,
    mayChangeRow,
    mayChangeValues,
    mayDeleteRow
} from './gridFunctions/editPermissions';
import { fillDown } from './gridFunctions/fillDown';
import { columnConditions, sameConditions } from './gridFunctions/filterCallback';
import { closeFind, findDataChanged, findStep, getFindFilter, getFindResult, openFind } from './gridFunctions/findBar';
import { DEFAULT_COLUMN_WIDTH, fitColumns } from './gridFunctions/fitColumns';
import { getCellHeight } from './gridFunctions/getCellHeight';
import { getElementByClassName } from './gridFunctions/getElementByClassName';
import { getLayoutFields } from './gridFunctions/getLayoutFields';
import { getTextWidth } from './gridFunctions/getTextWidth';
import { downloadGridCsv, gridCsv } from './gridFunctions/gridCsv';
import { downloadGridExcel, gridExcel } from './gridFunctions/gridExcel';
import { type LookupColumn, lookupColumnsOf } from './gridFunctions/lookupColumn';
import { TOOLTIP_LINES } from './gridFunctions/multilineText';
import { openFilterEditor } from './gridFunctions/openFilterEditor';
import { focusedCell, pointOf, renderRangeClasses } from './gridFunctions/rangeSelection';
import { rebuildFooter, renderFooter } from './gridFunctions/rebuildFooter';
import { removeContextMenu } from './gridFunctions/removeContextMenu';
import { requestRowsRender } from './gridFunctions/renderChangedRows';
import { fitRowLinesOf, layoutColumns, MULTILINE_LINE_HEIGHT, rowHeightOf } from './gridFunctions/rowHeights';
import { ROW_STATUS_WIDTH } from './gridFunctions/rowStatus';
import { openShortcutHelp } from './gridFunctions/shortcutHelp';
import { placeAt, showMenu } from './gridFunctions/showMenu';
import { closeTextEditor } from './gridFunctions/textEditor';
import { triggerScrollEvent } from './gridFunctions/triggerScrollEvent';
import { updateMainElementSizes } from './gridFunctions/updateMainElementSizes';
import { updateVerticalScrollHeight } from './gridFunctions/updateVerticalScrollHeight';
import type { CellClass, GridHooks } from './gridHooks';
import type { MenuContext, MenuEntry, MenuPosition } from './gridMenus';
import type { ExcelOptions } from './xlsx';

/**
 * The grid: its config, its datasource and its state. What you call to work with a grid - read and
 * set the state, change an option, subscribe to events, re-render.
 *
 * Make one with {@link createGrid}, which also puts the grid on the page. `new GridInterface()` is for
 * a `<simple-html-grid>` element you place yourself, see {@link GridElement}.
 *
 * @typeParam T the type of the rows, from the datasource: a `Datasource<Person>` gives a
 * `GridInterface<Person>`
 *
 * @sample basic-grid
 * @example
 * ```ts
 * import { createGrid, type GridConfig } from '@simple-html/grid';
 *
 * declare const config: GridConfig;
 *
 * const gridInterface = createGrid(document.getElementById('grid')!, { config, datasource });
 *
 * gridInterface.on('cell-click', (data) => console.log(data.attribute, data.rowData));
 * gridInterface.updateConfig({ readonly: false });
 * gridInterface.updateHooks({ cellClass: (row, field) => (field === 'age' && row.age < 18 ? { input: 'minor' } : null) });
 * const state = gridInterface.getState();
 *
 * gridInterface.destroy(); // done with it
 * ```
 */
export class GridInterface<T> {
    // not there until connectGrid, null after __disconnectGrid
    private grid?: Grid | null;
    // the grid connectGrid was given last. Kept while its element is out of the dom (__disconnectGrid
    // clears `grid`, it connects again when the element is put back), so destroy() can remove it then too
    private lastGrid?: Grid | null;
    // a copy of the config with every default filled in, __parseConfig() computes the sizes.
    // Its layout is the state's: the user changes it
    private gridConfig: ParsedGridConfig;
    // the options as written - the config without columns, layout and initialState - so updateConfig()
    // can fill in the defaults again: cellHeaderLabelHeight follows cellHeight ...
    private options: GridOptions;
    // copies of the config's layout and initialState: the state resetState() goes back to
    private configLayout: Required<GridLayout>;
    // the aggregates of the config's columns: what resetState() goes back to, see GridState.aggregates
    private configAggregates: Record<string, AggregateFunction[]> = {};
    // the display formats of the config's columns: what resetState() goes back to, see GridState.formats
    private configFormats: Record<string, ColumnFormat> = {};
    private initialState: Partial<GridState>;
    // the functions: isReadonly, cellClass, menus. A copy, updateHooks() changes it
    private hooks: GridHooks<T>;
    private dataSource: Datasource<T>;
    // the columns selected with the column numbers under the header filters, see columnSelection.ts
    private columnSelection: ColumnSelection = NO_COLUMNS;
    // the layout they were selected in (layoutKey): their numbers are other columns in another one
    private columnSelectionKey = '';

    // for variable scroll, set by __dataSourceUpdated, called from the constructor
    private scrollTops!: number[];
    private scrollHeights!: number[];
    private scrollHeight!: number;

    /**
     * for skipping the datasource events while applyState() changes the datasource, it rebuilds once
     * when done
     */
    private suppressEvents = false;

    /**
     * the handlers subscribed with on(), called on cell clicks, copy/paste etc
     */
    private events = new Emitter<GridEvents>();

    /**
     * unsubscribe functions of the grid's handlers on the datasource events,
     * set by connectGrid and called by __disconnectGrid
     */
    private datasourceSubscriptions: (() => void)[] = [];

    /**
     * what the header filter cells show, see GridState.headerFilters. Only the columns that have
     * a value or a picked operator are in it
     */
    private headerFilters: Record<string, HeaderFilter> = {};

    /**
     * the lines of the rows made taller by fitRows(), by the row's key (`String(row.__KEY)`). A row
     * that is not in it is as high as the layout makes a row. See rowHeights.ts
     */
    private rowLines = new Map<string, number>();

    /**
     * the ranges of cells, see getRanges(): copies of what was set
     */
    private ranges: CellRange[] = [];

    /**
     * the ranges in indexes, with the layout they were made in - what the cells need to show them.
     * null without ranges. See cellRanges.ts
     */
    private rangeState: RangeState | null = null;

    /**
     * the columns with an `editor`, by field: their lookups, see lookupColumn.ts. Made from the config's
     * columns when the interface is made and by updateConfig()
     */
    private lookupColumns: Map<string, LookupColumn>;

    /**
     * what this interface sorts its lookup columns on, given to the datasource (__setSortValue): the
     * label the cell shows. Kept to take them back, see clearSortValues
     */
    private sortValues = new Map<string, (value: unknown) => string>();

    /**
     * Most of the time {@link createGrid} makes the interface. Make it yourself for a
     * `<simple-html-grid>` element you place on your own, and connect it with
     * `element.connectInterface()`.
     *
     * @param gridConfig the columns, the layout and the options, see {@link GridConfig}. The object is
     * not changed, the grid copies the parts it changes
     * @param datasource the rows. The grid applies `gridConfig.initialState` to it: its sorting,
     * grouping and filter are replaced (left out, they are cleared)
     * @param hooks optional: the functions - `isReadonly`, `cellClass`, `menus`, see {@link GridHooks}.
     * The grid keeps a copy of the object, change them later with {@link updateHooks}
     * @throws a `TypeError` when `gridConfig` has `isReadonly`, `cellClass` or `menus` (those are
     * hooks), a column has v5's `mandatory` (it is the field's `required` rule), `texts` is not an
     * object of strings, `multilineTooltipLines` or `multilineLineHeight` is not a whole number of 1 or
     * more, a column's `aggregate` is no aggregate function or needs a number field, a column's
     * `format` does not fit its field (see {@link ColumnFormat}), a column's `editor` is wrong - its
     * lookup not registered, see {@link ColumnEditor} - a column's `renderer` is not the id of a
     * registered cell renderer, or is given with an `editor`, or a column's `filterOperators`,
     * `operator` or `filterCaseSensitive` does not fit its type, see {@link ColumnConfig} - when
     * `detailForm` is not a {@link DetailForm}, and when `edit` is not an object of the permissions
     * `add`, `change` and `delete`, each true or false (see {@link EditPermissions})
     *
     * @example
     * ```ts
     * import { type GridConfig, type GridElement, type GridHooks, GridInterface } from '@simple-html/grid';
     *
     * declare const config: GridConfig;
     * declare const hooks: GridHooks;
     *
     * const gridInterface = new GridInterface(config, datasource, hooks);
     * const element = document.createElement('simple-html-grid') as GridElement;
     * element.connectInterface(gridInterface);
     * host.appendChild(element);
     * ```
     */
    constructor(gridConfig: GridConfig, datasource: Datasource<T>, hooks: GridHooks<T> = {}) {
        assertNoHooks(gridConfig);
        assertNoV5Options(gridConfig);
        assertConfigTexts(gridConfig);
        assertTooltipLines(gridConfig);
        assertLineHeight(gridConfig);
        assertAggregates(gridConfig, datasource);
        assertFormats(gridConfig, datasource);
        assertRenderers(gridConfig);
        assertFilterOptions(gridConfig, datasource);
        assertConfigDetailForm(gridConfig);
        assertEditPermissions(gridConfig.edit);
        this.lookupColumns = lookupColumnsOf(gridConfig.columns, datasource);
        this.dataSource = datasource;
        this.hooks = { ...hooks };

        const { columns, layout, initialState, ...options } = gridConfig;
        this.options = options;
        this.gridConfig = {
            ...withDefaults(options),
            columns: structuredClone(columns ?? {}),
            layout: copyLayout(layout),
            ...NO_SIZES
        };
        this.configLayout = copyLayout(layout);
        this.configAggregates = aggregatesOfColumns(this.gridConfig.columns);
        this.configFormats = formatsOfColumns(this.gridConfig.columns);
        // structuredClone, not JSON: it keeps the Dates of a filter
        this.initialState = structuredClone(initialState ?? {});

        // before the start state is applied: it can sort on a lookup column
        this.setSortValues();
        this.applyState(this.getStartState());
    }

    /**
     * The state of the grid now: what the user changed - column order, pinning and widths, sorting,
     * grouping, expanded groups, the filter and what the header filters show, the aggregates, the
     * totals row, the display formats of the columns and the detail form. See {@link GridState}.
     *
     * It is a copy: changing it changes nothing in the grid, and what the user does later does not
     * change it. Give it to {@link setState} to go back to it.
     *
     * @sample grid-state
     * @example
     * ```ts
     * const state = gridInterface.getState();
     * state.layout.center.map((column) => column.fields); // [['name'], ['age', 'born']]
     * state.sorting; // [{ attribute: 'name', ascending: true }]
     *
     * // later, e.g. after the user moved columns and changed the filter
     * gridInterface.setState(state);
     * ```
     */
    public getState(): GridState {
        const datasource = this.getDatasource();
        // copies: the datasource and the grid keep changing these objects in place (shift+click sort,
        // drag/drop, resizing). structuredClone keeps Dates; it throws on a proxy, and none of these
        // hold one - the rows are the only proxies, and only their values go into a filter
        return {
            layout: copyLayout(this.gridConfig.layout),
            sorting: structuredClone(datasource.getLastSorting()),
            grouping: structuredClone(datasource.getGrouping()),
            expandedGroups: structuredClone(datasource.getExpanded()),
            filter: structuredClone(datasource.getFilter()),
            headerFilters: structuredClone(this.headerFilters),
            aggregates: aggregatesOfColumns(this.gridConfig.columns),
            totalsRow: this.gridConfig.totalsRow,
            formats: formatsOfColumns(this.gridConfig.columns),
            detailForm: copyDetailForm(this.gridConfig.detailForm)
        };
    }

    /**
     * Sets the state: column order, pinning and widths, sorting, grouping, expanded groups, the filter
     * and what the header filters show, the aggregates, the totals row, the display formats of the
     * columns and the detail form. See {@link GridState}.
     *
     * **Applies what is given and keeps the rest**: `setState({ sorting })` changes the sort and
     * nothing else. To set everything, pass a whole state, e.g. one from {@link getState}. Within a
     * part nothing is merged: `layout` replaces the whole layout, `headerFilters` every header filter.
     *
     * The grid keeps a copy, the object passed in is not changed later. It must be plain data (no
     * functions, no rows from the datasource): it is copied with `structuredClone`. A state stored as
     * JSON can be given as it is; its `Date`s came back as ISO text, which is kept as text - see
     * {@link GridState}.
     *
     * `filter` is what the rows are filtered by, `headerFilters` only what the header filter cells show.
     * Set both to have a header filter's condition and its cell agree, as `getState()` gives them.
     *
     * @param state the parts to set
     * @throws a `TypeError` for aggregates or display formats (`formats`) that do not fit their fields,
     * see {@link ColumnConfig} `aggregate` and {@link ColumnFormat}, and a `detailForm` that is no
     * {@link DetailForm} - before anything changes
     *
     * @sample grid-state
     * @example
     * ```ts
     * import type { GridState } from '@simple-html/grid';
     *
     * declare const savedState: GridState;
     *
     * // a whole state, saved before
     * gridInterface.setState(savedState);
     *
     * // only some parts, the rest stays as it is
     * gridInterface.setState({ sorting: [{ attribute: 'age', ascending: false }] });
     * gridInterface.setState({ grouping: [{ attribute: 'country', title: 'Country' }], expandedGroups: [] });
     * gridInterface.setState({ filter: null, headerFilters: {} }); // no filter
     * ```
     */
    public setState(state: Partial<GridState>) {
        this.applyState(structuredClone(state));
    }

    /**
     * Goes back to the state the grid started in: `GridConfig.initialState`, with the config's
     * `layout` (unless `initialState` has one). What `initialState` leaves out is cleared - no sorting,
     * no grouping, no filter, no header filters. A `layout` or `initialState` given to
     * {@link updateConfig} since is the one it goes back to.
     *
     * @sample grid-state
     * @example
     * ```ts
     * import { GridInterface } from '@simple-html/grid';
     *
     * const gridInterface = new GridInterface(
     *     {
     *         layout: { center: [{ fields: ['name'], width: 100 }, { fields: ['age'], width: 100 }] },
     *         initialState: { sorting: [{ attribute: 'name', ascending: true }] }
     *     },
     *     datasource
     * );
     *
     * // the user sorts, filters and moves columns around ...
     * gridInterface.resetState(); // sorted on name again, no filter, the config's columns
     * ```
     */
    public resetState() {
        this.applyState(this.getStartState());
    }

    /**
     * The state the grid starts in and resetState() goes back to: the config's initialState, with the
     * config's layout and empty values for what it leaves out. A new copy every call, applyState()
     * hands its parts on to the datasource and the grid, and they change them in place
     */
    private getStartState(): GridState {
        const initialState = structuredClone(this.initialState);
        return {
            layout: initialState.layout ?? copyLayout(this.configLayout),
            sorting: initialState.sorting ?? [],
            grouping: initialState.grouping ?? [],
            expandedGroups: initialState.expandedGroups ?? [],
            filter: initialState.filter ?? null,
            headerFilters: initialState.headerFilters ?? {},
            aggregates: initialState.aggregates ?? structuredClone(this.configAggregates),
            totalsRow: initialState.totalsRow ?? this.options.totalsRow ?? false,
            formats: initialState.formats ?? structuredClone(this.configFormats),
            // applyState checks it and keeps a copy
            detailForm: initialState.detailForm ?? this.options.detailForm ?? noDetailForm()
        };
    }

    /**
     * Changes options of the config while the grid is shown: `readonly`, `hideLabels`, the sizes,
     * `tooltips`, `columns` ... and rebuilds the grid once. The functions - `isReadonly`, `cellClass`,
     * `menus` - are not part of the config, change them with {@link updateHooks}.
     *
     * - **Only the keys given change**, the rest stay as they are. A key given as `undefined` goes
     *   back to its default - `layout` excepted, a grid always has one.
     * - **`columns` replaces the options of every column**, nothing is merged: a field left out gets
     *   the defaults.
     * - **`layout` is shown right away**, as `setState({ layout })` does: the column order, pinning and
     *   widths the user made are replaced. It is also the layout `resetState()` goes back to from now
     *   on (unless `initialState` has a layout).
     * - **`initialState` changes nothing now**: it is the state a later `resetState()` goes back to.
     *   Call `resetState()` after to apply it.
     * - **`texts` replaces the grid's texts as a whole**, the ids are not merged: an id left out shows
     *   the page's text again (`setTexts()`). A menu or the filter editor shows them the next time it
     *   opens.
     * - **`edit` replaces the permissions as a whole**: a permission left out is allowed again -
     *   `updateConfig({ edit: { delete: false } })` allows adding and changing. The cells follow at
     *   once; an open menu, date picker, lookup list or editor of a multiline cell is closed - what was
     *   typed in the editor is not saved. See {@link EditPermissions}.
     *
     * The rest of the state - sorting, grouping, filter, header filters - is kept, and so are the
     * handlers subscribed with {@link on}. The object passed in is not changed, the grid copies
     * `columns`, `layout` and `initialState`.
     *
     * @param config the parts of the config to change
     * @throws a `TypeError` when `config` has `isReadonly`, `cellClass` or `menus` (those are hooks),
     * a column has v5's `mandatory` (it is the field's `required` rule), `texts` is not an object of
     * strings, `multilineTooltipLines` or `multilineLineHeight` is not a whole number of 1 or more, a
     * column's `aggregate` is no aggregate function or needs a number field, a column's `format` does
     * not fit its field (see {@link ColumnFormat}), a column's `editor` is wrong - its lookup not
     * registered, see {@link ColumnEditor} - a column's `renderer` is not the id of a registered cell
     * renderer, or is given with an `editor`, or a column's `filterOperators`, `operator` or
     * `filterCaseSensitive` does not fit its type, see {@link ColumnConfig} - when `detailForm` is
     * not a {@link DetailForm}, and when `edit` is not an object of the permissions `add`, `change` and
     * `delete`, each true or false (see {@link EditPermissions})
     *
     * @sample misc-options
     * @example
     * ```ts
     * gridInterface.updateConfig({ readonly: false }); // editing on
     * gridInterface.updateConfig({ edit: { add: true, change: false, delete: false } }); // new rows only
     * gridInterface.updateConfig({ hideFilter: true, cellHeight: 30 });
     * gridInterface.updateConfig({ tooltips: undefined }); // back to the default, true
     *
     * // the columns the config starts with, shown now and what resetState() goes back to
     * gridInterface.updateConfig({ layout: { center: [{ fields: ['name'], width: 200 }] } });
     * ```
     */
    public updateConfig(config: Partial<GridConfig>) {
        assertNoHooks(config);
        assertNoV5Options(config);
        assertConfigTexts(config);
        assertTooltipLines(config);
        assertLineHeight(config);
        assertAggregates(config, this.dataSource);
        assertFormats(config, this.dataSource);
        assertRenderers(config);
        assertFilterOptions(config, this.dataSource);
        assertConfigDetailForm(config);
        assertEditPermissions(config.edit);
        // checked before anything changes, like the rest
        const lookupColumns = 'columns' in config ? lookupColumnsOf(config.columns, this.dataSource) : null;
        const { columns, layout, initialState, ...options } = config;

        // other edit permissions: what is open was opened under the old ones - a menu, the date picker, the
        // editor of a multiline cell, a lookup's list - and could still write into a row they lock now.
        // Closed, what was typed in the editor not saved
        if ('edit' in config && this.grid) {
            closeTextEditor(this.grid, false);
            this.grid.lookupEditor?.close(false);
            removeContextMenu(this.grid);
        }

        this.options = { ...this.options, ...options };
        // the totals row is state too (the header menu turns it on and off): only a totalsRow given
        // here changes it
        const totalsRow = 'totalsRow' in config ? withDefaults(this.options).totalsRow : this.gridConfig.totalsRow;
        // and so is the detail form (the grid config dialog changes it)
        const detailForm = 'detailForm' in config ? withDefaults(this.options).detailForm : this.gridConfig.detailForm;
        // in place, so code that got the parsed config before reads the new options too
        Object.assign(this.gridConfig, withDefaults(this.options), { totalsRow, detailForm });

        // `in`, so that `columns: undefined` gives every column the defaults, as it does for an option.
        // Their aggregates are the ones resetState() goes back to from now on
        if ('columns' in config) {
            this.gridConfig.columns = structuredClone(columns ?? {});
            this.configAggregates = aggregatesOfColumns(this.gridConfig.columns);
            this.configFormats = formatsOfColumns(this.gridConfig.columns);
        }
        if (lookupColumns) {
            // the list open for a column of the old config is closed, the cells are rendered anew
            this.grid?.lookupEditor?.close(false);
            this.clearSortValues();
            this.lookupColumns = lookupColumns;
            this.setSortValues();
            // the grid follows the datasources of the lookups, the new ones now
            if (this.grid) {
                this.subscribeToDatasource();
            }
        }
        if ('initialState' in config) {
            this.initialState = structuredClone(initialState ?? {});
        }

        // a grid always has a layout, `layout: undefined` keeps it
        if (layout) {
            this.configLayout = copyLayout(layout);
            this.applyState({ layout: copyLayout(layout) });
        } else {
            // rebuilds once, the state stays as it is
            this.applyState({});
        }
    }

    /**
     * Changes the hooks while the grid is shown: `isReadonly`, `cellClass` and `menus`, see
     * {@link GridHooks}. **Only the keys given change**, a key given as `undefined` removes that hook -
     * the cells follow the config again, the menus show their defaults. The visible cells are rendered
     * again once (as {@link refresh} does); a menu uses its new function the next time it opens.
     *
     * The object passed in is not kept: the grid copies its keys.
     *
     * @param hooks the hooks to set, or to remove with `undefined`
     *
     * @sample cell-styling
     * @example
     * ```ts
     * // company can not be edited on an inactive row
     * gridInterface.updateHooks({ isReadonly: (row, field) => (field === 'company' && !row.isActive ? true : null) });
     *
     * // color the balance cells, the readonly rule stays
     * gridInterface.updateHooks({ cellClass: (row, field) => (field === 'balance' && row.balance < 0 ? { input: 'red' } : null) });
     *
     * gridInterface.updateHooks({ isReadonly: undefined }); // removed: the column config decides again
     * gridInterface.updateHooks({ menus: undefined }); // the menus show their defaults
     * ```
     */
    public updateHooks(hooks: GridHooks<T>) {
        this.hooks = { ...this.hooks, ...hooks };
        // isReadonly, cellClass and rowClass are called when a row or cell is rendered, menus when a menu
        // opens
        this.refresh();
    }

    /**
     * Applies the parts of the state that are given and rebuilds the grid once. The datasource parts
     * (filter, sorting, grouping, expanded groups) are applied together: what is not given is applied
     * again as it is now, the datasource needs them in this order.
     * @param state a copy, the datasource and the grid keep what they are given and change it in place
     * (shift+click sort, drag/drop, resizing)
     */
    private applyState(state: Partial<GridState>) {
        // checked before anything changes: a wrong one throws and leaves the grid as it is
        if (state.aggregates) {
            assertAggregates({ columns: columnsWithAggregates(state.aggregates) }, this.dataSource, 'setState: aggregates');
        }
        if (state.formats) {
            this.assertStateFormats(state.formats);
        }
        if (state.detailForm !== undefined) {
            assertDetailForm(state.detailForm, 'setState: detailForm');
        }
        this.suppressEvents = true;

        if (state.layout) {
            this.gridConfig.layout = copyLayout(state.layout);
        }

        // every column gets the functions listed for it, the others none
        if (state.aggregates) {
            for (const column of Object.values(this.gridConfig.columns)) {
                delete column.aggregate;
            }
            for (const [field, fns] of Object.entries(state.aggregates)) {
                const list = normalizeAggregates(fns);
                if (list.length) {
                    this.gridConfig.columns[field] = { ...this.gridConfig.columns[field], aggregate: list };
                }
            }
        }
        if (state.totalsRow !== undefined) {
            this.gridConfig.totalsRow = state.totalsRow === true;
        }
        if (state.detailForm) {
            this.gridConfig.detailForm = copyDetailForm(state.detailForm);
        }

        // every column gets the format listed for it, the others none
        if (state.formats) {
            for (const column of Object.values(this.gridConfig.columns)) {
                delete column.format;
            }
            for (const [field, format] of Object.entries(state.formats)) {
                if (hasDisplayFormat(format)) {
                    this.gridConfig.columns[field] = { ...this.gridConfig.columns[field], format };
                }
            }
        }

        if (state.headerFilters) {
            this.headerFilters = {};
            for (const [field, headerFilter] of Object.entries(state.headerFilters)) {
                this.storeHeaderFilter(
                    field,
                    headerFilter.value,
                    headerFilter.operator,
                    headerFilter.caseSensitive === true,
                    typeof headerFilter.filterOnType === 'boolean' ? headerFilter.filterOnType : undefined
                );
            }
        }

        const datasourceParts = state.filter !== undefined || state.sorting || state.grouping || state.expandedGroups;
        if (datasourceParts) {
            // what is not given: the datasource's own, it replaces these when it is given new ones
            const datasource = this.getDatasource();
            const filter = state.filter !== undefined ? state.filter : datasource.getFilter();
            const sorting = state.sorting ?? datasource.getLastSorting();
            const grouping = state.grouping ?? datasource.getGrouping();
            const expandedGroups = state.expandedGroups ?? datasource.getExpanded();

            if (!sorting.length) {
                // or filter() below sorts again: without a sort the rows go back to their own order
                datasource.resetSort();
            }

            // null clears a filter that was set before
            datasource.filter(filter);

            if (grouping.length) {
                datasource.setExpanded(expandedGroups);
                datasource.group(grouping);
            } else {
                datasource.removeGroup();
            }
            // grouping resets the sort to the grouped fields, so it is set after
            if (sorting.length) {
                datasource.sort(sorting);
            }
        }

        this.suppressEvents = false;

        // the displayed rows can be others now, the ranges of cells were made for the rows as they were.
        // The datasource's events that clear them otherwise were skipped. A new layout clears them in
        // __dataSourceUpdated()
        if (datasourceParts) {
            this.clearRanges();
        }

        if (this.grid) {
            this.grid.rebuild();
        } else {
            this.__dataSourceUpdated();
        }
    }

    /**
     * do not use - used by grid to connect
     * @param grid
     * @internal
     */
    public connectGrid(grid: Grid) {
        this.grid = grid;
        this.lastGrid = grid;
        // the datasource was not followed while no grid was connected: its displayed rows can be
        // others than the ranges of cells were made for
        this.clearRanges();
        this.subscribeToDatasource();
        this.__callSubscribers('grid-connected', {});
    }

    /**
     * Renders the visible cells again, with the values the rows have now. For when something the
     * cells show changed without a row changing: what the `isReadonly` / `cellClass` hooks read, a
     * value written to an object of your own instead of the row. A value set on a row shows on its
     * own (the datasource's `rows-changed`, rendered in the next animation frame), and a scroll only
     * renders the rows that scroll in. Cheap, the columns and the header are not built again - that
     * is {@link rebuild}.
     *
     * The cell input the user has typed in since it got the focus is not rendered, so its text is
     * kept: it is rendered once the focus leaves it.
     *
     * Does nothing while the grid is not on the page.
     *
     * Was `triggerScrollEvent()` in v5.
     *
     * @example
     * ```ts
     * let highlighted = 'ACME CORP';
     * gridInterface.updateHooks({ cellClass: (row) => (row.company === highlighted ? { input: 'highlight' } : null) });
     *
     * highlighted = 'GLOBEX'; // the hook reads it, the grid does not know
     * gridInterface.refresh();
     * ```
     */
    public refresh() {
        if (this.grid) {
            triggerScrollEvent(this.grid);
        }
    }

    /**
     * Builds the grid again: sizes, rows, columns, header, grouping panel and footer, then renders the
     * cells. For when more than the visible cells changed: what a formatter returns (the header
     * filters show it too), the texts of the page ({@link setTexts}), the size of the element without a
     * resize event, a column's options changed in place. To change an option, use {@link updateConfig} - it rebuilds too. For the cells only,
     * {@link refresh} is cheaper.
     *
     * Does nothing while the grid is not on the page, it is built when it is put there.
     *
     * Was `triggerRebuild()` in v5.
     *
     * @example
     * ```ts
     * import { Datasource, type Formatter, registerFormatter } from '@simple-html/grid';
     *
     * // a formatter that reads a setting of your own
     * let decimals = 2;
     * const price: Formatter = {
     *     format: (value) => (typeof value === 'number' ? value.toFixed(decimals) : ''),
     *     parse: (text) => (text.trim() === '' ? null : Number(text))
     * };
     * registerFormatter('price', price);
     * const datasource = new Datasource({ fields: { price: { type: 'number', formatter: 'price' } } });
     * // ...
     * decimals = 0;
     * gridInterface.rebuild(); // the cells and the header filter show the prices without decimals
     * ```
     */
    public rebuild() {
        this.grid?.rebuild();
    }

    /**
     * Removes the grid from the page and disconnects it: from the datasource, the document and the
     * handlers subscribed with {@link on}. For a grid made with {@link createGrid}, when you are done
     * with it. The datasource is not changed, it can be shown again in a new grid.
     *
     * The element is removed also when you placed it yourself (`element.connectInterface()`). Removing
     * such an element from the page disconnects the grid as well: there `destroy()` is not needed.
     *
     * Do not use the interface after this: make a new one.
     *
     * @example
     * ```ts
     * import { createGrid, type GridConfig } from '@simple-html/grid';
     *
     * declare const config: GridConfig;
     *
     * const gridInterface = createGrid(host, { config, datasource });
     * // ...
     * gridInterface.destroy(); // host is empty again
     * ```
     */
    public destroy() {
        const grid = this.lastGrid;
        this.lastGrid = null;
        // connectInterface() can have put another interface in the element since: not ours to remove
        if (grid && grid.gridInterface === this) {
            grid.destroy();
        }
        // the element was not in the dom (then nothing calls it), or shows another interface now
        this.__disconnectGrid();
        this.events.clear();
        // the datasource can be shown in another grid: it sorts its fields on their values again
        this.clearSortValues();
    }

    /**
     * Fits the width of columns to their content, like Excel's AutoFit: each column as wide as the
     * widest text of its fields - for a column with stacked fields the widest of them, every line of a
     * multiline text - and its header label. At least 25px, at most 750px. Then rebuilds the grid. A
     * column with nothing to measure keeps its width. The user does the same from the header menu
     * ("Fit column width", "Fit all columns") and with a double click on a column's resize handle.
     *
     * - **The text** is what the cells show: formatted, with `numberOverride`. A checkbox cell needs
     *   the room of its checkbox. By default the rows the filter lets through (the rows of collapsed
     *   groups too), and the header label.
     * - **Measured** with the grid's font (the labels with theirs) on a canvas: the 20 longest texts of
     *   each field, by their number of characters - every text of 100 000 rows would take the browser
     *   half a second per field. The widest text is one of the longest, unless a short text of wide
     *   letters is wider than 20 longer ones of narrow letters.
     * - **`options.rows`**: only the text of these rows, and not the header label - a column fitted to
     *   cells, as the row menu's "Fit column to this cell" does.
     * - The widths are part of the state (`getState().layout`). {@link resetColumnWidths} goes back to
     *   the widths of the config.
     *
     * Measures with the grid's font, so call it once the grid is on the page: right after
     * {@link createGrid}, or from a `grid-connected` handler for an element you connect yourself. It
     * does nothing before the interface is connected to an element.
     *
     * @param fields the columns that show one of these fields, every column when left out. A field
     * that is not in the layout is skipped
     * @param options.rows fit to the cells of these rows only, see above
     * @throws a `TypeError` when `fields` is not an array of field names, or `options.rows` not an array
     *
     * @sample multiline
     * @sample misc-options
     * @example
     * ```ts
     * import { createGrid, type GridConfig, isGroupRow } from '@simple-html/grid';
     *
     * declare const config: GridConfig;
     *
     * const gridInterface = createGrid(host, { config, datasource });
     * gridInterface.fitColumns(); // every column
     * gridInterface.fitColumns(['name', 'notes']); // the columns of these fields
     *
     * // the name column as wide as the name of the current row
     * const row = datasource.currentEntity;
     * if (row && !isGroupRow(row)) {
     *     gridInterface.fitColumns(['name'], { rows: [row] });
     * }
     * ```
     */
    public fitColumns(fields?: string[], options: { rows?: EntityUnion<T>[] } = {}) {
        assertFields('fitColumns', fields);
        assertOptions('fitColumns', options, "fitColumns(['name'], { rows: [row] })");
        if (options.rows !== undefined && !Array.isArray(options.rows)) {
            throw new TypeError("fitColumns(): options.rows is an array of rows: fitColumns(['name'], { rows: [row] })");
        }
        if (this.grid) {
            fitColumns(this.grid, fields, options.rows);
        }
    }

    /**
     * Fits every column to its content: the same as {@link fitColumns} without arguments.
     *
     * @deprecated use `fitColumns()`. Before v6 it measured the values as they are stored, not as the
     * cells show them, of every row - also the rows the filter hides
     */
    public autoResizeColumns() {
        this.fitColumns();
    }

    /**
     * Gives columns back the width they start with: the width of the field's column in the layout
     * `resetState()` goes back to - `initialState.layout` when the config has one, else the config's
     * `layout`. A field that is not in it (added from the column chooser) gets 100px, as when it is
     * added. For a column with stacked fields, the width of its first field that is in it. Then
     * rebuilds the grid. The header menu has it too: "Reset column width", "Reset all column widths".
     *
     * Only the widths change: the columns stay where the user put them.
     *
     * @param fields the columns that show one of these fields, every column when left out
     * @throws a `TypeError` when `fields` is not an array of field names
     *
     * @example
     * ```ts
     * gridInterface.fitColumns();
     * gridInterface.resetColumnWidths(['notes']); // the notes column as wide as in the config again
     * gridInterface.resetColumnWidths(); // every column
     * ```
     */
    public resetColumnWidths(fields?: string[]) {
        assertFields('resetColumnWidths', fields);
        const start = layoutColumns({ layout: copyLayout(this.getStartState().layout) });
        for (const column of layoutColumns(this.gridConfig)) {
            if (fields && !column.fields.some((field) => fields.includes(field))) {
                continue;
            }
            const startColumn = column.fields
                .map((field) => start.find((candidate) => candidate.fields.includes(field)))
                .find((candidate) => candidate !== undefined);
            column.width = startColumn?.width ?? DEFAULT_COLUMN_WIDTH;
        }
        if (this.grid) {
            this.grid.rebuild();
        } else {
            this.__dataSourceUpdated();
        }
    }

    /**
     * Makes rows as high as their multiline cells need to show every line, like Excel's AutoFit of a
     * row: each row as many lines as its tallest column needs - a multiline cell the lines of its text
     * (the empty lines at its end left out), every other cell one line, the fields of a column with
     * stacked fields added up. At most 20 lines. A row that needs no more lines than the layout gives a
     * row goes back to that height. The user does the same from the row menu: "Fit row height", "Fit
     * all rows".
     *
     * - **The height**: the lines of the layout's row are `cellHeight` px each, every line more is a
     *   line of text, `multilineLineHeight` px (default 15): the lines of a note read as a paragraph. A
     *   row of one field with a note of three lines is `cellHeight + 2 * multilineLineHeight` px, 52 by
     *   default.
     *
     * - **Cheap**: it counts the line breaks of the cells' text, nothing is measured. A long line is
     *   not wrapped, it is cut at the cell's edge as in a row of one line.
     * - **In a taller row** a multiline cell shows as many of its lines as it has room for, the marker
     *   when there are more. Every other cell has its text on the first line. The editor of a
     *   multiline cell is the same.
     * - **Kept by the row's key** (`__KEY`: the datasource's `key` field, or the key it generated), so
     *   a row keeps its height through a sort, a filter, grouping and new data with the same keys
     *   (`setData()`, `upsert()`). A row whose text changes keeps its height: fit it again.
     * - **Not part of the state** (`getState()`): the heights belong to the rows loaded now.
     *   {@link resetRowHeights} takes them back.
     *
     * Works before the grid is on the page too.
     *
     * @param rows the rows to fit, a row or a list. Left out: the rows the filter lets through (the
     * rows of collapsed groups too) - and the heights of rows that are no longer in the data are
     * dropped. Group rows are skipped
     * @throws a `TypeError` when `rows` is not a row or an array of rows
     *
     * @sample multiline
     * @example
     * ```ts
     * import { isGroupRow } from '@simple-html/grid';
     *
     * gridInterface.fitRows(); // every row the filter lets through
     * gridInterface.fitRows(datasource.getSelectedRows());
     *
     * const row = datasource.currentEntity;
     * if (row && !isGroupRow(row)) {
     *     gridInterface.fitRows(row);
     * }
     * ```
     */
    public fitRows(rows?: EntityUnion<T> | EntityUnion<T>[]) {
        const list = this.rowList('fitRows', rows);
        if (rows === undefined) {
            // a full fit: the heights of rows that are gone are dropped, they would never be used again
            const kept = new Map<string, number>();
            for (const row of this.dataSource.getAllData()) {
                const key = String(row.__KEY);
                const lines = this.rowLines.get(key);
                if (lines !== undefined) {
                    kept.set(key, lines);
                }
            }
            this.rowLines = kept;
        }

        const fitLines = fitRowLinesOf({ gridInterface: this });
        const cells = this.gridConfig.__columnCells;
        for (const row of list) {
            const key = rowKey(row);
            if (key === undefined) {
                continue;
            }
            const lines = fitLines(row);
            if (lines > cells) {
                this.rowLines.set(key, lines);
            } else {
                this.rowLines.delete(key);
            }
        }
        this.updateRowHeights();
    }

    /**
     * Gives rows back the height the layout gives a row, after {@link fitRows}. The row menu has it
     * too: "Reset row height", "Reset all row heights".
     *
     * @param rows a row or a list of rows. Left out: every row
     * @throws a `TypeError` when `rows` is not a row or an array of rows
     *
     * @sample multiline
     * @example
     * ```ts
     * gridInterface.resetRowHeights(); // every row back to the height of the layout
     * gridInterface.resetRowHeights(datasource.getSelectedRows());
     * ```
     */
    public resetRowHeights(rows?: EntityUnion<T> | EntityUnion<T>[]) {
        if (rows === undefined) {
            this.rowLines.clear();
        } else {
            for (const row of this.rowList('resetRowHeights', rows)) {
                const key = rowKey(row);
                if (key !== undefined) {
                    this.rowLines.delete(key);
                }
            }
        }
        this.updateRowHeights();
    }

    /**
     * @internal
     * true when the row has a height of its own (fitRows), for the row menu. Left out: any row
     */
    public __hasRowHeight(row?: Entity): boolean {
        if (row === undefined) {
            return this.rowLines.size > 0;
        }
        const key = rowKey(row);
        return key !== undefined && this.rowLines.has(key);
    }

    /**
     * the rows given to fitRows() / resetRowHeights() as a list: the rows the filter lets through when
     * none are given
     * @throws a `TypeError` when it is not a row or an array of rows
     */
    private rowList(method: string, rows: EntityUnion<T> | EntityUnion<T>[] | undefined): readonly Entity[] {
        if (rows === undefined) {
            return this.dataSource.getDataRows();
        }
        if (Array.isArray(rows)) {
            return rows;
        }
        if (rows && typeof rows === 'object') {
            return [rows];
        }
        throw new TypeError(`${method}(): rows is a row or an array of rows, not ${JSON.stringify(rows)}`);
    }

    /**
     * the rows have other heights: the tops of the rows again, and the rows on screen rendered
     */
    private updateRowHeights() {
        this.__dataSourceUpdated();
        if (this.grid) {
            triggerScrollEvent(this.grid);
        }
    }

    /**
     * Opens the filter editor, the dialog where the user builds a filter of conditions and AND/OR
     * groups. It starts with the filter the datasource has now. The user opens it from the header
     * filter's menu ("Advanced Filter") or by clicking the filter shown in the footer - or "No filter"
     * there while the rows are not filtered; call this from a button of your own.
     *
     * It is a modal `<dialog>` (`showModal()`): over everything on the page, the page behind it can
     * not be used while it is open. The focus moves to the dialog when it opens and goes back to where
     * it was when it closes; Esc closes it (a menu open in it first). The user drags it by its title
     * bar and resizes it from every edge and corner, with the mouse, a finger or a pen.
     *
     * Does nothing while the grid is not on the page.
     *
     * @example
     * ```ts
     * document.getElementById('advanced-filter')!.onclick = () => gridInterface.openFilterEditor();
     * ```
     */
    public openFilterEditor() {
        if (this.grid) {
            openFilterEditor(this.grid);
        }
    }

    /**
     * Opens the grid config dialog on its *Columns* tab: the columns of the layout on the left, the
     * settings of the one picked on the right - its label, a date or number column's display format (as
     * Format › in the header menu), a number column's blank / 0, a text column's template and link, a text
     * or number column as checkboxes, the placeholder and the operator of the header filter, with a
     * preview of the current row (see {@link ColumnFormat}). The user opens it with the gear at the right
     * end of the footer (`GridConfig.settingsButton`) or *Column settings…* in the header menu; call this
     * from a button of your own. Its other tab is the detail form, see {@link openDetailFormSettings}.
     *
     * Its Apply sets the formats of the state (`setState({ formats })`, {@link GridState}): `getState()`
     * has them, to save. Reset column / Reset all go back to the formats the grid starts with -
     * `ColumnConfig.format`, or `initialState.formats`.
     *
     * A modal `<dialog>`, as the filter editor: the focus moves into it, Esc closes it (a menu open in it
     * first), the focus goes back to where it was; the user drags it by its title bar and resizes it from
     * every edge and corner.
     *
     * Does nothing while the grid is not on the page.
     *
     * @param field the column it shows first. Left out: the column of the cell with the focus, else the
     * first column of the layout
     *
     * @sample full-grid
     * @example
     * ```ts
     * document.getElementById('settings')!.onclick = () => gridInterface.openColumnSettings('company');
     * ```
     */
    public openColumnSettings(field?: string) {
        if (this.grid) {
            openColumnSettings(this.grid, field);
        }
    }

    /**
     * Opens the grid config dialog on its *Detail form* tab: *Show the detail form*, its width, and the
     * fields it shows - the columns of the layout and the other columns of the config - each with a
     * checkbox, in the order of the form: Move up / Move down (Alt+↑ / Alt+↓) change it. See
     * {@link DetailForm}.
     *
     * Its Apply sets the detail form of the state (`setState({ detailForm })`, {@link GridState}):
     * `getState()` has it, to save. *Reset form* goes back to the one the grid starts with -
     * `GridConfig.detailForm`, or `initialState.detailForm`. The dialog's other tab, *Columns*, is
     * {@link openColumnSettings}; Apply applies both.
     *
     * Does nothing while the grid is not on the page.
     *
     * @sample detail-form
     * @example
     * ```ts
     * document.getElementById('detail-form')!.onclick = () => gridInterface.openDetailFormSettings();
     * ```
     */
    public openDetailFormSettings() {
        if (this.grid) {
            openColumnSettings(this.grid, undefined, 'detailForm');
        }
    }

    /**
     * Opens the keyboard shortcuts help: a dialog that lists the keys of the grid in groups, with a
     * search - as `?` (where it types nothing) and Ctrl+/ in the grid do, and *Keyboard shortcuts…* in
     * the header menu. The keys as the platform names them, ⌘ on a Mac; a key that does nothing in this
     * grid is left out - the editing keys of a readonly grid. For a help button of your own: it opens the
     * help also with `GridConfig.shortcutHelp: false`, which turns the grid's own ways to open it off.
     *
     * A modal `<dialog>`, as the filter editor: the focus moves into it - into its search when a key
     * opened it - Esc closes it, the focus goes back to where it was; the user drags it by its title bar
     * and resizes it from every edge and corner. Its texts are `shortcuts.*`.
     *
     * Does nothing while the grid is not on the page.
     *
     * @example
     * ```ts
     * document.getElementById('keys-help')!.onclick = () => gridInterface.openShortcutHelp();
     * ```
     */
    public openShortcutHelp() {
        if (this.grid) {
            openShortcutHelp(this.grid);
        }
    }

    /**
     * The fields in the layout now, in the order the user sees them: pinned left, center, pinned right,
     * left to right, and top to bottom within a column of stacked fields.
     *
     * With `selectedOnly`, only the fields of the columns the user selected - by clicking the column
     * numbers under the header filters, Ctrl/Cmd+click for more, Shift+click for the ones between, see
     * {@link getSelectedColumns}. None selected gives `[]`.
     *
     * Was `getAttributeColumns(filterSelectedColumns)` in v5, which gave the selected columns by default
     * and every column when none was selected.
     *
     * @param options.selectedOnly only the fields of the selected columns, default `false`
     *
     * @example
     * ```ts
     * gridInterface.getLayoutFields(); // ['name', 'age', 'born', 'company']
     * gridInterface.getLayoutFields({ selectedOnly: true }); // ['age', 'born'] - one column, two fields
     *
     * // the selected columns, or every column when none is selected
     * const selected = gridInterface.getLayoutFields({ selectedOnly: true });
     * const toExport = selected.length ? selected : gridInterface.getLayoutFields();
     * ```
     */
    public getLayoutFields(options: { selectedOnly?: boolean } = {}): string[] {
        assertOptions('getLayoutFields', options, 'getLayoutFields({ selectedOnly: true })');
        return getLayoutFields(this, options);
    }

    /**
     * The columns the user selected, by their numbers: the row of numbers under the header filters,
     * 1 based, counted across the pinned left, the center and the pinned right columns - a column of
     * stacked fields is one number. A click on a number selects that column, Ctrl/Cmd+click adds or
     * removes one, Shift+click selects the columns from the one clicked before, as on the row numbers.
     * Ascending, `[]` when none is selected. {@link getLayoutFields} with `selectedOnly` gives their
     * fields.
     *
     * The numbers are good for the layout they were selected in: the selection is cleared when the
     * fields of the layout change - a column moved, pinned, hidden or added - and
     * `column-selection-change` is sent. A column resized keeps it. It is not part of the state.
     *
     * @sample ranges
     * @example
     * ```ts
     * gridInterface.getSelectedColumns(); // [2, 3, 4]
     * gridInterface.getLayoutFields({ selectedOnly: true }); // ['city', 'age', 'born', 'active']
     * ```
     */
    public getSelectedColumns(): number[] {
        return [...this.columnSelection.selected];
    }

    /**
     * Selects columns by their numbers (see {@link getSelectedColumns}), replacing the ones selected:
     * the numbers show it, `column-selection-change` is sent when it changed. `[]` selects none. A
     * Shift+click after it selects from the last number given.
     *
     * @param columns the numbers, 1 based as the header shows them
     * @throws a `TypeError` for a number that is no column: not a whole number from 1 to the number of
     * columns of the layout
     *
     * @sample ranges
     * @example
     * ```ts
     * gridInterface.selectColumns([1, 2]); // the first two columns
     * gridInterface.selectColumns([]); // none
     *
     * gridInterface.on('column-selection-change', ({ columns, fields }) => {
     *     console.log(columns.length ? `columns ${columns.join(', ')}: ${fields.join(', ')}` : 'no column selected');
     * });
     * ```
     */
    public selectColumns(columns: number[]) {
        const count = numberedColumns(this.gridConfig).length;
        if (!Array.isArray(columns) || columns.some((n) => !Number.isInteger(n) || n < 1 || n > count)) {
            throw new TypeError(
                `selectColumns() takes column numbers from 1 to ${count}, the columns of the layout - got ${JSON.stringify(columns)}`
            );
        }
        const selected = Array.from(new Set(columns)).sort((a, b) => a - b);
        this.setColumnSelection({ selected, anchor: columns.at(-1) ?? null, kept: [] }, true);
    }

    /**
     * The fields the grid knows that are not in the layout now: the ones the column chooser can add
     * back. The grid knows the keys of `GridConfig.columns`, and every field that has been in the
     * layout.
     *
     * Was `getOptionalAttributes()` in v5.
     *
     * @example
     * ```ts
     * import { createGrid } from '@simple-html/grid';
     *
     * const gridInterface = createGrid(host, {
     *     config: { columns: { phone: {} }, layout: { center: [{ fields: ['name'], width: 100 }] } },
     *     datasource
     * });
     * gridInterface.getHiddenFields(); // ['phone']
     * ```
     */
    public getHiddenFields(): string[] {
        const fields = new Set(Object.keys(this.gridConfig.columns));
        for (const field of getLayoutFields(this)) {
            fields.delete(field);
        }
        return Array.from(fields);
    }

    /**
     * The ranges of cells the user selected - by dragging over the cells, Shift+click, Ctrl/Cmd+click
     * for another one, Alt+Shift+arrows - or that {@link setRanges} set. See {@link CellRange}: rows
     * are indexes in the displayed rows, fields are field names. The last range is the one made last,
     * its `fromRow` / `fromField` is the active cell. `[]` when no cells are selected.
     *
     * Copies: changing them changes nothing in the grid.
     *
     * The ranges are cleared when the displayed rows change - a filter, a sort, grouping, a group
     * expanded or collapsed, rows added or removed (`setData()`, `upsert()` that adds or removes
     * rows, rows marked for deletion) - and when the fields of the layout change: a column moved,
     * pinned, hidden or added. A column resized keeps them, and so does an edit: the rows stay where
     * they are. `range-change` is sent every time they change.
     *
     * The row selection of the datasource (`datasource.getSelectedRows()`) is something else: a
     * range does not select rows, selecting rows changes no range.
     *
     * @sample ranges
     * @example
     * ```ts
     * const ranges = gridInterface.getRanges();
     * if (ranges.length) {
     *     const { fromRow, fromField, toRow, toField } = ranges[ranges.length - 1];
     *     console.log(`from row ${fromRow} ${fromField} to row ${toRow} ${toField}`);
     * }
     * ```
     */
    public getRanges(): CellRange[] {
        return this.ranges.map((range) => ({ ...range }));
    }

    /**
     * Selects ranges of cells, replacing the ones there are - as if the user had selected them. See
     * {@link CellRange}. The cells show them, `range-change` is sent. The focus does not move and the
     * grid does not scroll to them.
     *
     * The grid keeps copies, with only the four keys of a range. They are cleared when the displayed
     * rows or the layout change, see {@link getRanges}.
     *
     * @param ranges the ranges, the last one is the active one. `[]` clears them, as {@link clearRanges}
     * @throws a `TypeError` for a range with a row that is not displayed (0 to `datasource.length() - 1`)
     * or a field that is not in the layout
     *
     * @sample ranges
     * @example
     * ```ts
     * // rows 0 to 4, the fields from name to age
     * gridInterface.setRanges([{ fromRow: 0, fromField: 'name', toRow: 4, toField: 'age' }]);
     *
     * // two ranges, as Ctrl+click makes them
     * gridInterface.setRanges([
     *     { fromRow: 0, fromField: 'name', toRow: 0, toField: 'name' },
     *     { fromRow: 5, fromField: 'age', toRow: 9, toField: 'age' }
     * ]);
     * ```
     */
    public setRanges(ranges: CellRange[]) {
        assertRanges(this, ranges);
        this.__setRanges(ranges);
    }

    /**
     * Clears the ranges of cells: no cell is selected. Sends `range-change` when there were ranges.
     * The rows selected in the datasource stay selected.
     *
     * @sample ranges
     * @example
     * ```ts
     * document.getElementById('clear-selection')!.onclick = () => gridInterface.clearRanges();
     * ```
     */
    public clearRanges() {
        this.__setRanges([]);
    }

    /**
     * Fill down, as Ctrl+D (Cmd+D) in a cell does: in every range the values of its top row go into the
     * rows under it, a range of one row gets the values of the data row above it. Without a range, the
     * cell with the focus gets the value of the cell above it. The values are copied as they are; cells
     * that can not be edited are skipped (the grid's `readonly`, the column's, the `isReadonly` hook),
     * group rows have no cells. One step of the undo history. See the guide "Selection and clipboard".
     *
     * @sample ranges
     * @example
     * ```ts
     * // the status of the first row into the next four
     * gridInterface.setRanges([{ fromRow: 0, fromField: 'status', toRow: 4, toField: 'status' }]);
     * gridInterface.fillDown();
     * ```
     */
    public fillDown() {
        const focused = this.grid ? focusedCell(this.grid) : null;
        fillDown(this, focused ? pointOf(focused.cell) : null);
    }

    /**
     * @internal
     * Sets the ranges, for the grid's mouse and keys and for setRanges() (which checks them first): the
     * cells on screen show them, and `range-change` is sent. Nothing happens when they are the ranges
     * there are - a pointer moving within a cell
     */
    public __setRanges(ranges: CellRange[]) {
        const copies = ranges.map(({ fromRow, fromField, toRow, toField }) => ({ fromRow, fromField, toRow, toField }));
        if (sameRanges(this.ranges, copies)) {
            return;
        }
        this.ranges = copies;
        this.rangeState = rangeState(this.gridConfig, copies);
        if (this.grid) {
            renderRangeClasses(this.grid);
            // the summary of the selected cells
            if (this.grid.domCreated) {
                renderFooter(this.grid);
            }
        }
        this.__callSubscribers('range-change', { ranges: this.getRanges() });
    }

    /**
     * @internal
     * the ranges in indexes, for the cells: see RangeState. null without ranges
     */
    public __getRangeState(): RangeState | null {
        return this.rangeState;
    }

    /**
     * Finds a text in the cells, as Ctrl+F in the grid does: opens the find bar with the text, marks
     * every cell that shows it and scrolls to the current match. See {@link FindResult} for what a
     * match is and their order - the text a cell shows, formatted, in any case (or as it is, with
     * `caseSensitive`).
     *
     * The current match is the first one at or after the cell that has the focus (or the first one);
     * while the bar is open, the current match stays while it still matches, else it is the next one.
     * The focus does not move: {@link openFind} puts it in the bar, as Ctrl+F does. `find-change` is
     * sent. Does nothing while the grid is not on the page.
     *
     * **`filterRows`** turns "Filter rows" of the find bar on or off, as its toggle does: only the rows
     * with a match are shown - on top of the filter, not part of it (`getFilter()` and the state do not
     * have it, {@link getFindFilter} gives it for a backend). Left out, it stays as it is. It is turned
     * off when the bar closes ({@link closeFind}, Esc), and by the footer's Clear. See
     * {@link FindResult.filterRows}.
     *
     * **`caseSensitive`** turns "Match case" of the find bar on or off, as its toggle `Aa` does: the
     * text is found as it is - `Acme` does not find `ACME`. The matches, the count and "Filter rows"
     * follow it. Left out, it stays as it is; it is kept when the bar closes. See
     * {@link FindResult.caseSensitive}.
     *
     * @param text the text to find. `''` opens the bar with no matches (and every row)
     * @param options.filterRows `true` for only the rows with a match, `false` for every row
     * @param options.caseSensitive `true` to find the text as it is, `false` to find it in any case
     * @returns how many cells show the text
     * @throws a `TypeError` when the text is not a string
     *
     * @sample find
     * @example
     * ```ts
     * const count = gridInterface.find('acme');
     * console.log(`${count} cells`, gridInterface.getFind().current); // { row: 3, field: 'company' }
     * gridInterface.findNext();
     *
     * // only the rows with a cell that shows "acme", then every row again with the bar still open
     * gridInterface.find('acme', { filterRows: true });
     * gridInterface.find('acme', { filterRows: false });
     *
     * // "Acme" as it is: not "ACME" or "acme"
     * gridInterface.find('Acme', { caseSensitive: true });
     * gridInterface.closeFind();
     * ```
     */
    public find(text: string, options: { filterRows?: boolean; caseSensitive?: boolean } = {}): number {
        if (typeof text !== 'string') {
            throw new TypeError(`find(text): the text is a string, e.g. find('acme'), got ${String(text)}`);
        }
        assertOptions('find', options, "find('acme', { filterRows: true, caseSensitive: true })");
        if (this.grid) {
            openFind(this.grid, {
                text,
                focus: false,
                filterRows: options.filterRows,
                caseSensitive: options.caseSensitive
            });
        }
        return this.getFind().count;
    }

    /**
     * Opens the find bar as Ctrl+F does: the focus goes into its input, with the text it had selected,
     * and the matches of that text show. For a button or a menu entry of your own. Does nothing while
     * the grid is not on the page.
     *
     * @sample find
     * @example
     * ```ts
     * document.getElementById('find-button')!.onclick = () => gridInterface.openFind();
     * ```
     */
    public openFind() {
        if (this.grid) {
            openFind(this.grid, { focus: true });
        }
    }

    /**
     * Goes to the next match, as Enter and F3 in the find bar: it is the current one, the grid scrolls
     * to it. After the last one, the first. Nothing while the find bar is closed or nothing matches.
     *
     * @returns the cell of the current match - its row in the displayed rows and its field - or `null`
     *
     * @sample find
     * @example
     * ```ts
     * gridInterface.find('norway');
     * const cell = gridInterface.findNext(); // { row: 12, field: 'country' }
     * ```
     */
    public findNext(): FindResult['current'] {
        return this.grid ? findStep(this.grid, 1) : null;
    }

    /**
     * Goes to the previous match, as Shift+Enter and Shift+F3 in the find bar. Before the first one, the
     * last. See {@link findNext}.
     *
     * @returns the cell of the current match, or `null`
     *
     * @example
     * ```ts
     * gridInterface.find('norway');
     * gridInterface.findPrevious(); // the last match: the first one comes before it
     * ```
     */
    public findPrevious(): FindResult['current'] {
        return this.grid ? findStep(this.grid, -1) : null;
    }

    /**
     * Closes the find bar, as Esc in it does: the cells are not marked any more. Its text is kept, Ctrl+F
     * shows it again. "Filter rows" is turned off: every row the filter lets through is shown again. When
     * the focus was in the bar it goes to the cell of the current match. `find-change` is sent.
     *
     * @example
     * ```ts
     * document.getElementById('close-find')!.onclick = () => gridInterface.closeFind();
     * ```
     */
    public closeFind() {
        if (this.grid) {
            closeFind(this.grid);
        }
    }

    /**
     * What Find has found now: whether the bar is open, its text, whether "Filter rows" and "Match case"
     * are on, how many cells match and the current match, see {@link FindResult}. A copy. The
     * `find-change` event sends the same each time it changes.
     *
     * @example
     * ```ts
     * const { open, count, position, filterRows, caseSensitive } = gridInterface.getFind();
     * if (open) {
     *     console.log(count ? `${position} of ${count}` : 'no matches', filterRows ? '(rows filtered)' : '');
     *     console.log(caseSensitive ? 'match case' : 'any case');
     * }
     * ```
     */
    public getFind(): FindResult {
        return this.grid
            ? getFindResult(this.grid)
            : { open: false, text: '', filterRows: false, caseSensitive: false, count: 0, position: 0, current: null };
    }

    /**
     * Find's "Filter rows" as a filter, for a backend that loads the rows: the rows with a match as a
     * {@link FilterExpression}, which `toSqlWhere()` (`@simple-html/grid/sql`) turns into SQL like any
     * other filter. AND it to `datasource.getFilter()`: "Filter rows" is on top of the filter. `null`
     * while "Filter rows" shows every row - it is off, the bar is closed, the text is empty. The
     * `find-filter-change` event sends it each time it changes.
     *
     * An OR group of one condition per field Find searches (the fields of the layout), for the fields
     * whose cells SQL can match the way they show:
     *
     * - **a text field** showing its value as it is: `CONTAINS` the text, `literal` (`*`, `%` and `_`
     *   are no wildcards: Find takes the text as it is) and `caseSensitive` with Match case - every line
     *   of a multiline text. The same rows as Find
     * - **a lookup column**: `IN` the values whose label - what the cells show - holds the text
     * - **a number field**: `EQUAL` the number the text reads as, when the cell of that number shows the
     *   text: `30` is 30 - Find also marks `130`
     * - **a date or datetime field**: `EQUAL` the day (the second) the text is, as the cells show it:
     *   `2026-03-14`. A part of a date is none
     *
     * Left out: a boolean and a column of checkboxes (Find does not search them), a text field with a
     * formatter or a template of its own, a column whose type changes per row. With no condition, a
     * condition of no row: `IN []` on the first field.
     *
     * So the filter selects the rows Find shows, or fewer - never a row without a match. The find
     * guide has the details.
     *
     * @param options.fields the fields the filter may name - the ones your backend has a column for (a
     * field made in the browser is not in the database). A field Find searches that is not in it is
     * left out, the condition of no row is on its first. Default every field Find searches
     * @returns the filter, or `null` for every row - also while the grid is not on the page
     * @throws a `TypeError` for `fields` that is not a list of at least one field name
     *
     * @sample sql
     * @example
     * ```ts
     * import { and, type FilterExpression } from '@simple-html/grid';
     * import { toSqlWhere } from '@simple-html/grid/sql';
     *
     * gridInterface.find('acme', { filterRows: true });
     * gridInterface.getFindFilter();
     * // { group: 'OR', children: [
     * //     { field: 'company', operator: 'CONTAINS', value: 'acme', literal: true },
     * //     { field: 'country', operator: 'CONTAINS', value: 'acme', literal: true } ] }
     *
     * // what a backend gets: the filter AND the find, the fields it has columns for
     * const find = gridInterface.getFindFilter({ fields: ['company', 'country', 'age'] });
     * const parts = [datasource.getFilter(), find].filter((part): part is FilterExpression => part !== null);
     * const { sql, params } = toSqlWhere(and(...parts), {
     *     dialect: 'postgres',
     *     columns: { company: 'company', country: 'country', age: { column: 'age', type: 'number' } }
     * });
     * ```
     */
    public getFindFilter(options: { fields?: readonly string[] } = {}): FilterExpression | null {
        assertOptions('getFindFilter', options, "getFindFilter({ fields: ['company', 'country'] })");
        const { fields } = options;
        if (
            fields !== undefined &&
            (!Array.isArray(fields) || !fields.length || fields.some((field) => typeof field !== 'string'))
        ) {
            throw new TypeError(
                `getFindFilter({ fields }): fields is a list of the field names your backend has, e.g. ['company', 'country'], got ${JSON.stringify(fields)}`
            );
        }
        return this.grid ? getFindFilter(this.grid, fields) : null;
    }

    /**
     * The rows as an Excel workbook (.xlsx), a Blob: one sheet with a header row of the column labels
     * (bold, frozen, with an autofilter over it and every row), then a row per data row. By default
     * every row the filter lets through, in the sort order, and the columns of the layout in the
     * order the user sees them, as wide as in the grid. See {@link ExcelOptions} for what can be
     * changed: the selected rows, the selected range of cells, the fields, the sheet name.
     *
     * - **Typed cells**, so Excel can sum, sort and filter: a number field gives numbers, a date or
     *   datetime field Excel dates (the local date and time the grid shows), a boolean field TRUE /
     *   FALSE, text text - with wrapped lines when it has a line break. A value that is not of its
     *   field's type (text in a number field) is written as the text the cell shows. Blanks are empty
     *   cells.
     * - **A flat list**: when grouped, every data row in the grouped order - the rows of collapsed
     *   groups too - and no group rows, no outline, no totals. Rows marked for deletion are rows of the
     *   grid until they are saved, they are exported too.
     * - **No formulas**: text is never a formula in an .xlsx file, a value a user typed
     *   (`=HYPERLINK(...)`) shows as the text it is.
     * - **The values when called**: the rows and values are read before the promise is returned, the
     *   file is zipped after (with the browser's `CompressionStream`, so this is async).
     *
     * Works without the grid on the page too: it reads the config and the datasource.
     *
     * @param options what to export, see {@link ExcelOptions}. Every option is optional
     * @returns the .xlsx file, of the type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
     * @throws (the promise rejects with) a `TypeError` for an option it does not know or a value an
     * option does not take (`rows: 'some'`, a sheet name Excel does not take), a `RangeError` for more
     * rows (1 048 576 with the header) or columns (16 384) than an Excel sheet holds
     *
     * @sample export
     * @example
     * ```ts
     * // the file, for code of your own: upload it, attach it to a mail ...
     * const blob = await gridInterface.getExcel();
     * await fetch('/api/reports', { method: 'POST', body: blob });
     *
     * // the selected rows, two fields, on a sheet named People
     * const people = await gridInterface.getExcel({ rows: 'selected', fields: ['name', 'born'], sheetName: 'People' });
     *
     * // the cells the user selected (the last range of cells)
     * const cells = await gridInterface.getExcel({ rows: 'range' });
     * ```
     */
    public getExcel(options: ExcelOptions = {}): Promise<Blob> {
        return gridExcel(this, 'getExcel', options);
    }

    /**
     * Saves the rows as an Excel file (.xlsx): the browser downloads it, as from a link. The file is
     * {@link getExcel}'s. The row menu's *Excel, all rows* and *Excel, selected rows* call this.
     *
     * @param filename the name the file is saved as, default `'export.xlsx'`. Give it the `.xlsx`
     * ending yourself, it is not added
     * @param options what to export, see {@link ExcelOptions}
     * @returns a promise that is fulfilled once the download is started
     * @throws (the promise rejects with) a `TypeError` when the filename is not a text
     * (`downloadExcel({ rows: 'selected' })`: the filename comes first), for an option it does not
     * know or a value an option does not take
     *
     * @sample export
     * @example
     * ```ts
     * document.getElementById('export')!.onclick = () => gridInterface.downloadExcel();
     *
     * // the selected rows, on a sheet named Orders
     * await gridInterface.downloadExcel('orders.xlsx', { rows: 'selected', sheetName: 'Orders' });
     * ```
     */
    public downloadExcel(filename: string = 'export.xlsx', options: ExcelOptions = {}): Promise<void> {
        return downloadGridExcel(this, filename, options);
    }

    /**
     * The rows as CSV text (RFC 4180): a header line with the column labels, then a line per row,
     * every line ended with CRLF. By default every row the filter lets through, in the sort order, and
     * the columns of the layout in the order the user sees them, each value as the grid shows it. See
     * {@link CsvOptions} for what can be changed: the selected rows, the selected range of cells, the
     * fields, the separator (`';'` for Excel in Norway), raw values ...
     *
     * - **The rows**: when grouped, every data row in the grouped order - the rows of collapsed groups
     *   too, no group rows. Rows marked for deletion are rows of the grid until they are saved, they
     *   are exported too.
     * - **Formulas**: text starting with `=`, `+`, `-`, `@` ... gets a `'` in front, so a spreadsheet
     *   does not run a formula a user typed in (`escapeFormulas`).
     * - **No BOM** by default, unlike {@link downloadCsv}: the text is for code of your own.
     *
     * Works without the grid on the page too: it reads the config and the datasource.
     *
     * @param options what to export and how, see {@link CsvOptions}. Every option is optional
     * @returns the CSV text, `''` when there are no columns
     * @throws a `TypeError` for an option it does not know or a value an option does not take
     * (`rows: 'some'`)
     *
     * @sample export
     * @example
     * ```ts
     * const text = gridInterface.getCsv(); // 'Name,Born\r\nAnn,2001-05-17\r\n...'
     *
     * // the selected rows, semicolons for Excel in Norway, the values as they are stored
     * const selected = gridInterface.getCsv({ rows: 'selected', separator: ';', formatted: false });
     *
     * // two fields, no header line
     * const names = gridInterface.getCsv({ fields: ['name', 'email'], header: false });
     *
     * // the cells of the range the user selected, see getRanges()
     * const range = gridInterface.getCsv({ rows: 'range' });
     * ```
     */
    public getCsv(options: CsvOptions = {}): string {
        return gridCsv(this, 'getCsv', options);
    }

    /**
     * Saves the rows as a CSV file: the browser downloads it, as from a link. The text is
     * {@link getCsv}'s, with a UTF-8 byte order mark (BOM) first by default - Excel needs it to read
     * `æøå` (`bom: false` leaves it out).
     *
     * For Excel in a locale with a decimal comma (Norwegian, German ...), use `separator: ';'`:
     * Excel splits a .csv file on the list separator of the computer's locale, and with `','` every
     * row ends up in one column.
     *
     * @param filename the name the file is saved as, default `'export.csv'`. Give it the `.csv`
     * ending yourself, it is not added
     * @param options what to export and how, see {@link CsvOptions}
     * @throws a `TypeError` when the filename is not a text (`downloadCsv({ rows: 'selected' })`: the
     * filename comes first), for an option it does not know or a value an option does not take
     *
     * @sample export
     * @example
     * ```ts
     * document.getElementById('export')!.onclick = () => gridInterface.downloadCsv();
     *
     * // the selected rows, for Excel in Norway
     * gridInterface.downloadCsv('selected.csv', { rows: 'selected', separator: ';' });
     * ```
     */
    public downloadCsv(filename: string = 'export.csv', options: CsvOptions = {}): void {
        downloadGridCsv(this, filename, options);
    }

    /**
     * Opens a menu of your own, in the grid's menu style: a value picker for a cell, the actions of a
     * button, a second grid as a dropdown ({@link MenuBlock}). See {@link MenuEntry} for what it can
     * show, submenus too ({@link MenuSubmenu}). To change the grid's own right click menus, use the
     * `menus` hook ({@link GridHooks}).
     *
     * The menu is a popover: shown in the top layer, over everything on the page - a container with
     * `overflow: hidden` does not cut it off, no z-index covers it. Opened from an element in a
     * `<dialog>` or a popover of your own, it is put inside that element, so it can be used there
     * (everything outside a modal dialog is inert).
     *
     * The menu open before is closed: there is one menu at a time. The grid closes this one, as its
     * own, on a click outside it, on Esc, when another menu opens, on scroll (with
     * `autoRemoveContextMenuOnScrollEvent`) and when the grid leaves the page. Clicking an item closes
     * it too, with its submenus, then calls the item's action; clicking in a block does not.
     * {@link closeMenu} closes it from code. When the focus is in the menu as it closes (an item, a
     * field in a block), it goes back to the element that had it when the menu opened.
     *
     * The keyboard: called after a key (a button pressed with Enter) the menu takes the focus, on its
     * first item, and the arrows, Enter, Esc work as in the grid's menus - the WAI-ARIA menu pattern.
     * Called after a pointer press the focus stays where it is, ArrowDown gets into the menu.
     *
     * Called from a click handler the menu stays open: the click that opened it does not count as a
     * click outside it.
     *
     * The callbacks of the entries get a {@link MenuContext} with `menu: 'custom'`, the grid and the
     * datasource; it has no field, row or cell - your entries know what they were made for.
     *
     * Does nothing while the grid is not on the page.
     *
     * Replaces v5's `contextMenuCustom()` and `setContextMenuElement()`.
     *
     * @param at where it opens:
     * - a mouse event: its top left corner at the mouse
     * - a {@link MenuPosition} `{ x, y }`: its top left corner there, in px from the window's left and
     *   top edges
     * - an element: under the element, lined up with its left edge
     *
     * It is kept in the window: opened above the point (or the element) when there is no room below,
     * moved left when it sticks out on the right.
     * @param entries what the menu shows, in order. Entries whose `visible` returns `false` are left out
     *
     * @sample context-menu
     * @sample dropdown-grid
     * @example
     * ```ts
     * // a value picker on a cell
     * gridInterface.on('cell-click', (data) => {
     *     if (data.attribute === 'fruit') {
     *         const pick = (fruit: string) => {
     *             data.rowData.fruit = fruit;
     *             gridInterface.refresh();
     *         };
     *         gridInterface.openMenu(data.originalEvent, [
     *             { type: 'section', id: 'fruit', label: 'Pick a fruit:' },
     *             { id: 'fruit.apple', label: 'Apple', action: () => pick('Apple') },
     *             { id: 'fruit.banana', label: 'Banana', action: () => pick('Banana') }
     *         ]);
     *     }
     * });
     *
     * // an element of your own under a cell, closed with the grid's menus
     * declare const cell: HTMLElement;
     * declare const myPicker: HTMLElement;
     * gridInterface.openMenu(cell, [{ type: 'block', id: 'picker', element: myPicker }]);
     * ```
     */
    public openMenu(at: MouseEvent | MenuPosition | HTMLElement, entries: MenuEntry[]) {
        // no grid connected (not in the dom yet, or removed): nothing to open the menu in
        if (this.grid) {
            const context: MenuContext = {
                menu: 'custom',
                field: '',
                row: undefined,
                rowIndex: -1,
                cell: undefined,
                gridInterface: this,
                datasource: this.dataSource
            };
            showMenu(this.grid, entries, context, placeAt(at));
        }
    }

    /**
     * Closes the menu that is open: one opened with {@link openMenu}, or one of the grid's own right
     * click menus. Does nothing when no menu is open. The focus goes back as when the user closes it,
     * see {@link openMenu}.
     *
     * Replaces v5's `removeContextMenuElement()`.
     *
     * @sample dropdown-grid
     * @example
     * ```ts
     * // moving to another cell closes a dropdown opened from a cell
     * gridInterface.on('cell-row-focus', () => gridInterface.closeMenu());
     * ```
     */
    public closeMenu() {
        // no grid connected: there is no menu to close
        if (this.grid) {
            removeContextMenu(this.grid);
        }
    }

    /**
     * Subscribes to an event of the grid: cell clicks and focus, copy/paste from the row menu ...
     * The handler gets the event's payload, typed from {@link GridEvents} - see there for every
     * event and what it sends. Sorting, filtering, selection and data changes are events of the
     * datasource: `gridInterface.getDatasource().on(...)`, see {@link DatasourceEvents}.
     *
     * The handler stays subscribed until you call the function this returns. What the handler
     * returns is ignored (in v5 it had to return `true` to stay subscribed).
     *
     * @param type the event name
     * @param handler called with the payload every time the event is sent
     * @returns a function that unsubscribes the handler
     *
     * @sample events
     * @example
     * ```ts
     * const off = gridInterface.on('cell-click', (data) => {
     *     if (data.attribute === 'company') {
     *         console.log('company clicked:', data.rowData.company);
     *     }
     * });
     *
     * off(); // unsubscribe
     * ```
     */
    public on<Type extends keyof GridEvents>(type: Type, handler: EventHandler<GridEvents[Type]>): () => void {
        return this.events.on(type, handler);
    }

    /**
     * The datasource the grid shows: its rows, selection, sorting, filter and the events for them.
     *
     * @example
     * ```ts
     * const datasource = gridInterface.getDatasource();
     * datasource.on('selection-change', () => console.log(datasource.getSelectedRows().length, 'selected'));
     * ```
     */
    public getDatasource(): Datasource<T> {
        return this.dataSource;
    }

    /**
     * @internal
     * @private
     * computes what depends on the layout and the rows: the sizes, and a `columns` entry for every
     * field of the layout. Called on every rebuild, the user changes the layout
     */
    public __parseConfig() {
        const config = this.gridConfig;
        const layout = config.layout;

        // a column without fields is left out (drag/drop and hiding can empty a column)
        layout.left = layout.left.filter((e) => e.fields?.length);
        layout.right = layout.right.filter((e) => e.fields?.length);
        layout.center = layout.center.filter((e) => e.fields?.length);

        /**
         * height
         */
        let cells = getCellHeight(layout.left, 1);
        cells = getCellHeight(layout.right, cells);
        cells = getCellHeight(layout.center, cells);

        config.__rowHeight = cells * config.cellHeight;
        config.__rowHeaderHeight = cells * config.cellHeight + cells * config.cellHeaderLabelHeight;
        config.__columnCells = cells;

        /**
         * widths pinned
         */
        config.__leftWidth = layout.left.map((col) => col.width || 100).reduce((value, curvalue) => value + curvalue, 0) || 0;
        config.__rightWidth = layout.right.map((col) => col.width || 100).reduce((value, curvalue) => value + curvalue, 0) || 0;

        config.__scrollbarSize = 10;

        config.__selectSizeWidth = Math.floor(getTextWidth(this.grid, this.dataSource.getRows().length.toString()) || 10);
        if (config.__selectSizeWidth < 25) {
            config.__selectSizeWidth = 25;
        }
        // room for the icon of the row's state in front of the number, see renderRowSelector
        if (config.rowStatus) {
            config.__selectSizeWidth += ROW_STATUS_WIDTH;
        }

        /**
         * a field in the layout without an entry in columns gets the defaults. The entry stays when the
         * field leaves the layout, so the column chooser can add it back
         */
        for (const column of [...layout.left, ...layout.center, ...layout.right]) {
            for (const field of column.fields) {
                if (!config.columns[field]) {
                    config.columns[field] = {};
                }
            }
        }

        /**
         * the aggregates (aggregates.ts): a group row with aggregates is its name's line and a line for
         * each function of the column that has the most; the totals row has those lines
         */
        const heights = aggregateRowHeights(config);
        config.__groupRowHeight = heights.group;
        config.__totalsRowHeight = heights.totals;
    }

    /**
     * @internal
     * @private
     */
    public __getGridConfig(): ParsedGridConfig {
        return this.gridConfig;
    }

    /**
     * @internal
     * the hooks as they are now, for the menus
     */
    public __getHooks(): GridHooks<T> {
        return this.hooks;
    }

    /**
     * @internal
     * the header filter of a column: what its cell shows, the operator picked in its menu, its "Match
     * case" and its filter as you type
     */
    public __getHeaderFilter(field: string): HeaderFilter | undefined {
        return this.headerFilters[field];
    }

    /**
     * @internal
     * sets what a column's header filter cell shows, keeps the operator picked and "Match case".
     * null/'' is empty
     */
    public __setHeaderFilterValue(field: string, value: unknown) {
        const headerFilter = this.headerFilters[field];
        this.storeHeaderFilter(
            field,
            value,
            headerFilter?.operator,
            headerFilter?.caseSensitive === true,
            headerFilter?.filterOnType
        );
    }

    /**
     * @internal
     * sets the operator picked in a column's header filter menu, keeps the value and "Match case"
     */
    public __setHeaderFilterOperator(field: string, operator: FilterOperator) {
        const headerFilter = this.headerFilters[field];
        this.storeHeaderFilter(
            field,
            headerFilter?.value,
            operator,
            headerFilter?.caseSensitive === true,
            headerFilter?.filterOnType
        );
    }

    /**
     * @internal
     * turns a column's "Match case" (its header filter menu) on or off, keeps the value and the operator
     */
    public __setHeaderFilterCaseSensitive(field: string, caseSensitive: boolean) {
        const headerFilter = this.headerFilters[field];
        this.storeHeaderFilter(field, headerFilter?.value, headerFilter?.operator, caseSensitive, headerFilter?.filterOnType);
    }

    /**
     * @internal
     * sets a column's filter as you type (filterOnType.ts), keeps the value, the operator and "Match
     * case". undefined: the column's default, left out of the state
     */
    public __setHeaderFilterOnType(field: string, filterOnType: boolean | undefined) {
        const headerFilter = this.headerFilters[field];
        this.storeHeaderFilter(
            field,
            headerFilter?.value,
            headerFilter?.operator,
            headerFilter?.caseSensitive === true,
            filterOnType
        );
    }

    /**
     * @internal
     * empties every header filter cell, for when the filter is replaced as a whole. The operators
     * picked are kept
     */
    public __clearHeaderFilterValues() {
        for (const field of Object.keys(this.headerFilters)) {
            this.__setHeaderFilterValue(field, null);
        }
    }

    /**
     * @internal
     * For the filter editor's Apply: empties the header filter cells whose column's conditions it
     * changed - the ones a header filter owns, its top level conditions (columnConditions). A cell whose
     * conditions are as they were keeps its text: the filter still has what it shows. The operators
     * picked are kept
     * @param before the filter before it was applied
     * @param after the filter it applied
     */
    public __clearChangedHeaderFilters(before: FilterExpression | null, after: FilterExpression | null) {
        for (const field of Object.keys(this.headerFilters)) {
            if (!sameConditions(columnConditions(before, field), columnConditions(after, field))) {
                this.__setHeaderFilterValue(field, null);
            }
        }
    }

    /**
     * stores a column's header filter, or removes it when it has no value, no operator, no "Match
     * case" and no filter as you type of the user's - so getState() lists only the header filters in
     * use. An empty value ('' or undefined) is stored as null, `operator`, `caseSensitive` and
     * `filterOnType` only when they are set
     */
    private storeHeaderFilter(
        field: string,
        value: unknown,
        operator: FilterOperator | undefined,
        caseSensitive: boolean,
        filterOnType?: boolean
    ) {
        const empty = value === null || value === undefined || value === '';
        if (empty && !operator && !caseSensitive && filterOnType === undefined) {
            delete this.headerFilters[field];
            return;
        }
        const headerFilter: HeaderFilter = { value: empty ? null : value };
        if (operator) {
            headerFilter.operator = operator;
        }
        if (caseSensitive) {
            headerFilter.caseSensitive = true;
        }
        if (filterOnType !== undefined) {
            headerFilter.filterOnType = filterOnType;
        }
        this.headerFilters[field] = headerFilter;
    }

    /**
     * @internal
     * @private
     */
    public __disconnectGrid() {
        this.unsubscribeFromDatasource();
        this.grid = null;
    }

    /**
     * @internal
     * @private
     */
    public __clickColumn(number: number, keys: { toggle: boolean; range: boolean }) {
        this.setColumnSelection(clickColumn(this.columnSelection, number, keys), true);
    }

    /**
     * @internal
     * @private
     * the column number a Shift+click selects from (the last one clicked without Shift), null before
     * any: the column menu's Select › Columns from N to here
     */
    public __getColumnAnchor(): number | null {
        return this.columnSelection.anchor;
    }

    /**
     * @internal
     * @private
     * true when the column with this number (1 based, as the header shows it) is selected
     */
    public __isColumnSelected(number: number) {
        return this.columnSelection.selected.includes(number);
    }

    /**
     * The column selection changes: the numbers on screen show it (`render`, not while the layout is
     * being rebuilt - the rebuild renders them), and `column-selection-change` is sent when the
     * selected columns changed
     */
    private setColumnSelection(selection: ColumnSelection, render: boolean) {
        const before = this.columnSelection.selected;
        this.columnSelection = selection;
        this.columnSelectionKey = layoutKey(this.gridConfig);
        if (render && this.grid) {
            renderColumnNumbers(this.grid);
        }
        const changed = before.length !== selection.selected.length || before.some((n, i) => n !== selection.selected[i]);
        if (changed) {
            this.__callSubscribers('column-selection-change', {
                columns: this.getSelectedColumns(),
                fields: getLayoutFields(this, { selectedOnly: true })
            });
        }
    }

    /**
     * @internal
     * @private
     */
    public __isConnected(): boolean {
        return !!this.grid;
    }

    /**
     * @internal
     * @private
     */
    public __dataSourceUpdated() {
        this.__parseConfig();
        // the layout changed since the ranges of cells were made - a column moved, pinned, hidden: the
        // fields between their ends are others now. Every change of the layout comes here (a rebuild,
        // or applyState() without a grid)
        if (this.rangeState && this.rangeState.key !== layoutKey(this.gridConfig)) {
            this.clearRanges();
        }
        // the selected columns too: their numbers are other columns now. The rebuild renders the numbers
        const columns = this.columnSelection;
        if ((columns.selected.length || columns.anchor !== null) && this.columnSelectionKey !== layoutKey(this.gridConfig)) {
            this.setColumnSelection(NO_COLUMNS, false);
        }
        this.scrollTops = [];
        this.scrollHeights = [];
        this.scrollHeight = 0;

        // lets make a index if datasource is > 1000k, and store top for each k

        const groupRow = this.gridConfig.__groupRowHeight;
        const row = this.gridConfig.__rowHeight;
        // the rows made taller by fitRows(): their lines, a row is at least as high as the layout makes it.
        // A line more than the layout's is a line of text, multilineLineHeight px (rowHeightOf)
        const rowLines = this.rowLines;
        const cells = this.gridConfig.__columnCells;
        let count = 0;

        this.dataSource.getRows().forEach((ent) => {
            let height = row;
            if (isGroupRow(ent)) {
                height = groupRow;
            } else if (rowLines.size) {
                const lines = rowLines.get(String(ent.__KEY));
                if (lines !== undefined && lines > cells) {
                    height = rowHeightOf(this.gridConfig, lines);
                }
            }
            this.scrollTops.push(count);
            this.scrollHeights.push(height);
            count = count + height;
        });

        this.scrollHeight = count;
        if (this.grid?.getElement()) {
            updateVerticalScrollHeight(this.grid, this.scrollHeight);
        }
    }

    /**
     * scroll state have all row height and top values
     * this is used during a scroll event to move rows into right height
     * @internal
     * @private
     */
    public __getScrollState() {
        return {
            scrollHeight: this.scrollHeight,
            scrollHeights: this.scrollHeights,
            scrollTops: this.scrollTops
        };
    }

    /**
     * @internal
     * Is the cell readonly: on a row the edit permissions (`GridConfig.edit`) do not let the user change,
     * every cell is - whatever the hook says. Else the `isReadonly` hook decides, and when it gives no
     * answer (anything but `true` / `false`) the column's `readonly` option. The grid's own `readonly`
     * is not part of it, the callers check that first
     * @param row a row of the datasource, so one of its `EntityUnion<T>` rows
     */
    public __isCellReadonly(row: Entity, field: string): boolean {
        if (!mayChangeRow(this.gridConfig.edit, row)) {
            return true;
        }
        // the user's (format.readonly) over the column's
        const readonlyByConfig = readonlyOf(this.gridConfig.columns[field]);
        const readonly = this.hooks.isReadonly?.(row as EntityUnion<T>, field, readonlyByConfig);
        return typeof readonly === 'boolean' ? readonly : readonlyByConfig;
    }

    /**
     * @internal
     * Can the user change the values of the row: the grid is editable (`readonly: false`) and the edit
     * permissions allow it - `change`, or `add` for a new row (editPermissions.ts). The grid's `readonly`
     * for one row: what the cells of a row the user may not change look like. A cell can still be
     * readonly on its own, see __isCellReadonly
     * @param row a data row of the datasource
     */
    public __canChangeRow(row: Entity): boolean {
        return !this.gridConfig.readonly && mayChangeRow(this.gridConfig.edit, row);
    }

    /**
     * @internal
     * Can the user change some values: the grid is editable and `change` or `add` is allowed. The paste,
     * clear and fill of the grid start with it - nothing to do when no row can be changed, the keys are
     * the browser's as in a readonly grid - and check each cell after (__isCellReadonly)
     */
    public __canChangeValues(): boolean {
        return !this.gridConfig.readonly && mayChangeValues(this.gridConfig.edit);
    }

    /**
     * @internal
     * Can the user mark the row for deletion: the grid is editable and `delete` is allowed, or the row is
     * new - taking out a row that is not saved deletes nothing (editPermissions.ts). The isReadonly hook
     * can lock it too, see isLockedByHook in deleteRows.ts
     * @param row a data row of the datasource
     */
    public __canDeleteRow(row: Entity): boolean {
        return !this.gridConfig.readonly && mayDeleteRow(this.gridConfig.edit, row);
    }

    /**
     * @internal
     * The column's editor and lookup when it has an `editor` (ColumnConfig.editor), see lookupColumn.ts
     */
    public __getLookupColumn(field: string): LookupColumn | undefined {
        return this.lookupColumns.get(field);
    }

    /**
     * @internal
     * The formatter the grid shows a value of a field with - the one place the grid turns a value into
     * the text of a cell (renderRowCell, cellTextOf, the aggregates, the footer's summary): the field's
     * formatter (`datasource.getFormatter(field, type)`), with the column's display format when it has
     * one (`ColumnConfig.format`, `GridState.formats`, see columnFormat.ts) - its `format` is the display
     * format's text, `formatForEdit` and `parse` stay the field's. The names of a date format are in
     * the language of the text `format.locale`, a week and a quarter written as `format.weekIso`,
     * `format.weekUs` and `format.quarter` say.
     *
     * The template of a text column (`ColumnFormat.text`) needs the row - its placeholders are fields of
     * the row - so it is only there with `row` (the cells, cellTextOf): `format(value)` is the template
     * filled in, `{value}` the value it is given (templateFormatter, cellTemplate.ts).
     *
     * Not for a lookup column (its lookup's formatter shows a label), nor for a cell whose type is not
     * the field's (`dynamicCellTypeColumn` on a text field: its other types have no format)
     * @param type the cell's type, see getCellType. Left out, the field's
     * @param row the cell's row: for the template of a text column. Left out, the template is not used
     * @param format the format to show it with: the column's when left out. The grid config dialog
     * gives the one it edits, for its preview
     */
    public __getCellFormatter(
        field: string,
        type?: FieldType,
        row?: Entity,
        format: ColumnFormat | undefined = this.gridConfig.columns[field]?.format
    ): Formatter {
        const formatter = this.dataSource.getFormatter(field, type);
        if (type !== undefined && type !== this.dataSource.getField(field).type) {
            return formatter;
        }
        if (format && hasValueFormat(format)) {
            return displayFormatter(formatter, format, formatTexts(this.gridConfig.texts));
        }
        if (format?.text !== undefined && row) {
            return templateFormatter(formatter, field, format.text, this.__fieldTextOf(row));
        }
        return formatter;
    }

    /**
     * @internal
     * The link of a cell: its address and whether it opens in a new tab - for a column with a link
     * (`ColumnFormat.link`), when the row's address is one the grid links to (linkOf, cellTemplate.ts).
     * null for a column without a link, a group row, and a row whose address is empty or not allowed: the
     * cell shows its text then
     */
    public __getCellLink(field: string, row: Entity): { href: string; newTab: boolean } | null {
        const link = this.gridConfig.columns[field]?.format?.link;
        const result = this.__getLinkResult(field, row);
        return link && result && 'href' in result ? { href: result.href, newTab: link.newTab === true } : null;
    }

    /**
     * @internal
     * The address of a cell's link, or why the row has none (linkOf, cellTemplate.ts): `{value}` is the
     * cell's value, the other placeholders the row's fields. null for a format without a link and a group
     * row
     * @param format the format: the column's when left out. The grid config dialog gives the one it
     * edits, for its preview
     */
    public __getLinkResult(
        field: string,
        row: Entity,
        format: ColumnFormat | undefined = this.gridConfig.columns[field]?.format
    ): LinkResult | null {
        if (!format?.link || isGroupRow(row)) {
            return null;
        }
        const formatter = this.dataSource.getFormatter(field);
        return linkOf(format.link.url, cellFieldText(field, row[field], formatter, this.__fieldTextOf(row)));
    }

    /**
     * @internal
     * The text of the fields of a row for a template's placeholders: each through its field's formatter,
     * see fieldTextOf (cellTemplate.ts)
     */
    public __fieldTextOf(row: Entity): FieldText {
        return fieldTextOf(row, (name) => this.dataSource.getFormatter(name));
    }

    /**
     * @internal
     * The display formats the grid starts with, by field - the config's columns, or `initialState.formats`:
     * what resetState() goes back to, and the grid config dialog's "Reset". A copy
     */
    public __getStartFormats(): Record<string, ColumnFormat> {
        return structuredClone(this.initialState.formats ?? this.configFormats);
    }

    /**
     * @internal
     * The detail form the grid starts with - `initialState.detailForm`, else the config's `detailForm`:
     * what resetState() goes back to, and the grid config dialog's "Reset form". A copy
     */
    public __getStartDetailForm(): DetailForm {
        return copyDetailForm(this.initialState.detailForm ?? this.options.detailForm ?? noDetailForm());
    }

    /**
     * The display formats of a state given to setState() fit their fields, see assertColumnFormat
     * @throws a `TypeError` naming the field, before anything changes
     */
    private assertStateFormats(formats: unknown) {
        if (typeof formats !== 'object' || formats === null || Array.isArray(formats)) {
            throw new TypeError(`setState: formats is an object of formats by field, got ${JSON.stringify(formats)}`);
        }
        for (const [field, format] of Object.entries(formats)) {
            const lookup = this.gridConfig.columns[field]?.editor !== undefined;
            assertColumnFormat(format, field, this.dataSource.getField(field).type, lookup, `setState: formats.${field}`);
        }
    }

    /**
     * The datasource sorts the lookup columns on the label their cells show, see Datasource.__setSortValue
     */
    private setSortValues() {
        for (const [field, column] of this.lookupColumns) {
            const sortValue = (value: unknown) => column.formatter.format(value);
            this.sortValues.set(field, sortValue);
            this.dataSource.__setSortValue(field, sortValue);
        }
    }

    /**
     * Takes back what setSortValues() gave the datasource - not what another grid on the same
     * datasource gave it since
     */
    private clearSortValues() {
        for (const [field, sortValue] of this.sortValues) {
            if (this.dataSource.__getSortValue(field) === sortValue) {
                this.dataSource.__setSortValue(field, null);
            }
        }
        this.sortValues.clear();
    }

    /**
     * @internal
     * The css classes the `cellClass` hook gives the cell, '' for the ones it leaves out
     * @param row a row of the datasource, so one of its `EntityUnion<T>` rows
     */
    public __getCellClass(row: Entity, field: string): Required<CellClass> {
        const classes = this.hooks.cellClass?.(row as EntityUnion<T>, field);
        return { input: classes?.input ?? '', background: classes?.background ?? '' };
    }

    /**
     * @internal
     * The css classes the `rowClass` hook gives a data row, one name each: [] without the hook or when
     * it gives none
     * @param row a data row of the datasource
     * @param rowIndex its index in the displayed rows
     */
    public __getRowClass(row: Entity, rowIndex: number): string[] {
        const classes = this.hooks.rowClass?.(row as EntityUnion<T>, rowIndex);
        return classes ? classes.split(/\s+/).filter((name) => name !== '') : [];
    }

    /**
     * Subscribes the connected grid to the datasource events it has to follow.
     * Unsubscribes first, so a second connectGrid does not subscribe twice.
     */
    private subscribeToDatasource() {
        this.unsubscribeFromDatasource();

        // the handlers do nothing while applyState runs (suppressEvents), it rebuilds once when
        // done, or when no grid is connected
        const follow = <Type extends keyof DatasourceEvents>(
            type: Type,
            handler: (data: DatasourceEvents[Type], grid: Grid) => void
        ) =>
            this.dataSource.on(type, (data) => {
                if (!this.suppressEvents && this.grid) {
                    handler(data, this.grid);
                }
            });

        // the displayed rows are others after these: the ranges of cells were made for the rows as they
        // were, they are cleared first
        this.datasourceSubscriptions = [
            follow('collection-filtered', (data, grid) => {
                this.clearRanges();
                // '__internalUpdate, forced' comes before a collection-changed, that one rebuilds
                if (data.info !== '__internalUpdate, forced') {
                    grid.rebuild(false);
                }
            }),
            follow('collection-sorted', (_data, grid) => {
                this.clearRanges();
                grid.rebuild();
            }),
            follow('collection-grouped', (_data, grid) => {
                this.clearRanges();
                grid.rebuild();
            }),
            follow('collection-expand', (_data, grid) => {
                this.clearRanges();
                grid.rebuild();
            }),
            follow('collection-collapse', (_data, grid) => {
                this.clearRanges();
                grid.rebuild();
            }),
            // an upsert keeps the row elements: the input the user types in stays, with its focus. One
            // that only changed values sends rows-changed, not this: the ranges stay
            follow('collection-changed', (data, grid) => {
                this.clearRanges();
                if (data.info === 'upsert') {
                    this.updateAfterMerge(grid);
                } else {
                    grid.rebuild();
                }
            }),
            follow('current-entity', (_data, grid) => this.updateRows(grid)),
            follow('selection-change', (_data, grid) => this.updateRows(grid)),
            follow('select', (data, grid) => this.scrollToRow(grid, data.row)),
            // the errors are shown on the cells and the row selectors
            follow('validate', (_data, grid) => this.updateRows(grid)),
            // undo and redo changed values the cells show, the displayed rows stay as they are. Not
            // on 'edit': the cells show the edit the user made, and rendering the cell being typed in
            // would put the formatted value into its input
            follow('history-changed', (data, grid) => {
                if (data.info === 'undo' || data.info === 'redo') {
                    this.updateRows(grid);
                }
            }),
            // values set from code, by undo, by an upsert ...: the rows on screen, in the next frame. An
            // open find bar finds its text again
            follow('rows-changed', (data, grid) => {
                requestRowsRender(grid, data.rows);
                findDataChanged(grid);
            })
        ];

        // the rows of a lookup came, went or changed: a cell of any row can show another label now
        const lookupDatasources = new Set(Array.from(this.lookupColumns.values(), (column) => column.lookup.datasource));
        for (const lookupDatasource of lookupDatasources) {
            // once per run of code: rows-changed comes in a microtask. As refresh(), every row on screen
            const refresh = () => {
                if (this.grid) {
                    triggerScrollEvent(this.grid);
                }
            };
            this.datasourceSubscriptions.push(
                lookupDatasource.on('collection-changed', refresh),
                lookupDatasource.on('rows-changed', refresh)
            );
        }
    }

    /**
     * Unsubscribes the grid from the datasource events, see subscribeToDatasource
     */
    private unsubscribeFromDatasource() {
        for (const unsubscribe of this.datasourceSubscriptions) {
            unsubscribe();
        }
        this.datasourceSubscriptions = [];
    }

    /**
     * renders the rows again, for a new current entity or selection
     */
    private updateRows(grid: Grid) {
        this.__dataSourceUpdated();
        triggerScrollEvent(grid);
    }

    /**
     * after an upsert added or removed rows, or moved them: the sizes, the footer's counts and every
     * row on screen - not a rebuild, the row and column elements stay. They do not depend on the rows,
     * and rebuilding them would take the input the user types in away, with its focus
     */
    private updateAfterMerge(grid: Grid) {
        // connected with connectInterface, but not put in the dom yet: it is built when it is
        if (!grid.domCreated) {
            return;
        }
        this.__dataSourceUpdated();
        updateMainElementSizes(grid);
        rebuildFooter(grid);
        triggerScrollEvent(grid);
        // rows added, removed or moved: an open find bar finds its text again
        findDataChanged(grid);
    }

    /**
     * scrolls the row into view when it is outside of it, for the datasource select event
     * @param row index in the displayed rows
     */
    private scrollToRow(grid: Grid, row: number) {
        this.__dataSourceUpdated();

        // connected with connectInterface, but not put in the dom yet - nothing to scroll
        if (!grid.domCreated) {
            return;
        }

        const scrollEl = getElementByClassName(grid.getElement(), 'simple-html-grid-body-scroller');
        const scrollElHeight = scrollEl?.clientHeight;
        const scrollElScrollTop = scrollEl?.scrollTop;

        const newTop = this.__getScrollState().scrollTops[row];
        // the row's own height: a row can be taller than the layout makes a row (fitRows)
        const rowHeight = this.__getScrollState().scrollHeights[row] ?? this.__getGridConfig().__rowHeight;

        if (newTop - rowHeight < scrollElScrollTop) {
            scrollEl.scrollTop = Math.floor(newTop - scrollElHeight / 2);
        }

        if (newTop + rowHeight > scrollElHeight + scrollElScrollTop) {
            scrollEl.scrollTop = Math.floor(newTop - scrollElHeight / 2);
        }
    }

    /**
     * @internal
     * sends an event to the handlers subscribed with on(), used by the grid's cells and menus
     */
    public __callSubscribers<Type extends keyof GridEvents>(type: Type, data: GridEvents[Type]): void {
        this.events.emit(type, data);
    }
}

/**
 * The options with every default filled in, for the grid to work with. A shallow copy: the options are
 * only read. `columns` and `layout` are copied deep by the interface itself, the grid changes them
 * (the user moves columns around, a `filter-operator-change` handler can change a column).
 */
function withDefaults(options: GridOptions): ParsedGridOptions {
    const cellHeight = options.cellHeight ?? 22;
    return {
        ...options,
        cellHeight,
        multilineLineHeight: options.multilineLineHeight ?? MULTILINE_LINE_HEIGHT,
        cellHeaderLabelHeight: options.cellHeaderLabelHeight ?? cellHeight,
        panelHeight: options.panelHeight ?? 25,
        footerHeight: options.footerHeight ?? 45,
        selectSizeHeight: options.selectSizeHeight ?? 18,
        readonly: options.readonly ?? true,
        tooltips: options.tooltips ?? true,
        multilineTooltipLines: options.multilineTooltipLines ?? TOOLTIP_LINES,
        rowStatus: options.rowStatus ?? true,
        editedMarker: options.editedMarker ?? true,
        mergeHighlight: options.mergeHighlight ?? true,
        copyHeaders: options.copyHeaders ?? true,
        filterOperatorIndicator: options.filterOperatorIndicator ?? true,
        settingsButton: options.settingsButton ?? true,
        shortcutHelp: options.shortcutHelp ?? true,
        placeholderRowCurrentEntityOnly: options.placeholderRowCurrentEntityOnly ?? true,
        groupAggregates: options.groupAggregates ?? true,
        totalsRow: options.totalsRow ?? false,
        detailForm: options.detailForm ? copyDetailForm(options.detailForm) : noDetailForm(),
        edit: editPermissionsOf(options.edit)
    };
}

/**
 * The keys of the hooks, which a config must not have
 */
const HOOK_KEYS = ['isReadonly', 'cellClass', 'rowClass', 'menus'] as const satisfies readonly (keyof GridHooks)[];

/**
 * The functions of a grid are hooks, given next to the config. TypeScript catches one in the config,
 * plain JavaScript does not - the grid would ignore it without a word.
 * @throws a `TypeError` naming the hook and where it goes
 */
function assertNoHooks(config: Partial<GridConfig>) {
    for (const key of HOOK_KEYS) {
        if (key in config) {
            throw new TypeError(
                `GridConfig: '${key}' is a hook, not part of the config: createGrid(host, { config, datasource, hooks: { ${key} } }), or gridInterface.updateHooks({ ${key} })`
            );
        }
    }
}

/**
 * v5 options that are gone or moved in v6, with where they went. TypeScript catches them, a config
 * from plain JavaScript or one stored in a backend does not - the grid would drop the option without
 * a word, and e.g. a column would silently stop being checked or translated.
 */
const V5_CONFIG_OPTIONS: Record<string, string> = {
    attributes: "'columns', keyed by field",
    columnsPinnedLeft: "'layout.left'",
    columnsCenter: "'layout.center'",
    columnsPinnedRight: "'layout.right'",
    sorting: "'initialState.sorting'",
    grouping: "'initialState.grouping'",
    expandedGroups: "'initialState.expandedGroups'",
    filter: "'initialState.filter'",
    tooltipText: "'texts' (a tooltip id ends in '.tooltip')",
    selectionMode: 'the datasource: new Datasource({ selectionMode })',
    placeHolderRowCurrentEnityOnly: "'placeholderRowCurrentEntityOnly'",
    placeHolderRowCurrentEntityOnly: "'placeholderRowCurrentEntityOnly'"
};

/**
 * the same for the options of a column, `{field}` is filled in
 */
const V5_COLUMN_OPTIONS: Record<string, string> = {
    mandatory: "the required rule of the datasource field: new Datasource({ fields: { {field}: { validate: ['required'] } } })",
    type: "the datasource field: new Datasource({ fields: { {field}: 'date' } })",
    attribute: "the key of 'columns'",
    currentFilterValue: 'the state: setState({ headerFilters: { {field}: { value } } })',
    placeHolderRow: "'placeholderRow'",
    placeHolderFilter: "'placeholderFilter'"
};

/**
 * @throws a `TypeError` naming the v5 option and where it went in v6
 */
function assertNoV5Options(config: Partial<GridConfig>) {
    for (const [key, where] of Object.entries(V5_CONFIG_OPTIONS)) {
        if (key in config) {
            throw new TypeError(`GridConfig: '${key}' is gone in v6, it is ${where}`);
        }
    }
    for (const [field, column] of Object.entries(config.columns ?? {})) {
        if (!column || typeof column !== 'object') {
            continue;
        }
        for (const [key, where] of Object.entries(V5_COLUMN_OPTIONS)) {
            if (key in column) {
                throw new TypeError(
                    `GridConfig: columns.${field}.${key} is gone in v6, it is ${where.replaceAll('{field}', field)}`
                );
            }
        }
    }
}

/**
 * `texts` is an object of strings, see assertTexts. Left out or undefined is no texts of its own
 * @throws a `TypeError` naming the id whose text is not a string
 */
function assertConfigTexts(config: Partial<GridConfig>) {
    if (config.texts !== undefined) {
        assertTexts(config.texts, 'GridConfig.texts');
    }
}

/**
 * `multilineTooltipLines` is a whole number of 1 or more: TypeScript does not catch `0`, `-1` or `2.5`,
 * nor a text from plain JavaScript or JSON - the tooltip would show no line, or all of them. Left out or
 * undefined is the default
 * @throws a `TypeError` naming the option and what it takes
 */
function assertTooltipLines(config: Partial<GridConfig>) {
    const lines: unknown = config.multilineTooltipLines;
    if (lines !== undefined && !(Number.isInteger(lines) && (lines as number) >= 1)) {
        throw new TypeError(`GridConfig: multilineTooltipLines is ${JSON.stringify(lines)}, it is a whole number of 1 or more`);
    }
}

/**
 * `multilineLineHeight` is a whole number of px, 1 or more: TypeScript does not catch `0`, `-1` or
 * `15.5`, nor a text from plain JavaScript or JSON - a row would be no taller than its first line, the
 * lines of a cell on top of each other, or the rows at half px (blurred lines between them). Left out or
 * undefined is the default
 * @throws a `TypeError` naming the option and what it takes
 */
function assertLineHeight(config: Partial<GridConfig>) {
    const height: unknown = config.multilineLineHeight;
    if (height !== undefined && !(Number.isInteger(height) && (height as number) >= 1)) {
        throw new TypeError(
            `GridConfig: multilineLineHeight is ${JSON.stringify(height)}, it is a whole number of px, 1 or more`
        );
    }
}

/**
 * `detailForm` is a {@link DetailForm}: TypeScript does not catch a config from plain JavaScript or
 * JSON - `fields` that is no list would break the form. Left out or undefined is none
 * @throws a `TypeError` that says what is wrong, see assertDetailForm
 */
function assertConfigDetailForm(config: Partial<GridConfig>) {
    if (config.detailForm !== undefined) {
        assertDetailForm(config.detailForm, 'GridConfig: detailForm');
    }
}

/**
 * A column's `aggregate` is one of the functions or a list of them, and `sum`, `avg`, `min` and `max`
 * are for a number field: TypeScript catches neither in a config from plain JavaScript or JSON, and the
 * grid would show nothing (a text field has no numbers to sum) without a word
 * @param where how the message names it: the config's columns, or the state given to setState()
 * @throws a `TypeError` naming the column and what it takes
 */
function assertAggregates(config: Partial<GridConfig>, datasource: Datasource<any>, where = 'GridConfig: columns') {
    for (const [field, column] of Object.entries(config.columns ?? {})) {
        const value: unknown = column?.aggregate;
        if (value === undefined) {
            continue;
        }
        const name = where.endsWith('columns') ? `${where}.${field}.aggregate` : `${where}.${field}`;
        const list: unknown[] = Array.isArray(value) ? value : [value];
        for (const fn of list) {
            if (!isAggregateFunction(fn)) {
                throw new TypeError(
                    `${name} is ${JSON.stringify(value)}, it is one of ${AGGREGATE_FUNCTIONS.map((fnName) => `'${fnName}'`).join(', ')} or a list of them`
                );
            }
            const type = datasource.getField(field).type;
            if (fn !== 'count' && type !== 'number') {
                throw new TypeError(
                    `${name} '${fn}' is for a number field, '${field}' is ${type}: new Datasource({ fields: { ${field}: 'number' } }), or 'count'`
                );
            }
        }
    }
}

/**
 * A column's `format` fits its field, see assertColumnFormat: a date part for a date or datetime field,
 * a number part for a number field, of the values they take, and none on a lookup column
 * @throws a `TypeError` naming the column and what it takes
 */
function assertFormats(config: Partial<GridConfig>, datasource: Datasource<any>) {
    for (const [field, column] of Object.entries(config.columns ?? {})) {
        if (!column || typeof column !== 'object') {
            continue;
        }
        const type = datasource.getField(field).type;
        assertColumnFormat(column.format, field, type, column.editor !== undefined, `GridConfig: columns.${field}.format`);
    }
}

/**
 * A column's `renderer` is the id of a registered cell renderer: a typo, or a renderer registered after
 * the grid is made, would else show the default cell without a word. And not next to an `editor`: a
 * lookup column draws its cell itself, its label and its button
 * @throws a `TypeError` naming the column, see getCellRenderer
 */
function assertRenderers(config: Partial<GridConfig>) {
    for (const [field, column] of Object.entries(config.columns ?? {})) {
        if (column?.renderer === undefined) {
            continue;
        }
        getCellRenderer(column.renderer, `GridConfig: columns.${field}.renderer`);
        if (column.editor !== undefined) {
            throw new TypeError(
                `GridConfig: columns.${field} has a renderer and an editor: a lookup column draws its own cell (the label and its button), leave one of them out`
            );
        }
    }
}

/**
 * A column's `filterOperators`, `operator` and `filterCaseSensitive` fit its type (a lookup column's is
 * text, it filters on its labels): TypeScript catches neither an operator of another type nor a text
 * option on a number, and a config from plain JavaScript or JSON can have anything - the menus would
 * offer what the column can not filter on, or nothing
 * - `filterOperators`: a list of the type's operators (operatorsFor), with one the header filter's
 *   input takes (isHeaderOperator)
 * - `operator`: one of those the header filter takes, of `filterOperators` when it is given
 * - `filterCaseSensitive`: a boolean, `true` for a text column only
 * - `filterOnType`: a boolean
 * @throws a `TypeError` naming the column, what it has and what it takes
 */
function assertFilterOptions(config: Partial<GridConfig>, datasource: Datasource<any>) {
    for (const [field, column] of Object.entries(config.columns ?? {})) {
        if (!column || typeof column !== 'object') {
            continue;
        }
        const { operator, filterOperators, filterCaseSensitive } = column as Record<string, unknown>;
        // a lookup column filters on its labels, as text (headerFilterType)
        const type = column.editor !== undefined ? 'text' : datasource.getField(field).type;
        const name = `GridConfig: columns.${field}`;
        const list = (operators: string[]) => operators.map((op) => `'${op}'`).join(', ');
        if (filterOperators !== undefined) {
            const ofType = operatorsFor(type);
            if (!Array.isArray(filterOperators) || filterOperators.length === 0) {
                throw new TypeError(
                    `${name}.filterOperators is a list of operators of a ${type} column (${list(ofType)}), got ${JSON.stringify(filterOperators)}`
                );
            }
            for (const op of filterOperators) {
                if (!ofType.some((ofTypeOp) => ofTypeOp === op)) {
                    throw new TypeError(
                        `${name}.filterOperators has ${JSON.stringify(op)}, not an operator of a ${type} column: ${list(ofType)}`
                    );
                }
            }
            // each of them is an operator now
            if (!(filterOperators as FilterOperator[]).some(isHeaderOperator)) {
                throw new TypeError(
                    `${name}.filterOperators needs an operator for the header filter's input: one of ${list(ofType.filter(isHeaderOperator))}`
                );
            }
        }
        if (operator !== undefined) {
            const offered = headerOperators(column, type);
            if (!offered.some((op) => op === operator)) {
                throw new TypeError(
                    `${name}.operator is ${JSON.stringify(operator)}, the header filter of this ${type} column takes ${list(offered)}`
                );
            }
        }
        if (filterCaseSensitive !== undefined && typeof filterCaseSensitive !== 'boolean') {
            throw new TypeError(`${name}.filterCaseSensitive is true or false, got ${JSON.stringify(filterCaseSensitive)}`);
        }
        const { filterOnType } = column as Record<string, unknown>;
        if (filterOnType !== undefined && typeof filterOnType !== 'boolean') {
            throw new TypeError(`${name}.filterOnType is true or false, got ${JSON.stringify(filterOnType)}`);
        }
        if (filterCaseSensitive === true && type !== 'text') {
            throw new TypeError(
                `${name}.filterCaseSensitive is for a text column, '${field}' is ${type}: its filters have no case`
            );
        }
    }
}

/**
 * The aggregates of the columns, for the state: the fields that have some, a list each
 */
function aggregatesOfColumns(columns: Record<string, ColumnConfig>): Record<string, AggregateFunction[]> {
    const aggregates: Record<string, AggregateFunction[]> = {};
    for (const [field, column] of Object.entries(columns)) {
        const list = normalizeAggregates(column?.aggregate);
        if (list.length) {
            aggregates[field] = list;
        }
    }
    return aggregates;
}

/**
 * The display formats of the columns, for the state: the fields whose format shows something, a copy
 * each
 */
function formatsOfColumns(columns: Record<string, ColumnConfig>): Record<string, ColumnFormat> {
    const formats: Record<string, ColumnFormat> = {};
    for (const [field, column] of Object.entries(columns)) {
        if (hasDisplayFormat(column?.format)) {
            formats[field] = structuredClone(column.format);
        }
    }
    return formats;
}

/**
 * The state's aggregates as columns, to check them as a config's
 */
function columnsWithAggregates(aggregates: Record<string, unknown>): Record<string, ColumnConfig> {
    return Object.fromEntries(
        Object.entries(aggregates).map(([field, fns]) => [field, { aggregate: fns as AggregateFunction[] }])
    );
}

/**
 * The fields of fitColumns() / resetColumnWidths(): left out, or an array of field names. A field
 * name on its own, from plain JavaScript, would be read as a list of its letters
 * @throws a `TypeError` naming the method
 */
function assertFields(method: string, fields: unknown) {
    if (fields !== undefined && !(Array.isArray(fields) && fields.every((field) => typeof field === 'string'))) {
        throw new TypeError(`${method}(): fields is an array of field names, not ${JSON.stringify(fields)}: ${method}(['name'])`);
    }
}

/**
 * The key fitRows() keeps a row's height by, as text: `7` and `'7'` are the same key, as the datasource
 * compares them. undefined for what is no data row of a datasource: a group row, an object of your own
 */
function rowKey(row: Entity | null | undefined): string | undefined {
    if (!row || typeof row !== 'object' || isGroupRow(row) || !row.__controller) {
        return undefined;
    }
    return String(row.__KEY);
}

/**
 * The internal sizes before `__parseConfig()` computes them
 */
const NO_SIZES = {
    __rowHeight: 0,
    __rowHeaderHeight: 0,
    __columnCells: 0,
    __leftWidth: 0,
    __rightWidth: 0,
    __scrollbarSize: 0,
    __selectSizeWidth: 0,
    __groupRowHeight: 0,
    __totalsRowHeight: 0
};

/**
 * A copy of a layout, with `left` and `right` always there. A list that is missing (plain js) is
 * empty, and so is a column's `fields`.
 */
function copyLayout(layout: GridLayout | undefined): Required<GridLayout> {
    const copyColumns = (columns: LayoutColumn[] | undefined): LayoutColumn[] =>
        Array.isArray(columns) ? columns.map((column) => ({ fields: [...(column.fields ?? [])], width: column.width })) : [];
    return {
        left: copyColumns(layout?.left),
        center: copyColumns(layout?.center),
        right: copyColumns(layout?.right)
    };
}
