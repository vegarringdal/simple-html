import { SimpleHtmlGrid, IGridConfig } from '.';
import {
    GroupArgument,
    GridConfig,
    CellConfig,
    FilterArgument,
    GridGroupConfig,
    GridCallbacks
} from './types';
import { Datasource, DataContainer, Entity } from '@simple-html/datasource';
import { SortArgument } from '@simple-html/datasource';

/**
 * Grid nterface is just connection between datasource/config to the grid.
 */
export class GridInterface {
    /**
     * Have all the data
     **/
    private __ds: Datasource;

    /**
     * connected grid
     **/
    private __SimpleHtmlGrid: SimpleHtmlGrid;

    /**
     * for subscribing event (current entity etc)
     **/
    private __subscribers: Function[] = [];

    private __SCROLL_TOPS: number[];
    private __SCROLL_HEIGHTS: number[];
    private __SCROLL_HEIGHT: number;
    private __handleEvent: any = null;
    private __CONFIG: GridConfig;
    gridCallbacks: GridCallbacks;
    private __configDefault: GridConfig;

    constructor(
        config: GridConfig,
        datasource?: Datasource | DataContainer,
        gridCallbacks: GridCallbacks = {}
    ) {
        if (!datasource) {
            this.__ds = new Datasource();
        } else {
            if (datasource.type === 'Datasource') {
                this.__ds = datasource as Datasource;
            }
            if (datasource.type === 'DataContainer') {
                this.__ds = new Datasource(datasource as DataContainer);
            }
        }

        this.gridCallbacks = gridCallbacks;
        this.__configDefault = JSON.parse(JSON.stringify(config));
        this.__CONFIG = config;
        this.parseConfig();
    }

    /**
     * for setting callback funtions
     * so config does not contain anything that cant live in JSON
     */
    setCallback(gridCallbacks: GridCallbacks) {
        this.gridCallbacks = gridCallbacks;
    }

    /**
     * datasource dataContainer data
     */
    get completeDataset() {
        return this.__ds.getAllData();
    }

    /**
     * filtered data- no groups here, just pure data
     */
    get filteredDataset() {
        return this.__ds.getRows(true);
    }

    /**
     * this is the rows the grid is displaying
     */
    get displayedDataset() {
        return this.__ds.getRows();
    }

    /**
     * returns current datasource
     */
    public getDatasource() {
        return this.__ds;
    }

    /**
     * event handler for the grid
     * Internal useage only
     * @param _event string
     */
    handleEvent(_event: { type: string; data: any }) {
        if (_event.type === 'currentEntity') {
            return true;
        }

        if (_event.type === 'selectionChange') {
            this.__SimpleHtmlGrid.triggerEvent('selection');
            return true;
        }

        // update config sorting sets
        this.config.groupingSet = this.__ds.getGrouping();
        this.config.groupingExpanded = this.__ds.getExpanded();
        this.config.sortingSet = this.__ds.getOrderBy();

        if (this.__handleEvent === null) {
            this.__SimpleHtmlGrid && this.__SimpleHtmlGrid.resetRowCache();

            // only trigger once..
            this.__handleEvent = 1;
            Promise.resolve().then(() => {
                this.dataSourceUpdated();
                this.__SimpleHtmlGrid && this.reRender();
                this.__handleEvent = null;
            });
        }

        return true;
    }

    /**
     * runs thouh config and sets some internals needed when creating grid or changing the config
     */
    private parseConfig() {
        // set groupheight
        let cellheight = 1;
        this.__CONFIG.groups.forEach((group) => {
            if (group.rows) {
                group.rows.forEach((_c, i) => {
                    if (cellheight < i + 1) {
                        cellheight = i + 1;
                    }
                });
            }
        });
        this.__CONFIG.__cellRows = cellheight;
        this.__CONFIG.__rowHeight = this.__CONFIG.cellHeight * cellheight;

        //set left on groups
        let totalWidth = 0;
        this.config.groups.reduce((agg, element) => {
            element.__left = agg;
            totalWidth = totalWidth + element.width;
            return element.__left + element.width;
        }, 0);
        this.__CONFIG.__rowWidth = totalWidth;

        if (this.__CONFIG) {
            if (this.__CONFIG.sortingSet) {
                this.__ds.setOrderBy(this.__CONFIG.sortingSet);
            }
            if (this.__CONFIG.groupingSet) {
                this.__ds.setGrouping(this.__CONFIG.groupingSet);
            }
            if (this.__CONFIG.groupingExpanded) {
                this.__ds.setExpanded(this.__CONFIG.groupingExpanded);
            }
        }
    }

