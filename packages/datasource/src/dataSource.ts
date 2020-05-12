import { Filter } from './filter';
import { Sort } from './sort';
import { Grouping } from './grouping';
import { Selection } from './selection';
import { Entity, DatasourceConfigOptions, SelectionMode, SortArgument } from './interfaces';
import { DataContainer } from './dataContainer';

type callable = Function | { handleEvent: Function };

/**
 * Helper class for calling internal sort, filter and grouping classes
 *
 */
export class Datasource {
    /**
     * filter controller, holds all logic for filtering
     */
    private __filter: Filter;

    /**
     * sorting controller, holds all logic for sorting
     */
    private __sorting: Sort;

    /**
     * grouping contoller, holds all logic for grouping
     */
    private __grouping: Grouping;

    /**
     * this holds the filtered data, used when sorting and grouping
     */
    private __collectionFiltered: Entity[] = [];

    /**
     * This is the data that is sorted/filtered and grouped
     */
    private __collectionDisplayed: Entity[] = [];

    /**
     * datacontainer is holding the data, you can have many datasources sharing 1 datacontainer
     */
    private __dataContainer: DataContainer;

    /**
     * selection controller, holds selection
     */
    private __selection: Selection;

    /**
     * selection mode used by the selection controller
     */
    private __selectionMode: SelectionMode = 'multiple';

    /**
     * subscribed listerners, gets called when collection changes/is sorted/filtered etc
     */
    private __listeners: Set<callable> = new Set();

    /**
     * current entity, use this with form etc if you have a grid with detail form
     */
    public currentEntity: Entity | null = null;

    constructor(dataContainer?: DataContainer, options?: DatasourceConfigOptions) {
        this.__dataContainer = dataContainer || new DataContainer();
        this.__selectionMode = options?.selectionMode || 'multiple';
        this.__selection = new Selection(this);
        this.__filter = new Filter();
        this.__sorting = new Sort();
        this.__grouping = new Grouping();
    }

    /**
     * This is the data in the dataContainer
     */
    public getAllData(): Entity[] {
        return this.__dataContainer.getDataSet();
    }

    /**
     * INTERNAL: Used by selection to se new current entity
     * @param row
     */
    public __select(row: number) {
        this.currentEntity = this.__collectionDisplayed[row];
        this.__callSubscribers('currentEntity');
    }

    /**
     * for adding data to datasource, this will also be sendt to dataContainer
     * so if you replace data the data in the datacontainer also gets replaced
     * @param data js object
     * @param add add to current, if false it replaces current collections
     * @param reRunFilter rerun current filter, grouping/sorting will run automatically
     */
    public setData(data: any[], add = false, reRunFilter = false) {
        if (add) {
            const x = this.__dataContainer.setData(data, add);
            if (x) {
                this.__collectionFiltered.push(...x);
            }
        } else {
            this.__dataContainer.setData(data, add);
            this.__collectionFiltered = this.getAllData().slice();
        }

        // TODO:  rerun filter ?
        if (reRunFilter) {
            // re-run filer?
        }

        this.sort();
    }

    /**
     * sorts current displayed selection
     * @param args obj/obj array must have attribute and ascending
     * @param add add to previous sort arguments
     */
    sort(args?: SortArgument | SortArgument[], add?: boolean) {
        // sort
        if (args) {
            // TODO: if we have grouping we need to add it to this..

            this.__sorting.setOrderBy(args, add);
            this.__sorting.runOrderBy(this.__collectionFiltered);
        } else {
            //if nothing the reuse last config
            const lastSort = this.__sorting.getLastSort();
            if (lastSort.length) {
                this.__sorting.runOrderBy(this.__collectionFiltered);
            }
        }

        //set sorted collection to display
        this.__collectionDisplayed = this.__collectionFiltered.slice();
        // group if any config set
        this.__callSubscribers('collection-sorted');
    }

    filter() {
        // filter
        // sort if any config set
        // group if any config set
        this.__callSubscribers('collection-filtered');
    }

    group() {
        // sort
        // group
        this.__callSubscribers('collection-grouped');
    }

