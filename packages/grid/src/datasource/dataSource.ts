import { Filter } from './filter';
import { Sort } from './sort';
import { Grouping } from './grouping';
import { Selection } from './selection';
import { FilterArgument } from './filterArgument';
import { DatasourceConfigOptions } from './datasourceConfigOptions';
import { SelectionMode } from './selectionMode';
import { SortArgument } from './sortArgument';
import { GroupArgument } from './groupArgument';
import { OPERATORS } from './OPERATORS';
import { Entity } from './entity';
import { DataContainer } from './dataContainer';
import { DateFormaterDefault, DateFormaterType } from './dateFormaterDefault';
import { NumberFormaterDot, NumberFormaterType } from './numberFormaterDot';

export type callF = (...args: any[]) => any;
export type callO = { handleEvent: (...args: any[]) => any };
export type callable = callF | callO;

export type EntityUnion<T> = Entity & T;

/**
 * Helper class for calling internal sort, filter and grouping classesS
 *
 */
export class Datasource<T = any> {
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
     * default date formater
     */
    private __dateFormater: DateFormaterType = DateFormaterDefault;

    /**
     * default number formater
     */
    private __numberFormater: NumberFormaterType = NumberFormaterDot;

    /**
     * current entity, use this with form etc if you have a grid with detail form
     */
    public currentEntity: EntityUnion<T> | null = null;

    constructor(dataContainer?: DataContainer, options?: DatasourceConfigOptions) {
        this.__dataContainer = dataContainer || new DataContainer();
        this.__selectionMode = options?.selectionMode || 'multiple';
        this.__selection = new Selection(this);
        this.__filter = new Filter();
        this.__sorting = new Sort();
        this.__grouping = new Grouping();
    }

    public setNumberFormater(formater: NumberFormaterType) {
        this.__numberFormater = formater;
    }

    public setDateFormater(formater: DateFormaterType) {
        this.__dateFormater = formater;
    }

    public getNumberFormater() {
        return this.__numberFormater;
    }

    public getDateFormater() {
        return this.__dateFormater;
    }

    /**
     * so I can check
     */
    public get type() {
        return 'Datasource';
    }

    public setDates(x: string[]) {
        this.__sorting.setDateAttribute(x);
    }

    public getMarkedForDeletion(): EntityUnion<T>[] {
        return this.__dataContainer.getMarkedForDeletion() as EntityUnion<T>[];
    }

    public clearMarkedForDeletion() {
        this.__dataContainer.clearMarkedForDeletion();
    }

