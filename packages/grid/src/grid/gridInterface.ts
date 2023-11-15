import { Datasource } from '../datasource/dataSource';
import { FilterArgument } from '../datasource/filterArgument';
import { Entity } from '../datasource/entity';
import { autoResizeColumns } from './gridFunctions/autoResizeColumns';
import { getAttributeColumns } from './gridFunctions/getAttributeColumns';
import { getCellHeight } from './gridFunctions/getCellHeight';
import { Grid } from './grid';
import { GridConfig } from './gridConfig';
import { openFilterEditor } from './gridFunctions/openFilterEditor';
import { rebuildHeaderColumns } from './gridFunctions/rebuildHeaderColumns';
import { triggerScrollEvent } from './gridFunctions/triggerScrollEvent';
import { updateVerticalScrollHeight } from './gridFunctions/updateVerticalScrollHeight';
import { getTextWidth } from './gridFunctions/getTextWidth';
import { getElementByClassName } from './gridFunctions/getElementByClassName';
import { removeContextMenu } from './gridFunctions/removeContextMenu';
import { contextMenuCustom } from './gridFunctions/contextMenuCustom';

export type callF = (...args: any[]) => any;
export type callO = { handleEvent: (...args: any[]) => any };
export type callable = callF | callO;

/* declare const DEVELOPMENT: boolean; */

/**
 * grid interface is what user have access to controll grid behavior
 */
export class GridInterface<T> {
    private grid: Grid;
    private gridConfig: GridConfig;
    private dataSource: Datasource<T>;
    private columnsSelected: Set<number>;

    // for variable scroll
    private scrollTops: number[];
    private scrollHeights: number[];
    private scrollHeight: number;

    /**
     * for skipping events during setting gridconfig
     */
    private suppressEvents: boolean;

    /**
     * for setting readonly based on row values
     */
    private readonlySetterFn: (attribute: string, rowData: Entity, cellReadOnlyConfig: boolean) => boolean | null;

    /**
     * for adding classes on row lvl
     */
    private cellAppendClassSetterFn: (
        attribute: string,
        rowData: Entity,
        cellReadOnlyConfig: boolean
    ) => {
        inputClass: string;
        dimmedClass: string;
    };