    // save current settings
    saveSettings() {
        return JSON.parse(JSON.stringify(this.config));
    }

    // load custom setup
    loadSettings(config: IGridConfig) {
        this.manualConfigChange(config);
    }

    // set back default user had when grid loaded
    useInitSettings() {
        this.manualConfigChange(JSON.parse(JSON.stringify(this.__configDefault)));
    }

    /**
     * if you have manually edits config and need to update you will need to run this
     * grid also uses this for some internal use
     */
    manualConfigChange(config?: IGridConfig) {
        if (config) {
            this.__CONFIG = config;
        }
        this.parseConfig();
        this.__updateSortConfig();
        this.__ds.reloadDatasource();
        this.dataSourceUpdated();
        this.__SimpleHtmlGrid && this.__SimpleHtmlGrid.manualConfigChange();
        this.__handleEvent = null;
    }

    /**
     * add or replace data, this also edits the underlaying datasource/container
     * with other words repplacing data also replace data in underlaying datasource and container
     */
    setData(data: any[], add = false, reRunFilter = false) {
        this.__ds.setData(data, add, reRunFilter);

        this.dataSourceUpdated();
    }

    /**
     * Reloads newest data from datasource
     * Internal usage only, do not call
     */
    reloadDatasource() {
        this.__ds.reloadDatasource();
        this.dataSourceUpdated();
    }

    /**
     * update vaiable row values according to datasource
     * Internal usage only, do not call
     */
    dataSourceUpdated() {
        this.__SCROLL_TOPS = [];
        this.__SCROLL_HEIGHTS = [];
        this.__SCROLL_HEIGHT = 0;
        const cell = this.config.cellHeight;
        const row = this.config.__rowHeight;
        let count = 0;
        this.displayedDataset.forEach((ent: Entity) => {
            const height = ent.__group ? cell : row;

            this.__SCROLL_TOPS.push(count);
            this.__SCROLL_HEIGHTS.push(height);
            count = count + height;
        });
        this.__SCROLL_HEIGHT = count;
    }

    /**
     * returns config
     * Internal usage only, do not call
     */
    public get config() {
        return this.__CONFIG;
    }

    /**
     * set new config
     * Internal usage only, do not call
     */
    public set config(config: GridConfig) {
        this.__CONFIG = config;
    }

    /**
     * return scollvars used for controlling variable scrollheight
     * Internal usage only, do not call
     */
    public get getScrollVars() {
        return {
            __SCROLL_HEIGHT: this.__SCROLL_HEIGHT,
            __SCROLL_HEIGHTS: this.__SCROLL_HEIGHTS,
            __SCROLL_TOPS: this.__SCROLL_TOPS
        };
    }

    /**
     * selects row
     * Internal usage only, do not call
     */
    public select(row: number) {
        this.__ds.select(row);
    }

    /**
     * returns edited rows
     * Internal usage only, do not call
     */
    public edited() {
        return this.__ds.getAllData().filter((entity: Entity) => {
            if (entity.__controller.__edited) {
                return true;
            } else {
                return false;
            }
        });
    }

    /**
     * publish events
     * Internal usage only, do not call
     */
    publishEvent(event: string) {
        const keep = this.__subscribers.filter((element) => {
            return element(event);
        });
        this.__subscribers = keep;
    }

    /**
     * add events listener
     * Internal usage only, do not call
     */
    addEventListener(callable: (event: string) => boolean) {
        this.__subscribers.push(callable);
    }

    /**
     * calls grid element reRender funtion
     * Internal usage only, do not call
     */
    reRender() {
        if (this.__SimpleHtmlGrid) this.__SimpleHtmlGrid.reRender();
    }

    /**
     * calls grid element render funtion
     * Internal usage only, do not call
     */
    render() {
        if (this.__SimpleHtmlGrid) this.__SimpleHtmlGrid.render();
    }

