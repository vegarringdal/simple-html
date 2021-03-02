import { SimpleHtmlGrid, IGridConfig } from '.';
import {
    GroupArgument,
    GridConfig,
    CellConfig,
    FilterArgument,
    GridGroupConfig
} from './types';
import { Datasource, DataContainer, Entity } from '@simple-html/datasource';
import { SortArgument } from '@simple-html/datasource';
import { DateFormater, DateFormaterType } from './dateFormater';
import { NumberFormater } from './numberFormater';

type f = (...args: any[]) => void;

/**
 * Grid nterface is just connection between datasource/config to the grid.
 */
export class GridInterface<T = any> {
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
    private __subscribers: f[] = [];

    private __SCROLL_TOPS: number[];
    private __SCROLL_HEIGHTS: number[];
    private __SCROLL_HEIGHT: number;
    private __handleEvent: any = null;
    private __CONFIG: GridConfig;
    private __configDefault: GridConfig;
    dateFormater: DateFormaterType;
    numberFormater: typeof NumberFormater;

    constructor(
        config: GridConfig<T>,
        datasource?: Datasource | DataContainer
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

        this.__configDefault = JSON.parse(JSON.stringify(config));
        this.__CONFIG = config;
        // set default date formater
        this.dateFormater = DateFormater;
        this.numberFormater = NumberFormater;
        this.parseConfig();
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
        return this.__ds as Datasource<T>;
    }

    /**
     * event handler for the grid
     * Internal useage only
     * @param _event string
     */
    handleEvent(_event: { type: string; data: any }) {
        if (_event.type === 'select') {
            this.dataSourceUpdated();
            const node = this.__SimpleHtmlGrid.getElementsByTagName('simple-html-grid-body')[0];
            const height = node?.clientHeight;
            const scroll = node?.scrollTop;
            const row = this.getSelectedRows()[0];
            const rowTop = this.__SCROLL_TOPS[row];

            let trigger = false;
            let scrollto = 0;
            if (scroll > rowTop) {
                trigger = true;
                scrollto = rowTop - height / 2;
            }

            if (scroll + height <= rowTop) {
                trigger = true;
                scrollto = rowTop;
            }

            if (trigger) {
                setTimeout(() => {
                    // needs to trigger after so dom is updted first
                    this.setScroll(scrollto);
                });
            }

            return true;
        }

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
            this.parseConfigWidth();
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

    public getMainElement() {
        return this.__SimpleHtmlGrid;
    }

    /**
     * runs thouh config and sets some internals needed when creating grid or changing the config
     */
    private parseConfig() {
        // set groupheight
        let cellheight = 1;
        this.__CONFIG.groups = this.__CONFIG.groups.filter((a) => a);
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
        this.parseConfigWidth();

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
            if (this.__CONFIG.filterSet) {
                this.__ds.setFilter(this.__CONFIG.filterSet);
                this.__CONFIG.filterSet = null; // only once..
            }

            let dates: string[] = [];
            this.__CONFIG.groups?.forEach((group) => {
                group.rows?.forEach((r) => {
                    if (r.type === 'date') {
                        dates.push(r.attribute);
                    }
                });
            });
            this.__ds.setDates(dates);
        }
    }

    parseConfigWidth() {
        let totalWidth = 0;
        this.config.groups.reduce((agg, element) => {
            element.__left = agg;
            totalWidth = totalWidth + element.width;
            return element.__left + element.width;
        }, 0);
        this.__CONFIG.__rowWidth = totalWidth;

        const node = this.__SimpleHtmlGrid?.getElementsByTagName('simple-html-grid-body')[0];
        if (this.__CONFIG.__rowWidth < node?.clientWidth && this.__CONFIG.scrollLeft > 0) {
            this.__CONFIG.scrollLeft = node.scrollLeft;
        }
    }

    // save current settings (including filter)
    saveSettings() {
        this.__CONFIG.filterSet = this.__ds.getFilter() || ([] as FilterArgument);
        this.__CONFIG.groupingSet = this.__ds.getGrouping() || ([] as GroupArgument[]);
        this.__CONFIG.groupingExpanded = this.__ds.getExpanded() || ([] as string[]);
        this.__CONFIG.sortingSet = this.__ds.getOrderBy() || ([] as SortArgument[]);
        const settings = JSON.parse(JSON.stringify(this.config));
        this.__CONFIG.filterSet = null;
        return settings;
    }

    /**
     *
     * @param config standard gridconfig
     * @param overrideDefault in case of making the grid dynamicaly you should also set default setup
     */
    loadSettings(config: IGridConfig, overrideDefault = false) {
        if (overrideDefault) {
            this.__configDefault = JSON.parse(JSON.stringify(config));
        }
        this.manualConfigChange(JSON.parse(JSON.stringify(config)));
    }