    /**
     * subscribed listerners, gets called when collection changes/is sorted/filtered etc
     */
    private listeners: Set<callable> = new Set();
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
     */
    public connectGrid(grid: Grid) {
        this.grid = grid;
        this.dataSource.addEventListener(this);
        this.__callSubscribers('gridConnected', {});
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
        contextMenuCustom(this.grid, event, cell, callback, options);
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
        removeContextMenu(this.grid);
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

        // convert attributes
        const keys = Object.keys(config.__attributes);
        config.attributes = [];
        keys.forEach((key) => {
            config.attributes.push(config.__attributes[key]);
        });

        delete config.__attributes;
        delete config.__rowHeight;
        delete config.__columnCells;
        delete config.__leftWidth;
        delete config.__rightWidth;
        delete config.__scrollbarSize;
        delete config.__selectSizeWidth;

        config.expandedGroups = this.getDatasource().getExpanded();
        config.sorting = this.getDatasource().getLastSorting();
        config.grouping = this.getDatasource().getGrouping();
        config.filter = this.getDatasource().getFilter();

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

        const sortOrder = gridConfig.sorting;
        const grouping = gridConfig.grouping;
        const filter = gridConfig.filter;
        const exspandedGroups = gridConfig.expandedGroups;

        this.gridConfig = JSON.parse(JSON.stringify(gridConfig));
        this.gridConfig.sorting = null;
        this.gridConfig.grouping = null;
        this.gridConfig.filter = null;
        this.gridConfig.expandedGroups = null;

        this.__parseConfig();

        if (filter) {
            this.getDatasource().setFilter(filter as FilterArgument);
        } else {
            this.getDatasource().setFilter(null);
        }
        this.getDatasource().filter();

        if (grouping?.length) {
            this.getDatasource().setExpanded(exspandedGroups);
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
        return getAttributeColumns(this.grid, filterSelectedColumns);
    }

    public getOptionalAttributes() {
        const attributes = new Set(Object.keys(this.gridConfig.__attributes));
        this.getAttributeColumns(false).forEach((e) => attributes.delete(e));
        return Array.from(attributes);
    }

    /**
     * trigger rebuild of all
     */
    public triggerRebuild() {
        this.grid?.rebuild();
    }

    /**
     * adds event listener, useful when you need to do stuff based on
     * @param callable
     */
    public addEventListener(callable: callable): void {
        if (typeof callable !== 'function' && typeof callable?.handleEvent !== 'function') {
            throw new Error('callable sent to datasource event listner is wrong type');
        }

        if (!this.listeners.has(callable)) {
            this.listeners.add(callable);
        }
    }

    /**
     * this is for enabling readonly based on row data
     * @param callback
     */
    public readonlySetter(callback: (attribute: string, rowData: Entity, cellReadOnlyConfig: boolean) => boolean | null) {
        this.readonlySetterFn = callback;
        if (this.grid) {
            triggerScrollEvent(this.grid);
        }
    }

    /**
     * this is for enabling class append to input element and dimmed cell behind it
     * dimmed cell can be used for graphics in class
     * @param callback
     */
    public cellAppendClassSetter(
        callback: (attribute: string, rowData: Entity, cellReadOnlyConfig: boolean) => { inputClass: string; dimmedClass: string }
    ) {
        this.cellAppendClassSetterFn = callback;
        if (this.grid) {
            triggerScrollEvent(this.grid);
        }
    }

    /**
     * removes listener from datasource
     * @param callable
     */
    public removeEventListener(callable: callable): void {
        if (this.listeners.has(callable)) {
            this.listeners.delete(callable);
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
        if (!Array.isArray(this.gridConfig.columnsPinnedLeft)) {
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

        this.dataSource.setSelectionMode(this.gridConfig.selectionMode);

        if (
            this.gridConfig.placeHolderRowCurrentEnityOnly === null ||
            this.gridConfig.placeHolderRowCurrentEnityOnly === undefined
        ) {
            this.gridConfig.placeHolderRowCurrentEnityOnly = true;
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
            const name = att.attribute;
            if (!this.gridConfig.__attributes[name]) {
                this.gridConfig.__attributes[name] = att;
            } else {
                this.gridConfig.__attributes[name] = att;
            }
        });
    }

    /**
     * @internal
     * @private
     */
    public __getGridConfig() {
        return this.gridConfig;
    }

    /**
     * @internal
     * @private
     */
    public __disconnectGrid() {
        this.dataSource.removeEventListener(this);
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
        return this.grid ? true : false;
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

        this.dataSource.getRows().forEach((ent: Entity) => {
            const height = ent.__group ? cell : row;
            this.scrollTops.push(count);
            this.scrollHeights.push(height);
            count = count + height;
        });

        this.scrollHeight = count;
        if (this.grid && this.grid.getElement()) {
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
     * @internal
     * @private
     * do not use - used to handle event from datasource
     * cant use __ since datasource wants it without
     */
    public handleEvent(e: any) {
        if (this.suppressEvents) {
            return true;
        }

        switch (true) {
            case e.type === 'collection-filtered' &&
                (e.data?.info === 'filter' || e.data?.info === 'markForDeletion' || e.data?.info === 'resetData'):
                this.grid.rebuild(false);
                break;
            case e.type === 'collection-sorted':
            case e.type === 'collection-grouped':
            case e.type === 'collection-expand':
            case e.type === 'collection-collapse':
            case e.type === 'collection-changed':
                this.grid.rebuild();

                break;
            case e.type === 'currentEntity':
            case e.type === 'selectionChange':
                this.__dataSourceUpdated();
                triggerScrollEvent(this.grid);
                break;
            case e.type === 'select':
                this.__dataSourceUpdated();

                const scrollEl = getElementByClassName(this.grid.getElement(), 'simple-html-grid-body-scroller');
                const scrollElHeight = scrollEl?.clientHeight;
                const scrollElScrollTop = scrollEl?.scrollTop;

                const newTop = this.__getScrollState().scrollTops[e.data?.row];

                if (newTop - this.__getGridConfig().__rowHeight < scrollElScrollTop) {
                    scrollEl.scrollTop = Math.floor(newTop - scrollElHeight / 2);
                }

                if (newTop + this.__getGridConfig().__rowHeight > scrollElHeight + scrollElScrollTop) {
                    scrollEl.scrollTop = Math.floor(newTop - scrollElHeight / 2);
                }

                break;
            default:
            /* if (DEVELOPMENT === true) {
                    console.log('skipping:', e.type, e.data);
                } */
        }

        return true; // to hold active
    }

    /**
     * @internal
     * @private
     * used to call subscribers, used by selection/sorting/filter/grouping controller
     * @param event
     * @param data
     */
    public __callSubscribers(event: string, data = {}): void {
        const keeping: any = [];
        this.listeners.forEach((callable) => {
            let keep: boolean;
            if (typeof callable === 'function') {
                keep = callable({ type: event, data: data });
            } else {
                if (typeof callable?.handleEvent === 'function') {
                    keep = callable.handleEvent({ type: event, data: data });
                }
            }
            if (keep) {
                keeping.push(callable);
            }
        });
        this.listeners = new Set(keeping);
    }
}