    /**
     * groups columns
     * Internal usage only, do not call
     */
    groupingCallback(_event: any, col: CellConfig, beforeGroup: string) {
        let newGrouping = col ? true : false;
        const groupings = this.__ds.getGrouping();
        let beforeGroupIndex: number = null;

        col &&
            groupings.forEach((g: GroupArgument, i: number) => {
                if (g.attribute === col.attribute) {
                    newGrouping = false;
                }
                if (beforeGroup) {
                    if (g.attribute === beforeGroup) {
                        beforeGroupIndex = i;
                    }
                }
            });

        if (newGrouping) {
            if (beforeGroup) {
                groupings.splice(beforeGroupIndex, 0, {
                    title: col.header,
                    attribute: col.attribute
                });
            } else {
                groupings.push({ title: col.header, attribute: col.attribute });
            }
        }

        if (!newGrouping && beforeGroup && col) {
            // we want to move before
            let removeIndex = null;

            groupings.forEach((g: GroupArgument, i: number) => {
                if (g.attribute === beforeGroup) {
                    beforeGroupIndex = i;
                }
            });
            groupings.forEach((g: GroupArgument, i: number) => {
                if (col.attribute === g.attribute) {
                    removeIndex = i;
                }
            });
            const moveGrouping = groupings.splice(removeIndex, 1);
            if (moveGrouping.length) {
                groupings.splice(beforeGroupIndex, 0, moveGrouping[0]);
            }
        }

        if (!newGrouping && !beforeGroup && col) {
            // we want to move to end
            let removeIndex = null;
            groupings.forEach((g: GroupArgument, i: number) => {
                if (col.attribute === g.attribute) {
                    removeIndex = i;
                }
            });

            const moveGrouping = groupings.splice(removeIndex, 1);
            groupings.push(moveGrouping[0]);
        }

        this.clearConfigSort(this.config.groups.flatMap((x) => x.rows));
        this.__ds.sortReset();
        groupings.forEach((group: GroupArgument) => {
            this.__ds.setOrderBy({ attribute: group.attribute, ascending: true }, true);
        });

        this.__updateSortConfig();

        /* this.config.groupingSet = this.__ds.getGrouping();
        this.config.groupingExpanded = this.__ds.getExpanded(); */
        this.__ds.group(groupings);
    }

    /**
     * filters columns
     * Internal usage only, do not call
     */
    filterCallback(event: any, col: CellConfig) {
        switch (col.type) {
            case 'date':
                col.filterable.currentValue = new Date(event.target.valueAsDate);
                break;
            case 'number':
                col.filterable.currentValue = event.target.valueAsNumber;
                break;
            case 'boolean':
                col.filterable.currentValue = event.target.indeterminate
                    ? null
                    : event.target.checked;
                break;
            default:
                col.filterable.currentValue = event.target.value;
        }

        const filter: FilterArgument = {
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: []
        };

        const columns = this.config.groups.flatMap((x) => x.rows);
        columns.forEach((col) => {
            const f = col.filterable;
            if (
                f &&
                f.currentValue !== null &&
                f.currentValue !== undefined &&
                f.currentValue !== ''
            ) {
                filter.filterArguments.push({
                    type: 'CONDITION',
                    logicalOperator: 'NONE',
                    valueType: 'VALUE',
                    attribute: col.attribute,
                    attributeType: (col.type as any) || 'text',
                    operator: f.operator || this.__ds.getFilterFromType(col.type),
                    value: f.currentValue as any
                });
            }
        });
        this.__ds.filter(filter);
    }

    /**
     * clears sorting order of config columns
     * Internal usage only, do not call
     */
    public clearConfigSort(configColumns: CellConfig[]) {
        configColumns.forEach((col) => {
            if (col.sortable) {
                col.sortable.sortAscending = null;
                col.sortable.sortNo = null;
            }
        });
    }

    /**
     * updates config sort, so grid displays correctly
     * Internal usage only, do not call
     */
    private __updateSortConfig() {
        const columns = this.config.groups.flatMap((x: GridGroupConfig) => x.rows);
        const attributes = this.__ds.getOrderBy().flatMap((x: SortArgument) => x.attribute);
        const sorting = this.__ds.getOrderBy();
        columns.forEach((col) => {
            const index = attributes.indexOf(col.attribute);
            if (index !== -1) {
                if (!col.sortable) {
                    col.sortable = {};
                }
                col.sortable.sortAscending = sorting[index].ascending;
                col.sortable.sortNo = index + 1;
            } else {
                if (col.sortable) {
                    col.sortable.sortAscending;
                    col.sortable.sortNo = null;
                }
            }
        });
    }

