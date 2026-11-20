import { Emitter, type EventHandler } from '../emitter';
import { assertOptions } from './assertOptions';
import type { Changes } from './changes';
import { DataContainer } from './dataContainer';
import type { DatasourceEvents } from './datasourceEvents';
import type { DatasourceOptions } from './datasourceOptions';
import { type Entity, type GroupRow, isGroupRow } from './entity';
import { type Field, type FieldConfig, type FieldType, isFieldType } from './field';
import { Filter, isIgnoredCondition } from './filter';
import { type FilterCondition, type FilterExpression, isFilterGroup } from './filterExpression';
import type { Formatter } from './formatter';
import { DEFAULT_FORMATTER_IDS, getRegisteredFormatter } from './formatterRegistry';
import type { GroupArgument } from './groupArgument';
import { Grouping } from './grouping';
import { OPERATORS } from './OPERATORS';
import { Selection } from './selection';
import type { SelectionMode } from './selectionMode';
import { Sort } from './sort';
import type { SortArgument } from './sortArgument';

/**
 * A data row as the datasource hands it out: your object `T` and the fields of an {@link Entity} - the
 * key, the row state, the error and the edit tracking controller. `getDataRows()`, `getSelectedRows()`,
 * `getAllData()` ... return these.
 *
 * The row is your own object, wrapped in a `Proxy` that tracks the edits: setting a field on it is an
 * edit (`getChanges()`).
 *
 * @typeParam T the type of your rows, the `T` of `Datasource<T>`
 *
 * @example
 * ```ts
 * import { Datasource, type EntityUnion } from '@simple-html/grid';
 *
 * interface Person {
 *     id: number;
 *     name: string;
 * }
 *
 * const datasource = new Datasource<Person>({ key: 'id' });
 * datasource.setData([{ id: 1, name: 'Ann' }]);
 * const ann: EntityUnion<Person> = datasource.getDataRows()[0];
 * ann.name; // 'Ann'
 * ann.__rowState; // undefined: not edited
 * ```
 */
export type EntityUnion<T> = Entity & T;

/**
 * One condition of {@link FilterGroupNode}, ready to show: the field's label and the value as text.
 * Part of what `getFilterTree()` returns.
 *
 * @example
 * ```ts
 * import type { FilterConditionNode } from '@simple-html/grid';
 *
 * const describe = (node: FilterConditionNode) => (node.hasValue ? `${node.label} ${node.operator} ${node.value}` : `${node.label} ${node.operator}`);
 * ```
 */
export interface FilterConditionNode {
    /** always `'condition'` */
    kind: 'condition';
    /** the field's label, or what the `label` function given to `getFilterTree()` returns */
    label: string;
    /** the operator's name, e.g. `'EQUAL'`, see {@link FilterOperator} */
    operator: string;
    /**
     * the value as text: formatted with the field's formatter, the values of `IN` / `NOT_IN` joined by
     * `', '`, a `valueField` as `[label]`. `''` for `IS_BLANK` / `IS_NOT_BLANK`
     */
    value: string;
    /** `false` for `IS_BLANK` / `IS_NOT_BLANK`, they take no value */
    hasValue: boolean;
}

/**
 * A group of filter nodes joined by one logical operator, as `getFilterTree()` returns it. It keeps the
 * nesting of the filter, so the grouping can be shown, not flattened away - the grid's footer draws
 * these as bracketed chips.
 *
 * @example
 * ```ts
 * import type { FilterNode } from '@simple-html/grid';
 *
 * // the filter as text: (age GREATER_THAN 18 AND (country EQUAL Norway OR country EQUAL Sweden))
 * const toText = (node: FilterNode): string =>
 *     node.kind === 'group'
 *         ? `(${node.children.map(toText).join(` ${node.logicalOperator} `)})`
 *         : `${node.label} ${node.operator} ${node.value}`;
 *
 * const tree = datasource.getFilterTree();
 * const text = tree ? toText(tree) : 'no filter';
 * ```
 */
export interface FilterGroupNode {
    /** always `'group'` */
    kind: 'group';
    /** how the children are joined: `'AND'`, or `'OR'` */
    logicalOperator: 'AND' | 'OR';
    /** the conditions and groups in it. The conditions the filter ignores are left out */
    children: FilterNode[];
}

/**
 * A node of the tree `datasource.getFilterTree()` returns: a {@link FilterGroupNode} or a
 * {@link FilterConditionNode}. Tell them apart by `kind`.
 */
export type FilterNode = FilterConditionNode | FilterGroupNode;

