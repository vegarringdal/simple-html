import { SimpleHtmlGrid } from '.';
import { GroupArgument, IGridConfig, ICell, FilterArgument } from './interfaces';
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

    constructor(private __CONFIG: IGridConfig, datasource?: Datasource | DataContainer) {
        if (!datasource) {
            this.__ds = new Datasource();
        } else {
            if (datasource instanceof Datasource) {
                this.__ds = datasource;
            }
            if (datasource instanceof DataContainer) {
                this.__ds = new Datasource(datasource);
            }
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

            /*   this.__ds.sort(this.filteredDataset, false);
            this.__ds.setOrderBy(this.config.groups.flatMap((x) => x.rows));
            this.displayedDataset = this.__ds.getRows(); */
            console.log('code skipped');
        }
        this.__SimpleHtmlGrid.resetRowCache();
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

    /* get selection() {
        return this.__ds.getSelection();
    } */

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
        this.publishEvent('collection-change');
    }

    get config() {
        return this.__CONFIG;
    }

    set config(config: IGridConfig) {
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
        console.log('click');
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
        if (
            event === 'collecton-filter' ||
            event === 'collection-change' ||
            event === 'collecton-grouping' ||
            event === 'collecton-sort'
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
        console.error('not implemeted:setCurrentFilter', event, col);
        //this.__arrayUtils.groupingCallback(event, col);
    }

    filterCallback(event: any, col: ICell) {
        console.error('not implemeted:setCurrentFilter', event, col);
        //this.__arrayUtils.filterCallback(event, col, this.__CONFIG);
    }

    sortCallback(event: any, col: ICell) {
        console.error('not implemeted:setCurrentFilter', event, col);
        //this.__arrayUtils.sortCallback(event, col);
    }

    removeGroup(group: GroupArgument) {
        console.error('not implemeted:setCurrentFilter', group);
        // this.__arrayUtils.removeGroup(group);
    }

    groupExpand(id: string) {
        console.error('not implemeted:setCurrentFilter', id);
        //  this.__arrayUtils.groupExpand(id);
    }

    groupCollapse(id: string) {
        console.error('not implemeted:setCurrentFilter', id);
        //this.__arrayUtils.groupCollapse(id);
    }

    connectGrid(SimpleHtmlGrid: SimpleHtmlGrid) {
        this.__SimpleHtmlGrid = SimpleHtmlGrid;
    }

    disconnectGrid() {
        this.__SimpleHtmlGrid = null;
    }

    getCurrentFilter() {
        return this.__ds.getFilter();
    }
    setCurrentFilter(_filter: FilterArgument) {
        console.error('not implemeted:setCurrentFilter');
        // this.__arrayUtils.arrayFilter.setLastFilter(filter);
    }

    reRunFilter() {
        console.error('not implemeted:reRunFilter');
        //this.__arrayUtils.reRunFilter();
    }

    /**
     * new added
     */

    isSelected(row: number) {
        return this.__ds.getSelection().isSelected(row);
    }

    highlightRow(e: MouseEvent, currentRow: number) {
        this.__ds.getSelection().highlightRow(e, currentRow);
    }

    getSelectedRows() {
        return this.__ds.getSelection().getSelectedRows();
    }
}
