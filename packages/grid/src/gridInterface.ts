import { SimpleHtmlGrid } from '.';
import { GroupArgument, GridConfig, CellConfig, FilterArgument } from './interfaces';
import { Datasource, DataContainer } from '@simple-html/datasource';

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

    constructor(private __CONFIG: GridConfig, datasource?: Datasource | DataContainer) {
        if (!datasource) {
            this.__ds = new Datasource();
        } else {
            if (datasource instanceof Datasource) {
                this.__ds = datasource;
            }
            if (datasource instanceof DataContainer) {
                this.__ds = new Datasource(datasource);
            }
            this.__ds.addEventListner(this);
        }

        // set groupheight
        let cellheight = 1;
        __CONFIG.groups.forEach((group) => {
            if (group.rows) {
                group.rows.forEach((_c, i) => {
                    if (cellheight < i + 1) {
                        cellheight = i + 1;
                    }
                });
            }
        });
        __CONFIG.__cellRows = cellheight;
        __CONFIG.__rowHeight = __CONFIG.cellHeight * cellheight;

        //set left on groups
        let totalWidth = 0;
        __CONFIG.groups.reduce((agg, element) => {
            element.__left = agg;
            totalWidth = totalWidth + element.width;
            return element.__left + element.width;
        }, 0);
        __CONFIG.__rowWidth = totalWidth;

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

    handleEvent(event: string) {
        console.log(event, this.displayedDataset.length);
        if (this.__handleEvent === null) {
            // only trigger once..
            this.__handleEvent = 1;
            Promise.resolve().then(() => {
                this.__SimpleHtmlGrid && this.__SimpleHtmlGrid.resetRowCache();
                this.dataSourceUpdated();
                this.__SimpleHtmlGrid && this.reRender();
                this.__handleEvent = null;
            });
        }

        return true;
    }

    manualConfigChange() {
        if (this.config) {
            if (this.config.sortingSet) {
                this.__ds.setOrderBy(this.config.sortingSet);
            }
            if (this.config.groupingSet) {
                this.__ds.setGrouping(this.config.groupingSet);
            }
            if (this.config.groupingExpanded) {
                this.__ds.setExpanded(this.config.groupingExpanded);
            }
        }
        this.__SimpleHtmlGrid.resetRowCache();
        this.__ds.reloadDatasource();
        this.dataSourceUpdated();
        this.reRender();
    }

    get completeDataset() {
        return this.__ds.getAllData();
    }

    get filteredDataset() {
        return this.__ds.getRows(true);
    }

    get displayedDataset() {
        return this.__ds.getRows();
    }

    setData(data: any[], add = false, reRunFilter = false) {
        const olddataSetlength = this.__ds.getAllData().length;

        this.__ds.setData(data, add, reRunFilter);

        if (this.__SimpleHtmlGrid && olddataSetlength !== this.completeDataset.length) {
            const node = this.__SimpleHtmlGrid.getElementsByTagName('simple-html-grid-body')[0];
            if (node) {
                node.scrollTop = 0;
            }
        }

        this.dataSourceUpdated();
    }

    reloadDatasource() {
        if (this.__SimpleHtmlGrid) {
            const node = this.__SimpleHtmlGrid.getElementsByTagName('simple-html-grid-body')[0];
            if (node) {
                node.scrollTop = 0;
            }
        }
        this.__ds.reloadDatasource();
        this.dataSourceUpdated();
    }

    dataSourceUpdated() {
        this.__SCROLL_TOPS = [];
        this.__SCROLL_HEIGHTS = [];
        this.__SCROLL_HEIGHT = 0;
        const cell = this.config.cellHeight;
        const row = this.config.__rowHeight;
        let count = 0;
        this.displayedDataset.forEach((ent) => {
            const height = ent.__group ? cell : row;

            this.__SCROLL_TOPS.push(count);
            this.__SCROLL_HEIGHTS.push(height);
            count = count + height;
        });
        this.__SCROLL_HEIGHT = count;
    }

    get config() {
        return this.__CONFIG;
    }

    set config(config: GridConfig) {
        this.__CONFIG = config;
    }

    get getScrollVars() {
        return {
            __SCROLL_HEIGHT: this.__SCROLL_HEIGHT,
            __SCROLL_HEIGHTS: this.__SCROLL_HEIGHTS,
            __SCROLL_TOPS: this.__SCROLL_TOPS
        };
    }

    public select(row: number) {
        this.__ds.select(row);
    }

    public edited() {
        return this.__ds.getAllData().filter((entity) => {
            if (entity.__controller.__edited) {
                return true;
            } else {
                return false;
            }
        });
    }

    publishEvent(event: string) {
        const keep = this.__subscribers.filter((element) => {
            return element(event);
        });
        this.__subscribers = keep;
    }

    addEventListener(callable: (event: string) => boolean) {
        this.__subscribers.push(callable);
    }

    reRender() {
        if (this.__SimpleHtmlGrid) this.__SimpleHtmlGrid.reRender();
    }

    render() {
        if (this.__SimpleHtmlGrid) this.__SimpleHtmlGrid.render();
    }

    groupingCallback(_event: any, col: CellConfig) {
        let newGrouping = col ? true : false;
        const groupings = this.__ds.getGrouping();
        col &&
            groupings.forEach((g) => {
                if (g.attribute === col.attribute) {
                    newGrouping = false;
                }
            });

        if (newGrouping) {
            groupings.push({ title: col.header, attribute: col.attribute });
        }
        this.clearConfigSort(this.config.groups.flatMap((x) => x.rows));
        this.__ds.sortReset();
        groupings.forEach((group: GroupArgument) => {
            this.__ds.setOrderBy({ attribute: group.attribute, ascending: true }, true);
        });

        const columns = this.config.groups.flatMap((x) => x.rows);
        const attributes = this.__ds.getGrouping().flatMap((x) => x.attribute);
        const sorting = this.__ds.getOrderBy();
        columns.forEach((col) => {
            const index = attributes.indexOf(col.attribute);
            if (index !== -1) {
                if (!col.sortable) {
                    col.sortable = {};
                }
                col.sortable.sortAscending = sorting[index].ascending;
                col.sortable.sortNo = index + 1;
            }
        });

        this.config.groupingSet = this.__ds.getGrouping();
        this.__ds.group(groupings);
    }

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
            if (f && f.currentValue !== null && f.currentValue !== undefined) {
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

    public clearConfigSort(configColumns: CellConfig[]) {
        configColumns.forEach((col) => {
            if (col.sortable) {
                col.sortable.sortAscending = null;
                col.sortable.sortNo = null;
            }
        });
    }

    sortCallback(event: MouseEvent, col: CellConfig) {
        // get data we need
        let sorting = this.__ds.getOrderBy();
        const attribute = col.attribute;
        const ascending = col.sortable?.sortAscending;
        const add = event.shiftKey;

        // clear config sort
        this.clearConfigSort(this.config.groups.flatMap((x) => x.rows));

        if (add) {
            let exist = false;
            sorting.forEach((el) => {
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

        // add to config, grid uses this atm - need to orginize this better, but atm just getting all to work
        const columns = this.config.groups.flatMap((x) => x.rows);
        const attributes = sorting.flatMap((x) => x.attribute);
        columns.forEach((col) => {
            const index = attributes.indexOf(col.attribute);
            if (index !== -1) {
                if (!col.sortable) {
                    col.sortable = {};
                }
                col.sortable.sortAscending = sorting[index].ascending;
                col.sortable.sortNo = index + 1;
            }
        });

        this.__ds.sort(sorting, add);
    }

    removeGroup(group: GroupArgument) {
        debugger;
        this.__ds.removeGroup(group);
    }

    groupExpand(id: string) {
        this.__ds.expandGroup(id);
    }

    groupCollapse(id: string) {
        this.__ds.collapseGroup(id);
    }

    connectGrid(SimpleHtmlGrid: SimpleHtmlGrid) {
        this.__SimpleHtmlGrid = SimpleHtmlGrid;
        this.dataSourceUpdated();
        this.reRender();
    }

    disconnectGrid() {
        this.__SimpleHtmlGrid = null;
    }

    getCurrentFilter() {
        return this.__ds.getFilter();
    }

    setCurrentFilter(filter: FilterArgument) {
        this.__ds.setFilter(filter);
    }

    reRunFilter() {
        this.__ds.filter();
    }

    /**
     * new added
     */

    isSelected(row: number) {
        return this.__ds.getSelection().isSelected(row);
    }

    highlightRow(e: MouseEvent, currentRow: number) {
        this.__ds.getSelection().highlightRow(e, currentRow);
        this.reRender();
    }

    getSelectedRows() {
        return this.__ds.getSelection().getSelectedRows();
    }
}
