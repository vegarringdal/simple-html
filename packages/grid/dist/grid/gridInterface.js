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
export class GridInterface {
    grid;
    gridConfig;
    dataSource;
    columnsSelected;
    // for variable scroll
    scrollTops;
    scrollHeights;
    scrollHeight;
    /**
     * for skipping events during setting gridconfig
     */
    suppressEvents;
    /**
     * for setting readonly based on row values
     */
    readonlySetterFn;
    /**
     * for adding classes on row lvl
     */
    cellAppendClassSetterFn;
    /**
     * subscribed listerners, gets called when collection changes/is sorted/filtered etc
     */
    listeners = new Set();
    initConfig;
    /**
     *
     * @param gridConfig
     * @param datasource
     */
    constructor(gridConfig, datasource) {
        this.columnsSelected = new Set();
        this.dataSource = datasource;
        this.initConfig = JSON.parse(JSON.stringify(gridConfig));
        if (this.initConfig.autoRemoveContextMenuOnScrollEvent === null ||
            this.initConfig.autoRemoveContextMenuOnScrollEvent === undefined) {
            this.initConfig.autoRemoveContextMenuOnScrollEvent = false;
        }
        this.loadConfig(gridConfig, true);
        this.__dataSourceUpdated();
    }
    /**
     * loads init config, useful when saved/loaded many different configs
     */
    loadInitConfig() {
        this.loadConfig(this.initConfig, false);
    }
    /**
     * in case you need to set new init config, to be used with loadInitConfig()
     * @param gridConfig
     * @param load = false, but can be usedful if you want to update and load it
     */
    updateInitConfig(gridConfig, load = false) {
        this.initConfig = JSON.parse(JSON.stringify(gridConfig));
        if (load) {
            this.loadConfig(this.initConfig, false);
        }
    }
    /**
     * do not use - used by grid to connect
     * @param grid
     */
    connectGrid(grid) {
        this.grid = grid;
        this.dataSource.addEventListener(this);
        this.__callSubscribers('gridConnected', {});
    }
    autoResizeColumns() {
        if (this.grid) {
            autoResizeColumns(this.grid);
        }
    }
    /**
     * contextMenu element can be used to attach own context menus
     * practical since it will be removed if new is open/scroll happens
     * @returns
     */
    getContextMenuElement() {
        return this.grid?.contextMenu;
    }
    /**
     * small helper function to show context menu in same style as the rest
     * @param event
     * @param options
     * @param cell
     * @param callback
     */
    contextMenuCustom(event, options, cell, callback) {
        contextMenuCustom(this.grid, event, cell, callback, options);
    }
    /**
     * contextMenu element can be used to attach own context menus
     * practical since it will be removed if new is open/scroll happens
     * @param el
     */
    setContextMenuElement(el) {
        if (this.grid) {
            this.grid.contextMenu = el;
        }
    }
    /**
     * contextMenu element can be used to attach own context menus
     * practical since it will be removed if new is open/scroll happens
     */
    removeContextMenuElement() {
        removeContextMenu(this.grid);
    }
    /**
     * this will force scroll event and update cells
     * usefull if you have done any manual edits to datasource data and want grid updated
     */
    triggerScrollEvent() {
        if (this.grid) {
            triggerScrollEvent(this.grid);
        }
    }
    /**
     * when you need to save a copy
     */
    saveConfig() {
        const config = JSON.parse(JSON.stringify(this.gridConfig));
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
    openFilterEditor() {
        if (this.grid) {
            openFilterEditor(this.grid);
        }
    }
    /**
     * when you need load grid config
     */
    loadConfig(gridConfig, skipRebuild = false) {
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
            this.getDatasource().setFilter(filter);
        }
        else {
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
        }
        else {
            this.getDatasource().removeGroup();
            if (sortOrder?.length && !grouping?.length) {
                this.getDatasource().sort(sortOrder);
            }
        }
        this.suppressEvents = false;
        if (!skipRebuild) {
            if (this.grid) {
                this.grid.rebuild();
            }
            else {
                this.__dataSourceUpdated();
            }
        }
        else {
            this.__dataSourceUpdated();
        }
    }
    /**
     * gets columns in order
     * by default it filters out selected columns only
     * @param filterSelectedColumns = true by default
     */
    getAttributeColumns(filterSelectedColumns = true) {
        return getAttributeColumns(this.grid, filterSelectedColumns);
    }
    getOptionalAttributes() {
        const attributes = new Set(Object.keys(this.gridConfig.__attributes));
        this.getAttributeColumns(false).forEach((e) => {
            attributes.delete(e);
        });
        return Array.from(attributes);
    }
    /**
     * trigger rebuild of all
     */
    triggerRebuild() {
        this.grid?.rebuild();
    }
    /**
     * adds event listener, useful when you need to do stuff based on
     * @param callable
     */
    addEventListener(callable) {
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
    readonlySetter(callback) {
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
    cellAppendClassSetter(callback) {
        this.cellAppendClassSetterFn = callback;
        if (this.grid) {
            triggerScrollEvent(this.grid);
        }
    }
    /**
     * removes listener from datasource
     * @param callable
     */
    removeEventListener(callable) {
        if (this.listeners.has(callable)) {
            this.listeners.delete(callable);
        }
    }
    /**
     * current datasource
     * @returns
     */
    getDatasource() {
        return this.dataSource;
    }
    /**
     * @internal
     * @private
     */
    __parseConfig() {
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
        if (this.gridConfig.placeHolderRowCurrentEnityOnly === null ||
            this.gridConfig.placeHolderRowCurrentEnityOnly === undefined) {
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
        this.gridConfig.__selectSizeWidth = Math.floor(getTextWidth(this.grid, this.dataSource.getRows().length.toString()) || 10);
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
    __getGridConfig() {
        return this.gridConfig;
    }
    /**
     * @internal
     * @private
     */
    __disconnectGrid() {
        this.dataSource.removeEventListener(this);
        this.grid = null;
    }
    /**
     * @internal
     * @private
     */
    __setSelectedColumn(number, add = false) {
        if (!add) {
            this.columnsSelected.clear();
        }
        if (this.__isColumnSelected(number)) {
            this.columnsSelected.delete(number);
        }
        else {
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
    __isColumnSelected(number) {
        return this.columnsSelected.has(number);
    }
    /**
     * @internal
     * @private
     */
    __selectedColumns() {
        return this.columnsSelected.size;
    }
    /**
     * @internal
     * @private
     */
    __isConnected() {
        return !!this.grid;
    }
    /**
     * @internal
     * @private
     */
    __dataSourceUpdated() {
        this.__parseConfig();
        this.scrollTops = [];
        this.scrollHeights = [];
        this.scrollHeight = 0;
        // lets make a index if datasource is > 1000k, and store top for each k
        const cell = this.gridConfig.cellHeight;
        const row = this.gridConfig.__rowHeight;
        let count = 0;
        this.dataSource.getRows().forEach((ent) => {
            const height = ent.__group ? cell : row;
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
    __getScrollState() {
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
    __callReadonlySetter(attribute, rowData, cellReadOnlyConfig) {
        if (this.readonlySetterFn) {
            return this.readonlySetterFn(attribute, rowData, cellReadOnlyConfig);
        }
        else {
            return null;
        }
    }
    /**
     * @internal
     * @private
     * called by grid calss
     */
    __callCellAppendClass(attribute, rowData, cellReadOnlyConfig) {
        if (this.cellAppendClassSetterFn) {
            return this.cellAppendClassSetterFn(attribute, rowData, cellReadOnlyConfig);
        }
        else {
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
    handleEvent(e) {
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
            case e.type === 'select': {
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
            }
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
    __callSubscribers(event, data = {}) {
        const keeping = [];
        this.listeners.forEach((callable) => {
            let keep;
            if (typeof callable === 'function') {
                keep = callable({ type: event, data: data });
            }
            else {
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
//# sourceMappingURL=gridInterface.js.map