    /**
     * sorts the grid
     * Internal usage only, do not call
     */
    public sortCallback(event: MouseEvent, col: CellConfig) {
        // get data we need
        let sorting = this.__ds.getOrderBy();
        const attribute = col.attribute;
        const ascending = col.sortable?.sortAscending;
        const add = event.shiftKey;

        // clear config sort
        this.clearConfigSort(this.config.groups.flatMap((x) => x.rows));

        if (add) {
            let exist = false;
            sorting.forEach((el: SortArgument) => {
                if (el.attribute === attribute) {
                    exist = true;
                    el.ascending = el.ascending ? false : true;
                }
            });
            if (!exist) {
                sorting.push({ attribute, ascending: true });
            } else {
                col.sortable.sortAscending = true;
                col.sortable.sortNo = sorting.length;
            }
        } else {
            sorting = [{ attribute: attribute, ascending: ascending ? false : true }];
        }

        this.__ds.setOrderBy(sorting);

        this.__ds.sort();

        // this needs to run after sort since it might trigger endit of the sort order
        this.__updateSortConfig();
    }

    /**
     * removes group
     * Internal usage only, do not call
     */
    public removeGroup(group: GroupArgument) {
        this.__ds.removeGroup(group);
    }

    /**
     * expands all/or 1
     * Internal usage only, do not call
     */
    public groupExpand(id: string) {
        this.__ds.expandGroup(id);
    }

    /**
     * collapses all/1
     * Internal usage only, do not call
     */
    public groupCollapse(id: string) {
        this.__ds.collapseGroup(id);
    }

    /**
     * grid connects to datainterface when its ready
     * Internal usage only, do not call
     */
    public connectGrid(SimpleHtmlGrid: SimpleHtmlGrid) {
        this.__SimpleHtmlGrid = SimpleHtmlGrid;
        this.__ds.addEventListner(this);
        this.dataSourceUpdated();
        /* this.reRender(); */
    }

    /**
     * grid element disconnects when diconnectedCallback is called, gridinterfaces disconnects from datsoruce events
     * Internal usage only, do not call
     */
    public disconnectGrid() {
        this.__SimpleHtmlGrid = null;
        this.__ds.removeEventListner(this);
    }

    /**
     * returns ds current filter
     * Internal usage only, do not call
     */
    public getCurrentFilter() {
        return this.__ds.getFilter();
    }

    /**
     * set new current filter
     * Internal usage only, do not call
     */
    public setCurrentFilter(filter: FilterArgument) {
        this.__ds.setFilter(filter);
    }

    /**
     * reruns current filter
     * Internal usage only, do not call
     */
    public reRunFilter() {
        this.__ds.filter();
    }

    /**
     * returns true if row is selected
     * Internal usage only, do not call
     */
    public isSelected(row: number) {
        return this.__ds.getSelection().isSelected(row);
    }

    /**
     * highlights/selects row
     * Internal usage only, do not call
     */
    public highlightRow(e: MouseEvent, currentRow: number) {
        this.__ds.getSelection().highlightRow(e, currentRow);
    }

    /**
     * returns selected rows
     * Internal usage only, do not call
     */
    public getSelectedRows() {
        return this.__ds.getSelection().getSelectedRows();
    }

    /**
     * Set all columns readonly state, if cell config have readonly this will still be readonly
     * @param newValue default = true
     */
    public setReadOnlyState(newValue = true) {
        return (this.__CONFIG.readonly = newValue);
    }

    /**
     * resets scroll
     * @param value default = 0
     */
    public setScroll(value = 0) {
        if (this.__SimpleHtmlGrid) {
            const node = this.__SimpleHtmlGrid.getElementsByTagName('simple-html-grid-body')[0];

            if (node) {
                node.scrollTop = value;
            }
        }
    }

    /**
     * get filter string
     */
    public getFilterString() {
        return this.getDatasource().getFilterString();
    }
}
