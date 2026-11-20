import type { Datasource } from '../datasource/dataSource';
import type { DatasourceEvents } from '../datasource/datasourceEvents';
import { type Entity, isGroupRow } from '../datasource/entity';
import type { FilterOperator } from '../datasource/filterExpression';
import { Emitter, type EventHandler } from '../emitter';
import type { Grid } from './grid';
import type { GridConfig, GridLayout, GridState, HeaderFilter, LayoutColumn, ParsedGridConfig } from './gridConfig';
import type { GridEvents } from './gridEvents';
import { autoResizeColumns } from './gridFunctions/autoResizeColumns';
import { contextMenuCustom } from './gridFunctions/contextMenuCustom';
import { getAttributeColumns } from './gridFunctions/getAttributeColumns';
import { getCellHeight } from './gridFunctions/getCellHeight';
import { getElementByClassName } from './gridFunctions/getElementByClassName';
import { getTextWidth } from './gridFunctions/getTextWidth';
import { openFilterEditor } from './gridFunctions/openFilterEditor';
import { rebuildHeaderColumns } from './gridFunctions/rebuildHeaderColumns';
import { removeContextMenu } from './gridFunctions/removeContextMenu';
import { triggerScrollEvent } from './gridFunctions/triggerScrollEvent';
import { updateVerticalScrollHeight } from './gridFunctions/updateVerticalScrollHeight';

/* declare const DEVELOPMENT: boolean; */

/**
 * grid interface is what user have access to controll grid behavior
 */
export class GridInterface<T> {
    // not there until connectGrid, null after __disconnectGrid
    private grid?: Grid | null;
    // a copy of the config with every default filled in, __parseConfig() computes the sizes.
    // Its layout is the state's: the user changes it
    private gridConfig: ParsedGridConfig;
    private dataSource: Datasource<T>;
    private columnsSelected: Set<number>;

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
     * for setting readonly based on row values
     */
    private readonlySetterFn?: ((attribute: string, rowData: Entity, cellReadOnlyConfig: boolean) => boolean | null) | null;

    /**
     * for adding classes on row lvl
     */
    private cellAppendClassSetterFn?:
        | ((attribute: string, rowData: Entity, cellReadOnlyConfig: boolean) => { inputClass: string; dimmedClass: string })
        | null;

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
     * the state the grid starts in and resetState() goes back to: the config's initialState, with
     * the config's layout and empty values for what it leaves out. A copy, applyState() copies it again
     */
    private startState: GridState;

    /**
     * @param gridConfig the columns, the layout and the options, see {@link GridConfig}. The object is
     * not changed, the grid copies the parts it changes
     * @param datasource the rows. The grid applies `gridConfig.initialState` to it: its sorting,
     * grouping and filter are replaced (left out, they are cleared)
     */
    constructor(gridConfig: GridConfig, datasource: Datasource) {
        this.columnsSelected = new Set();
        this.dataSource = datasource;
        this.gridConfig = withDefaults(gridConfig);

        // structuredClone, not JSON: it keeps the Dates of a filter
        const initialState = structuredClone(gridConfig.initialState ?? {});
        this.startState = {
            layout: initialState.layout ?? copyLayout(gridConfig.layout),
            sorting: initialState.sorting ?? [],
            grouping: initialState.grouping ?? [],
            expandedGroups: initialState.expandedGroups ?? [],
            filter: initialState.filter ?? null,
            headerFilters: initialState.headerFilters ?? {}
        };
        this.applyState(structuredClone(this.startState));
    }

