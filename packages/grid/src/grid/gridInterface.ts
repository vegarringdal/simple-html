import { Datasource } from '../datasource/dataSource';
import { Entity, FilterArgument } from '../datasource/types';
import { getCellHeight } from './getCellHeight';
import { Grid } from './grid';
import { GridConfig } from './gridConfig';

type callF = (...args: any[]) => any;
type callO = { handleEvent: (...args: any[]) => any };
type callable = callF | callO;

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
     * subscribed listerners, gets called when collection changes/is sorted/filtered etc
     */
    private listeners: Set<callable> = new Set();
    private initConfig: GridConfig;

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
        this.loadConfig(this.initConfig, true);
    }

    /**
     * in case you need to set new init config, to be used with loadInitConfig()
     * @param gridConfig
     */
    public updateInitConfig(gridConfig: GridConfig) {
        this.initConfig = JSON.parse(JSON.stringify(gridConfig)) as GridConfig;
    }

    public parseConfig() {
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

        /**
         * height
         */
        let cells = getCellHeight(this.gridConfig.columnsPinnedLeft, 1);
        cells = getCellHeight(this.gridConfig.columnsPinnedRight, cells);
        cells = getCellHeight(this.gridConfig.columnsCenter, cells);

        this.gridConfig.__rowHeight = cells * this.gridConfig.cellHeight;
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
            this.grid?.getTextWidth(this.dataSource.getRows().length.toString()) || 10
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
     * do not use - used by grid to connect
     * @param grid
     */
    connectGrid(grid: Grid) {
        this.grid = grid;
        this.dataSource.addEventListener(this);
    }

    public autoResizeColumns() {
        this.grid.autoResizeColumns();
    }

    /**
     * @internal
     * current Gridconfig, so not use this for saving
     * @returns
     */
    public __getGridConfig() {
        return this.gridConfig;
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
        config.__attributes = null;

        config.exspandedGroups = this.getDatasource().getExpanded();
        config.sorting = this.getDatasource().getLastSorting();
        config.grouping = this.getDatasource().getGrouping();
        config.filter = this.getDatasource().getFilter();

        return config;
    }

    public openFilterEditor() {
        if (this.grid) {
            this.grid.openFilterEditor();
        }
    }

    public __setSelectedColumn(number: number, add = false) {
        if (!add) {
            this.columnsSelected.clear();
        }
        if (this.__isColumnSelected(number)) {
            this.columnsSelected.delete(number);
        } else {
            this.columnsSelected.add(number);
        }

        this.grid.rebuildHeaderColumns();
    }

    public __isColumnSelected(number: number) {
        return this.columnsSelected.has(number);
    }

    public __selectedColumns() {
        return this.columnsSelected.size;
    }

    /**
     * when you need load grid config
     */
    public loadConfig(gridConfig: GridConfig, skipRebuild = false) {
        this.suppressEvents = true;

        const sortOrder = gridConfig.sorting;
        const grouping = gridConfig.grouping;
        const filter = gridConfig.filter;
        const exspandedGroups = gridConfig.exspandedGroups;

        this.gridConfig = JSON.parse(JSON.stringify(gridConfig));
        this.gridConfig.sorting = null;
        this.gridConfig.grouping = null;
        this.gridConfig.filter = null;
        this.gridConfig.exspandedGroups = null;

        this.parseConfig();
        if (filter) {
            this.getDatasource().setFilter(filter as FilterArgument);
        } else {
            this.getDatasource().setFilter(null);
        }
        this.getDatasource().filter();

        if (sortOrder?.length && !grouping?.length) {
            this.getDatasource().sort(sortOrder);
        }

        if (grouping?.length) {
            this.getDatasource().setExpanded(exspandedGroups);
            this.getDatasource().group(grouping);
        } else {
            this.getDatasource().removeGroup();
        }

        this.suppressEvents = false;

        if (!skipRebuild) {
            this.grid.rebuild();
        }
    }

    /**
     * shows filter dialog
     */
    public showFilterDialog() {
        this.grid.openFilterEditor();
    }

    /**
     * gets columns in order
     * by default it filters out selected columns
     */
    public getAttributeColumns(filterSelectedColumns = true) {
        return this.grid.getAttributeColumns(filterSelectedColumns);
    }

    public getOptionalAttributes() {
        const attributes = new Set(Object.keys(this.gridConfig.__attributes));
        this.getAttributeColumns(false).forEach((e) => attributes.delete(e));
        return Array.from(attributes);
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
     * do not use - used by grid to disconnect
     * @returns
     */
    public __disconnectGrid() {
        this.dataSource.removeEventListener(this);
        this.grid = null;
    }

    /**
     * @internal
     * if its connected to grid or not
     * @returns
     */
    public __isConnected(): boolean {
        return this.grid ? true : false;
    }

    /**
     * @internal
     * will update scroll tops/heights
     */
    public __dataSourceUpdated() {
        this.parseConfig();
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
            this.grid.updateVerticalScrollHeight(this.scrollHeight);
        }
    }

    /**
     * @internal
     * scroll state have all row height and top values
     * this is used during a scroll event to move rows into right height
     * @returns
     */
    public __getScrollState() {
        return {
            scrollHeight: this.scrollHeight,
            scrollHeights: this.scrollHeights,
            scrollTops: this.scrollTops
        };
    }

    /**
     * this is for enabling readonly based on row data
     * @param callback
     */
    public readonlySetter(callback: (attribute: string, rowData: Entity, cellReadOnlyConfig: boolean) => boolean | null) {
        this.readonlySetterFn = callback;
        this.grid.triggerScrollEvent();
    }

    /**
     * @internal
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
     * do not use - used to handle event from datasource
     * cant use __ since datasource wants it without
     */
    public handleEvent(e: any) {
        if (this.suppressEvents) {
            return true;
        }

        switch (true) {
            case e.type === 'collection-filtered' && e.data?.info === 'filter':
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
                this.grid.triggerScrollEvent();
                break;
            default:
                console.log('skipping:', e.type, e.data);
        }

        return true; // to hold active
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
     * removes listener from datasource
     * @param callable
     */
    public removeEventListener(callable: callable): void {
        if (this.listeners.has(callable)) {
            this.listeners.delete(callable);
        }
    }

    /**
     * @internal
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
