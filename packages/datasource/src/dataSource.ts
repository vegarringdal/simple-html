import { Filter } from './filter';
import { Sort } from './sort';
import { Grouping } from './grouping';
import { Selection } from './selection';
import {
    Entity,
    DatasourceConfigOptions,
    SelectionMode,
    SortArgument,
    FilterArgument,
    GroupArgument
} from './interfaces';
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

        this.__internalUpdate(reRunFilter);
        this.__callSubscribers('collection-changed', { added: !!add });
    }

    /**
     * runs sorting/grouping, used by setdata/and filter, so we dont rerun sort/grouping many times
     * this also does not call any events
     */
    private __internalUpdate(reRunFilter: boolean) {
        if (reRunFilter && this.__filter.getFilter()) {
            this.__collectionFiltered = this.__filter.filter(
                this.getAllData(),
                this.__filter.getFilter()
            );
        }

        const lastSort = this.__sorting.getLastSort();
        if (lastSort.length) {
            this.__sorting.runOrderBy(this.__collectionFiltered);
        }

        if (this.__grouping.getGrouping().length) {
            // if grouping is set
        } else {
            //set sorted collection to display
            this.__collectionDisplayed = this.__collectionFiltered.slice();
        }
    }

    /**
     * sorts current displayed selection
     * @param args obj/obj array must have attribute and ascending
     * @param add add to previous sort arguments
     */
    public sort(args?: SortArgument | SortArgument[], add?: boolean) {
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

        if (this.__grouping.getGrouping().length) {
            // if grouping is set
        } else {
            //set sorted collection to display
            this.__collectionDisplayed = this.__collectionFiltered.slice();
        }

        // group if any config set
        this.__callSubscribers('collection-sorted');
    }

    /**
     * filters using the connected data container, result is sorted also if this is set
     * if you need to set sort then do this before calling filter
     * @param ObjFilter
     */
    public filter(ObjFilter?: FilterArgument | FilterArgument[]) {
        if (ObjFilter) {
            if (Array.isArray(ObjFilter)) {
                // FilterArgumentSimple[]
                this.__filter.setFilter({
                    type: 'GROUP',
                    logicalOperator: 'AND',
                    filterArguments: ObjFilter as FilterArgument[]
                });
            } else {
                if (!ObjFilter.filterArguments || ObjFilter?.filterArguments?.length === 0) {
                    // FilterArgumentSimple
                    this.__filter.setFilter({
                        type: 'GROUP',
                        logicalOperator: 'AND',
                        filterArguments: [ObjFilter as FilterArgument]
                    });
                } else {
                    // FilterArgument
                    // todo, check more and warn if missing options _
                    this.__filter.setFilter(ObjFilter as FilterArgument);
                }
            }
        }
        this.__internalUpdate(true);
        this.__callSubscribers('collection-filtered');
    }

    /**
     * Groups filtered collection
     * @param group
     * @param add
     */
    public group(group: GroupArgument[], add?: boolean) {
        let groupings: GroupArgument[];
        if (add) {
            groupings = this.__grouping.getGrouping();
            groupings = groupings.concat(group);
        } else {
            groupings = group;
        }

        this.__sorting.reset();

        groupings.forEach((group: GroupArgument) => {
            this.__sorting.setOrderBy({ attribute: group.attribute, ascending: true }, true);
        });
        this.__sorting.runOrderBy(this.__collectionFiltered);
        if (groupings.length) {
            const result = this.__grouping.group(this.__collectionFiltered, groupings, true);
            this.__collectionDisplayed = result;
        } else {
            this.__collectionDisplayed = this.__collectionFiltered;
        }

        // group
        this.__callSubscribers('collection-grouped');
    }

    /**
     * Removed group
     * @param group undefined = remove all groups
     */
    public removeGroup(group?: GroupArgument) {
        if (group) {
            const groupings = this.__grouping.getGrouping();

            const oldGroupIndex = groupings.indexOf(group);
            if (oldGroupIndex !== -1) {
                groupings.splice(oldGroupIndex, 1);
            }
            this.group(groupings);
        } else {
            this.group([]);
        }
    }

    /**
     * expand 1 or all groups
     * @param id null/undefined = all
     */
    public expandGroup(id?: string) {
        this.__collectionDisplayed = this.__grouping.expandOneOrAll(id);
        this.__callSubscribers('collection-expand');
    }

    /**
     * collapse 1 or all groups
     * @param id null/undefined = all
     */
    public collapseGroup(id?: string) {
        this.__collectionDisplayed = this.__grouping.collapseOneOrAll(id);
        this.__callSubscribers('collection-collapse');
    }

    /**
     * used to call subscribers, used by selection/sorting/filter/grouping controller
     * @param event
     * @param data
     */
    public __callSubscribers(event: string, data = {}): void {
        const keeping: any = [];
        this.__listeners.forEach((callable) => {
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
        this.__listeners = keeping;
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
     * @param onlyDataRows only get sorted/filtered and skip group
     */
    public getRows(onlyDataRows?: boolean): Entity[] {
        if (onlyDataRows) {
            return this.__collectionFiltered;
        } else {
            return this.__collectionDisplayed;
        }
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

    /**
     * Sets order by, if you plan to filter with new sorting order you need to use this first
     * @param param
     * @param add
     */
    public setOrderBy(param: SortArgument | SortArgument[], add?: boolean) {
        this.__sorting.setOrderBy(param, add);
    }

    /**
     * returns current sortorder config
     */
    public getOrderBy() {
        return this.__sorting.getOrderBy();
    }

    /**
     * returns current grouing config
     */
    public getGrouping() {
        return this.__grouping.getGrouping();
    }

    /**
     * sets current grouing config
     */
    public setGrouping(group: GroupArgument[]) {
        this.__grouping.setGrouping(group);
    }

    /**
     * sets current expanded ids
     */
    public setExpanded(x: string[]) {
        this.__grouping.setExpanded(x);
    }

    /**
     * gets current expanded ids
     */
    public getExpanded() {
        return this.__grouping.getExpanded();
    }

    public getFilter() {
        return this.__filter.getFilter();
    }

    public getSelection() {
        return this.__selection;
    }
}
