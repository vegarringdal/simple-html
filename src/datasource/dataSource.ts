import { Emitter, type EventHandler } from '../emitter';
import { BooleanFormatter } from './booleanFormatter';
import { DateFormatterYYYYMMDD } from './DateFormatterYYYYMMDD';
import { DateFormatterYYYYMMDDTHHMMSS } from './DateFormatterYYYYMMDDTHHMMSS';
import { DataContainer } from './dataContainer';
import type { DatasourceEvents } from './datasourceEvents';
import type { DatasourceOptions } from './datasourceOptions';
import { type Entity, type GroupRow, isGroupRow } from './entity';
import { type Field, type FieldConfig, type FieldType, isFieldType } from './field';
import { Filter, isIgnoredCondition } from './filter';
import { type FilterCondition, type FilterExpression, isFilterGroup } from './filterExpression';
import type { Formatter } from './formatter';
import type { GroupArgument } from './groupArgument';
import { Grouping } from './grouping';
import { NumberFormatterDot } from './numberFormatterDot';
import { OPERATORS } from './OPERATORS';
import { Selection } from './selection';
import type { SelectionMode } from './selectionMode';
import { Sort } from './sort';
import type { SortArgument } from './sortArgument';
import { TextFormatter } from './textFormatter';

export type EntityUnion<T> = Entity & T;

/**
 * A single filter condition, ready for display. `label` is the field's label (see
 * `getFilterTree()`), `value` is already run through the field's formatter; blank operators
 * (`IS_BLANK` / `IS_NOT_BLANK`) have no value, flagged by `hasValue`.
 */
export interface FilterConditionNode {
    kind: 'condition';
    label: string;
    operator: string;
    value: string;
    hasValue: boolean;
}

/**
 * A group of filter nodes joined by one logical operator, mirroring the nesting in the
 * filter editor so grouping/precedence can be shown rather than flattened away.
 */
export interface FilterGroupNode {
    kind: 'group';
    logicalOperator: 'AND' | 'OR';
    children: FilterNode[];
}