    // set back default user had when grid loaded, does not do anything with filter
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
        /*         this.__updateSortConfig();
        this.__ds.reloadDatasource(); */
        this.__SimpleHtmlGrid && this.__SimpleHtmlGrid.manualConfigChange();
        this.reRunFilter();
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
        if (this.__SimpleHtmlGrid) this.__SimpleHtmlGrid.reRender();
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
    filterCallback(
        value: string | number | null | undefined,
        col: CellConfig,
        filterArray?: any[],
        filterArrayAndValue?: string,
        notinArray?: boolean
    ) {
        switch (col.type) {
            case 'date':
                if (value === 'null') {
                    col.filterable.currentValue = 'null';
                } else {
                    col.filterable.currentValue = this.dateFormater.toDate(value as string);
                }
                break;
            case 'number':
                if (value === 'null') {
                    col.filterable.currentValue = 'null';
                } else {
                    col.filterable.currentValue = this.numberFormater.fromString(value as string);
                }
                break;
            case 'boolean':
                if (value === null) {
                    col.filterable.currentValue = null;
                }
                if (value === 'false') {
                    col.filterable.currentValue = false;
                }
                if (value === 'true') {
                    col.filterable.currentValue = true;
                }

                break;
            default:
                col.filterable.currentValue = filterArrayAndValue ? filterArrayAndValue : value;
        }

        const oldFilter = this.__ds.getFilter();
        let filter: FilterArgument = {
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: []
        };

        if (oldFilter?.logicalOperator === 'AND') {
            filter = oldFilter;
            filter.filterArguments = filter.filterArguments.filter((arg: FilterArgument) => {
                if (arg.attribute === col.attribute) {
                    return false;
                } else {
                    return true;
                }
            });
        }

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

        if (filterArray) {
            filter.filterArguments.push({
                type: 'CONDITION',
                logicalOperator: 'NONE',
                valueType: 'VALUE',
                attribute: col.attribute,
                attributeType: (col.type as any) || 'text',
                operator: notinArray ? 'NOT_IN' : 'IN',
                value: filterArray as any
            });
        }

        // just add to beginning, duplicates get removed
        if (filterArrayAndValue) {
            filter.filterArguments.unshift({
                type: 'CONDITION',
                logicalOperator: 'NONE',
                valueType: 'VALUE',
                attribute: col.attribute,
                attributeType: (col.type as any) || 'text',
                operator: 'CONTAINS',
                value: filterArrayAndValue
            });
        }

        // remove duplicates
        const attributes: string[] = [];
        filter.filterArguments = filter.filterArguments.filter((arg: FilterArgument) => {
            if (
                attributes.indexOf(arg.attribute) !== -1 &&
                arg.operator !== 'IN' &&
                arg.operator !== 'NOT_IN'
            ) {
                return false;
            } else {
                attributes.push(arg.attribute);
                return true;
            }
        });

        if (filterArray && !filterArrayAndValue) {
            // we need to clear the value so it does not show
            col.filterable.currentValue = '';
        }

        this.__ds.filter(filter);
    }

    public setDateFormater(dateFormater: DateFormaterType) {
        this.dateFormater = dateFormater || dateFormater;
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
        const ascending = col?.sortable?.sortAscending;
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
                sorting.push({
                    attribute,
                    ascending: ascending === false ? false : true
                });
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
        this.__ds.getSelection().highlightRow(e, currentRow, this.config.selectionMode);
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

    /**
     * experimental autoresize columns
     */
    private getTextWidth(text: string) {
        // if given, use cached canvas for better performance
        // else, create new canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = this.getFont();
        const metrics = context.measureText(text);
        return metrics.width;
    }

    /**
     * experimental autoresize columns
     */
    private getFont() {
        const ele = this?.__SimpleHtmlGrid;
        if (ele) {
            return (
                window.getComputedStyle(ele).getPropertyValue('font-size') +
                ' ' +
                window.getComputedStyle(ele).getPropertyValue('font-family')
            );
        } else {
            return '12px Arial';
        }
    }

    /**
     * experimental autoresize columns
     */
    public autoResizeColumns() {
        const attributes = this.config.groups.flatMap((g) => g?.rows);
        let widths: number[] = attributes.map((e) => {
            return e?.header?.length + 4;
        });
        const text: string[] = attributes.map((e) => {
            if (e.type === 'date' && e?.header?.length < 5) {
                return '19.19.2000 A';
            }
            /*   if (e.type === 'number' && e?.header?.length < 5) {
                return 'AA.AA';
            } */
            return e?.header + 'sorter';
        });

        const data = this.__ds.getAllData();
        data.forEach((row: any) => {
            attributes.forEach((att, i) => {
                if (row && typeof row[att.attribute] === 'string') {
                    if (widths[i] < row[att.attribute].length) {
                        widths[i] = row[att.attribute].length;
                        text[i] = row[att.attribute];
                    }
                }
                if (row && typeof row[att.attribute] === 'number') {
                    if (widths[i] < (row[att.attribute] + '').length) {
                        widths[i] = (row[att.attribute] + '').length;
                        text[i] = row[att.attribute];
                    }
                }
            });
        });

        const attributesStrings = attributes.map((e) => e.attribute);

        // set some defaults
        widths = widths.map((e: number) => (e ? e * 8 : 100));
        this.config.groups.forEach((g) => {
            let x = 0;
            g?.rows.forEach((r) => {
                if (x < 750) {
                    const xx = widths[attributesStrings.indexOf(r.attribute)];
                    if (xx > x) {
                        x = this.getTextWidth(text[attributesStrings.indexOf(r.attribute)]) + 15;
                    }
                }
            });
            g.width = x > 750 ? 750 : x;
        });

        this.manualConfigChange(this.config);
    }
}