    /**
     * The state of the grid now: what the user changed - column order, pinning and widths, sorting,
     * grouping, expanded groups, the filter and what the header filters show. See {@link GridState}.
     *
     * It is a copy: changing it changes nothing in the grid, and what the user does later does not
     * change it. Give it to {@link setState} to go back to it.
     *
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
            headerFilters: structuredClone(this.headerFilters)
        };
    }

    /**
     * Sets the state: column order, pinning and widths, sorting, grouping, expanded groups, the filter
     * and what the header filters show. See {@link GridState}.
     *
     * **Applies what is given and keeps the rest**: `setState({ sorting })` changes the sort and
     * nothing else. To set everything, pass a whole state, e.g. one from {@link getState}. Within a
     * part nothing is merged: `layout` replaces the whole layout, `headerFilters` every header filter.
     *
     * The grid keeps a copy, the object passed in is not changed later. It must be plain data (no
     * functions, no rows from the datasource): it is copied with `structuredClone`.
     *
     * `filter` is what the rows are filtered by, `headerFilters` only what the header filter cells show.
     * Set both to have a header filter's condition and its cell agree, as `getState()` gives them.
     *
     * @param state the parts to set
     *
     * @example
     * ```ts
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
     * no grouping, no filter, no header filters.
     *
     * @example
     * ```ts
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
        this.applyState(structuredClone(this.startState));
    }

    /**
     * Applies the parts of the state that are given and rebuilds the grid once. The datasource parts
     * (filter, sorting, grouping, expanded groups) are applied together: what is not given is applied
     * again as it is now, the datasource needs them in this order.
     * @param state a copy, the datasource and the grid keep what they are given and change it in place
     * (shift+click sort, drag/drop, resizing)
     */
    private applyState(state: Partial<GridState>) {
        this.suppressEvents = true;

        if (state.layout) {
            this.gridConfig.layout = copyLayout(state.layout);
        }

        if (state.headerFilters) {
            this.headerFilters = {};
            for (const [field, headerFilter] of Object.entries(state.headerFilters)) {
                this.storeHeaderFilter(field, headerFilter.value, headerFilter.operator);
            }
        }

        if (state.filter !== undefined || state.sorting || state.grouping || state.expandedGroups) {
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
        this.subscribeToDatasource();
        this.__callSubscribers('grid-connected', {});
    }

    public autoResizeColumns() {
        if (this.grid) {
            autoResizeColumns(this.grid);
        }
    }

    /**
     * contextMenu element can be used to attach own context menus
     * practical since it will be removed if new is open/scroll happens
     * @returns
     */
    public getContextMenuElement() {
        return this.grid?.contextMenu;
    }

    /**
     * small helper function to show context menu in same style as the rest
     * @param event
     * @param options
     * @param cell
     * @param callback
     */
    public contextMenuCustom(
        event: MouseEvent,
        options: { label: string; value: string; isHeader?: boolean }[],
        cell: HTMLElement,
        callback: (attribute: string) => void
    ) {
        // no grid connected (not in the dom yet, or removed): nothing to open the menu in
        if (this.grid) {
            contextMenuCustom(this.grid, event, cell, callback, options);
        }
    }

    /**
     * contextMenu element can be used to attach own context menus
     * practical since it will be removed if new is open/scroll happens
     * @param el
     */
    public setContextMenuElement(el: HTMLElement) {
        if (this.grid) {
            this.grid.contextMenu = el;
        }
    }

    /**
     * contextMenu element can be used to attach own context menus
     * practical since it will be removed if new is open/scroll happens
     */
    public removeContextMenuElement() {
        // no grid connected: there is no menu to remove
        if (this.grid) {
            removeContextMenu(this.grid);
        }
    }

    /**
     * this will force scroll event and update cells
     * usefull if you have done any manual edits to datasource data and want grid updated
     */
    public triggerScrollEvent() {
        if (this.grid) {
            triggerScrollEvent(this.grid);
        }
    }

    public openFilterEditor() {
        if (this.grid) {
            openFilterEditor(this.grid);
        }
    }

    /**
     * gets columns in order
     * by default it filters out selected columns only
     * @param filterSelectedColumns = true by default
     */
    public getAttributeColumns(filterSelectedColumns = true) {
        return getAttributeColumns(this, filterSelectedColumns);
    }

    /**
     * the fields the grid knows - the keys of `GridConfig.columns`, and every field that was in the
     * layout - that are not in the layout now: the ones the column chooser can add back
     */
    public getOptionalAttributes() {
        const attributes = new Set(Object.keys(this.gridConfig.columns));
        this.getAttributeColumns(false).forEach((e) => {
            attributes.delete(e);
        });
        return Array.from(attributes);
    }

    /**
     * trigger rebuild of all
     */
    public triggerRebuild() {
        this.grid?.rebuild();
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
     * this is for enabling readonly based on row data
     * @param callback called per cell: return `true`/`false` to override the column's `readonly`,
     * `null` to keep it. `rowData` is the cell's data row, never a group row - a group row has no
     * cells. `null` removes the callback
     */
    public readonlySetter(
        callback: ((attribute: string, rowData: Entity, cellReadOnlyConfig: boolean) => boolean | null) | null
    ) {
        this.readonlySetterFn = callback;
        if (this.grid) {
            triggerScrollEvent(this.grid);
        }
    }

    /**
     * this is for enabling class append to input element and dimmed cell behind it
     * dimmed cell can be used for graphics in class
     * @param callback called per cell. `rowData` is the cell's data row, never a group row - a
     * group row has no cells. `null` removes the callback
     */
    public cellAppendClassSetter(
        // null removes it again
        callback:
            | ((attribute: string, rowData: Entity, cellReadOnlyConfig: boolean) => { inputClass: string; dimmedClass: string })
            | null
    ) {
        this.cellAppendClassSetterFn = callback;
        if (this.grid) {
            triggerScrollEvent(this.grid);
        }
    }

    /**
     * current datasource
     * @returns
     */
    public getDatasource() {
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

        this.dataSource.setSelectionMode(config.selectionMode);

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
     * the header filter of a column: what its cell shows and the operator picked in its menu
     */
    public __getHeaderFilter(field: string): HeaderFilter | undefined {
        return this.headerFilters[field];
    }

    /**
     * @internal
     * sets what a column's header filter cell shows, keeps the operator picked. null/'' is empty
     */
    public __setHeaderFilterValue(field: string, value: unknown) {
        this.storeHeaderFilter(field, value, this.headerFilters[field]?.operator);
    }

    /**
     * @internal
     * sets the operator picked in a column's header filter menu, keeps the value
     */
    public __setHeaderFilterOperator(field: string, operator: FilterOperator) {
        this.storeHeaderFilter(field, this.headerFilters[field]?.value, operator);
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
     * stores a column's header filter, or removes it when it has no value and no operator - so
     * getState() lists only the header filters in use. An empty value ('' or undefined) is stored as null
     */
    private storeHeaderFilter(field: string, value: unknown, operator: FilterOperator | undefined) {
        const empty = value === null || value === undefined || value === '';
        if (empty && !operator) {
            delete this.headerFilters[field];
        } else {
            this.headerFilters[field] = operator ? { value: empty ? null : value, operator } : { value };
        }
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
    public __setSelectedColumn(number: number, add = false) {
        if (!add) {
            this.columnsSelected.clear();
        }
        if (this.__isColumnSelected(number)) {
            this.columnsSelected.delete(number);
        } else {
            this.columnsSelected.add(number);
        }
        if (this.grid) {
            rebuildHeaderColumns(this.grid);
            this.grid.gridInterface.triggerScrollEvent();
        }
    }

    /**
     * @internal
     * @private
     */
    public __isColumnSelected(number: number) {
        return this.columnsSelected.has(number);
    }

    /**
     * @internal
     * @private
     */
    public __selectedColumns() {
        return this.columnsSelected.size;
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
        this.scrollTops = [];
        this.scrollHeights = [];
        this.scrollHeight = 0;

        // lets make a index if datasource is > 1000k, and store top for each k

        const cell = this.gridConfig.cellHeight;
        const row = this.gridConfig.__rowHeight;
        let count = 0;

        this.dataSource.getRows().forEach((ent) => {
            const height = isGroupRow(ent) ? cell : row;
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
     * @private
     * called by grid calss
     */
    public __callReadonlySetter(attribute: string, rowData: Entity, cellReadOnlyConfig: boolean) {
        if (this.readonlySetterFn) {
            return this.readonlySetterFn(attribute, rowData, cellReadOnlyConfig);
        } else {
            return null;
        }
    }

    /**
     * @internal
     * @private
     * called by grid calss
     */
    public __callCellAppendClass(attribute: string, rowData: Entity, cellReadOnlyConfig: boolean) {
        if (this.cellAppendClassSetterFn) {
            return this.cellAppendClassSetterFn(attribute, rowData, cellReadOnlyConfig);
        } else {
            return {
                inputClass: '',
                dimmedClass: ''
            };
        }
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

        this.datasourceSubscriptions = [
            follow('collection-filtered', (data, grid) => {
                // '__internalUpdate, forced' comes before a collection-changed, that one rebuilds
                if (data.info === 'filter' || data.info === 'markForDeletion' || data.info === 'resetData') {
                    grid.rebuild(false);
                }
            }),
            follow('collection-sorted', (_data, grid) => grid.rebuild()),
            follow('collection-grouped', (_data, grid) => grid.rebuild()),
            follow('collection-expand', (_data, grid) => grid.rebuild()),
            follow('collection-collapse', (_data, grid) => grid.rebuild()),
            follow('collection-changed', (_data, grid) => grid.rebuild()),
            follow('current-entity', (_data, grid) => this.updateRows(grid)),
            follow('selection-change', (_data, grid) => this.updateRows(grid)),
            follow('select', (data, grid) => this.scrollToRow(grid, data.row))
        ];
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

        if (newTop - this.__getGridConfig().__rowHeight < scrollElScrollTop) {
            scrollEl.scrollTop = Math.floor(newTop - scrollElHeight / 2);
        }

        if (newTop + this.__getGridConfig().__rowHeight > scrollElHeight + scrollElScrollTop) {
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
 * A copy of the config with every default filled in, for the grid to work with. The sizes are
 * computed by `__parseConfig()`. `layout` and `columns` are copied deep, the grid changes them (the
 * user moves columns around, a `filter-operator-change` handler can change a column); the other
 * options are only read. `initialState` is left out, the interface keeps it as its start state.
 */
function withDefaults(config: GridConfig): ParsedGridConfig {
    const { columns, layout, initialState, ...options } = config;
    const cellHeight = options.cellHeight ?? 22;
    return {
        ...options,
        columns: structuredClone(columns ?? {}),
        layout: copyLayout(layout),
        cellHeight,
        cellHeaderLabelHeight: options.cellHeaderLabelHeight ?? cellHeight,
        panelHeight: options.panelHeight ?? 25,
        footerHeight: options.footerHeight ?? 45,
        selectSizeHeight: options.selectSizeHeight ?? 18,
        readonly: options.readonly ?? true,
        selectionMode: options.selectionMode ?? 'multiple',
        tooltips: options.tooltips ?? true,
        placeholderRowCurrentEntityOnly: options.placeholderRowCurrentEntityOnly ?? true,
        __rowHeight: 0,
        __rowHeaderHeight: 0,
        __columnCells: 0,
        __leftWidth: 0,
        __rightWidth: 0,
        __scrollbarSize: 0,
        __selectSizeWidth: 0
    };
}

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
