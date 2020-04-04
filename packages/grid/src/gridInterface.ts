import { FreeGrid } from '.';
import { IGroupingObj, IGridConfig, IEntity, ICell } from './interfaces';
import { ArrayUtils } from './arrayUtils';
import { Selection } from './selection';
import { EntityHandler } from './entity';

export class GridInterface {
    /**
     * Have all the data
     **/
    private __DATASET_ALL: IEntity[] = [];

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
    private __freeGrid: FreeGrid;

    /**
     * for subscribing event (current entity etc)
     **/
    private __subscribers: Function[] = [];

    currentEntity: IEntity = null;

    constructor(private __CONFIG: IGridConfig) {

        // set groupheight
        let cellheight = 1;
        __CONFIG.groups.forEach(group => {
            if (group.rows) {
                group.rows.forEach((_c, i) => {
                    if (cellheight < i + 1) {
                        cellheight = i + 1;
                    }
                });
            }
        });
        __CONFIG.__cellRows = cellheight;
        __CONFIG.__rowHeight = __CONFIG.cellHeight* cellheight;

        //set left on groups
        let totalWidth = 0;
        __CONFIG.groups.reduce((agg, element) => {
                element.__left = agg;
                totalWidth = totalWidth + element.width
                return element.__left + element.width;
        }, 0);
        __CONFIG.__rowWidth =  totalWidth;
       

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
            this.__arrayUtils.arraySort.SetConfigSort(this.config.groups.flatMap(x=> x.rows));
            this.displayedDataset = result.fixed;
        }
        this.reRender();
    }

    setData(data: any[], add: boolean = false) {
        const olddataSetlength = this.__DATASET_ALL.length;

        if (add) {
            const x = Array.from(data, o => new Proxy(o, new EntityHandler() as any));
            this.__DATASET_ALL.push(...x);
            this.__DATASET_FILTERED.push(...x);
        } else {
            this.__DATASET_ALL = Array.from(data, o => new Proxy(o, new EntityHandler() as any)); // <- do I want to update user array Im allready setting a key on it ?
            this.__DATASET_ALL.forEach((entity, i) => {
                if (entity && !(<any>entity).__KEY) {
                    (<any>entity).__KEY = this.selection.getKey();
                } else {
                    if (!this.__DATASET_ALL[i]) {
                        this.__DATASET_ALL[i] = { __KEY: this.selection.getKey() };
                    }
                }
            });
            this.__DATASET_FILTERED = this.__DATASET_ALL.slice();
            this.__DATASET_VIEW = this.__DATASET_ALL.slice();
        }

        if (this.__freeGrid && olddataSetlength !== this.__DATASET_ALL.length) {
            const node = this.__freeGrid.getElementsByTagName('free-grid-body')[0];
            if (node) {
                node.scrollTop = 0;
            }
            this.__freeGrid.resetRowCache();
        }

        if (this.config.sortingSet) {
            this.__arrayUtils.setOrderBy(this.config.sortingSet);
        }
        if (this.config.groupingSet) {
            this.__arrayUtils.setGrouping(this.config.groupingSet);
        }

        const result = this.__arrayUtils.orderBy(this.filteredDataset, null, false);
        this.__arrayUtils.arraySort.SetConfigSort(this.config.groups.flatMap(x=> x.rows));
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
        return this.__DATASET_ALL;
    }

    set filteredDataset(value) {
        this.__DATASET_FILTERED = value;
    }
    get filteredDataset() {
        return this.__DATASET_FILTERED;
    }

    set displayedDataset(value) {
        this.__DATASET_VIEW = value;
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
        const row = this.displayedDataset.indexOf(this.currentEntity);
        this.selection.highlightRow({} as any, row + 1);
    }

    public prev() {
        const row = this.displayedDataset.indexOf(this.currentEntity);
        this.selection.highlightRow({} as any, row - 1);
    }

    public first() {
        this.selection.highlightRow({} as any, 0);
    }

    public last() {
        this.selection.highlightRow({} as any, this.displayedDataset.length - 1);
    }

    public edited() {
        return this.__DATASET_ALL.filter(entity => {
            if (entity.__controller.__edited) {
                return true;
            } else {
                return false;
            }
        });
    }

    publishEvent(event: string) {
        this.reRender();
        let keep = this.__subscribers.filter(element => {
            return element(event);
        });
        this.__subscribers = keep;
    }

    addEventListener(callable: (event: string) => boolean) {
        this.__subscribers.push(callable);
    }

    reRender() {
        if (this.__freeGrid) this.__freeGrid.reRender();
    }

    render() {
        if (this.__freeGrid) this.__freeGrid.render();
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

    connectGrid(freeGrid: FreeGrid) {
        this.__freeGrid = freeGrid;
    }

    disconnectGrid() {
        this.__freeGrid = null;
    }
}
