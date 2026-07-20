import type { Grid } from '../grid/grid';
import { DataContainer } from './dataContainer';
import type { DatasourceConfigOptions } from './datasourceConfigOptions';
import type { Entity } from './entity';
import type { FilterArgument } from './filterArgument';
import type { GroupArgument } from './groupArgument';
import { Selection } from './selection';
import type { SelectionMode } from './selectionMode';
import type { SortArgument } from './sortArgument';
import type { DateAndNumberFormater, ValueFormater } from './valueFormater';
export type callF = (...args: any[]) => any;
export type callO = {
    handleEvent: (...args: any[]) => any;
};
export type callable = callF | callO;
export type EntityUnion<T> = Entity & T;
/**
 * Helper class for calling internal sort, filter and grouping classesS
 *
 */
export declare class Datasource<T = any> {
    /**
     * filter controller, holds all logic for filtering
     */
    private __filter;
    /**
     * sorting controller, holds all logic for sorting
     */
    private __sorting;
    /**
     * grouping contoller, holds all logic for grouping
     */
    private __grouping;
    /**
     * this holds the filtered data, used when sorting and grouping
     */
    private __collectionFiltered;
    /**
     * This is the data that is sorted/filtered and grouped
     */
    private __collectionDisplayed;
    /**
     * datacontainer is holding the data, you can have many datasources sharing 1 datacontainer
     */
    private __dataContainer;
    /**
     * selection controller, holds selection
     */
    private __selection;
    /**
     * selection mode used by the selection controller
     */
    private __selectionMode;
    /**
     * subscribed listerners, gets called when collection changes/is sorted/filtered etc
     */
    private __listeners;
    /**
     * default date formater
     */
    private __dateFormater;
    /**
     * default number formater
     */
    private __numberFormater;
    private __valueFormater;
    /**
     * current entity, use this with form etc if you have a grid with detail form
     */
    currentEntity: EntityUnion<T> | null;
    constructor(dataContainer?: DataContainer, options?: DatasourceConfigOptions);
    setNumberFormater(formater: DateAndNumberFormater): void;
    setDateFormater(formater: DateAndNumberFormater): void;
    setValueFormater(formater: ValueFormater): void;
    getNumberFormater(): DateAndNumberFormater;
    getDateFormater(): DateAndNumberFormater;
    getValueFormater(): ValueFormater;
    /**
     * so I can check
     */
    get type(): string;
    setDates(x: string[]): void;
    getMarkedForDeletion(): EntityUnion<T>[];
    clearMarkedForDeletion(): void;
    /**
     * resets all edited data and brings back marked for deletion
     */
    resetData(): void;
    /**
     * resets all edited data and brings back marked for deletion
     */
    resetDataSelectionOnly(): void;
    /**
     * returns copy of all modified, new or marked for deletion
     * changes to these do not edit anything in grid
     */
    getChanges(): any;
    /**
     * only mark for deletion, you can reset/bring it back with resetData()
     * @param data
     * @param all
     */
    markForDeletion(data: Entity | Entity[], all?: boolean): void;
    /**
     * remove data
     * @param data
     * @param all
     * @param rerunFilters if you plan to trigger many times in a loop then you want to set this to false until last one
     * @returns
     */
    removeData(data: Entity | Entity[], all?: boolean, rerunFilters?: boolean): Entity[];
    /**
     * This is the data in the dataContainer
     */
    getAllData(): EntityUnion<T>[];
    /**
     * This returns datacontainer used
     */
    getDataContainer(): DataContainer;
    /**
     * @internal
     * INTERNAL: Used by selection to set new current entity
     * @param row
     */
    __select(row: number): void;
    /**
     * sets row as current entity
     * @param row 0 based like array, not like the select
     */
    setRowAsCurrentEntity(row: number): void;
    /**
     * for adding data to datasource, this will also be sendt to dataContainer
     * so if you replace data the data in the datacontainer also gets replaced
     * @param data js object
     * @param add add to current, if false it replaces current collections
     * @param reRunFilter rerun current filter, grouping/sorting will run automatically
     */
    setData(data: any[], add?: boolean, reRunFilter?: boolean): void;
    addNewEmpty(defaultData?: EntityUnion<T>, scrollto?: boolean): void;
    getLastSorting(): SortArgument[];
    /**
     * runs sorting/grouping, used by setdata/and filter, so we dont rerun sort/grouping many times
     * this also does not call any events
     */
    private __internalUpdate;
    /**
     * sorts current displayed selection
     * @param args obj/obj array must have attribute and ascending
     * @param add add to previous sort arguments
     */
    sort(args?: SortArgument | SortArgument[], add?: boolean): void;
    /**
     * filters using the connected data container, result is sorted also if this is set
     * if you need to set sort then do this before calling filter
     * @param ObjFilter
     */
    filter(ObjFilter?: FilterArgument | FilterArgument[]): void;
    /**
     * Groups filtered collection
     * @param group
     * @param add
     */
    group(group: GroupArgument[], add?: boolean): void;
    /**
     * Removed group
     * @param group undefined = remove all groups
     */
    removeGroup(group?: GroupArgument): void;
    /**
     * expand 1 or all groups
     * @param id null/undefined = all
     */
    expandGroup(id?: string): void;
    /**
     * collapse 1 or all groups
     * @param id null/undefined = all
     */
    collapseGroup(id?: string): void;
    /**
     * @internal
     * used to call subscribers, used by selection/sorting/filter/grouping controller
     * @param event
     * @param data
     */
    __callSubscribers(event: string, data?: {}): void;
    /**
     * adds event listener, this is called when collection is changed by sorting/grouping etc
     * @param callable
     */
    addEventListener(callable: callable): void;
    /**
     * removes listener from datasource
     * @param callable
     */
    removeEventListener(callable: callable): void;
    /**
     *  returns lenght of sorted/filtered collection
     * @param onlyDataRows use this to skip grouping rows
     */
    length(onlyDataRows?: boolean): number;
    /**
     * return selection mode used
     */
    getSelectionMode(): SelectionMode;
    /**
     * Selects all rows displayed
     */
    selectAll(): void;
    /**
     * deSelectAll all rows displayed
     */
    deSelectAll(triggerEvent?: boolean): void;
    /**
     * replace selection mode used, if blank it will be set to 'none'
     */
    setSelectionMode(mode: SelectionMode): void;
    /**
     * returns 1 row sorted/grouped/filtered, start on 0
     * @param rowNo
     */
    getRow(rowNo: number): EntityUnion<T>;
    /**
     * returns all rows sorted/grouped/filtered
     * @param onlyDataRows only get sorted/filtered and skip group
     */
    getRows(onlyDataRows?: boolean): EntityUnion<T>[];
    /**
     * sets current entity and selection, start on 1 not 0
     * @param row, if skipped we select the first
     */
    select(row?: number, triggerSelect?: boolean): void;
    /**
     * updates current entity to first
     */
    selectFirst(): void;
    /**
     * updates current entity, if first when running this it will select the last
     */
    selectPrev(): void;
    /**
     * updates current entity, if on last it will end on up the first
     */
    selectNext(): void;
    /**
     * updates current entity to last entity
     */
    selectLast(): void;
    /**
     * returns selected data rows
     * @returns
     */
    getSelectedRows(): Entity[];
    /**
     * sets Intl Collator , this is used for sorting
     * @param code
     * @param options
     */
    setLocalCompare(code: string, options?: any): void;
    /**
     * resets current sort
     * @param defaultSortAttribute attribute name if you have a default you want to use
     */
    resetSort(defaultSortAttribute?: string): void;
    /**
     * Sets order by, if you plan to filter with new sorting order you need to use this first
     * @param param
     * @param add
     */
    setOrderBy(param: SortArgument | SortArgument[], add?: boolean): void;
    /**
     * returns current sortorder config
     */
    getOrderBy(): SortArgument[];
    /**
     * returns current grouing config
     */
    getGrouping(): GroupArgument[];
    /**
     * sets current grouing config
     */
    setGrouping(group: GroupArgument[]): void;
    /**
     * sets current expanded ids
     */
    setExpanded(x: string[]): void;
    /**
     * gets current expanded ids
     */
    getExpanded(): string[];
    getFilter(): FilterArgument;
    getSelection(): Selection;
    sortReset(): void;
    getFilterFromType(type: string): import("./filterComparisonOperator").FilterComparisonOperator;
    setFilter(filter: FilterArgument): void;
    reloadDatasource(): void;
    getFilterString(ctx?: Grid): string;
}
//# sourceMappingURL=dataSource.d.ts.map