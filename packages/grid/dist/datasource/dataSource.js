import { DateFormaterYYYYMMDD } from './DateFormaterYYYYMMDD';
import { DataContainer } from './dataContainer';
import { DefaultValueFormater } from './defaultValueFormater';
import { Filter } from './filter';
import { Grouping } from './grouping';
import { NumberFormaterDot } from './numberFormaterDot';
import { OPERATORS } from './OPERATORS';
import { Selection } from './selection';
import { Sort } from './sort';
/**
 * Helper class for calling internal sort, filter and grouping classesS
 *
 */
export class Datasource {
    /**
     * filter controller, holds all logic for filtering
     */
    __filter;
    /**
     * sorting controller, holds all logic for sorting
     */
    __sorting;
    /**
     * grouping contoller, holds all logic for grouping
     */
    __grouping;
    /**
     * this holds the filtered data, used when sorting and grouping
     */
    __collectionFiltered = [];
    /**
     * This is the data that is sorted/filtered and grouped
     */
    __collectionDisplayed = [];
    /**
     * datacontainer is holding the data, you can have many datasources sharing 1 datacontainer
     */
    __dataContainer;
    /**
     * selection controller, holds selection
     */
    __selection;
    /**
     * selection mode used by the selection controller
     */
    __selectionMode = 'multiple';
    /**
     * subscribed listerners, gets called when collection changes/is sorted/filtered etc
     */
    __listeners = new Set();
    /**
     * default date formater
     */
    __dateFormater = DateFormaterYYYYMMDD;
    /**
     * default number formater
     */
    __numberFormater = NumberFormaterDot;
    __valueFormater;
    /**
     * current entity, use this with form etc if you have a grid with detail form
     */
    currentEntity = null;
    constructor(dataContainer, options) {
        this.__valueFormater = new DefaultValueFormater(this);
        this.__dataContainer = dataContainer || new DataContainer();
        this.__selectionMode = options?.selectionMode || 'multiple';
        this.__selection = new Selection(this);
        this.__filter = new Filter();
        this.__sorting = new Sort();
        this.__grouping = new Grouping();
    }
    setNumberFormater(formater) {
        this.__numberFormater = formater;
    }
    setDateFormater(formater) {
        this.__dateFormater = formater;
    }
    setValueFormater(formater) {
        this.__valueFormater = formater;
    }
    getNumberFormater() {
        return this.__numberFormater;
    }
    getDateFormater() {
        return this.__dateFormater;
    }
    getValueFormater() {
        return this.__valueFormater;
    }
    /**
     * so I can check
     */
    get type() {
        return 'Datasource';
    }
    setDates(x) {
        this.__sorting.setDateAttribute(x);
    }
    getMarkedForDeletion() {
        return this.__dataContainer.getMarkedForDeletion();
    }
    clearMarkedForDeletion() {
        this.__dataContainer.clearMarkedForDeletion();
    }
    /**
     * resets all edited data and brings back marked for deletion
     */
    resetData() {
        this.__dataContainer.resetData();
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info: 'resetData' });
        }
    }
    /**
     * resets all edited data and brings back marked for deletion
     */
    resetDataSelectionOnly() {
        this.__dataContainer.resetDataSelection(this.getSelectedRows());
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info: 'resetData' });
        }
    }
    /**
     * returns copy of all modified, new or marked for deletion
     * changes to these do not edit anything in grid
     */
    getChanges() {
        return this.__dataContainer.getChanges();
    }
    /**
     * only mark for deletion, you can reset/bring it back with resetData()
     * @param data
     * @param all
     */
    markForDeletion(data, all = false) {
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
    removeData(data, all = false, rerunFilters = true) {
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
    getAllData() {
        return this.__dataContainer.getDataSet();
    }
    /**
     * This returns datacontainer used
     */
    getDataContainer() {
        return this.__dataContainer;
    }
    /**
     * @internal
     * INTERNAL: Used by selection to set new current entity
     * @param row
     */
    __select(row) {
        this.currentEntity = this.__collectionDisplayed[row];
        if (this.currentEntity === undefined) {
            this.currentEntity = null; // so its always a entity or null, makes it easier to work with
        }
        this.__callSubscribers('currentEntity');
    }
    /**
     * sets row as current entity
     * @param row 0 based like array, not like the select
     */
    setRowAsCurrentEntity(row) {
        this.__select(row);
    }
    /**
     * for adding data to datasource, this will also be sendt to dataContainer
     * so if you replace data the data in the datacontainer also gets replaced
     * @param data js object
     * @param add add to current, if false it replaces current collections
     * @param reRunFilter rerun current filter, grouping/sorting will run automatically
     */
    setData(data, add = false, reRunFilter = false) {
        if (add) {
            const x = this.__dataContainer.setData(data, add);
            if (x) {
                this.__collectionFiltered.push(...x);
            }
        }
        else {
            this.__dataContainer.setData(data, add);
            this.__collectionFiltered = this.getAllData().slice();
        }
        this.__internalUpdate(reRunFilter);
        this.__callSubscribers('collection-changed', { added: !!add });
    }
    addNewEmpty(defaultData = {}, scrollto = true) {
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
    getLastSorting() {
        return this.__sorting.getLastSort();
    }
    /**
     * runs sorting/grouping, used by setdata/and filter, so we dont rerun sort/grouping many times
     * this also does not call any events
     */
    __internalUpdate(reRunFilter) {
        let forceUpdate = false;
        if (!reRunFilter &&
            !this.__filter.getFilter() &&
            !this.__sorting.getLastSort().length &&
            !this.__grouping.getGrouping().length) {
            forceUpdate = true;
        }
        if (reRunFilter) {
            if (this.__filter.getFilter()) {
                this.__collectionFiltered = this.__filter.filter(this.getAllData(), this.__filter.getFilter(), this);
            }
            else {
                this.__collectionFiltered = this.__dataContainer.getDataSet();
            }
        }
        if (this.__sorting.getLastSort().length) {
            this.__sorting.runOrderBy(this.__collectionFiltered);
        }
        if (this.__grouping.getGrouping().length) {
            this.__collectionDisplayed = this.__grouping.group(this.__collectionFiltered, this.__grouping.getGrouping(), true, this);
        }
        else {
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
    sort(args, add) {
        // sort
        if (!this.__grouping.getGrouping().length) {
            if (args) {
                // TODO: if we have grouping we need to add it to this..
                this.__sorting.setOrderBy(args, add);
                this.__sorting.runOrderBy(this.__collectionFiltered);
            }
            else {
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
            this.__grouping.getGrouping().forEach((group) => {
                const sortIndex = sortingAttributes.indexOf(group.attribute);
                if (sortingAttributes.indexOf(group.attribute) === -1) {
                    this.__sorting.setOrderBy({ attribute: group.attribute, ascending: true }, true);
                }
                else {
                    // if it already is in the new sorting, we need to use this sort order
                    this.__sorting.setOrderBy({
                        attribute: group.attribute,
                        ascending: sortingAttributesOrder[sortIndex]
                    }, true);
                }
            });
            // last part is to get the column thats not in grouping and add them
            const groupings = this.__grouping.getGrouping().map((col) => col.attribute);
            sortingAttributes.forEach((attribute, i) => {
                if (groupings.indexOf(attribute) === -1) {
                    this.__sorting.setOrderBy({
                        attribute: sortingAttributes[i],
                        ascending: sortingAttributesOrder[i]
                    }, true);
                }
            });
            this.__sorting.runOrderBy(this.__collectionFiltered);
            // if grouping is set
            this.__collectionDisplayed = this.__grouping.group(this.__collectionFiltered, this.__grouping.getGrouping(), true, this);
        }
        else {
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
    filter(ObjFilter) {
        if (ObjFilter) {
            if (Array.isArray(ObjFilter)) {
                // FilterArgumentSimple[]
                this.__filter.setFilter({
                    type: 'GROUP',
                    logicalOperator: 'AND',
                    filterArguments: ObjFilter
                });
            }
            else {
                if (!ObjFilter.filterArguments || ObjFilter?.filterArguments?.length === 0) {
                    // FilterArgumentSimple
                    this.__filter.setFilter({
                        type: 'GROUP',
                        logicalOperator: 'AND',
                        filterArguments: [ObjFilter]
                    });
                    // empty group, clear
                    if (ObjFilter?.logicalOperator &&
                        //ObjFilter?.type &&
                        ObjFilter?.filterArguments?.length === 0) {
                        this.__filter.setFilter(null);
                    }
                }
                else {
                    // FilterArgument
                    // todo, check more and warn if missing options _
                    this.__filter.setFilter(ObjFilter);
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
    group(group, add) {
        let groupings;
        if (add) {
            groupings = this.__grouping.getGrouping();
            groupings = groupings.concat(group);
        }
        else {
            groupings = group;
        }
        this.__sorting.reset();
        groupings.forEach((group) => {
            this.__sorting.setOrderBy({ attribute: group.attribute, ascending: true }, true);
        });
        this.__sorting.runOrderBy(this.__collectionFiltered);
        if (groupings.length) {
            const result = this.__grouping.group(this.__collectionFiltered, groupings, true, this);
            this.__collectionDisplayed = result;
        }
        else {
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
    removeGroup(group) {
        if (group) {
            const groupings = this.__grouping.getGrouping();
            const oldGroupIndex = groupings.indexOf(group);
            if (oldGroupIndex !== -1) {
                groupings.splice(oldGroupIndex, 1);
            }
            this.group(groupings);
        }
        else {
            this.group([]);
        }
        this.__callSubscribers('collection-grouped', { info: 'removeGroup' });
    }
    /**
     * expand 1 or all groups
     * @param id null/undefined = all
     */
    expandGroup(id) {
        if (this.__grouping.getGrouping().length) {
            this.__collectionDisplayed = this.__grouping.expandOneOrAll(id);
            this.__callSubscribers('collection-expand');
        }
    }
    /**
     * collapse 1 or all groups
     * @param id null/undefined = all
     */
    collapseGroup(id) {
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
    __callSubscribers(event, data = {}) {
        const keeping = [];
        this.__listeners.forEach((callable) => {
            let keep;
            if (typeof callable === 'function') {
                keep = callable({ type: event, data: data });
            }
            else {
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
    addEventListener(callable) {
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
    removeEventListener(callable) {
        if (this.__listeners.has(callable)) {
            this.__listeners.delete(callable);
        }
    }
    /**
     *  returns lenght of sorted/filtered collection
     * @param onlyDataRows use this to skip grouping rows
     */
    length(onlyDataRows) {
        if (onlyDataRows) {
            return this.__collectionFiltered.length;
        }
        else {
            return this.__collectionDisplayed.length;
        }
    }
    /**
     * return selection mode used
     */
    getSelectionMode() {
        return this.__selectionMode;
    }
    /**
     * Selects all rows displayed
     */
    selectAll() {
        this.__selection.selectAll();
    }
    /**
     * deSelectAll all rows displayed
     */
    deSelectAll(triggerEvent = false) {
        this.__selection.deSelectAll(triggerEvent);
    }
    /**
     * replace selection mode used, if blank it will be set to 'none'
     */
    setSelectionMode(mode) {
        this.__selectionMode = mode || 'none';
    }
    /**
     * returns 1 row sorted/grouped/filtered, start on 0
     * @param rowNo
     */
    getRow(rowNo) {
        return this.__collectionDisplayed[rowNo];
    }
    /**
     * returns all rows sorted/grouped/filtered
     * @param onlyDataRows only get sorted/filtered and skip group
     */
    getRows(onlyDataRows) {
        if (onlyDataRows) {
            return this.__collectionFiltered;
        }
        else {
            return this.__collectionDisplayed;
        }
    }
    /**
     * sets current entity and selection, start on 1 not 0
     * @param row, if skipped we select the first
     */
    select(row, triggerSelect) {
        const selectedRow = row ? row - 1 : 0;
        this.__selection.highlightRow({}, selectedRow);
        if (triggerSelect) {
            this.__callSubscribers('select', { info: 'select-first', row: selectedRow });
        }
    }
    /**
     * updates current entity to first
     */
    selectFirst() {
        this.__selection.highlightRow({}, 0);
        this.__callSubscribers('select', { info: 'select-first', row: 0 });
    }
    /**
     * updates current entity, if first when running this it will select the last
     */
    selectPrev() {
        let row = this.__collectionDisplayed.indexOf(this.currentEntity) - 1;
        if (row < 0) {
            row = this.__collectionDisplayed.length - 1;
            this.__selection.highlightRow({}, row);
        }
        this.__selection.highlightRow({}, row);
        this.__callSubscribers('select', { info: 'select-prev', row });
    }
    /**
     * updates current entity, if on last it will end on up the first
     */
    selectNext() {
        let row = this.__collectionDisplayed.indexOf(this.currentEntity) + 1;
        if (this.__collectionDisplayed.length - 1 < row) {
            row = 0;
        }
        this.__selection.highlightRow({}, row);
        this.__callSubscribers('select', { info: 'select-next', row });
    }
    /**
     * updates current entity to last entity
     */
    selectLast() {
        const row = this.__collectionDisplayed.length - 1;
        this.__selection.highlightRow({}, row);
        this.__callSubscribers('select', { info: 'select-last', row });
    }
    /**
     * returns selected data rows
     * @returns
     */
    getSelectedRows() {
        const displayedRows = this.getRows();
        const selectedRows = this.getSelection().getSelectedRows();
        const data = [];
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
    setLocalCompare(code, options) {
        // should we also use this for filter ?
        this.__sorting.setLocaleCompare(code, options);
    }
    /**
     * resets current sort
     * @param defaultSortAttribute attribute name if you have a default you want to use
     */
    resetSort(defaultSortAttribute) {
        this.__sorting.reset(defaultSortAttribute);
    }
    /**
     * Sets order by, if you plan to filter with new sorting order you need to use this first
     * @param param
     * @param add
     */
    setOrderBy(param, add) {
        this.__sorting.setOrderBy(param, add);
    }
    /**
     * returns current sortorder config
     */
    getOrderBy() {
        return this.__sorting.getOrderBy();
    }
    /**
     * returns current grouing config
     */
    getGrouping() {
        return this.__grouping.getGrouping();
    }
    /**
     * sets current grouing config
     */
    setGrouping(group) {
        this.__grouping.setGrouping(group);
    }
    /**
     * sets current expanded ids
     */
    setExpanded(x) {
        this.__grouping.setExpanded(x);
    }
    /**
     * gets current expanded ids
     */
    getExpanded() {
        return this.__grouping.getExpanded();
    }
    getFilter() {
        return this.__filter.getFilter();
    }
    getSelection() {
        return this.__selection;
    }
    sortReset() {
        return this.__sorting.reset();
    }
    getFilterFromType(type) {
        return this.__filter.getFilterFromType(type);
    }
    setFilter(filter) {
        return this.__filter.setFilter(filter);
    }
    reloadDatasource() {
        this.__collectionFiltered = this.getAllData();
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info: 'filter' });
        }
    }
    getFilterString(ctx) {
        const filter = this.__filter.getFilter();
        if (!filter?.filterArguments?.length) {
            return '';
        }
        const valueFormater = this.getValueFormater();
        function convertValue(type, value, attribute) {
            return valueFormater.fromSource(value, type, attribute, true);
        }
        function label(attribute) {
            if (!ctx) {
                return attribute;
            }
            const label = ctx.gridInterface.__getGridConfig().__attributes[attribute].label;
            return label || attribute;
        }
        const parser = (obj, queryString = '') => {
            if (obj) {
                if (!obj.filterArguments || (obj.filterArguments && obj.filterArguments.length === 0)) {
                    if (obj.operator === 'IS_BLANK' || obj.operator === 'IS_NOT_BLANK') {
                        queryString = `${queryString}[${label(obj.attribute)}] <<${OPERATORS[obj.operator]}>>`;
                    }
                    else {
                        if (obj.operator !== 'IN' && obj.operator !== 'NOT_IN') {
                            queryString =
                                queryString +
                                    `[${label(obj.attribute)}] <<${OPERATORS[obj.operator]}>> ${obj.valueType === 'ATTRIBUTE'
                                        ? `[${obj.value}]`
                                        : `'${convertValue(obj.attributeType, obj.value, obj.attribute)}'`}`;
                        }
                        else {
                            // split newline into array
                            if (Array.isArray(obj.value)) {
                                queryString =
                                    queryString +
                                        `[${label(obj.attribute)}] <<${OPERATORS[obj.operator]}>> [${obj.value.map((val) => {
                                            return `'${val}'`;
                                        })}]`;
                            }
                            else {
                                queryString =
                                    queryString +
                                        `[${label(obj.attribute)}] <<${OPERATORS[obj.operator]}>> [${obj.value
                                            .split('\n')
                                            .map((val) => {
                                            return `'${val}'`;
                                        })}]`;
                            }
                        }
                    }
                }
                else {
                    obj.filterArguments.forEach((y, i) => {
                        if (i > 0) {
                            queryString = `${queryString} ${obj.logicalOperator} `;
                        }
                        else {
                            queryString = `${queryString}(`;
                        }
                        queryString = parser(y, queryString);
                        if (obj.filterArguments.length - 1 === i) {
                            queryString = `${queryString})`;
                        }
                    });
                }
            }
            return queryString;
        };
        return parser(this.__filter.getFilter()).toUpperCase();
    }
}
//# sourceMappingURL=dataSource.js.map