/**
 * The rows of a grid, and what is done with them: the data, the fields (type, label and formatter of
 * each), the filter, sorting, grouping, selection, the current row and the edits (`getChanges()`).
 * It works without a grid too.
 *
 * A grid shows one datasource: give it to `createGrid()`. What you do here - `filter()`, `sort()`,
 * `setData()` ... - sends an event (see {@link DatasourceEvents}), and the grid shows the result.
 *
 * @typeParam T the type of your rows. The rows the datasource hands out are {@link EntityUnion}`<T>`:
 * your object with the key and the edit tracking fields
 *
 * @sample basic-grid
 * @example
 * ```ts
 * import { Datasource, where } from '@simple-html/grid';
 *
 * interface Person {
 *     id: number;
 *     name: string;
 *     born: Date;
 * }
 *
 * const datasource = new Datasource<Person>({ key: 'id', fields: { born: 'date' } });
 * datasource.setData([
 *     { id: 1, name: 'Ann', born: new Date(1990, 4, 17) },
 *     { id: 2, name: 'Bob', born: new Date(1985, 0, 2) }
 * ]);
 *
 * datasource.filter(where('name', 'BEGIN_WITH', 'a'));
 * datasource.sort({ attribute: 'born', ascending: false });
 * datasource.getDataRows().map((row) => row.name); // ['Ann']
 * ```
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
     * the default formatter per type, the built-in ones with the `formatters` option on top. Looked up
     * in the registry when the datasource is made
     */
    private __formatters: Record<FieldType, Formatter>;

    /**
     * the formatters of the fields that have one of their own (`FieldConfig.formatter`), looked up in
     * the registry when the datasource is made
     */
    private __fieldFormatters = new Map<string, Formatter>();

    /**
     * The current row: the one last clicked, selected or set with `setRowAsCurrentEntity()`. Use it
     * for a detail form next to the grid. `null` until a row is made current.
     *
     * When grouped it can be a {@link GroupRow}: moving the focus up from the first data row into
     * the header filter row makes row 0 current, and that is a group row when grouped.
     * `setRowAsCurrentEntity(row)` does the same for a group row's index. Clicking a group row,
     * `select()` and `selectNext()` ... never make one current. Check with {@link isGroupRow}.
     *
     * `setData()` sets it to `null` when the current row is no longer in the data - the rows were
     * replaced by new objects, also ones with the same key - and keeps it when it still is (rows added,
     * or the same row objects set again). The `current-entity` event is sent when it changes.
     *
     * @example
     * ```ts
     * import { isGroupRow } from '@simple-html/grid';
     *
     * declare const detailForm: { show(row: object): void; clear(): void };
     *
     * datasource.on('current-entity', () => {
     *     const row = datasource.currentEntity;
     *     if (row && !isGroupRow(row)) {
     *         detailForm.show(row);
     *     } else {
     *         detailForm.clear();
     *     }
     * });
     * ```
     */
    public currentEntity: EntityUnion<T> | GroupRow | null = null;

    /**
     * @param options the key, the fields and their formatters, the selection mode, or a data
     * container shared with another datasource - all optional, see {@link DatasourceOptions}
     * @throws when `key` and `container` are both given and `key` is not the container's key, a
     * field has a type that does not exist, a formatter id is not registered (see
     * {@link registerFormatter}), or a field has another type than in a datasource made earlier on
     * the same `container`
     *
     * @example
     * ```ts
     * import { Datasource } from '@simple-html/grid';
     *
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

        // the formatters are ids in the options, looked up once, here: an id that is not registered
        // throws now, not when a cell is rendered
        const formatters = options.formatters || {};
        const defaultFor = (type: FieldType) =>
            getRegisteredFormatter(formatters[type] ?? DEFAULT_FORMATTER_IDS[type], `formatters.${type}`);
        this.__formatters = {
            text: defaultFor('text'),
            number: defaultFor('number'),
            boolean: defaultFor('boolean'),
            date: defaultFor('date'),
            datetime: defaultFor('datetime')
        };

        for (const [name, field] of Object.entries(options.fields || {})) {
            const config: FieldConfig = typeof field === 'string' ? { type: field } : { ...field };
            // a typo in plain js would otherwise show up much later, as a field without a formatter
            if (config.type !== undefined && !isFieldType(config.type)) {
                throw new Error(`Datasource: field '${name}' has an unknown type '${config.type}'`);
            }
            if (config.formatter !== undefined) {
                this.__fieldFormatters.set(name, getRegisteredFormatter(config.formatter, `field '${name}'`));
            }
            this.__fields.set(name, config);
        }
        // the container tracks the edits, a date field compares on the day there.
        // Throws when another datasource on the container gave a field another type
        this.__dataContainer.__addFieldTypes(
            new Map(Array.from(this.__fields, ([name, config]) => [name, config.type ?? 'text']))
        );

        this.__selectionMode = options.selectionMode || 'multiple';
        this.__selection = new Selection(this);
        this.__filter = new Filter();
        // the type is looked up once per sort, not per row
        this.__sorting = new Sort((attribute) => this.getField(attribute).type);
        this.__grouping = new Grouping();
    }

    /**
     * Always `'Datasource'`. Tells a datasource from other objects without `instanceof`, which fails when
     * two copies of the package are loaded.
     *
     * @example
     * ```ts
     * const isDatasource = (value: any) => value?.type === 'Datasource';
     * isDatasource(datasource); // true
     * ```
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
     * import { Datasource } from '@simple-html/grid';
     *
     * const datasource = new Datasource({ fields: { born: { type: 'date', label: 'Born' } } });
     *
     * datasource.getField('born'); // { name: 'born', type: 'date', label: 'Born', formatter: DateFormatterYYYYMMDD }
     * datasource.getField('name'); // { name: 'name', type: 'text', label: 'name', formatter: TextFormatter }
     * // formatter: the formatter object, looked up by its id when the datasource was made
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
     * its type. The formatter object, as registered under the id the options name (see
     * {@link registerFormatter}) when the datasource was made.
     *
     * @param field the field name. A field that is not listed in `fields` is `'text'`
     * @param type use this type instead of the field's. When it is not the field's type, the default
     * formatter for `type` is returned - the field's own formatter is written for its own type. The
     * grid uses it for `dynamicCellTypeColumn`, where another column of the row decides the type.
     *
     * @example
     * ```ts
     * import { Datasource } from '@simple-html/grid';
     *
     * const datasource = new Datasource({
     *     fields: { price: { type: 'number', formatter: 'numberComma' }, born: 'date' }
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
        return this.__fieldFormatters.get(field) ?? this.__formatters[fieldType];
    }

    /**
     * @internal
     * the field as it was given in `fields` (the shorthand written out), undefined when it is not
     * listed. The grid uses it for a label that was really given
     */
    public __getFieldConfig(name: string): FieldConfig | undefined {
        return this.__fields.get(name);
    }

    /**
     * The rows marked for deletion with {@link markForDeletion} / {@link markAllForDeletion}: still in
     * the data until {@link acceptChanges} or {@link clearMarkedForDeletion} removes them. The rows
     * themselves, not copies - the rows of `getChanges().deletedEntities`, plus the new rows that are
     * marked (they are not sent to a server).
     *
     * @example
     * ```ts
     * datasource.markForDeletion(datasource.getSelectedRows());
     * datasource.getMarkedForDeletion().length; // the rows just marked
     * ```
     */
    public getMarkedForDeletion(): EntityUnion<T>[] {
        return this.__dataContainer.getMarkedForDeletion() as EntityUnion<T>[];
    }

    /**
     * Removes the rows marked for deletion for good, once the deletes are saved: they leave the rows,
     * `getChanges()` no longer lists them in `deletedEntities`, and `resetData()` does not bring them
     * back. Sends `collection-changed` with `{ removed: true, info: 'clearMarkedForDeletion' }`.
     *
     * When the new and edited rows were saved in the same go, call {@link acceptChanges} instead: it
     * removes the marked rows and accepts the rest.
     *
     * @sample editing
     * @example
     * ```ts
     * const { deletedEntities } = datasource.getChanges();
     * await fetch('/api/people/delete', { method: 'POST', body: JSON.stringify(deletedEntities) });
     * datasource.clearMarkedForDeletion();
     * ```
     */
    public clearMarkedForDeletion() {
        this.__dataContainer.clearMarkedForDeletion();
        // the rows are gone from the container, rebuild the displayed rows or they stay on screen.
        // Same event as removeData, it is a removal
        this.__internalUpdate(true);
        this.__callSubscribers('collection-changed', { removed: true, info: 'clearMarkedForDeletion' });
    }

    /**
     * Throws away every change since the data was set: edited rows get their original values back,
     * rows marked for deletion are unmarked, and new rows (from `addNewEmpty()`) are removed. Then the
     * displayed rows are rebuilt. Rows removed for good (`removeData()`, `clearMarkedForDeletion()`) do
     * not come back.
     *
     * The changes are those of the data container, so of every datasource sharing it.
     *
     * @sample editing
     * @example
     * ```ts
     * datasource.getDataRows()[0].name = 'Changed';
     * datasource.addNewEmpty({ name: 'New' });
     *
     * datasource.resetData();
     * datasource.getChanges(); // { newEntities: [], modifiedEntities: [], deletedEntities: [] }
     * ```
     */
    public resetData() {
        this.__dataContainer.resetData();
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info: 'resetData' });
        }
    }

    /**
     * {@link resetData} for the selected rows only: their edits are undone, the ones marked for deletion
     * are unmarked, and the new ones are removed. The other rows keep their changes.
     *
     * @example
     * ```ts
     * datasource.select(1); // the first row
     * datasource.resetDataSelectionOnly(); // only that row gets its original values back
     * ```
     */
    public resetDataSelectionOnly() {
        this.__dataContainer.resetDataSelection(this.getSelectedRows());
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info: 'resetData' });
        }
    }

    /**
     * The rows added, edited and marked for deletion since the data was set, as copies - what to send
     * to a server. See {@link Changes} for what is in it and when an edit counts: a field edited back
     * to its original value is not listed, a `date` field compares on the day, a `datetime` field to
     * the second.
     *
     * The changes are those of the data container, so of every datasource sharing it.
     *
     * @sample editing
     * @example
     * ```ts
     * import { Datasource } from '@simple-html/grid';
     *
     * interface Person {
     *     id: number;
     *     name: string;
     *     born: Date;
     * }
     *
     * const datasource = new Datasource<Person>({ key: 'id', fields: { born: 'date' } });
     * datasource.setData([
     *     { id: 1, name: 'Ann', born: new Date(1990, 4, 17) },
     *     { id: 2, name: 'Bob', born: new Date(1985, 0, 2) }
     * ]);
     * const [ann, bob] = datasource.getDataRows();
     * ann.name = 'Anna';
     * bob.born = new Date(1985, 0, 2, 13, 30); // the same day: no edit
     * datasource.addNewEmpty({ name: 'New' });
     * datasource.markForDeletion(bob);
     *
     * const { newEntities, modifiedEntities, deletedEntities } = datasource.getChanges();
     * // newEntities:      [{ name: 'New', id: -1 }] - a generated key
     * // modifiedEntities: [{ id: 1, name: 'Anna' }]
     * // deletedEntities:  [{ id: 2, name: 'Bob', born: ... }]
     * ```
     */
    public getChanges(): Changes<T> {
        return this.__dataContainer.getChanges() as Changes<T>;
    }

    /**
     * `true` when there is something to save: `getChanges()` would list a row. For an "unsaved
     * changes" indicator, or to ask before the user leaves the page. A new row marked for deletion is
     * no change, and neither is a field edited back to its original value.
     *
     * The changes are those of the data container, so of every datasource sharing it.
     *
     * @sample saving
     * @example
     * ```ts
     * declare const saveButton: HTMLButtonElement;
     *
     * // the grid sends no event for an edit: check when the user is about to leave
     * window.addEventListener('beforeunload', (event) => {
     *     if (datasource.hasChanges()) {
     *         event.preventDefault();
     *     }
     * });
     * saveButton.disabled = !datasource.hasChanges();
     * ```
     */
    public hasChanges(): boolean {
        return this.__dataContainer.hasChanges();
    }

    /**
     * Marks rows for deletion, so the delete can be undone: `getChanges()` lists them in
     * `deletedEntities`, and {@link unmarkForDeletion} (or `resetData()`) takes the mark off again.
     * They stay in the rows, with `__rowState` `'D'` - the grid marks them as deleted in the row
     * selector. {@link acceptChanges} removes them once the deletes are saved.
     *
     * A new row (from `addNewEmpty()`) is marked too. While it is marked it is in none of the lists of
     * `getChanges()` - it was never saved, there is nothing to send - and unmarked it is a new row again.
     *
     * In the grid, the row menu's "Delete:" entries mark and unmark the selected rows, see `MENU_IDS`.
     * To remove rows that are not on a server, without tracking, use {@link removeData}.
     *
     * Sends `collection-filtered` with `info: 'markForDeletion'`.
     *
     * @param rows a row or a list of rows, e.g. `getSelectedRows()`
     *
     * @sample editing
     * @example
     * ```ts
     * datasource.markForDeletion(datasource.getSelectedRows());
     * ```
     */
    public markForDeletion(rows: Entity | Entity[]) {
        // v5 was markForDeletion(data, all)
        assertOptions('markForDeletion', arguments[1], 'markForDeletion(rows), or markAllForDeletion()');
        this.__dataContainer.markForDeletion(rows);
        this.__afterRowStateChange('markForDeletion');
    }

    /**
     * Marks every row for deletion, see {@link markForDeletion}: the new rows too. Was
     * `markForDeletion(null, true)` in v5.
     *
     * @sample editing
     * @example
     * ```ts
     * datasource.markAllForDeletion();
     * datasource.getChanges().deletedEntities; // every row that is not new
     * datasource.unmarkAllForDeletion(); // unmarked again
     * ```
     */
    public markAllForDeletion() {
        this.__dataContainer.markAllForDeletion();
        this.__afterRowStateChange('markForDeletion');
    }

    /**
     * Undoes a delete: takes the mark of {@link markForDeletion} off rows again. A row is back as it
     * was before it was marked - with its edits, and a new row as a new row. Unlike `resetData()`, no
     * edit is undone.
     *
     * Sends `collection-filtered` with `info: 'unmarkForDeletion'`.
     *
     * @param rows a row or a list of rows, e.g. `getSelectedRows()`. Rows that are not marked are skipped
     *
     * @sample editing
     * @example
     * ```ts
     * const rows = datasource.getSelectedRows();
     * datasource.markForDeletion(rows);
     * datasource.unmarkForDeletion(rows); // as they were
     * ```
     */
    public unmarkForDeletion(rows: Entity | Entity[]) {
        this.__dataContainer.unmarkForDeletion(rows);
        this.__afterRowStateChange('unmarkForDeletion');
    }

    /**
     * Takes the mark off every row marked for deletion, see {@link unmarkForDeletion}.
     *
     * @example
     * ```ts
     * datasource.markAllForDeletion();
     * datasource.unmarkAllForDeletion();
     * datasource.getMarkedForDeletion(); // []
     * ```
     */
    public unmarkAllForDeletion() {
        this.__dataContainer.unmarkAllForDeletion();
        this.__afterRowStateChange('unmarkForDeletion');
    }

    /**
     * Call it after a successful save, to show what was saved: the changes are on the server now, so
     * they are no changes any more. For every row (or the `rows` given):
     *
     * - a row marked for deletion is removed, a new one too
     * - a new row becomes an ordinary row (`__rowState` `undefined`)
     * - the values a row has now become its original values: nothing counts as edited
     * - the row's error (`setErrors()`) is cleared
     *
     * Then `getChanges()` lists none of them, `hasChanges()` is `false` when every row was accepted,
     * and `resetData()` goes back to these values. The displayed rows are rebuilt and
     * `collection-filtered` is sent once, with `info: 'acceptChanges'`.
     *
     * **The keys of new rows.** A new row has a temporary key, a generated negative number: in its key
     * field (`id: -1` with `key: 'id'`), or without a key field as `__KEY` in
     * `getChanges().newEntities`. `newKeys` maps each temporary key to the key the server gave the row.
     * The row gets it in its key field, or as its `__KEY` without a key field - setting it is no edit,
     * and a selected row stays selected.
     *
     * Keep the grid readonly while the save runs (`gridInterface.updateConfig({ readonly: true })`):
     * an edit made in between is accepted too, without being saved.
     *
     * The changes are those of the data container, so of every datasource sharing it. Call
     * `reloadDatasource()` on the others.
     *
     * @param options.rows a row or a list of rows to accept, default every row. Pass the rows that
     * were saved when only some of them were
     * @param options.newKeys the server's key per temporary key. The keys are compared as text: `-1`
     * and `'-1'` are the same key, so a map made from JSON works too. A new row that is not in it
     * keeps its key
     * @throws when a key in `newKeys` is not the key of a new row that is accepted (and not marked
     * for deletion), or the server's key is blank (`null`, `undefined`, `''`) - a map the wrong way
     * round, say. Checked first: nothing is accepted then
     *
     * @sample saving
     * @example
     * ```ts
     * import { Datasource } from '@simple-html/grid';
     *
     * interface Person {
     *     id: number;
     *     name: string;
     * }
     * // saves the changes in one transaction, and answers with the id it gave each new row
     * declare function save(changes: object): Promise<{ temporaryId: number; id: number }[]>;
     *
     * const people = new Datasource<Person>({ key: 'id' });
     * people.setData([{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }]);
     * const [ann, bob] = people.getDataRows();
     * ann.name = 'Anna';
     * people.markForDeletion(bob);
     * people.addNewEmpty({ name: 'Cid' }); // a temporary id: -1, say
     *
     * const saved = await save(people.getChanges());
     * people.acceptChanges({ newKeys: new Map(saved.map((row) => [row.temporaryId, row.id])) });
     *
     * people.getDataRows().map((row) => [row.id, row.name, row.__rowState]);
     * // [[1, 'Anna', undefined], [7, 'Cid', undefined]] - Bob is gone, Cid has the server's id
     * people.hasChanges(); // false
     *
     * // only some rows were saved
     * people.acceptChanges({ rows: people.getSelectedRows() });
     * ```
     */
    public acceptChanges(options: { rows?: Entity | Entity[]; newKeys?: ReadonlyMap<string | number, string | number> } = {}) {
        // the selection is kept by key: a selected new row that gets its key from the server stays
        // selected under it. The container throws before it changes anything, so this is safe to read first
        const selected = new Set<string | number | undefined>(this.__selection.getSelectedKeys());
        const keysBefore = new Map(
            this.getAllData()
                .filter((row) => row.__rowState === 'N' && selected.has(row.__KEY))
                .map((row) => [row, row.__KEY])
        );

        this.__dataContainer.acceptChanges(options);

        for (const [row, before] of keysBefore) {
            if (before !== undefined && row.__KEY !== undefined && row.__KEY !== before) {
                this.__selection.replaceKey(before, row.__KEY);
            }
        }
        this.__afterRowStateChange('acceptChanges');
    }

    /**
     * after rows were marked, unmarked or accepted: rebuilds the displayed rows (accepting removes the
     * marked rows, and a filter can be on `__rowState`) and tells the grid, once
     */
    private __afterRowStateChange(info: 'markForDeletion' | 'unmarkForDeletion' | 'acceptChanges') {
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info });
        }
    }

    /**
     * Removes rows for good: they are not marked for deletion, `getChanges()` does not list them and
     * `resetData()` does not bring them back. Use {@link markForDeletion} to delete rows on a server.
     *
     * @param rows a row or a list of rows
     * @param options.refilter `false` to leave the displayed rows as they are, default `true`: they
     * are rebuilt (filter, sort, group). When removing in a loop, pass `false` for every call but the
     * last.
     * @returns the rows removed
     *
     * @sample rows-data
     * @example
     * ```ts
     * datasource.removeData(datasource.getSelectedRows());
     *
     * // many calls: rebuild the displayed rows once, at the end
     * const rows = datasource.getAllData().filter((row) => row.archived);
     * rows.forEach((row, i) => datasource.removeData(row, { refilter: i === rows.length - 1 }));
     * ```
     */
    public removeData(rows: Entity | Entity[], options: { refilter?: boolean } = {}): Entity[] {
        assertOptions('removeData', options, 'removeData(rows, { refilter: false }), or removeAllData()');
        const { refilter = true } = options;
        const removed = this.__dataContainer.removeData(rows);
        if (refilter) {
            this.__internalUpdate(true);
        }
        this.__callSubscribers('collection-changed', { removed: true, info: 'removeData', data: rows });
        return removed;
    }

    /**
     * Removes every row for good, see {@link removeData}. Was `removeData(null, true)` in v5. Sends
     * the same `collection-changed` event, with `data: null`.
     *
     * @returns the rows removed
     *
     * @sample rows-data
     * @example
     * ```ts
     * datasource.removeAllData();
     * datasource.getAllData(); // []
     * ```
     */
    public removeAllData(): Entity[] {
        const removed = this.__dataContainer.removeAllData();
        this.__internalUpdate(true);
        this.__callSubscribers('collection-changed', { removed: true, info: 'removeData', data: null });
        return removed;
    }

    /**
     * Every row in the data: no filter, sort or grouping, the rows marked for deletion included, never a
     * group row. A new array, the rows in it are the rows themselves (not copies). Shared with every
     * datasource on the same data container.
     *
     * {@link getDataRows} has the rows that pass the filter, sorted; {@link getRows} what the grid shows.
     *
     * @sample rows-data
     * @example
     * ```ts
     * import { where } from '@simple-html/grid';
     *
     * datasource.filter(where('age', 'GREATER_THAN', 60));
     * datasource.getDataRows().length; // the rows over 60
     * datasource.getAllData().length; // every row
     * ```
     */
    public getAllData(): EntityUnion<T>[] {
        return this.__dataContainer.getDataSet() as any;
    }

    /**
     * The data container that holds the rows and tracks the edits: the one given as
     * `DatasourceOptions.container`, or the one the datasource made. See {@link DataContainer}.
     *
     * @example
     * ```ts
     * const container = datasource.getDataContainer();
     * container.setErrors(new Map([['7', 'Name is already taken']]));
     * ```
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
     * Makes a displayed row the current entity ({@link currentEntity}) and sends `current-entity`. The
     * selection is not changed. A group row's index makes the group row current, an index out of range
     * makes it `null`.
     *
     * @param row the index in the displayed rows (`getRows()`), 0 based - not 1 based like {@link select}
     *
     * @example
     * ```ts
     * datasource.setRowAsCurrentEntity(0); // the first displayed row
     * datasource.currentEntity; // that row
     * ```
     */
    public setRowAsCurrentEntity(row: number) {
        this.__select(row);
    }

    /**
     * Sets the rows, in the data container - so every datasource sharing it gets them. The rows are
     * filtered, sorted and grouped the way the datasource is: a filter that is set applies to the new
     * rows too.
     *
     * @param rows your objects
     * @param options.add `true` to add the rows to the ones there are, default `false`: they replace them
     * @param options.refilter `false` to show every row that is set, also one the filter would leave out,
     * default `true`: the filter runs on the rows. With `false` the filter stays set (the header filters
     * and the footer still show it) while rows it leaves out are shown, until it runs again
     *
     * The selection follows the key (`DatasourceOptions.key`): rows that come back with the same key stay
     * selected. {@link currentEntity} is set to `null` when it is no longer in the data (replaced by new
     * objects), and `current-entity` is sent; a row that is still in the data stays current.
     *
     * Sends `collection-changed`, `{ added }`.
     *
     * @sample rows-data
     * @example
     * ```ts
     * declare const rowsFromServer: object[];
     * declare const moreRows: object[];
     *
     * datasource.setData(rowsFromServer); // replaces the rows, the filter applies
     * datasource.setData(moreRows, { add: true });
     * datasource.setData(moreRows, { add: true, refilter: false }); // shown even if the filter leaves them out
     * ```
     */
    public setData(rows: any[], options: { add?: boolean; refilter?: boolean } = {}) {
        assertOptions('setData', options, 'setData(rows, { add: true })');
        const { add = false, refilter = true } = options;
        if (add) {
            this.__collectionFiltered.push(...this.__dataContainer.setData(rows, { add }));
        } else {
            this.__dataContainer.setData(rows);
            this.__collectionFiltered = this.getAllData().slice();
        }

        this.__internalUpdate(refilter);

        // the current row is gone when the rows were replaced by new objects. A group row is never
        // in the data, the groups were built again. Cleared before the events, so every handler
        // reads the new state
        const current = this.currentEntity;
        const currentGone = !!current && (isGroupRow(current) || !this.getAllData().includes(current));
        if (currentGone) {
            this.currentEntity = null;
        }

        this.__callSubscribers('collection-changed', { added: add });
        if (currentGone) {
            this.__callSubscribers('current-entity', {});
        }
    }

    /**
     * Adds a new row at the end: `getChanges()` lists it in `newEntities`, its `__rowState` is `'N'`.
     * When grouped it is put in its group, and the group is expanded.
     *
     * The row gets a generated key, a negative number: with a key field it is written there
     * (`{ company: 'NEW COMPANY', id: -1 }`), else it is the row's `__KEY`. After the save,
     * `acceptChanges({ newKeys })` gives it the key from the server, see {@link acceptChanges}.
     *
     * @param row the values of the new row, default none. The object itself becomes the row.
     * @param options.scrollTo `false` to leave the selection as it is, default `true`: the new row is
     * selected and made current, and the grid scrolls to it
     *
     * @sample editing
     * @example
     * ```ts
     * datasource.addNewEmpty();
     * datasource.addNewEmpty({ company: 'NEW COMPANY' });
     * datasource.addNewEmpty({ company: 'NEW COMPANY' }, { scrollTo: false });
     * ```
     */
    public addNewEmpty(row: Partial<T> = {}, options: { scrollTo?: boolean } = {}) {
        assertOptions('addNewEmpty', options, 'addNewEmpty(row, { scrollTo: false })');
        const { scrollTo = true } = options;
        this.__dataContainer.setData([row], { add: true, isNew: true });
        const dataset = this.__dataContainer.getDataSet();
        const newRow = dataset[dataset.length - 1];

        if (this.__grouping.getGrouping().length) {
            // grouped: the row has to be grouped with the rest, appended at the end it sat outside
            // every group and was lost on the next expand/collapse. Its group is expanded so it is seen
            this.__collectionFiltered.push(newRow);
            this.__internalUpdate(false);
            this.__collectionDisplayed = this.__grouping.expandToEntity(newRow);
            this.__callSubscribers('collection-changed', { added: true });
            if (scrollTo) {
                this.select(this.__collectionDisplayed.indexOf(newRow) + 1, { notify: true });
            }
            return;
        }

        this.__internalUpdate(false);
        // force add after internal update, doing before will mess up location
        this.__collectionFiltered.push(newRow);
        this.__collectionDisplayed.push(newRow);
        this.__callSubscribers('collection-changed', { added: true });
        if (scrollTo) {
            this.selectLast();
        }
    }

    /**
     * The sort that is set: the fields and directions, the first decides. When grouped, the grouped
     * fields come first. `[]` when the rows are not sorted. It is what `GridState.sorting` holds.
     *
     * It is the datasource's own array, not a copy - do not change it.
     *
     * @example
     * ```ts
     * datasource.sort({ attribute: 'name', ascending: true });
     * datasource.getLastSorting(); // [{ attribute: 'name', ascending: true }]
     * ```
     */
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

        if (this.__grouping.getGrouping().length) {
            // also when the grouping was set with setGrouping(), or the sort changed with setOrderBy()
            // or resetSort() since: unsorted rows give a group for each run of equal values
            this.__sortGroupedFieldsFirst();
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
     * Sets the sort (not run) to the grouped fields first, in the order of the grouping, then the other
     * fields of the sort. Grouping builds a group from each run of equal values, so the rows have to be
     * sorted on the grouped fields first, or a group shows up more than once. A grouped field keeps the
     * direction the sort gives it, ascending when the sort does not have it.
     */
    private __sortGroupedFieldsFirst() {
        const sorting = this.__sorting.getOrderBy();
        const grouped = this.__grouping.getGrouping().map((group) => group.attribute);
        this.__sorting.setOrderBy([
            ...grouped.map((attribute) => ({
                attribute,
                ascending: sorting.find((arg) => arg.attribute === attribute)?.ascending ?? true
            })),
            // copies: setOrderBy({ add: true }) changes the direction of an argument in place
            ...sorting
                .filter((arg) => !grouped.includes(arg.attribute))
                .map((arg) => ({ attribute: arg.attribute, ascending: arg.ascending }))
        ]);
    }

    /**
     * Sorts the rows. When grouped, the grouped fields are sorted first.
     *
     * - `sort(arg)` - sort on one field, replacing the sort there was
     * - `sort(arg, { add: true })` - add the field to the sort there is, after the fields there are.
     *   A field that is sorted on already gets the new direction. The grid does this on shift+click.
     * - `sort([a, b])` - sort on these fields, replacing the sort there was (`add` is ignored)
     * - `sort()` - sort again with the current sort
     *
     * @param args the field and direction, or a list of them
     * @param options.add `true` to add to the current sort, default `false`
     *
     * @sample sorting-grouping
     * @example
     * ```ts
     * datasource.sort({ attribute: 'company', ascending: true });
     * datasource.sort({ attribute: 'age', ascending: false }, { add: true }); // company, then age
     * datasource.sort([
     *     { attribute: 'country', ascending: true },
     *     { attribute: 'company', ascending: false }
     * ]);
     * ```
     */
    public sort(args?: SortArgument | SortArgument[], options: { add?: boolean } = {}) {
        assertOptions('sort', options, 'sort(args, { add: true })');
        const { add = false } = options;
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

            this.__sortGroupedFieldsFirst();
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
     * @sample filtering
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
     * Groups the rows: a {@link GroupRow} in front of each group, in `getRows()`. The rows are sorted
     * on the grouped fields, ascending. `group([])` removes the grouping.
     *
     * The groups start collapsed, apart from the ones whose id is in {@link getExpanded} (set with
     * {@link setExpanded}, or expanded before): `getRows()` has only the group rows until a group is
     * expanded. The rows are grouped on their value as the field's formatter shows it, so a `date` field
     * groups by day; every blank value (null, undefined, `''`) is one group with the id `' blank'`.
     *
     * @param groups the fields to group on, the first is the outer group
     * @param options.add `true` to add the groups after the current grouping, default `false`: they
     * replace it
     *
     * @sample sorting-grouping
     * @example
     * ```ts
     * datasource.group([{ attribute: 'country', title: 'Country' }]);
     * datasource.group([{ attribute: 'company', title: 'Company' }], { add: true }); // country, then company
     * datasource.group([]); // no grouping
     * ```
     */
    public group(groups: GroupArgument[], options: { add?: boolean } = {}) {
        assertOptions('group', options, 'group(groups, { add: true })');
        let groupings: GroupArgument[];
        if (options.add) {
            groupings = this.__grouping.getGrouping();
            groupings = groupings.concat(groups);
        } else {
            groupings = groups;
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
     * Removes one level of grouping, or all of it. The sort is set to the grouped fields that are left
     * (none: the rows keep the order they are in). Sends `collection-grouped` twice: `info: 'group'` with
     * the grouping left, then `info: 'removeGroup'`.
     *
     * @param group the level to remove, found by its field (`attribute`): the object from
     * {@link getGrouping} or a copy, the `title` does not matter. A field that is not grouped on changes
     * nothing and sends no event. Left out, all grouping is removed
     *
     * @sample sorting-grouping
     * @example
     * ```ts
     * datasource.group([
     *     { attribute: 'country', title: 'Country' },
     *     { attribute: 'company', title: 'Company' }
     * ]);
     * datasource.removeGroup({ attribute: 'country', title: 'Country' }); // grouped on company only
     * datasource.removeGroup(); // not grouped
     * ```
     */
    public removeGroup(group?: GroupArgument) {
        if (group) {
            const groupings = this.__grouping.getGrouping();
            if (!groupings.some((grouping) => grouping.attribute === group.attribute)) {
                return;
            }
            this.group(groupings.filter((grouping) => grouping.attribute !== group.attribute));
        } else {
            this.group([]);
        }
        this.__callSubscribers('collection-grouped', { info: 'removeGroup' });
    }

    /**
     * Expands a group, so its rows are displayed, or every group with their sub groups. Sends
     * `collection-expand`. Does nothing while the datasource is not grouped.
     *
     * A sub group is only shown when the groups above it are expanded: expanding one expands the groups
     * above it too, so it is shown. An id that is no group changes nothing.
     *
     * @param id the group's `__groupID` (see {@link GroupRow}), e.g. `'Norway'` or `'Norway-Apple'` for a
     * sub group. Left out, every group is expanded
     *
     * @sample sorting-grouping
     * @example
     * ```ts
     * datasource.group([{ attribute: 'country', title: 'Country' }]);
     * datasource.expandGroup('Norway'); // the rows of Norway are shown
     * datasource.expandGroup(); // every group
     * ```
     */
    public expandGroup(id?: string) {
        // setGrouping() alone does not build the groups, there is nothing to expand until it is applied
        if (this.__grouping.hasGroups()) {
            this.__collectionDisplayed = id ? this.__grouping.expandWithParents(id) : this.__grouping.expandOneOrAll();
            this.__callSubscribers('collection-expand', {});
        }
    }

    /**
     * Collapses a group, so only its group row is displayed, or every group with their sub groups.
     * Sends `collection-collapse`. Does nothing while the datasource is not grouped.
     *
     * The rows of a collapsed group are not in `getRows()`, but they are in `getDataRows()`.
     *
     * @param id the group's `__groupID` (see {@link GroupRow}). Left out, every group is collapsed
     *
     * @sample sorting-grouping
     * @example
     * ```ts
     * datasource.collapseGroup('Norway');
     * datasource.collapseGroup(); // every group: getRows() has the group rows only
     * ```
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
     * @sample events
     * @example
     * ```ts
     * const off = datasource.on('collection-filtered', (data) => {
     *     console.log('filtered by', data.info, '-', datasource.getDataRows().length, 'rows');
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
     * The number of displayed rows, `getRows().length`: filtered, and when grouped the group rows
     * included and the rows of collapsed groups left out. The number of data rows is
     * `getDataRows().length` (was `length(true)` in v5).
     *
     * @example
     * ```ts
     * datasource.length(); // rows the grid shows
     * datasource.getDataRows().length; // data rows that pass the filter
     * ```
     */
    public length(): number {
        return this.__collectionDisplayed.length;
    }

    /**
     * How rows can be selected: `'multiple'`, `'single'` or `'none'`, see {@link SelectionMode}. Set
     * with `DatasourceOptions.selectionMode` or {@link setSelectionMode}; a grid showing the datasource
     * uses it.
     *
     * @example
     * ```ts
     * if (datasource.getSelectionMode() === 'multiple') {
     *     datasource.selectAll();
     * }
     * ```
     */
    public getSelectionMode(): SelectionMode {
        return this.__selectionMode;
    }

    /**
     * Selects every displayed data row - not the rows of collapsed groups or the ones the filter leaves
     * out - and sends `selection-change`. Only in the `'multiple'` selection mode: in `'single'` and
     * `'none'` it does nothing, it selects nothing and sends no event.
     * Clicking the grid's top left corner does the same (ctrl+click there deselects every row).
     *
     * @sample selection
     * @example
     * ```ts
     * datasource.selectAll();
     * datasource.getSelectedRows().length; // every displayed data row
     * ```
     */
    public selectAll() {
        this.__selection.selectAll();
    }

    /**
     * Deselects every row.
     *
     * @param options.notify `true` to send the `selection-change` event, so the grid shows it.
     * Default `false`: the grid shows it on its next redraw
     *
     * @sample selection
     * @example
     * ```ts
     * datasource.deselectAll({ notify: true });
     * ```
     */
    public deselectAll(options: { notify?: boolean } = {}) {
        assertOptions('deselectAll', options, 'deselectAll({ notify: true })');
        this.__selection.deselectAll(options.notify ?? false);
    }

    /**
     * Sets how rows can be selected: `'multiple'`, `'single'` or `'none'`. A blank value is `'none'`. The
     * rows selected before stay selected.
     *
     * The datasource owns the selection mode: a grid showing it uses this one from the next click on, it
     * has no option of its own.
     *
     * @param mode the selection mode, see {@link SelectionMode}
     *
     * @sample selection
     * @example
     * ```ts
     * datasource.setSelectionMode('single'); // a click selects one row, ctrl/shift+click too
     * datasource.setSelectionMode('none'); // a click makes the row current, selects nothing
     * ```
     */
    public setSelectionMode(mode: SelectionMode): void {
        this.__selectionMode = mode || 'none';
    }

    /**
     * One row of the displayed rows, `getRows()[rowNo]`. When grouped it can be a {@link GroupRow}, check
     * with {@link isGroupRow}. Out of range gives `undefined`, though the type does not say so.
     *
     * @param rowNo the index in the displayed rows, 0 based
     *
     * @example
     * ```ts
     * import { isGroupRow } from '@simple-html/grid';
     *
     * const row = datasource.getRow(0);
     * if (row && !isGroupRow(row)) {
     *     console.log(row.name);
     * }
     * ```
     */
    public getRow(rowNo: number): EntityUnion<T> | GroupRow {
        return this.__collectionDisplayed[rowNo] as EntityUnion<T> | GroupRow;
    }

    /**
     * Returns the rows as they are displayed: filtered, sorted and grouped. When grouped, that
     * is your data rows with a {@link GroupRow} in front of each group, and the rows of a
     * collapsed group left out.
     *
     * {@link getDataRows} returns the data rows only - never a group row (was `getRows(true)` in v5).
     *
     * @sample rows-data
     * @sample sorting-grouping
     * @example
     * ```ts
     * import { isGroupRow } from '@simple-html/grid';
     *
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
     * const names = datasource.getDataRows().map((row) => row.name);
     * ```
     */
    public getRows(): (EntityUnion<T> | GroupRow)[] {
        return this.__collectionDisplayed as (EntityUnion<T> | GroupRow)[];
    }

    /**
     * Returns the data rows: filtered and sorted, never a {@link GroupRow}, and when grouped the rows
     * of collapsed groups included. Was `getRows(true)` in v5.
     *
     * It is the datasource's own list, not a copy - do not change it.
     *
     * @sample rows-data
     * @example
     * ```ts
     * datasource.group([{ attribute: 'country', title: 'Country' }]);
     * datasource.collapseGroup();
     *
     * datasource.getRows(); // the group rows only, every group is collapsed
     * datasource.getDataRows().map((row) => row.name); // every row that passes the filter
     * ```
     */
    public getDataRows(): EntityUnion<T>[] {
        return this.__collectionFiltered as EntityUnion<T>[];
    }

    /**
     * Selects a row and makes it the current entity. A group row can not be selected, the first
     * data row after it is.
     *
     * @param row the row number in the displayed rows, starting on 1 (not 0 like `getRow()`).
     * Default the first row
     * @param options.notify `true` to send the `select` event, so the grid scrolls to the row.
     * Default `false`
     *
     * With selection mode `'none'` the row is made current, but not selected.
     *
     * @sample selection
     * @example
     * ```ts
     * datasource.select(5); // the fifth displayed row, getRow(4)
     * datasource.select(5, { notify: true }); // and scroll the grid to it
     * ```
     */
    public select(row?: number, options: { notify?: boolean } = {}): void {
        assertOptions('select', options, 'select(row, { notify: true })');
        // a group header can not be selected, take the first data row from there on
        const selectedRow = this.__findDataRow(row ? row - 1 : 0, 1);
        if (selectedRow === -1) {
            return;
        }
        this.__selection.highlightRow({} as any, selectedRow);
        if (options.notify) {
            this.__callSubscribers('select', { info: 'select-first', row: selectedRow });
        }
    }

    /**
     * Selects the first displayed data row, makes it current and sends `select` (`info: 'select-first'`),
     * so the grid scrolls to it. Does nothing when no data row is displayed.
     *
     * @sample selection
     * @example
     * ```ts
     * datasource.selectFirst();
     * datasource.currentEntity; // the first data row
     * ```
     */
    public selectFirst(): void {
        this.__selectAndNotify(this.__findDataRow(0, 1), 'select-first');
    }

    /**
     * Selects the data row above the current one, makes it current and sends `select`
     * (`info: 'select-prev'`). From the first row it goes to the last. Group rows are skipped.
     *
     * @sample selection
     * @example
     * ```ts
     * document.getElementById('prev')!.onclick = () => datasource.selectPrev();
     * ```
     */
    public selectPrev(): void {
        let row = this.__findDataRow(this.__currentEntityIndex() - 1, -1);
        if (row === -1) {
            row = this.__findDataRow(this.__collectionDisplayed.length - 1, -1);
        }
        this.__selectAndNotify(row, 'select-prev');
    }

    /**
     * Selects the data row below the current one, makes it current and sends `select`
     * (`info: 'select-next'`). From the last row it goes to the first, and without a current row it
     * starts at the first. Group rows are skipped.
     *
     * @sample selection
     * @example
     * ```ts
     * document.getElementById('next')!.onclick = () => datasource.selectNext();
     * ```
     */
    public selectNext(): void {
        let row = this.__findDataRow(this.__currentEntityIndex() + 1, 1);
        if (row === -1) {
            row = this.__findDataRow(0, 1);
        }
        this.__selectAndNotify(row, 'select-next');
    }

    /**
     * Selects the last displayed data row, makes it current and sends `select` (`info: 'select-last'`),
     * so the grid scrolls to it. Does nothing when no data row is displayed.
     *
     * @sample selection
     * @example
     * ```ts
     * datasource.selectLast();
     * ```
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
     * The selected rows, in the order they are displayed. Data rows only, a group row can not be
     * selected.
     *
     * Only displayed rows are returned: a selected row in a collapsed group, or one the filter leaves
     * out, is not in it (it is selected again once it is displayed).
     *
     * @sample selection
     * @example
     * ```ts
     * datasource.on('selection-change', () => {
     *     console.log(datasource.getSelectedRows().map((row) => row.name));
     * });
     * ```
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
     * Sorts text with an `Intl.Collator` for a language, from the next sort on. Without it text is
     * sorted with `localeCompare()` of the browser's language. Filtering is not changed.
     *
     * Was `setLocalCompare()` in v5.
     *
     * @param code the language, e.g. `'nb'` - `å` sorts after `z`
     * @param options the `Intl.Collator` options, e.g. `{ sensitivity: 'base' }`
     *
     * @example
     * ```ts
     * datasource.setLocaleCompare('nb');
     * datasource.sort({ attribute: 'name', ascending: true }); // ... 'Zara', 'Øystein', 'Åse'
     * ```
     */
    public setLocaleCompare(code: string, options?: any) {
        // should we also use this for filter ?
        this.__sorting.setLocaleCompare(code, options);
    }

    /**
     * Clears the sort, without sorting: the rows keep their order until the displayed rows are built
     * again (`filter()`, `setData()` ...), then they are in the order they were set - sorted on the
     * grouped fields when grouped, the groups need that. No event is sent.
     *
     * @param defaultSortAttribute a field to sort on ascending instead, set the same way (not run)
     *
     * @example
     * ```ts
     * datasource.resetSort();
     * datasource.getLastSorting(); // []
     *
     * datasource.resetSort('name');
     * datasource.sort(); // sorted on name, ascending
     * ```
     */
    public resetSort(defaultSortAttribute?: string): void {
        this.__sorting.reset(defaultSortAttribute);
    }

    /**
     * Sets the sort without sorting, `sort()` sorts. Takes the same arguments as {@link sort}.
     *
     * @param param the field and direction, or a list of them
     * @param options.add `true` to add to the current sort, default `false`
     *
     * @example
     * ```ts
     * datasource.setOrderBy({ attribute: 'company', ascending: true });
     * datasource.setOrderBy({ attribute: 'age', ascending: false }, { add: true });
     * datasource.sort(); // sorts on company, then age
     * ```
     */
    public setOrderBy(param: SortArgument | SortArgument[], options: { add?: boolean } = {}) {
        assertOptions('setOrderBy', options, 'setOrderBy(param, { add: true })');
        this.__sorting.setOrderBy(param, options.add);
    }

    /**
     * The sort that is set, with {@link setOrderBy} or {@link sort}: the same fields and directions as
     * {@link getLastSorting}. The datasource's own array, not a copy.
     *
     * @example
     * ```ts
     * datasource.setOrderBy({ attribute: 'company', ascending: true });
     * datasource.getOrderBy(); // [{ attribute: 'company', ascending: true }]
     * ```
     */
    public getOrderBy() {
        return this.__sorting.getOrderBy();
    }

    /**
     * The grouping: the fields grouped on, the outer group first. `[]` when not grouped. It is what
     * `GridState.grouping` holds. The datasource's own array, not a copy - change the grouping with
     * {@link group}.
     *
     * @sample sorting-grouping
     * @example
     * ```ts
     * datasource.group([{ attribute: 'country', title: 'Country' }]);
     * datasource.getGrouping(); // [{ attribute: 'country', title: 'Country' }]
     * ```
     */
    public getGrouping() {
        return this.__grouping.getGrouping();
    }

    /**
     * Sets the grouping without grouping the rows now. The next call that builds the displayed rows
     * groups them - `group()`, `sort()`, `filter()`, `setData()`, `reloadDatasource()` ... - with the rows
     * sorted on the grouped fields first. Until then `getRows()` is not grouped and `expandGroup()` /
     * `collapseGroup()` do nothing.
     *
     * @param group the fields to group on, the outer group first
     *
     * @example
     * ```ts
     * datasource.setGrouping([{ attribute: 'country', title: 'Country' }]);
     * datasource.filter(); // grouped now, the rows sorted on country first
     * ```
     */
    public setGrouping(group: GroupArgument[]) {
        this.__grouping.setGrouping(group);
        // the groups built for the old grouping no longer match it, expand/collapse wait until
        // the new grouping is applied
        this.__grouping.clearGroups();
    }

    /**
     * Sets which groups are expanded, by their `__groupID`, for the next {@link group}: those groups start
     * expanded, the rest collapsed. The groups shown now do not change.
     *
     * @param x the group ids, e.g. `['Norway', 'Norway-Apple']`
     *
     * @example
     * ```ts
     * datasource.setExpanded(['Norway']);
     * datasource.group([{ attribute: 'country', title: 'Country' }]); // Norway is expanded
     * ```
     */
    public setExpanded(x: string[]) {
        this.__grouping.setExpanded(x);
    }

    /**
     * The ids (`__groupID`) of the expanded groups. It is what `GridState.expandedGroups` holds. A new
     * array.
     *
     * @example
     * ```ts
     * datasource.expandGroup('Norway');
     * datasource.getExpanded(); // ['Norway']
     * ```
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
     * @sample filtering
     * @example
     * ```ts
     * import { where } from '@simple-html/grid';
     *
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

    /**
     * The operator a header filter of this type starts with: `'GREATER_THAN_OR_EQUAL_TO'` for
     * `'number'`, `'date'` and `'datetime'`, `'EQUAL'` for the rest - for text the whole text, `ann`
     * does not find `Anna`. The grid uses it for a column without an `operator` in its config
     * (`columns: { name: { operator: 'CONTAINS' } }` for a contains search).
     *
     * @param type a field type, see {@link FieldType}
     *
     * @example
     * ```ts
     * datasource.getFilterFromType('number'); // 'GREATER_THAN_OR_EQUAL_TO'
     * datasource.getFilterFromType('text'); // 'EQUAL'
     * ```
     */
    public getFilterFromType(type: string) {
        return this.__filter.getFilterFromType(type);
    }

    /**
     * Sets the filter without running it - `filter()` runs it. `setFilter(null)` removes it.
     *
     * @param expression a condition or a group, see {@link FilterExpression}, or null for no filter
     *
     * @sample filtering
     * @example
     * ```ts
     * import { where } from '@simple-html/grid';
     *
     * datasource.setFilter(where('age', 'GREATER_THAN', 18));
     * datasource.filter(); // runs it
     * ```
     */
    public setFilter(expression: FilterExpression | null) {
        this.__filter.setFilter(expression);
    }

    /**
     * Builds the displayed rows again from every row in the data container: filtered, sorted and grouped
     * the way the datasource is. Sends `collection-filtered` (`info: 'filter'`). For rows changed in the
     * data container directly (`getDataContainer().setData()`, `replace()` ...), or by another datasource
     * on the same container.
     *
     * @example
     * ```ts
     * datasource.getDataContainer().setData([{ id: 3, name: 'Cid' }], { add: true });
     * datasource.reloadDatasource(); // the new row is shown, if the filter lets it through
     * ```
     */
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
     * @sample filtering
     * @example
     * ```ts
     * import { and, Datasource, or, where } from '@simple-html/grid';
     *
     * const datasource = new Datasource({ fields: { born: { type: 'date', label: 'Born' } } });
     * datasource.filter(where('born', 'GREATER_THAN', new Date(1990, 0, 1)));
     *
     * datasource.getFilterString(); // "([BORN] <<GREATER_THAN>> '1990-01-01')"
     * datasource.getFilterString((field: string) => `${field}!`); // "([BORN!] <<GREATER_THAN>> '1990-01-01')"
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
     * @sample filtering
     * @example
     * ```ts
     * import { Datasource, where } from '@simple-html/grid';
     *
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
