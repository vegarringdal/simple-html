import { ArrayFilter } from './arrayFilter';
import { ArraySort } from './arraySort';
import { ArrayGrouping } from './arrayGrouping';
import {
    ISortObjectInterface,
    IFilterObj,
    IDataRow,
    IGroupingObj,
    CallbackEvent,
    IColumns
} from './interfaces';
import { FreeGrid } from './';

/**
 * Helper class for calling internal sort, filter and grouping classes
 *
 */
export class ArrayUtils {
    public arrayFilter: ArrayFilter;
    public arraySort: ArraySort;
    public arrayGrouping: ArrayGrouping;
    public sortCallbackBinded: (event: CallbackEvent, col: IColumns, freeGrid: FreeGrid) => void;
    public filterCallbackBinded: (event: CallbackEvent, col: IColumns, freeGrid: FreeGrid) => void;
    public groupingCallbackBinded: (
        event: CallbackEvent,
        col: IColumns,
        freeGrid: FreeGrid
    ) => void;
    private freeGrid: FreeGrid;
    public removeGroupBinded: any;

    constructor(freeGrid: FreeGrid) {
        this.arrayFilter = new ArrayFilter();
        this.arraySort = new ArraySort();
        this.arrayGrouping = new ArrayGrouping();
        this.sortCallbackBinded = this.sortCallback.bind(this);
        this.filterCallbackBinded = this.filterCallback.bind(this);
        this.groupingCallbackBinded = this.groupingCallback.bind(this);
        this.removeGroupBinded = this.removeGroup.bind(this);
        this.freeGrid = freeGrid;
    }

    public orderBy(
        collection: IDataRow[],
        attribute: string | ISortObjectInterface,
        addToCurrentSort?: boolean
    ): { fixed: IDataRow[]; full: IDataRow[] } {
        const groupingFields = this.getGrouping().map((data: IGroupingObj) => data.field);
        const grouping = this.getGrouping();
        let result: { fixed: IDataRow[]; full: IDataRow[] } = {
            fixed: null,
            full: null
        };

        if (groupingFields.length > 0) {
            // get last sort
            const lastSort = this.getOrderBy();

            // reset sort
            this.resetSort();

            // loop
            let exist = false;

            // if not adding, create new sort array
            let newSort: ISortObjectInterface[] = [];

            let count = 0;
            // loop existing
            if (!attribute) {
                newSort = lastSort;
            } else {
                lastSort.forEach((sort: ISortObjectInterface) => {
                    count++;
                    if (groupingFields.indexOf(sort.attribute) !== -1 || addToCurrentSort) {
                        newSort.push(sort);
                        if (sort.attribute === attribute) {
                            sort.asc = sort.asc === true ? false : true;
                            sort.no = count;
                            exist = true;
                        }
                    } else {
                        if (sort.attribute === attribute) {
                            sort.asc = sort.asc === true ? false : true;
                            sort.no = count;
                            exist = true;
                            newSort.push(sort);
                        }
                    }
                });
            }

            // set last sort
            this.setLastSort(newSort);

            // if it does not exist, then add
            if (!exist && attribute) {
                this.setOrderBy(attribute, true);
            }

            // run orderby
            this.runOrderbyOn(collection);

            // regroup
            const groupedArray = this.group(collection, grouping, true);
            // set result
            result = {
                fixed: groupedArray,
                full: collection
            };
        } else {
            if (!attribute) {
                // no attribute, just reset last sort...
                const lastSort = this.getOrderBy();
                this.resetSort();
                this.setLastSort(lastSort);
                this.runOrderbyOn(collection);
                result = {
                    fixed: collection,
                    full: collection
                };
            } else {
                this.setOrderBy(attribute, addToCurrentSort);
                this.runOrderbyOn(collection);
                result = {
                    fixed: collection,
                    full: collection
                };
            }
        }
        this.freeGrid.config.sortingSet = this.arraySort.getOrderBy();

        return result;
    }

    public getGrouping(): IGroupingObj[] {
        return this.arrayGrouping.getGrouping();
    }

    public setGrouping(g: IGroupingObj[]) {
        this.arrayGrouping.setGrouping(g);
    }

    public getExpanded() {
        return this.arrayGrouping.getExpanded();
    }

    public setExpanded(x: string[]) {
        this.arrayGrouping.setExpanded(x);
    }

    public groupCollapse(id: string): void {
        this.freeGrid.viewRows = this.arrayGrouping.collapseOneOrAll(id);
        this.freeGrid.config.groupingExpanded = this.arrayGrouping.getExpanded();
        this.freeGrid.reRender();
    }

    public groupExpand(id: string): void {
        this.freeGrid.viewRows = this.arrayGrouping.expandOneOrAll(id);
        this.freeGrid.config.groupingExpanded = this.arrayGrouping.getExpanded();
        this.freeGrid.reRender();
    }