    public resetData() {
        this.__dataContainer.resetData();
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info: 'resetData' });
        }
    }

    /**
     * only mark for deletion, you can reset/bring it back with resetData()
     * @param data
     * @param all
     */
    public markForDeletion(data: Entity | Entity[], all = false) {
        this.__dataContainer.markForDeletion(data, all);
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info: 'markForDeletion' });
        }
    }

    /**
     * remove data
     * @param data
     * @param all
     * @param rerunFilters if you plan to trigger many times in a loop then you want to set this to false until last one
     * @returns
     */
    public removeData(data: Entity | Entity[], all = false, rerunFilters = true) {
        const removed = this.__dataContainer.removeData(data, all);
        if (rerunFilters) {
            this.__internalUpdate(true);
        }
        this.__callSubscribers('collection-changed', { removed: true, info: 'removeData', data });
        return removed;
    }

    /**
     * This is the data in the dataContainer
     */
    public getAllData(): EntityUnion<T>[] {
        return this.__dataContainer.getDataSet() as any;
    }

    /**
     * @internal
     * INTERNAL: Used by selection to set new current entity
     * @param row
     */
    public __select(row: number) {
        this.currentEntity = this.__collectionDisplayed[row] as Entity & T;
        if (this.currentEntity === undefined) {
            this.currentEntity = null; // so its always a entity or null, makes it easier to work with
        }
        this.__callSubscribers('currentEntity');
    }

    /**
     * sets row as current entity
     * @param row 0 based like array, not like the select
     */
    public setRowAsCurrentEntity(row: number) {
        this.__select(row);
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

    public addNewEmpty(defaultData: EntityUnion<T> = {} as EntityUnion<T>, scrollto = true) {
        this.__dataContainer.setData([defaultData], true, true);
        this.__internalUpdate(false);
        // force add after internal update, doing before will mess up location
        const dataset = this.__dataContainer.getDataSet();
        const newRow = dataset[dataset.length - 1];
        this.__collectionFiltered.push(newRow);
        this.__collectionDisplayed.push(newRow);
        this.__callSubscribers('collection-changed', { added: true });
        if (scrollto) {
            this.selectLast();
        }
    }

    public getLastSorting() {
        return this.__sorting.getLastSort();
    }

    /**
     * runs sorting/grouping, used by setdata/and filter, so we dont rerun sort/grouping many times
     * this also does not call any events
     */
    private __internalUpdate(reRunFilter: boolean) {
        let forceUpdate = false;
        if (
            !reRunFilter &&
            !this.__filter.getFilter() &&
            !this.__sorting.getLastSort().length &&
            !this.__grouping.getGrouping().length
        ) {
            forceUpdate = true;
        }

        if (reRunFilter) {
            if (this.__filter.getFilter()) {
                this.__collectionFiltered = this.__filter.filter(this.getAllData(), this.__filter.getFilter(), this);
            } else {
                this.__collectionFiltered = this.__dataContainer.getDataSet();
            }
        }

        if (this.__sorting.getLastSort().length) {
            this.__sorting.runOrderBy(this.__collectionFiltered);
        }

        if (this.__grouping.getGrouping().length) {
            this.__collectionDisplayed = this.__grouping.group(
                this.__collectionFiltered,
                this.__grouping.getGrouping(),
                true,
                this
            );
        } else {
            //set sorted collection to display
            this.__collectionDisplayed = this.__collectionFiltered.slice();
        }

        if (forceUpdate) {
            this.__callSubscribers('collection-filtered', { info: '__internalUpdate, forced' });
        }
        return forceUpdate;
    }

    /**
     * sorts current displayed selection
     * @param args obj/obj array must have attribute and ascending
     * @param add add to previous sort arguments
     */
    public sort(args?: SortArgument | SortArgument[], add?: boolean) {
        // sort
        if (!this.__grouping.getGrouping().length) {
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
        }

        if (this.__grouping.getGrouping().length) {
            // if we also have grouping we need to check if this needs to be added

            // add default sort
            if (args) {
                this.__sorting.setOrderBy(args, add);
            }

            // get attributes/sort order
            const sortingAttributes = this.__sorting.getOrderBy().map((col) => col.attribute);
            const sortingAttributesOrder = this.__sorting.getOrderBy().map((col) => col.ascending);

            // reset sort, we need to set it using grouping
            this.__sorting.reset();

            this.__grouping.getGrouping().forEach((group: GroupArgument) => {
                const sortIndex = sortingAttributes.indexOf(group.attribute);
                if (sortingAttributes.indexOf(group.attribute) === -1) {
                    this.__sorting.setOrderBy({ attribute: group.attribute, ascending: true }, true);
                } else {
                    // if it already is in the new sorting, we need to use this sort order
                    this.__sorting.setOrderBy(
                        {
                            attribute: group.attribute,
                            ascending: sortingAttributesOrder[sortIndex]
                        },
                        true
                    );
                }
            });

            // last part is to get the column thats not in grouping and add them
            const groupings = this.__grouping.getGrouping().map((col) => col.attribute);
            sortingAttributes.forEach((attribute, i) => {
                if (groupings.indexOf(attribute) === -1) {
                    this.__sorting.setOrderBy(
                        {
                            attribute: sortingAttributes[i],
                            ascending: sortingAttributesOrder[i]
                        },
                        true
                    );
                }
            });

            this.__sorting.runOrderBy(this.__collectionFiltered);

            // if grouping is set
            this.__collectionDisplayed = this.__grouping.group(
                this.__collectionFiltered,
                this.__grouping.getGrouping(),
                true,
                this
            );
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
                    // empty group, clear
                    if (
                        ObjFilter?.logicalOperator &&
                        //ObjFilter?.type &&
                        ObjFilter?.filterArguments?.length === 0
                    ) {
                        this.__filter.setFilter(null);
                    }
                } else {
                    // FilterArgument
                    // todo, check more and warn if missing options _
                    this.__filter.setFilter(ObjFilter as FilterArgument);
                }
            }
        } /*  */
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info: 'filter' });
        }
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
            const result = this.__grouping.group(this.__collectionFiltered, groupings, true, this);
            this.__collectionDisplayed = result;
        } else {
            this.__collectionDisplayed = this.__collectionFiltered;
        }

        this.__grouping.setGrouping(groupings);

        // group
        this.__callSubscribers('collection-grouped', { info: 'group', groupings });
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
        this.__callSubscribers('collection-grouped', { info: 'removeGroup' });
    }

    /**
     * expand 1 or all groups
     * @param id null/undefined = all
     */
    public expandGroup(id?: string) {
        if (this.__grouping.getGrouping().length) {
            this.__collectionDisplayed = this.__grouping.expandOneOrAll(id);
            this.__callSubscribers('collection-expand');
        }
    }

    /**
     * collapse 1 or all groups
     * @param id null/undefined = all
     */
    public collapseGroup(id?: string) {
        if (this.__grouping.getGrouping().length) {
            this.__collectionDisplayed = this.__grouping.collapseOneOrAll(id);
            this.__callSubscribers('collection-collapse');
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
        this.__listeners = new Set(keeping);
    }

    /**
     * adds event listener, this is called when collection is changed by sorting/grouping etc
     * @param callable
     */
    public addEventListener(callable: callable): void {
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
    public removeEventListener(callable: callable): void {
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
     * Selects all rows displayed
     */
    public selectAll() {
        this.__selection.selectAll();
    }

    /**
     * deSelectAll all rows displayed
     */
    public deSelectAll(triggerEvent = false) {
        this.__selection.deSelectAll(triggerEvent);
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
    public getRow(rowNo: number): EntityUnion<T> {
        return this.__collectionDisplayed[rowNo] as any;
    }

    /**
     * returns all rows sorted/grouped/filtered
     * @param onlyDataRows only get sorted/filtered and skip group
     */
    public getRows(onlyDataRows?: boolean): EntityUnion<T>[] {
        if (onlyDataRows) {
            return this.__collectionFiltered as any;
        } else {
            return this.__collectionDisplayed as any;
        }
    }

    /**
     * sets current entity and selection, start on 1 not 0
     * @param row, if skipped we select the first
     */
    public select(row?: number, triggerSelect?: boolean): void {
        this.__selection.highlightRow({} as any, row ? row - 1 : 0);
        if (triggerSelect) {
            this.__callSubscribers('select');
        }
    }

    /**
     * updates current entity to first
     */
    public selectFirst(): void {
        this.__selection.highlightRow({} as any, 0);
        this.__callSubscribers('select', { info: 'select-first' });
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
        this.__callSubscribers('select', { info: 'select-prev' });
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
        this.__callSubscribers('select', { info: 'select-next' });
    }

    /**
     * updates current entity to last entity
     */
    public selectLast(): void {
        this.__selection.highlightRow({} as any, this.__collectionDisplayed.length - 1);
        this.__callSubscribers('select', { info: 'select-last' });
    }

    /**
     * returns selected data rows
     * @returns
     */
    public getSelectedRows() {
        const displayedRows = this.getRows();
        const selectedRows = this.getSelection().getSelectedRows();
        const data: Entity[] = [];
        selectedRows.forEach((row) => {
            data.push(displayedRows[row]);
        });
        return data;
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

    public sortReset() {
        return this.__sorting.reset();
    }

    public getFilterFromType(type: string) {
        return this.__filter.getFilterFromType(type);
    }

    public setFilter(filter: FilterArgument) {
        return this.__filter.setFilter(filter);
    }

    public reloadDatasource() {
        this.__collectionFiltered = this.getAllData();
        this.__internalUpdate(true);
    }

    public getFilterString() {
        const filter = this.__filter.getFilter();
        if (!filter?.filterArguments?.length) {
            return '';
        }

        const dateformater = this.getDateFormater();
        const numformater = this.getNumberFormater();

        function convertValue(type: string, value: string | Date | number) {
            if (type === 'date') {
                return dateformater.fromDate(value);
            }

            if (type === 'number') {
                return numformater.fromNumber(value);
            }

            return value;
        }

        const parser = function (obj: FilterArgument, queryString = '') {
            if (obj) {
                if (!obj.filterArguments || (obj.filterArguments && obj.filterArguments.length === 0)) {
                    if (obj.operator === 'IS_BLANK' || obj.operator === 'IS_NOT_BLANK') {
                        queryString = queryString + `[${obj.attribute}] <<${OPERATORS[obj.operator]}>>`;
                    } else {
                        if (obj.operator !== 'IN' && obj.operator !== 'NOT_IN') {
                            queryString =
                                queryString +
                                `[${obj.attribute}] <<${OPERATORS[obj.operator]}>> ${
                                    obj.valueType === 'ATTRIBUTE'
                                        ? `[${obj.value}]`
                                        : "'" + convertValue(obj.attributeType, obj.value) + "'"
                                }`;
                        } else {
                            // split newline into array
                            if (Array.isArray(obj.value)) {
                                queryString =
                                    queryString +
                                    `[${obj.attribute}] <<${OPERATORS[obj.operator]}>> [${obj.value.map((val) => {
                                        return `'${val}'`;
                                    })}]`;
                            } else {
                                queryString =
                                    queryString +
                                    `[${obj.attribute}] <<${OPERATORS[obj.operator]}>> [${(obj.value as string)
                                        .split('\n')
                                        .map((val) => {
                                            return `'${val}'`;
                                        })}]`;
                            }
                        }
                    }
                } else {
                    obj.filterArguments.forEach((y, i) => {
                        if (i > 0) {
                            queryString = queryString + ` ${obj.logicalOperator} `;
                        } else {
                            queryString = queryString + `(`;
                        }
                        queryString = parser(y, queryString);
                        if (obj.filterArguments.length - 1 === i) {
                            queryString = queryString + `)`;
                        }
                    });
                }
            }
            return queryString;
        };
        return parser(this.__filter.getFilter()).toUpperCase();
    }
}