export type FilterNode = FilterConditionNode | FilterGroupNode;

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
     * This is the data that is sorted/filtered and grouped: data rows, and the group rows when grouped
     */
    private __collectionDisplayed: (Entity | GroupRow)[] = [];

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
     * the handlers subscribed with on(), called when the collection changes/is sorted/filtered etc
     */
    private __events = new Emitter<DatasourceEvents>();

    /**
     * the fields from the `fields` option, the shorthand `born: 'date'` written out as `{ type: 'date' }`
     */
    private __fields = new Map<string, FieldConfig>();

    /**
     * the default formatter per type, the built-in ones with the `formatters` option on top
     */
    private __formatters: Record<FieldType, Formatter>;

    /**
     * The current row: the one last clicked, selected or set with `setRowAsCurrentEntity()`. Use it
     * for a detail form next to the grid. `null` until a row is made current.
     *
     * When grouped it can be a {@link GroupRow}: moving the focus up from the first data row into
     * the header filter row makes row 0 current, and that is a group row when grouped.
     * `setRowAsCurrentEntity(row)` does the same for a group row's index. Clicking a group row,
     * `select()` and `selectNext()` ... never make one current. Check with {@link isGroupRow}.
     *
     * @example
     * ```ts
     * datasource.on('current-entity', () => {
     *     const row = datasource.currentEntity;
     *     if (row && !isGroupRow(row)) {
     *         form.show(row);
     *     } else {
     *         form.clear();
     *     }
     * });
     * ```
     */
    public currentEntity: EntityUnion<T> | GroupRow | null = null;

    /**
     * @param options the key, the fields and their formatters, the selection mode, or a data
     * container shared with another datasource - all optional, see {@link DatasourceOptions}
     * @throws when `key` and `container` are both given and `key` is not the container's key, or a
     * field has a type that does not exist
     *
     * @example
     * ```ts
     * const datasource = new Datasource({
     *     key: 'id',
     *     fields: { born: 'date', age: { type: 'number', label: 'Age' } }
     * });
     * datasource.setData([{ id: 1, name: 'Ann', born: new Date(1990, 4, 17), age: 36 }]);
     * ```
     */
    constructor(options: DatasourceOptions = {}) {
        const { key, container } = options;
        if (container && key !== undefined && key !== container.getKeyAttribute()) {
            throw new Error(
                `Datasource: key '${key}' is not the key of the container ('${container.getKeyAttribute()}'), give the key to the DataContainer only`
            );
        }
        this.__dataContainer = container || new DataContainer(key);

        const formatters = options.formatters || {};
        this.__formatters = {
            text: formatters.text ?? TextFormatter,
            number: formatters.number ?? NumberFormatterDot,
            boolean: formatters.boolean ?? BooleanFormatter,
            date: formatters.date ?? DateFormatterYYYYMMDD,
            datetime: formatters.datetime ?? DateFormatterYYYYMMDDTHHMMSS
        };

        for (const [name, field] of Object.entries(options.fields || {})) {
            const config: FieldConfig = typeof field === 'string' ? { type: field } : { ...field };
            // a typo in plain js would otherwise show up much later, as a field without a formatter
            if (config.type !== undefined && !isFieldType(config.type)) {
                throw new Error(`Datasource: field '${name}' has an unknown type '${config.type}'`);
            }
            this.__fields.set(name, config);
        }

        this.__selectionMode = options.selectionMode || 'multiple';
        this.__selection = new Selection(this);
        this.__filter = new Filter();
        // the type is looked up once per sort, not per row
        this.__sorting = new Sort((attribute) => this.getField(attribute).type);
        this.__grouping = new Grouping();
    }

    /**
     * so I can check
     */
    public get type() {
        return 'Datasource';
    }

    /**
     * A field as the datasource sees it: its type, label and formatter, with every default filled in.
     * A field that is not listed in `fields` is a `'text'` field labelled with its name.
     *
     * @param name the field name, the property on the row
     *
     * @example
     * ```ts
     * const datasource = new Datasource({ fields: { born: { type: 'date', label: 'Born' } } });
     *
     * datasource.getField('born'); // { name: 'born', type: 'date', label: 'Born', formatter: DateFormatterYYYYMMDD }
     * datasource.getField('name'); // { name: 'name', type: 'text', label: 'name', formatter: TextFormatter }
     * ```
     */
    public getField(name: string): Field {
        const config = this.__fields.get(name);
        return {
            name,
            type: config?.type ?? 'text',
            label: config?.label || name,
            formatter: this.getFormatter(name)
        };
    }

    /**
     * The formatter for a field: its own (`FieldConfig.formatter`), else the datasource's default for
     * its type.
     *
     * @param field the field name. A field that is not listed in `fields` is `'text'`
     * @param type use this type instead of the field's. When it is not the field's type, the default
     * formatter for `type` is returned - the field's own formatter is written for its own type. The
     * grid uses it for `dynamicCellTypeColumn`, where another column of the row decides the type.
     *
     * @example
     * ```ts
     * const datasource = new Datasource({
     *     fields: { price: { type: 'number', formatter: NumberFormatterComma }, born: 'date' }
     * });
     *
     * datasource.getFormatter('price').format(12.5); // '12,5'
     * datasource.getFormatter('born').format(new Date(2026, 10, 20)); // '2026-11-20'
     * datasource.getFormatter('value', 'number').parse('12.5'); // 12.5, the default number formatter
     * ```
     */
    public getFormatter(field: string, type?: FieldType): Formatter {
        const config = this.__fields.get(field);
        const fieldType = config?.type ?? 'text';
        if (type && type !== fieldType) {
            return this.__formatters[type];
        }
        return config?.formatter ?? this.__formatters[fieldType];
    }

    /**
     * @internal
     * the field as it was given in `fields` (the shorthand written out), undefined when it is not
     * listed. The grid uses it for a label that was really given
     */
    public __getFieldConfig(name: string): FieldConfig | undefined {
        return this.__fields.get(name);
    }

    public getMarkedForDeletion(): EntityUnion<T>[] {
        return this.__dataContainer.getMarkedForDeletion() as EntityUnion<T>[];
    }

    public clearMarkedForDeletion() {
        this.__dataContainer.clearMarkedForDeletion();
        // the rows are gone from the container, rebuild the displayed rows or they stay on screen.
        // Same event as removeData, it is a removal
        this.__internalUpdate(true);
        this.__callSubscribers('collection-changed', { removed: true, info: 'clearMarkedForDeletion' });
    }

    /**
     * resets all edited data and brings back marked for deletion
     */
    public resetData() {
        this.__dataContainer.resetData();
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info: 'resetData' });
        }
    }

    /**
     * resets all edited data and brings back marked for deletion
     */
    public resetDataSelectionOnly() {
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
    public getChanges() {
        return this.__dataContainer.getChanges();
    }

    /**
     * only mark for deletion, you can reset/bring it back with resetData()
     * @param data
     * @param all
     */
    public markForDeletion(data: Entity | Entity[] | null, all = false) {
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
    public removeData(data: Entity | Entity[] | null, all = false, rerunFilters = true) {
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
     * This returns datacontainer used
     */
    public getDataContainer() {
        return this.__dataContainer;
    }

    /**
     * @internal
     * INTERNAL: Used by selection to set new current entity
     * @param row
     */
    public __select(row: number) {
        // out of range is undefined, made null below
        this.currentEntity = this.__collectionDisplayed[row] as EntityUnion<T> | GroupRow;
        if (this.currentEntity === undefined) {
            this.currentEntity = null; // so its always a entity or null, makes it easier to work with
        }
        this.__callSubscribers('current-entity', {});
    }

    /**
     * sets row as current entity. A group row's index makes the group row current, see
     * {@link currentEntity}
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
        const dataset = this.__dataContainer.getDataSet();
        const newRow = dataset[dataset.length - 1];

        if (this.__grouping.getGrouping().length) {
            // grouped: the row has to be grouped with the rest, appended at the end it sat outside
            // every group and was lost on the next expand/collapse. Its group is expanded so it is seen
            this.__collectionFiltered.push(newRow);
            this.__internalUpdate(false);
            this.__collectionDisplayed = this.__grouping.expandToEntity(newRow);
            this.__callSubscribers('collection-changed', { added: true });
            if (scrollto) {
                this.select(this.__collectionDisplayed.indexOf(newRow) + 1, true);
            }
            return;
        }

        this.__internalUpdate(false);
        // force add after internal update, doing before will mess up location
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
        this.__callSubscribers('collection-sorted', {});
    }

    /**
     * Sets the filter and runs it. The rows it lets through are sorted and grouped the way the
     * datasource is, and are what `getRows()` returns.
     *
     * - `filter(expression)` - filter on this, it replaces the filter there was
     * - `filter(null)` - no filter, every row is shown
     * - `filter()` - run the current filter again
     *
     * The root can be a group or a single condition. Conditions without a field or operator, date
     * conditions without the value they need and empty groups are ignored. The datasource keeps the
     * object it is given, `getFilter()` returns it.
     *
     * @param expression a condition or a group of them, see {@link FilterExpression}. Build it with
     * {@link and}, {@link or} and {@link where}.
     *
     * @example
     * ```ts
     * import { and, or, where } from '@simple-html/grid';
     *
     * datasource.filter(where('balance', 'GREATER_THAN', 2500));
     *
     * // country = 'Norway' AND (age < 30 OR age > 60)
     * datasource.filter(
     *     and(where('country', 'EQUAL', 'Norway'), or(where('age', 'LESS_THAN', 30), where('age', 'GREATER_THAN', 60)))
     * );
     *
     * datasource.filter(); // run it again
     * datasource.filter(null); // every row
     * ```
     */
    public filter(expression?: FilterExpression | null) {
        if (expression !== undefined) {
            this.__filter.setFilter(expression);
        }
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
        // setGrouping() alone does not build the groups, there is nothing to expand until it is applied
        if (this.__grouping.hasGroups()) {
            this.__collectionDisplayed = this.__grouping.expandOneOrAll(id);
            this.__callSubscribers('collection-expand', {});
        }
    }

    /**
     * collapse 1 or all groups
     * @param id null/undefined = all
     */
    public collapseGroup(id?: string) {
        // setGrouping() alone does not build the groups, there is nothing to collapse until it is applied
        if (this.__grouping.hasGroups()) {
            this.__collectionDisplayed = this.__grouping.collapseOneOrAll(id);
            this.__callSubscribers('collection-collapse', {});
        }
    }

    /**
     * @internal
     * sends an event to the handlers subscribed with on(), used by the datasource itself and the
     * selection controller
     */
    public __callSubscribers<Type extends keyof DatasourceEvents>(type: Type, data: DatasourceEvents[Type]): void {
        this.__events.emit(type, data);
    }

    /**
     * Subscribes to an event. The handler gets the event's payload, typed from
     * {@link DatasourceEvents} - see there for every event and what it sends.
     *
     * The handler stays subscribed until you call the function this returns. What the handler
     * returns is ignored (in v5 it had to return `true` to stay subscribed).
     *
     * @param type the event name
     * @param handler called with the payload every time the event is sent
     * @returns a function that unsubscribes the handler
     *
     * @example
     * ```ts
     * const off = datasource.on('collection-filtered', (data) => {
     *     console.log('filtered by', data.info, '-', datasource.length(true), 'rows');
     * });
     *
     * datasource.on('current-entity', () => {
     *     console.log('current row', datasource.currentEntity);
     * });
     *
     * off(); // unsubscribe
     * ```
     */
    public on<Type extends keyof DatasourceEvents>(type: Type, handler: EventHandler<DatasourceEvents[Type]>): () => void {
        return this.__events.on(type, handler);
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
     * deselectAll all rows displayed
     */
    public deselectAll(triggerEvent = false) {
        this.__selection.deselectAll(triggerEvent);
    }

    /**
     * replace selection mode used, if blank it will be set to 'none'
     */
    public setSelectionMode(mode: SelectionMode): void {
        this.__selectionMode = mode || 'none';
    }

    /**
     * returns 1 row of the displayed rows (`getRows()`), start on 0. When grouped it can be a
     * {@link GroupRow}, check with {@link isGroupRow}. Out of range gives `undefined`.
     * @param rowNo
     */
    public getRow(rowNo: number): EntityUnion<T> | GroupRow {
        return this.__collectionDisplayed[rowNo] as EntityUnion<T> | GroupRow;
    }

    /**
     * Returns the rows as they are displayed: filtered, sorted and grouped. When grouped, that
     * is your data rows with a {@link GroupRow} in front of each group, and the rows of a
     * collapsed group left out.
     *
     * `getRows(true)` returns the data rows only - filtered and sorted, never a group row, and
     * the rows of collapsed groups included. The return type follows the argument.
     *
     * @param onlyDataRows `true` to skip the group rows
     *
     * @example
     * ```ts
     * datasource.group([{ attribute: 'country', title: 'Country' }]);
     *
     * // data rows and group rows, as the grid shows them
     * datasource.getRows().forEach((row) => {
     *     if (isGroupRow(row)) {
     *         console.log(row.__groupName);
     *     } else {
     *         console.log(row.name);
     *     }
     * });
     *
     * // data rows only, no check needed
     * const names = datasource.getRows(true).map((row) => row.name);
     * ```
     */
    public getRows(onlyDataRows: true): EntityUnion<T>[];
    public getRows(onlyDataRows?: false): (EntityUnion<T> | GroupRow)[];
    public getRows(onlyDataRows?: boolean): (EntityUnion<T> | GroupRow)[];
    public getRows(onlyDataRows?: boolean): (EntityUnion<T> | GroupRow)[] {
        if (onlyDataRows) {
            return this.__collectionFiltered as EntityUnion<T>[];
        } else {
            return this.__collectionDisplayed as (EntityUnion<T> | GroupRow)[];
        }
    }

    /**
     * sets current entity and selection, start on 1 not 0
     * @param row if skipped we select the first
     * @param triggerSelect also fire the select event, so the grid scrolls to the row
     */
    public select(row?: number, triggerSelect?: boolean): void {
        // a group header can not be selected, take the first data row from there on
        const selectedRow = this.__findDataRow(row ? row - 1 : 0, 1);
        if (selectedRow === -1) {
            return;
        }
        this.__selection.highlightRow({} as any, selectedRow);
        if (triggerSelect) {
            this.__callSubscribers('select', { info: 'select-first', row: selectedRow });
        }
    }

    /**
     * updates current entity to first
     */
    public selectFirst(): void {
        this.__selectAndNotify(this.__findDataRow(0, 1), 'select-first');
    }

    /**
     * updates current entity, if first when running this it will select the last
     */
    public selectPrev(): void {
        let row = this.__findDataRow(this.__currentEntityIndex() - 1, -1);
        if (row === -1) {
            row = this.__findDataRow(this.__collectionDisplayed.length - 1, -1);
        }
        this.__selectAndNotify(row, 'select-prev');
    }

    /**
     * updates current entity, if on last it will end on up the first
     */
    public selectNext(): void {
        let row = this.__findDataRow(this.__currentEntityIndex() + 1, 1);
        if (row === -1) {
            row = this.__findDataRow(0, 1);
        }
        this.__selectAndNotify(row, 'select-next');
    }

    /**
     * updates current entity to last entity
     */
    public selectLast(): void {
        this.__selectAndNotify(this.__findDataRow(this.__collectionDisplayed.length - 1, -1), 'select-last');
    }

    /**
     * index of the current entity in the displayed rows, -1 if there is none
     */
    private __currentEntityIndex(): number {
        return this.currentEntity ? this.__collectionDisplayed.indexOf(this.currentEntity) : -1;
    }

    /**
     * index of the first data row (not a group header) from `start`, walking in `step` direction
     * @returns -1 if there is none
     */
    private __findDataRow(start: number, step: 1 | -1): number {
        for (let i = start; i >= 0 && i < this.__collectionDisplayed.length; i += step) {
            if (!isGroupRow(this.__collectionDisplayed[i])) {
                return i;
            }
        }
        return -1;
    }

    /**
     * selects the row and fires the select event, does nothing if there is no row (-1)
     */
    private __selectAndNotify(row: number, info: DatasourceEvents['select']['info']): void {
        if (row === -1) {
            return;
        }
        this.__selection.highlightRow({} as any, row);
        this.__callSubscribers('select', { info, row });
    }

    /**
     * returns the selected rows, in displayed order. Data rows only, a group row can not be selected
     * @returns
     */
    public getSelectedRows(): EntityUnion<T>[] {
        const displayedRows = this.getRows();
        const selectedRows = this.getSelection().getSelectedRows();
        const data: EntityUnion<T>[] = [];
        selectedRows.forEach((row) => {
            const entity = displayedRows[row];
            // the selection never has a group row in it, the check is for the type
            if (!isGroupRow(entity)) {
                data.push(entity);
            }
        });
        return data;
    }

    /**
     * sets Intl Collator , this is used for sorting
     * @param code
     * @param options
     */
    public setLocaleCompare(code: string, options?: any) {
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
        // the groups built for the old grouping no longer match it, expand/collapse wait until
        // the new grouping is applied
        this.__grouping.clearGroups();
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

    /**
     * The filter that is set: the object given to `filter()` / `setFilter()`, the header filters and
     * the filter editor's, or null when there is none. The root is a group or a single condition.
     *
     * It is the datasource's own object, not a copy.
     *
     * @example
     * ```ts
     * datasource.filter(where('age', 'GREATER_THAN', 18));
     * datasource.getFilter(); // { field: 'age', operator: 'GREATER_THAN', value: 18 }
     *
     * // typing 'x' in the header filter of name adds to it
     * datasource.getFilter();
     * // { group: 'AND', children: [
     * //     { field: 'age', operator: 'GREATER_THAN', value: 18 },
     * //     { field: 'name', operator: 'EQUAL', value: 'x' }
     * // ] }
     *
     * datasource.filter(null);
     * datasource.getFilter(); // null
     * ```
     */
    public getFilter(): FilterExpression | null {
        return this.__filter.getFilter();
    }

    /**
     * @internal the grid's click/keyboard selection handling
     */
    public getSelection() {
        return this.__selection;
    }

    public getFilterFromType(type: string) {
        return this.__filter.getFilterFromType(type);
    }

    /**
     * Sets the filter without running it - `filter()` runs it. `setFilter(null)` removes it.
     *
     * @param expression a condition or a group, see {@link FilterExpression}, or null for no filter
     *
     * @example
     * ```ts
     * datasource.setFilter(where('age', 'GREATER_THAN', 18));
     * datasource.filter(); // runs it
     * ```
     */
    public setFilter(expression: FilterExpression | null) {
        this.__filter.setFilter(expression);
    }

    public reloadDatasource() {
        this.__collectionFiltered = this.getAllData();
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info: 'filter' });
        }
    }

    /**
     * The filter as text, e.g. `([NAME] <<EQUAL_TO>> 'X')`, upper case. Values are shown with the
     * field's formatter, a `valueField` as `[LABEL]`. What the filter ignores - incomplete conditions,
     * empty groups - is left out, and `''` is returned when nothing is left (or no filter is set).
     *
     * @param label the name to show for a field. Default the field's label (`FieldConfig.label`, else
     * the field name). The grid passes its column labels.
     *
     * @example
     * ```ts
     * const datasource = new Datasource({ fields: { born: { type: 'date', label: 'Born' } } });
     * datasource.filter(where('born', 'GREATER_THAN', new Date(1990, 0, 1)));
     *
     * datasource.getFilterString(); // "([BORN] <<GREATER_THAN>> '1990-01-01')"
     * datasource.getFilterString((field) => field.toUpperCase() + '!'); // "([BORN!] <<GREATER_THAN>> '1990-01-01')"
     *
     * datasource.filter(and(where('a', 'EQUAL', 'x'), or(where('b', 'EQUAL', 'y'), where('b', 'EQUAL', 'z'))));
     * datasource.getFilterString(); // "([A] <<EQUAL_TO>> 'X' AND ([B] <<EQUAL_TO>> 'Y' OR [B] <<EQUAL_TO>> 'Z'))"
     * ```
     */
    public getFilterString(label: (field: string) => string = (field) => this.getField(field).label): string {
        const filter = this.__filter.getFilter();
        if (!filter || !this.__isShown(filter)) {
            return '';
        }

        const parser = (expression: FilterExpression): string => {
            if (isFilterGroup(expression)) {
                // the filter treats anything but OR as AND
                const operator = expression.group === 'OR' ? 'OR' : 'AND';
                const children = expression.children.filter((child) => this.__isShown(child));
                return `(${children.map(parser).join(` ${operator} `)})`;
            }

            const condition = `[${label(expression.field)}] <<${OPERATORS[expression.operator]}>>`;
            if (expression.operator === 'IS_BLANK' || expression.operator === 'IS_NOT_BLANK') {
                return condition;
            }
            if (expression.operator === 'IN' || expression.operator === 'NOT_IN') {
                // a list, or a string with one value per line
                const values = Array.isArray(expression.value) ? expression.value : String(expression.value).split('\n');
                return `${condition} [${values.map((value) => `'${value}'`).join(',')}]`;
            }
            if (expression.valueField) {
                return `${condition} [${label(expression.valueField)}]`;
            }
            const type = this.getField(expression.field).type;
            return `${condition} '${this.getFormatter(expression.field, type).format(expression.value)}'`;
        };

        // a single condition is in parentheses too, like a group of one
        const text = isFilterGroup(filter) ? parser(filter) : `(${parser(filter)})`;
        return text.toUpperCase();
    }

    /**
     * Same information as {@link getFilterString}, but as a tree of {@link FilterNode}s that
     * keeps the group nesting, so the footer can render grouped conditions as clusters
     * instead of a flat, ambiguous list. The root is always a group, also when the filter is a
     * single condition. What the filter ignores is left out: incomplete conditions are, an empty
     * group is a group with no children. Returns `null` when no filter is set or nothing of it is
     * shown - when {@link getFilterString} returns `''`.
     *
     * @param label the name to show for a field. Default the field's label (`FieldConfig.label`, else
     * the field name). The grid passes its column labels.
     *
     * @example
     * ```ts
     * const datasource = new Datasource({ fields: { age: { type: 'number', label: 'Age' } } });
     * datasource.filter(where('age', 'GREATER_THAN', 18));
     *
     * datasource.getFilterTree();
     * // { kind: 'group', logicalOperator: 'AND', children: [
     * //     { kind: 'condition', label: 'Age', operator: 'GREATER_THAN', value: '18', hasValue: true }
     * // ] }
     * ```
     */
    public getFilterTree(label: (field: string) => string = (field) => this.getField(field).label): FilterGroupNode | null {
        const filter = this.__filter.getFilter();
        if (!filter || !this.__isShown(filter)) {
            return null;
        }

        const build = (expression: FilterExpression): FilterNode | null => {
            // an empty group stays a group with no children
            if (isFilterGroup(expression)) {
                return {
                    kind: 'group',
                    // the filter treats anything but OR as AND
                    logicalOperator: expression.group === 'OR' ? 'OR' : 'AND',
                    children: expression.children.map(build).filter((node): node is FilterNode => node !== null)
                };
            }
            // the filter ignores incomplete conditions, so they are not shown either
            if (this.__isIgnored(expression)) {
                return null;
            }

            const blank = expression.operator === 'IS_BLANK' || expression.operator === 'IS_NOT_BLANK';
            let value = '';
            if (!blank) {
                if (expression.operator === 'IN' || expression.operator === 'NOT_IN') {
                    const list = Array.isArray(expression.value) ? expression.value : String(expression.value ?? '').split('\n');
                    value = list.join(', ');
                } else if (expression.valueField) {
                    value = `[${label(expression.valueField)}]`;
                } else {
                    const type = this.getField(expression.field).type;
                    value = this.getFormatter(expression.field, type).format(expression.value);
                }
            }

            return {
                kind: 'condition',
                label: label(expression.field),
                operator: expression.operator,
                value,
                hasValue: !blank
            };
        };

        const root = build(filter);
        if (root?.kind === 'group') {
            return root;
        }
        // __isShown(filter) is true, so a condition at the root is built
        return { kind: 'group', logicalOperator: 'AND', children: root ? [root] : [] };
    }

    /**
     * true if the filter ignores the condition, see isIgnoredCondition. Its type is the field's type
     */
    private __isIgnored(condition: FilterCondition): boolean {
        return isIgnoredCondition(condition, this.getField(condition.field).type);
    }

    /**
     * true if getFilterString / getFilterTree show something of the expression: a condition the
     * filter does not ignore, or a group with one somewhere in it
     */
    private __isShown(expression: FilterExpression): boolean {
        if (isFilterGroup(expression)) {
            return expression.children.some((child) => this.__isShown(child));
        }
        return !this.__isIgnored(expression);
    }
}