    /**
     * expand 1 or all groups
     * @param id null/undefined = all
     */
    expandGroup(id?: string) {
        // TODO: not started yet
        if (!id) {
            //all
        } else {
            // just the id
        }
        this.__callSubscribers('collection-expand');
    }

    /**
     * collapse 1 or all groups
     * @param id null/undefined = all
     */
    collapseGroup(id?: string) {
        // TODO: not started yet
        if (!id) {
            //all
        } else {
            // just the id
        }
        this.__callSubscribers('collection-collapse');
    }

    /**
     * used to call subscribers, used by selection/sorting/filter/grouping controller
     * @param event
     * @param data
     */
    public __callSubscribers(event: string, data = {}): void {
        this.__listeners.forEach((callable) => {
            if (typeof callable === 'function') {
                callable({ type: event, data: data });
            } else {
                if (typeof callable?.handleEvent === 'function') {
                    callable.handleEvent({ type: event, data: data });
                }
            }
        });
    }

    /**
     * adds event listener, this is called when collection is changed by sorting/grouping etc
     * @param callable
     */
    public addEventListner(callable: callable): void {
        if (typeof callable !== 'function' && typeof callable?.handleEvent !== 'function') {
            throw new Error('callable sent to datasource event listner is wrong type');
        }

        if (!this.__listeners.has(callable)) {
            this.__listeners.add(callable);
        }
    }

    /**
     * removes listener from datasource
     * @param callable
     */
    public removeEventListner(callable: callable): void {
        if (this.__listeners.has(callable)) {
            this.__listeners.delete(callable);
        }
    }

    /**
     *  returns lenght of sorted/filtered collection
     * @param onlyDataRows use this to skip grouping rows
     */
    public length(onlyDataRows?: boolean): number {
        if (onlyDataRows) {
            return this.__collectionFiltered.length;
        } else {
            return this.__collectionDisplayed.length;
        }
    }

    /**
     * return selection mode used
     */
    public getSelectionMode(): SelectionMode {
        return this.__selectionMode;
    }

    /**
     * replace selection mode used, if blank it will be set to 'none'
     */
    public setSelectionMode(mode: SelectionMode): void {
        this.__selectionMode = mode || 'none';
    }

    /**
     * returns 1 row sorted/grouped/filtered, start on 0
     * @param rowNo
     */
    public getRow(rowNo: number): Entity {
        return this.__collectionDisplayed[rowNo];
    }

    /**
     * returns all rows sorted/grouped/filtered
     */
    public getRows(): Entity[] {
        return this.__collectionDisplayed;
    }

    /**
     * sets current entity and selection, start on 1 not 0
     * @param row, if skipped we select the first
     */
    public select(row?: number): void {
        this.__selection.highlightRow({} as any, row ? row - 1 : 0);
    }

    /**
     * updates current entity to first
     */
    public selectFirst(): void {
        this.__selection.highlightRow({} as any, 0);
    }

    /**
     * updates current entity, if first when running this it will select the last
     */
    public selectPrev(): void {
        let row = this.__collectionDisplayed.indexOf(this.currentEntity) - 1;
        if (row < 0) {
            row = this.__collectionDisplayed.length - 1;
            this.__selection.highlightRow({} as any, row);
        }
        this.__selection.highlightRow({} as any, row);
    }

    /**
     * updates current entity, if on last it will end on up the first
     */
    public selectNext(): void {
        let row = this.__collectionDisplayed.indexOf(this.currentEntity) + 1;
        if (this.__collectionDisplayed.length - 1 < row) {
            row = 0;
        }
        this.__selection.highlightRow({} as any, row);
    }

    /**
     * updates current entity to last entity
     */
    public selectLast(): void {
        this.__selection.highlightRow({} as any, this.__collectionDisplayed.length - 1);
    }

    /**
     * sets Intl Collator , this is used for sorting
     * @param code
     * @param options
     */
    public setLocalCompare(code: string, options?: any) {
        // should we also use this for filter ?
        this.__sorting.setLocaleCompare(code, options);
    }

    /**
     * resets current sort
     * @param defaultSortAttribute attribute name if you have a default you want to use
     */
    public resetSort(defaultSortAttribute?: string): void {
        this.__sorting.reset(defaultSortAttribute);
    }
}
