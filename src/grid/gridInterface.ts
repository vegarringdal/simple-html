import type { Datasource } from '../datasource/dataSource';
import type { DatasourceEvents } from '../datasource/datasourceEvents';
import { type Entity, isGroupRow } from '../datasource/entity';
import { Emitter, type EventHandler } from '../emitter';
import type { Grid } from './grid';
import type { GridConfig, ParsedGridConfig } from './gridConfig';
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
    // ParsedGridConfig: __parseConfig() fills in every default before the grid reads it
    // set by loadConfig, called from the constructor
    private gridConfig!: ParsedGridConfig;
    private dataSource: Datasource<T>;
    private columnsSelected: Set<number>;

    // for variable scroll, set by __dataSourceUpdated, called from the constructor
    private scrollTops!: number[];
    private scrollHeights!: number[];
    private scrollHeight!: number;

    /**
     * for skipping events during setting gridconfig
     * set by loadConfig, called from the constructor
     */
    private suppressEvents!: boolean;

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
    private initConfig: GridConfig;

    /**
     *
     * @param gridConfig
     * @param datasource
     */
    constructor(gridConfig: GridConfig, datasource: Datasource) {
        this.columnsSelected = new Set();
        this.dataSource = datasource;
        this.initConfig = JSON.parse(JSON.stringify(gridConfig)) as GridConfig;
        if (
            this.initConfig.autoRemoveContextMenuOnScrollEvent === null ||
            this.initConfig.autoRemoveContextMenuOnScrollEvent === undefined
        ) {
            this.initConfig.autoRemoveContextMenuOnScrollEvent = false;
        }
        this.loadConfig(gridConfig, true);
        this.__dataSourceUpdated();
    }

    /**
     * loads init config, useful when saved/loaded many different configs
     */
    public loadInitConfig() {
        this.loadConfig(this.initConfig, false);
    }

    /**
     * in case you need to set new init config, to be used with loadInitConfig()
     * @param gridConfig
     * @param load = false, but can be usedful if you want to update and load it
     */
    public updateInitConfig(gridConfig: GridConfig, load = false) {
        this.initConfig = JSON.parse(JSON.stringify(gridConfig)) as GridConfig;
        if (load) {
            this.loadConfig(this.initConfig, false);
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

    /**
     * when you need to save a copy
     */
    public saveConfig(): GridConfig {
        const config = JSON.parse(JSON.stringify(this.gridConfig)) as GridConfig;

        // convert attributes, a copy of the parsed config always has them
        const attributes = config.__attributes!;
        const keys = Object.keys(attributes);
        config.attributes = [];
        keys.forEach((key) => {
            config.attributes.push(attributes[key]);
        });

        delete config.__attributes;
        delete config.__rowHeight;
        delete config.__columnCells;
        delete config.__leftWidth;
        delete config.__rightWidth;
        delete config.__scrollbarSize;
        delete config.__selectSizeWidth;

        // these are the datasource's own objects, and it changes them in place (shift+click sort,
        // filter context menu), so hand out copies or the saved config changes later on.
        // structuredClone and not JSON, so Date values in the filter stay Dates
        config.expandedGroups = structuredClone(this.getDatasource().getExpanded());
        config.sorting = structuredClone(this.getDatasource().getLastSorting());
        config.grouping = structuredClone(this.getDatasource().getGrouping());
        config.filter = structuredClone(this.getDatasource().getFilter());

        return config;
    }

    public openFilterEditor() {
        if (this.grid) {
            openFilterEditor(this.grid);
        }
    }

    /**
     * when you need load grid config
     */
    public loadConfig(gridConfig: GridConfig, skipRebuild = false) {
        this.suppressEvents = true;

        // the datasource keeps what it is given and changes it in place later (shift+click sort,
        // filter context menu), so give it copies - else the caller's config (or initConfig,
        // used by loadInitConfig) changes too. structuredClone keeps Date values in the filter
        const sortOrder = structuredClone(gridConfig.sorting);
        const grouping = structuredClone(gridConfig.grouping);
        const filter = structuredClone(gridConfig.filter);
        const expandedGroups = structuredClone(gridConfig.expandedGroups);

        this.gridConfig = JSON.parse(JSON.stringify(gridConfig));
        this.gridConfig.sorting = null;
        this.gridConfig.grouping = null;
        this.gridConfig.filter = null;
        this.gridConfig.expandedGroups = null;

        this.__parseConfig();

        // null clears a filter that was set before
        this.getDatasource().filter(filter ?? null);

        if (grouping?.length) {
            // setExpanded makes a Set of it, and new Set(undefined/null) is empty too
            this.getDatasource().setExpanded(expandedGroups ?? []);
            this.getDatasource().group(grouping);
            if (sortOrder?.length) {
                // we asume they have control what they are sending in
                this.getDatasource().sort(sortOrder);
            }
        } else {
            this.getDatasource().removeGroup();
            if (sortOrder?.length && !grouping?.length) {
                this.getDatasource().sort(sortOrder);
            }
        }

        this.suppressEvents = false;

        if (!skipRebuild) {
            if (this.grid) {
                this.grid.rebuild();
            } else {
                this.__dataSourceUpdated();
            }
        } else {
            this.__dataSourceUpdated();
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

    public getOptionalAttributes() {
        const attributes = new Set(Object.keys(this.gridConfig.__attributes));
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
     */
    public __parseConfig() {
        if (!this.gridConfig.__attributes) {
            this.gridConfig.__attributes = {};
        }

        if (!Array.isArray(this.gridConfig.columnsPinnedLeft)) {
            this.gridConfig.columnsPinnedLeft = [];
        }
        if (!Array.isArray(this.gridConfig.columnsPinnedRight)) {
            this.gridConfig.columnsPinnedRight = [];
        }
        if (!Array.isArray(this.gridConfig.columnsCenter)) {
            this.gridConfig.columnsCenter = [];
        }

        if (this.gridConfig.footerHeight === null || this.gridConfig.footerHeight === undefined) {
            this.gridConfig.footerHeight = 45;
        }

        if (this.gridConfig.panelHeight === null || this.gridConfig.panelHeight === undefined) {
            this.gridConfig.panelHeight = 25;
        }
        if (this.gridConfig.cellHeight === null || this.gridConfig.cellHeight === undefined) {
            this.gridConfig.cellHeight = 22;
        }

        if (this.gridConfig.cellHeaderLabelHeight === null || this.gridConfig.cellHeaderLabelHeight === undefined) {
            this.gridConfig.cellHeaderLabelHeight = this.gridConfig.cellHeight;
        }

        if (this.gridConfig.panelHeight === null || this.gridConfig.panelHeight === undefined) {
            this.gridConfig.panelHeight = 0;
        }
        if (this.gridConfig.selectSizeHeight === null || this.gridConfig.selectSizeHeight === undefined) {
            this.gridConfig.selectSizeHeight = 18;
        }
        if (this.gridConfig.readonly === null || this.gridConfig.readonly === undefined) {
            this.gridConfig.readonly = true;
        }
        if (this.gridConfig.selectionMode === null || this.gridConfig.selectionMode === undefined) {
            this.gridConfig.selectionMode = 'multiple';
        }

        if (this.gridConfig.tooltips === null || this.gridConfig.tooltips === undefined) {
            this.gridConfig.tooltips = true;
        }

        this.dataSource.setSelectionMode(this.gridConfig.selectionMode);

        if (
            this.gridConfig.placeHolderRowCurrentEntityOnly === null ||
            this.gridConfig.placeHolderRowCurrentEntityOnly === undefined
        ) {
            this.gridConfig.placeHolderRowCurrentEntityOnly = true;
        }

        /**
         * height
         */
        let cells = getCellHeight(this.gridConfig.columnsPinnedLeft, 1);
        cells = getCellHeight(this.gridConfig.columnsPinnedRight, cells);
        cells = getCellHeight(this.gridConfig.columnsCenter, cells);

        this.gridConfig.__rowHeight = cells * this.gridConfig.cellHeight;
        this.gridConfig.__rowHeaderHeight = cells * this.gridConfig.cellHeight + cells * this.gridConfig.cellHeaderLabelHeight;
        this.gridConfig.__columnCells = cells;

        this.gridConfig.columnsPinnedLeft = this.gridConfig.columnsPinnedLeft.filter((e) => e.rows?.length);
        this.gridConfig.columnsPinnedRight = this.gridConfig.columnsPinnedRight.filter((e) => e.rows?.length);
        this.gridConfig.columnsCenter = this.gridConfig.columnsCenter.filter((e) => e.rows?.length);

        /**
         * widths pinned
         */
        this.gridConfig.__leftWidth =
            this.gridConfig.columnsPinnedLeft?.map((col) => col.width || 100).reduce((value, curvalue) => value + curvalue, 0) ||
            0;

        this.gridConfig.__rightWidth =
            this.gridConfig.columnsPinnedRight?.map((col) => col.width || 100).reduce((value, curvalue) => value + curvalue, 0) ||
            0;

        this.gridConfig.__scrollbarSize = 10;

        if (this.gridConfig.selectSizeHeight === undefined) {
            this.gridConfig.selectSizeHeight = this.gridConfig.cellHeight;
        }

        this.gridConfig.__selectSizeWidth = Math.floor(
            getTextWidth(this.grid, this.dataSource.getRows().length.toString()) || 10
        );
        if (this.gridConfig.__selectSizeWidth < 25) {
            this.gridConfig.__selectSizeWidth = 25;
        }

        /**
         * build up internal object with attributes
         */

        this.gridConfig.columnsPinnedLeft.forEach((e) => {
            if (Array.isArray(e.rows)) {
                e.rows.forEach((att) => {
                    if (!this.gridConfig.__attributes[att]) {
                        this.gridConfig.__attributes[att] = { attribute: att };
                    }
                });
            }
        });
        this.gridConfig.columnsPinnedRight.forEach((e) => {
            if (Array.isArray(e.rows)) {
                e.rows.forEach((att) => {
                    if (!this.gridConfig.__attributes[att]) {
                        this.gridConfig.__attributes[att] = { attribute: att };
                    }
                });
            }
        });
        this.gridConfig.columnsCenter.forEach((e) => {
            if (Array.isArray(e.rows)) {
                e.rows.forEach((att) => {
                    if (!this.gridConfig.__attributes[att]) {
                        this.gridConfig.__attributes[att] = { attribute: att };
                    }
                });
            }
        });

        this.gridConfig.attributes?.forEach((att) => {
            this.gridConfig.__attributes[att.attribute] = att;
        });
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

        // the handlers do nothing while loadConfig runs (suppressEvents), it rebuilds once when
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
