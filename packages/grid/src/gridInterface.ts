import { SimpleHtmlGrid } from '.';
import { IGroupingObj, IGridConfig, IEntity, ICell } from './interfaces';
import { ArrayUtils } from './arrayUtils';
import { Selection } from './selection';
import { DataSource } from './dataSource';

export class GridInterface {
    /**
     * Have all the data
     **/
    private __DATASOURCE: DataSource;

    /**
     * filtered data only
     **/
    private __DATASET_FILTERED: IEntity[] = [];

    /**
     * displayed dataset, with grouping etc
     **/
    private __DATASET_VIEW: IEntity[] = [];

    /**
     * utils for sorting/filter/grouping data
     **/
    private __arrayUtils: ArrayUtils;

    /**
     * keep track of selected rows
     **/
    private __selection: Selection;

    /**
     * connected grid
     **/
    private __SimpleHtmlGrid: SimpleHtmlGrid;

    /**
     * for subscribing event (current entity etc)
     **/
    private __subscribers: Function[] = [];

    currentEntity: IEntity = null;
    private __SCROLL_TOPS: any[];
    private __SCROLL_HEIGHTS: any[];
    private __SCROLL_HEIGHT: number;

    constructor(private __CONFIG: IGridConfig, datasource?: DataSource) {
        if (!datasource) {
            this.__DATASOURCE = new DataSource();
        } else {
            this.__DATASOURCE = datasource;
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

        this.__arrayUtils = new ArrayUtils(this);
        this.__selection = new Selection(this);
        if (this.__CONFIG.sortingSet) {
            this.__arrayUtils.setOrderBy(this.__CONFIG.sortingSet);
        }
        if (this.__CONFIG.groupingSet) {
            this.__arrayUtils.setGrouping(this.__CONFIG.groupingSet);
        }
        if (this.__CONFIG.groupingExpanded) {
            this.__arrayUtils.setExpanded(this.__CONFIG.groupingExpanded);
        }
    }

    manualConfigChange() {
        if (this.config) {
            if (this.config.sortingSet) {
                this.__arrayUtils.setOrderBy(this.config.sortingSet);
            }
            if (this.config.groupingSet) {
                this.__arrayUtils.setGrouping(this.config.groupingSet);
            }
            if (this.config.groupingExpanded) {
                this.__arrayUtils.setExpanded(this.config.groupingExpanded);
            }

            const result = this.__arrayUtils.orderBy(this.filteredDataset, null, false);
            this.__arrayUtils.arraySort.SetConfigSort(this.config.groups.flatMap((x) => x.rows));
            this.displayedDataset = result.fixed;
        }
        this.__SimpleHtmlGrid.resetRowCache();
        this.reRender();
    }

    setData(data: any[], add = false, reRunFilter = false) {
        const olddataSetlength = this.completeDataset.length;

        if (add) {
            const x = this.__DATASOURCE.setData(data, add);
            if (x) {
                this.__DATASET_FILTERED.push(...x);
            }
        } else {
            this.__DATASOURCE.setData(data, add);
            this.__DATASET_FILTERED = this.completeDataset.slice();
        }

        if (this.__SimpleHtmlGrid && olddataSetlength !== this.completeDataset.length) {
            const node = this.__SimpleHtmlGrid.getElementsByTagName('simple-html-grid-body')[0];
            if (node) {
                node.scrollTop = 0;
            }
        }

        this.dataSourceUpdated(reRunFilter);
    }

    reloadDatasource() {
        if (this.__SimpleHtmlGrid) {
            const node = this.__SimpleHtmlGrid.getElementsByTagName('simple-html-grid-body')[0];
            if (node) {
                node.scrollTop = 0;
            }
        }

        this.__arrayUtils.reRunFilter();
        this.dataSourceUpdated();
    }

    dataSourceUpdated(reRunFilter = false) {
        if (reRunFilter) {
            this.__arrayUtils.reRunFilter();
        }

        if (this.config.sortingSet) {
            this.__arrayUtils.setOrderBy(this.config.sortingSet);
        }
        if (this.config.groupingSet) {
            this.__arrayUtils.setGrouping(this.config.groupingSet);
        }

        const result = this.__arrayUtils.orderBy(this.filteredDataset, null, false);
        this.__arrayUtils.arraySort.SetConfigSort(this.config.groups.flatMap((x) => x.rows));
        this.displayedDataset = result.fixed;
        this.publishEvent('collection-change');
    }

    get config() {
        return this.__CONFIG;
    }

    set config(config: IGridConfig) {
        this.__CONFIG = config;
    }

    get completeDataset() {
        return this.__DATASOURCE.DATA_SET;
    }

    set filteredDataset(value) {
        this.__DATASET_FILTERED = value;
    }
    get filteredDataset() {
        return this.__DATASET_FILTERED;
    }

    get getScrollVars() {
        return {
            __SCROLL_HEIGHT: this.__SCROLL_HEIGHT,
            __SCROLL_HEIGHTS: this.__SCROLL_HEIGHTS,
            __SCROLL_TOPS: this.__SCROLL_TOPS
        };
    }

    set displayedDataset(value) {
        this.__DATASET_VIEW = value;
        this.__SCROLL_TOPS = [];
        this.__SCROLL_HEIGHTS = [];
        this.__SCROLL_HEIGHT = 0;
        const cell = this.config.cellHeight;
        const row = this.config.__rowHeight;
        let count = 0;
        this.__DATASET_VIEW.forEach((ent) => {
            const height = ent.__group ? cell : row;

            this.__SCROLL_TOPS.push(count);
            this.__SCROLL_HEIGHTS.push(height);
            count = count + height;
        });
        this.__SCROLL_HEIGHT = count;
    }

    get displayedDataset() {
        return this.__DATASET_VIEW;
    }

    get selection() {
        return this.__selection;
    }

    public __selectInternal(row: number) {
        this.currentEntity = this.displayedDataset[row];
        //console.log('new current entity:', this.currentEntity)
    }

    public select(row: number) {
        this.selection.highlightRow({} as any, row - 1);
    }

    public next() {
        let row = this.displayedDataset.indexOf(this.currentEntity) + 1;
        if (this.displayedDataset.length - 1 < row) {
            row = 0;
        }
        this.selection.highlightRow({} as any, row);
    }

    public prev() {
        let row = this.displayedDataset.indexOf(this.currentEntity) - 1;
        if (row < 0) {
            row = this.displayedDataset.length - 1;
            this.selection.highlightRow({} as any, row);
        }
        this.selection.highlightRow({} as any, row);
    }

    public first() {
        this.selection.highlightRow({} as any, 0);
    }

    public last() {
        this.selection.highlightRow({} as any, this.displayedDataset.length - 1);
    }

    public edited() {
        return this.completeDataset.filter((entity) => {
            if (entity.__controller.__edited) {
                return true;
            } else {
                return false;
            }
        });
    }

    publishEvent(event: string) {
        if (
            event === 'collecton-filter' ||
            event === 'collection-change' ||
            event === 'collecton-grouping'
        ) {
            // changes that make collection change needs rowcache to be updated
            this.__SimpleHtmlGrid && this.__SimpleHtmlGrid.resetRowCache();
        }

        this.reRender();
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

    groupingCallback(event: any, col: ICell) {
        this.__arrayUtils.groupingCallbackBinded(event, col);
    }

    filterCallback(event: any, col: ICell) {
        this.__arrayUtils.filterCallbackBinded(event, col, this.__CONFIG);
    }

    sortCallback(event: any, col: ICell) {
        this.__arrayUtils.sortCallbackBinded(event, col);
    }

    removeGroup(group: IGroupingObj) {
        this.__arrayUtils.removeGroupBinded(group);
    }

    groupExpand(id: string) {
        this.__arrayUtils.groupExpand(id);
    }

    groupCollapse(id: string) {
        this.__arrayUtils.groupCollapse(id);
    }

    connectGrid(SimpleHtmlGrid: SimpleHtmlGrid) {
        this.__SimpleHtmlGrid = SimpleHtmlGrid;
    }

    disconnectGrid() {
        this.__SimpleHtmlGrid = null;
    }
}