    public getOrderBy(): ISortObjectInterface[] {
        return this.arraySort.getOrderBy();
    }

    public setLastSort(array: ISortObjectInterface[]): void {
        this.arraySort.setLastSort(array);
    }

    public setOrderBy(
        attribute: string | ISortObjectInterface | ISortObjectInterface[],
        addToCurrentSort?: boolean
    ): void {
        this.arraySort.setOrderBy(attribute, addToCurrentSort);
    }

    public runOrderbyOn(array: IDataRow[]): void {
        this.arraySort.runOrderbyOn(array);
    }

    public resetSort(defaultSortAttribute?: string): void {
        this.arraySort.reset(defaultSortAttribute);
    }

    public resetGrouping(): void {
        this.arrayGrouping.reset();
    }

    public getCurrentFilter(): IFilterObj[] {
        return this.arrayFilter.getLastFilter();
    }

    private group(array: IDataRow[], grouping: IGroupingObj[], keepExpanded: boolean): IDataRow[] {
        const x = this.arrayGrouping.group(array, grouping, keepExpanded);
        this.freeGrid.config.groupingExpanded = this.arrayGrouping.getExpanded();

        return x;
    }

    private removeGroup(group: IGroupingObj) {
        const currentGrouping = this.getGrouping();
        const x = currentGrouping.indexOf(group);
        if (x !== -1) {
            currentGrouping.splice(x, 1);
        }

        if (currentGrouping.length) {
            const newdata = this.group(this.freeGrid.activeData, currentGrouping, true);
            this.freeGrid.viewRows = newdata;
        } else {
            this.freeGrid.viewRows = this.freeGrid.activeData;
        }
        this.freeGrid.reRender();
    }

    private groupingCallback(_event: CallbackEvent, col: IColumns, freeGrid: FreeGrid) {
        let newF = col ? true : false;
        const groupings: IGroupingObj[] = this.freeGrid.config.groupingSet || [];
        col &&
            groupings.forEach(g => {
                if (g.field === col.attribute) {
                    newF = false;
                }
            });

        if (newF) {
            groupings.push({ title: col.header, field: col.attribute });
        }
        this.arraySort.clearConfigSort(freeGrid.config.columns);
        this.arraySort.reset();
        groupings.forEach((group: IGroupingObj) => {
            this.arraySort.setOrderBy(group.field, true);
        });
        this.arraySort.runOrderbyOn(this.freeGrid.activeData);
        this.arraySort.SetConfigSort(freeGrid.config.columns);
        if (groupings.length) {
            const result = this.group(this.freeGrid.activeData, groupings, true);
            this.freeGrid.config.groupingSet = this.getGrouping();
            this.freeGrid.config.sortingSet = this.getOrderBy();
            this.freeGrid.viewRows = result;
        } else {
            this.freeGrid.viewRows = this.freeGrid.activeData;
        }
        freeGrid.reRender();
    }

    private sortCallback(event: CallbackEvent, col: IColumns, freeGrid: FreeGrid) {
        // toggle sort
        const sortAsc =
            col.sortable.sortAscending === null ? true : col.sortable.sortAscending ? false : true;

        // clear config, so it can be set after new sort
        this.arraySort.clearConfigSort(freeGrid.config.columns);

        // sort, update config, set viewRows and rerender
        const result = this.orderBy(
            freeGrid.activeData,
            { attribute: col.attribute, asc: sortAsc },
            (<any>event).shiftKey
        );
        this.freeGrid.config.sortingSet = this.getOrderBy();
        this.arraySort.SetConfigSort(freeGrid.config.columns);
        this.freeGrid.viewRows = result.fixed;
        freeGrid.reRender();
    }

    private filterCallback(event: CallbackEvent, col: IColumns, freeGrid: FreeGrid) {
        // depending on col type we need to get data from correct value
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

        const filter: IFilterObj[] = [];
        freeGrid.config.columns.forEach(col => {
            const f = col.filterable;
            if (f && (f.currentValue !== null && f.currentValue !== undefined)) {
                filter.push({
                    attribute: col.attribute,
                    type: col.type || 'text',
                    operator: f.operator
                        ? this.arrayFilter.operators[f.operator]
                        : this.arrayFilter.operators[this.arrayFilter.getFilterFromType(col.type)],
                    value: f.currentValue
                });
            }
        });
        freeGrid.activeData = this.arrayFilter.runQueryOn(freeGrid.data, filter);
        const result = this.orderBy(freeGrid.activeData, null, false);
        this.arraySort.SetConfigSort(freeGrid.config.columns);
        this.freeGrid.viewRows = result.fixed;
        this.freeGrid.reRender();
    }
}
