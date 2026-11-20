import { assertOptions } from '../datasource/assertOptions';
import type { Datasource } from '../datasource/dataSource';
import type { DatasourceEvents } from '../datasource/datasourceEvents';
import { type Entity, isGroupRow } from '../datasource/entity';
import type { FilterOperator } from '../datasource/filterExpression';
import { Emitter, type EventHandler } from '../emitter';
import type { Grid } from './grid';
import type {
    CellClass,
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
import { autoResizeColumns } from './gridFunctions/autoResizeColumns';
import { getCellHeight } from './gridFunctions/getCellHeight';
import { getElementByClassName } from './gridFunctions/getElementByClassName';
import { getLayoutFields } from './gridFunctions/getLayoutFields';
import { getTextWidth } from './gridFunctions/getTextWidth';
import { openFilterEditor } from './gridFunctions/openFilterEditor';
import { rebuildHeaderColumns } from './gridFunctions/rebuildHeaderColumns';
import { removeContextMenu } from './gridFunctions/removeContextMenu';
import { placeAt, showMenu } from './gridFunctions/showMenu';
import { triggerScrollEvent } from './gridFunctions/triggerScrollEvent';
import { updateVerticalScrollHeight } from './gridFunctions/updateVerticalScrollHeight';
import type { MenuContext, MenuEntry, MenuPosition } from './gridMenus';

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
    private initialState: Partial<GridState>;
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
     * Most of the time {@link createGrid} makes the interface. Make it yourself for a
     * `<simple-html-grid>` element you place on your own, and connect it with
     * `element.connectInterface()`.
     *
     * @param gridConfig the columns, the layout and the options, see {@link GridConfig}. The object is
     * not changed, the grid copies the parts it changes
     * @param datasource the rows. The grid applies `gridConfig.initialState` to it: its sorting,
     * grouping and filter are replaced (left out, they are cleared)
     *
     * @example
     * ```ts
     * import { type GridConfig, type GridElement, GridInterface } from '@simple-html/grid';
     *
     * declare const config: GridConfig;
     *
     * const gridInterface = new GridInterface(config, datasource);
     * const element = document.createElement('simple-html-grid') as GridElement;
     * element.connectInterface(gridInterface);
     * host.appendChild(element);
     * ```
     */
    constructor(gridConfig: GridConfig, datasource: Datasource<T>) {
        this.columnsSelected = new Set();
        this.dataSource = datasource;

        const { columns, layout, initialState, ...options } = gridConfig;
        this.options = options;
        this.gridConfig = {
            ...withDefaults(options),
            columns: structuredClone(columns ?? {}),
            layout: copyLayout(layout),
            ...NO_SIZES
        };
        this.configLayout = copyLayout(layout);
        // structuredClone, not JSON: it keeps the Dates of a filter
        this.initialState = structuredClone(initialState ?? {});

        this.applyState(this.getStartState());
    }

    /**
     * The state of the grid now: what the user changed - column order, pinning and widths, sorting,
     * grouping, expanded groups, the filter and what the header filters show. See {@link GridState}.
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
            headerFilters: initialState.headerFilters ?? {}
        };
    }

    /**
     * Changes options of the config while the grid is shown: `readonly`, `hideLabels`, the sizes,
     * `tooltips`, the `isReadonly` / `cellClass` callbacks, `columns` ... and rebuilds the grid once.
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
     *
     * The rest of the state - sorting, grouping, filter, header filters - is kept, and so are the
     * handlers subscribed with {@link on}. The object passed in is not changed, the grid copies
     * `columns`, `layout` and `initialState`.
     *
     * @param config the parts of the config to change
     *
     * @sample misc-options
     * @example
     * ```ts
     * gridInterface.updateConfig({ readonly: false }); // editing on
     * gridInterface.updateConfig({ hideFilter: true, cellHeight: 30 });
     * gridInterface.updateConfig({ isReadonly: (row, field) => (field === 'name' ? row.locked : null) });
     * gridInterface.updateConfig({ cellClass: undefined }); // the callback is removed
     *
     * // the columns the config starts with, shown now and what resetState() goes back to
     * gridInterface.updateConfig({ layout: { center: [{ fields: ['name'], width: 200 }] } });
     * ```
     */
    public updateConfig(config: Partial<GridConfig>) {
        const { columns, layout, initialState, ...options } = config;

        this.options = { ...this.options, ...options };
        // in place, so code that got the parsed config before reads the new options too
        Object.assign(this.gridConfig, withDefaults(this.options));

        // `in`, so that `columns: undefined` gives every column the defaults, as it does for an option
        if ('columns' in config) {
            this.gridConfig.columns = structuredClone(columns ?? {});
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
        this.lastGrid = grid;
        this.subscribeToDatasource();
        this.__callSubscribers('grid-connected', {});
    }

    /**
     * Renders the visible cells again, with the values the rows have now. For when something the
     * cells show changed without the grid knowing: a value set on a row object outside of the grid's
     * editing, or what the config's `isReadonly` / `cellClass` read. Cheap, the columns and the
     * header are not built again - that is {@link rebuild}.
     *
     * Does nothing while the grid is not on the page.
     *
     * Was `triggerScrollEvent()` in v5.
     *
     * @example
     * ```ts
     * gridInterface.on('cell-click', (data) => {
     *     data.rowData.lastClicked = new Date().toISOString();
     *     gridInterface.refresh();
     * });
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
     * filters show it too), the size of the element without a resize event, a column's options changed
     * in place. To change an option, use {@link updateConfig} - it rebuilds too. For the cells only,
     * {@link refresh} is cheaper.
     *
     * Does nothing while the grid is not on the page, it is built when it is put there.
     *
     * Was `triggerRebuild()` in v5.
     *
     * @example
     * ```ts
     * import { Datasource, type Formatter } from '@simple-html/grid';
     *
     * // a formatter that reads a setting of your own
     * let decimals = 2;
     * const price: Formatter = {
     *     format: (value) => (typeof value === 'number' ? value.toFixed(decimals) : ''),
     *     parse: (text) => (text.trim() === '' ? null : Number(text))
     * };
     * const datasource = new Datasource({ fields: { price: { type: 'number', formatter: price } } });
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
    }

    /**
     * Sizes the columns to their content: the label, the header filter's placeholder, and the longest
     * value of the fields in each column (every row, not only the filtered ones). A column is at most
     * 750px. Rebuilds the grid.
     *
     * Measures the text with the grid's font, so call it once the grid is on the page: right after
     * {@link createGrid}, or from a `grid-connected` handler for an element you connect yourself. It
     * does nothing before the interface is connected to an element.
     *
     * @sample misc-options
     * @example
     * ```ts
     * import { createGrid, type GridConfig } from '@simple-html/grid';
     *
     * declare const config: GridConfig;
     *
     * const gridInterface = createGrid(host, { config, datasource });
     * gridInterface.autoResizeColumns();
     * ```
     */
    public autoResizeColumns() {
        if (this.grid) {
            autoResizeColumns(this.grid);
        }
    }

    /**
     * Opens the filter editor, the dialog where the user builds a filter of conditions and AND/OR
     * groups. It starts with the filter the datasource has now. The user opens it from the header
     * filter's menu ("Advanced Filter") or by clicking the filter shown in the footer; call this from a
     * button of your own.
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
     * The fields in the layout now, in the order the user sees them: pinned left, center, pinned right,
     * left to right, and top to bottom within a column of stacked fields.
     *
     * With `selectedOnly`, only the fields of the columns the user selected - by clicking the column
     * numbers under the header filters, ctrl+click for more. None selected gives `[]`.
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
     * Opens a menu of your own, in the grid's menu style: a value picker for a cell, the actions of a
     * button, a second grid as a dropdown ({@link MenuBlock}). See {@link MenuEntry} for what it can
     * show. To change the grid's own right click menus, use `GridConfig.menus`.
     *
     * The menu open before is closed: there is one menu at a time. The grid closes this one, as its
     * own, on a click outside it, when another menu opens, on scroll (with
     * `autoRemoveContextMenuOnScrollEvent`) and when the grid leaves the page. Clicking an item closes
     * it too, then calls the item's action; clicking in a block does not. {@link closeMenu} closes it
     * from code.
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
     * click menus. Does nothing when no menu is open.
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
            triggerScrollEvent(this.grid);
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
     * Is the cell readonly: the config's `isReadonly()` decides, and when it gives no answer (anything
     * but `true` / `false`) the column's `readonly` option. The grid's own `readonly` is not part of it,
     * the callers check that first
     */
    public __isCellReadonly(row: Entity, field: string): boolean {
        const readonlyByConfig = this.gridConfig.columns[field]?.readonly ?? false;
        const readonly = this.gridConfig.isReadonly?.(row, field, readonlyByConfig);
        return typeof readonly === 'boolean' ? readonly : readonlyByConfig;
    }

    /**
     * @internal
     * The css classes the config's `cellClass()` gives the cell, '' for the ones it leaves out
     */
    public __getCellClass(row: Entity, field: string): Required<CellClass> {
        const classes = this.gridConfig.cellClass?.(row, field);
        return { input: classes?.input ?? '', background: classes?.background ?? '' };
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
 * The options with every default filled in, for the grid to work with. A shallow copy: the options are
 * only read. `columns` and `layout` are copied deep by the interface itself, the grid changes them
 * (the user moves columns around, a `filter-operator-change` handler can change a column).
 */
function withDefaults(options: GridOptions): ParsedGridOptions {
    const cellHeight = options.cellHeight ?? 22;
    return {
        ...options,
        cellHeight,
        cellHeaderLabelHeight: options.cellHeaderLabelHeight ?? cellHeight,
        panelHeight: options.panelHeight ?? 25,
        footerHeight: options.footerHeight ?? 45,
        selectSizeHeight: options.selectSizeHeight ?? 18,
        readonly: options.readonly ?? true,
        selectionMode: options.selectionMode ?? 'multiple',
        tooltips: options.tooltips ?? true,
        placeholderRowCurrentEntityOnly: options.placeholderRowCurrentEntityOnly ?? true
    };
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
    __selectSizeWidth: 0
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
