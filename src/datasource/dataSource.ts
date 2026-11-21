import { Emitter, type EventHandler } from '../emitter';
import { findText, getText } from '../texts';
import { AGGREGATE_FUNCTIONS, type AggregateFunction, aggregateRows, groupDataRows, isAggregateFunction } from './aggregate';
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
import type { Conflict, UpsertOptions, UpsertResult } from './liveData';
import { Selection } from './selection';
import type { SelectionMode } from './selectionMode';
import { Sort } from './sort';
import type { SortArgument } from './sortArgument';
import type { ValidationError, ValidationRuleObject } from './validator';
import { type ResolvedRule, resolveRules } from './validatorRegistry';

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
 * the rules of a field without any, what getField() gives for it
 */
const NO_RULES: readonly ValidationRuleObject[] = Object.freeze([]);

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
     * `true` while only the changed rows are shown, see filterChangedOnly(). Applied with the filter,
     * on top of it
     */
    private __changedOnly = false;

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
     * the validation rules of the fields that have them (`FieldConfig.validate`), written out as
     * objects, for getField(). The validators are the container's, it validates the edits
     */
    private __fieldRules = new Map<string, ValidationRuleObject[]>();

    /**
     * the aggregates of the group rows asked so far, see aggregate() and keptAggregate(). A WeakMap: the
     * group rows of an old grouping go away
     */
    private __groupAggregates = new WeakMap<GroupRow, KeptAggregates>();

    /**
     * the aggregates of the filtered rows asked so far (aggregate() without rows), see keptAggregate():
     * while `__collectionFiltered` is the same list, of the same length
     */
    private __filteredAggregates: { rows: Entity[] | null; length: number; values: KeptAggregates } = {
        rows: null,
        length: 0,
        values: new Map()
    };

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
     * or the same row objects set again). The methods that remove rows set it to `null` when they
     * remove it: `removeData()`, `removeAllData()`, `clearMarkedForDeletion()`, `acceptChanges()` (a
     * row marked for deletion), `resetData()` and `resetDataSelectionOnly()` (a new row). The
     * `current-entity` event is sent when it changes.
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
     * field has a type that does not exist, a formatter id or a validator id is not registered (see
     * {@link registerFormatter} and {@link registerValidator}), a rule's options are wrong, or a field
     * has another type or other rules than in a datasource made earlier on the same `container`
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

        // the validators are looked up here too, like the formatters
        const rules = new Map<string, ResolvedRule[]>();
        for (const [name, field] of Object.entries(options.fields || {})) {
            const config: FieldConfig = typeof field === 'string' ? { type: field } : { ...field };
            // a typo in plain js would otherwise show up much later, as a field without a formatter
            if (config.type !== undefined && !isFieldType(config.type)) {
                throw new Error(`Datasource: field '${name}' has an unknown type '${config.type}'`);
            }
            // the grid edits a multiline field as text: on another type the option would do nothing
            if (config.multiline !== undefined && typeof config.multiline !== 'boolean') {
                throw new Error(`Datasource: field '${name}' has multiline '${config.multiline}', it is true or false`);
            }
            if (config.multiline && (config.type ?? 'text') !== 'text') {
                throw new Error(`Datasource: field '${name}' is multiline, that is for text fields only, not '${config.type}'`);
            }
            if (config.formatter !== undefined) {
                this.__fieldFormatters.set(name, getRegisteredFormatter(config.formatter, `field '${name}'`));
            }
            if (config.validate !== undefined) {
                const resolved = resolveRules(config.validate, name);
                if (resolved.length) {
                    rules.set(name, resolved);
                    this.__fieldRules.set(
                        name,
                        resolved.map(({ rule }) => rule)
                    );
                }
            }
            this.__fields.set(name, config);
        }
        // the container tracks the edits, a date field compares on the day there, and it validates
        // the edits. Throws when another datasource on the container gave a field another type, or
        // other rules
        this.__dataContainer.__addFields(
            new Map(Array.from(this.__fields, ([name, config]) => [name, config.type ?? 'text'])),
            rules
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
     * A field as the datasource sees it: its type, label, formatter, validation rules and whether it
     * is multiline, with every default filled in. A field that is not listed in `fields` is a `'text'`
     * field labelled with its name, without rules.
     *
     * @param name the field name, the property on the row
     *
     * @example
     * ```ts
     * import { Datasource } from '@simple-html/grid';
     *
     * const datasource = new Datasource({ fields: { born: { type: 'date', label: 'Born' } } });
     *
     * datasource.getField('born'); // { name: 'born', type: 'date', label: 'Born', formatter: DateFormatterYYYYMMDD, validate: [], multiline: false }
     * datasource.getField('name'); // { name: 'name', type: 'text', label: 'name', formatter: TextFormatter, validate: [], multiline: false }
     * // formatter: the formatter object, looked up by its id when the datasource was made
     * ```
     */
    public getField(name: string): Field {
        const config = this.__fields.get(name);
        return {
            name,
            type: config?.type ?? 'text',
            label: config?.label || name,
            formatter: this.getFormatter(name),
            validate: this.__fieldRules.get(name) ?? NO_RULES,
            multiline: config?.multiline === true
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
     * the validation errors of a row, the messages by field: undefined when it has none. The grid reads
     * it for every cell it renders, getErrors() searches the rows and copies
     */
    public __getRowErrors(row: Entity): ReadonlyMap<string, readonly string[]> | undefined {
        return this.__dataContainer.__rowErrors(row);
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
     * back. Sends `collection-changed` with `{ removed: true, info: 'clearMarkedForDeletion' }`. When
     * the current row is removed, {@link currentEntity} is set to `null` and `current-entity` is sent
     * after; a removed row leaves the selection (`selection-change`).
     *
     * When the new and edited rows were saved in the same go, call {@link acceptChanges} instead: it
     * removes the marked rows and accepts the rest. The changes of the removed rows leave the undo
     * history.
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
        const before = this.getAllData();
        this.__dataContainer.clearMarkedForDeletion();
        const notify = this.__forgetRemovedRows(before);
        // the rows are gone from the container, rebuild the displayed rows or they stay on screen.
        // Same event as removeData, it is a removal
        this.__internalUpdate(true);
        this.__callSubscribers('collection-changed', { removed: true, info: 'clearMarkedForDeletion' });
        notify();
    }

    /**
     * Throws away every change since the data was set: edited rows get their original values back,
     * rows marked for deletion are unmarked, new rows (from `addNewEmpty()`) are removed, and the
     * validation errors are cleared. Then the displayed rows are rebuilt. Rows removed for good
     * (`removeData()`, `clearMarkedForDeletion()`) do not come back. A new row that was the current
     * row sets {@link currentEntity} to `null` (`current-entity` is sent after), and leaves the
     * selection (`selection-change`). The undo history is cleared: there is nothing left to undo.
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
        const before = this.getAllData();
        this.__dataContainer.resetData();
        const notify = this.__forgetRemovedRows(before);
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info: 'resetData' });
        }
        notify();
    }

    /**
     * {@link resetData} for the selected rows only: their edits are undone, the ones marked for deletion
     * are unmarked, the new ones are removed, and their validation errors are cleared. The other rows
     * keep their changes.
     *
     * Unlike `resetData()` it is a step of the undo history: {@link undo} brings the edits and the
     * deletion marks back - not a new row it removed, undo never adds a row. {@link resetRows} keeps
     * the new rows.
     *
     * @example
     * ```ts
     * datasource.select(1); // the first row
     * datasource.resetDataSelectionOnly(); // only that row gets its original values back
     * ```
     */
    public resetDataSelectionOnly() {
        const before = this.getAllData();
        this.__dataContainer.resetDataSelection(this.getSelectedRows());
        const notify = this.__forgetRemovedRows(before);
        const eventTriggered = this.__internalUpdate(true);
        if (!eventTriggered) {
            this.__callSubscribers('collection-filtered', { info: 'resetData' });
        }
        notify();
    }

    /**
     * Reverts one cell: the field of the row gets its original value back - the value it had when the
     * data was set, or when the changes were last accepted. A field that is not edited (that
     * `getChanges()` would not list) is left as it is.
     *
     * It is an edit like any other: validated, and one step of the undo history - {@link undo} brings
     * the edited value back. The grid's row menu has it as "Undo cell edit" (`row.edit.revertCell`). The
     * grid shows it on its own, as any value set on a row (the `rows-changed` event). A conflict of the
     * field goes with the edit, see {@link getConflicts}.
     *
     * @param row the row, one the datasource handed out. A row that is not in the data is skipped
     * @param field the field
     *
     * @sample editing
     * @example
     * ```ts
     * const row = datasource.getDataRows()[0];
     * row.name = 'Changed';
     *
     * datasource.resetField(row, 'name'); // the name it had
     * datasource.undo(); // 'Changed' again
     * ```
     */
    public resetField(row: Entity, field: string): void {
        this.__dataContainer.__resetField(row, field);
    }

    /**
     * Reverts rows: their fields get their original values back and a row marked for deletion is
     * unmarked - {@link resetDataSelectionOnly}, for the rows given.
     *
     * - **A new row stays**, with the values it was added with (`addNewEmpty(row)`), still new. Unlike
     *   `resetDataSelectionOnly()`, which removes it: a revert can be undone, and undo never adds a row
     *   back. To get rid of a new row, mark it for deletion.
     * - It is one step of the undo history: {@link undo} brings the edits and the marks back.
     * - The fields are validated as for an edit: an error of an edit goes away with it, an original
     *   value that breaks a rule shows its error.
     * - The displayed rows are not rebuilt, the rows stay where they are. The grid's row menu has it
     *   as "Undo row edits" (`row.edit.revertRow`, the row right clicked, and `row.edit.revertRows`, the selected rows). The grid shows it on its own, as
     *   any value set on a row (the `rows-changed` event).
     * - The conflicts of the rows go with their changes, see {@link getConflicts}.
     *
     * @param rows a row or a list of rows, e.g. `getSelectedRows()`. Rows that are not in the data are
     * skipped
     *
     * @sample editing
     * @example
     * ```ts
     * datasource.resetRows(datasource.getSelectedRows());
     * ```
     */
    public resetRows(rows: Entity | Entity[]): void {
        this.__dataContainer.__resetRows(rows);
    }

    /**
     * Takes the last step of the undo history back: the values it changed get the values they had
     * before, a row it marked for deletion is unmarked (and the other way round). The grid does it
     * with Ctrl+Z (Cmd+Z), and from its row menu.
     *
     * **What a step is**: the changes made in one go - what the user typed in one cell until the focus
     * left it, a paste or a clear over the selected rows, a `markForDeletion()` call, a revert, or what
     * code sets on the rows in one synchronous run (no `await` in between). Edits from code are
     * recorded too, they are edits like the user's. New rows (`addNewEmpty()`, `setData(rows, { add:
     * true })`) are not in the history: undo never removes or adds a row. The last 100 steps are kept.
     *
     * The values are set as an edit sets them: the edit tracking follows (a value back at its original
     * is no edit any more) and so does the validation. The displayed rows are not rebuilt - no filter,
     * sort or grouping runs, the rows stay where they are - and `history-changed` is sent with
     * `info: 'undo'`, on which the grid renders its cells again. The history is the data container's,
     * shared by the datasources on it.
     *
     * @returns `false` when there is nothing to undo
     *
     * @sample editing
     * @example
     * ```ts
     * const row = datasource.getDataRows()[0];
     * row.name = 'Changed';
     *
     * datasource.undo(); // true: the name it had
     * datasource.redo(); // true: 'Changed' again
     * datasource.undo();
     * datasource.undo(); // false, nothing left to undo
     * ```
     */
    public undo(): boolean {
        return this.__dataContainer.__history.undo();
    }

    /**
     * Does the last step {@link undo} took back again. Recording a new step empties what there is to
     * redo. The grid does it with Ctrl+Y, Ctrl+Shift+Z (Cmd+Shift+Z), and from its row menu. Sends
     * `history-changed` with `info: 'redo'`.
     *
     * @returns `false` when there is nothing to redo
     *
     * @sample editing
     * @example
     * ```ts
     * if (datasource.canRedo()) {
     *     datasource.redo();
     * }
     * ```
     */
    public redo(): boolean {
        return this.__dataContainer.__history.redo();
    }

    /**
     * `true` when there is a step to {@link undo}. With the `history-changed` event, for an Undo button
     * of your own.
     *
     * @sample editing
     * @example
     * ```ts
     * declare const undoButton: HTMLButtonElement;
     * declare const redoButton: HTMLButtonElement;
     *
     * datasource.on('history-changed', () => {
     *     undoButton.disabled = !datasource.canUndo();
     *     redoButton.disabled = !datasource.canRedo();
     * });
     * undoButton.onclick = () => datasource.undo();
     * redoButton.onclick = () => datasource.redo();
     * ```
     */
    public canUndo(): boolean {
        return this.__dataContainer.__history.canUndo();
    }

    /**
     * `true` when there is a step to {@link redo}: undo took one back, and nothing was recorded since.
     *
     * @example
     * ```ts
     * declare const redoButton: HTMLButtonElement;
     *
     * redoButton.disabled = !datasource.canRedo();
     * ```
     */
    public canRedo(): boolean {
        return this.__dataContainer.__history.canRedo();
    }

    /**
     * Empties the undo history: nothing to undo or redo. The edits stay as they are. Sends
     * `history-changed` with `info: 'clear'` when there was something in it.
     *
     * Done by the datasource itself where undoing past would be wrong: `setData()` without `add`,
     * `removeAllData()`, `resetData()` and `acceptChanges()` - after a save the saved values are the
     * originals.
     *
     * @example
     * ```ts
     * datasource.getDataRows()[0].name = 'Changed';
     * datasource.clearHistory();
     * datasource.canUndo(); // false, the name stays 'Changed'
     * ```
     */
    public clearHistory(): void {
        this.__dataContainer.__history.clear();
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
     * Validates the rows: every field that has rules (`FieldConfig.validate`), of every row or of the
     * rows given. Call it before a save - the edits are validated as they are made, but a field that
     * was never edited (an empty field of a new row, say) only here.
     *
     * - **The rows marked for deletion are skipped**: they are not saved, they have no errors.
     * - **Every row is checked**, also a row the filter leaves out and a row that was not edited. To
     *   check only what a save sends, pass the new and edited rows (see the example).
     * - **The errors are kept**: `getErrors()` and `hasErrors()` read them, and the grid shows them on
     *   the cells and the row selectors - this sends `validate`, the grid renders its rows again. A
     *   field that passes loses its error. `acceptChanges()` and `resetData()` clear them.
     * - The server's errors (`setErrors()`, `__rowError`) are apart: not checked, not returned.
     *
     * The errors are those of the data container, so of every datasource sharing it.
     *
     * @param rows a row or a list of rows, default every row
     * @returns the errors, one entry per field with an error: the rows in the order of the data, the
     * fields in the order they are listed in `fields`. `[]` when every row is valid
     *
     * @sample validation
     * @example
     * ```ts
     * import { Datasource } from '@simple-html/grid';
     *
     * const people = new Datasource({
     *     key: 'id',
     *     fields: { name: { validate: ['required'] }, age: { type: 'number', validate: [{ id: 'min', value: 0 }] } }
     * });
     * people.setData([{ id: 1, name: 'Ann', age: 36 }]);
     * people.addNewEmpty({ age: -1 }); // not validated yet
     *
     * const errors = people.validate();
     * // [{ row: <the new row>, field: 'name', messages: ['Required'] },
     * //  { row: <the new row>, field: 'age', messages: ['Must be at least 0'] }]
     * if (errors.length === 0) {
     *     await fetch('/api/people/save', { method: 'POST', body: JSON.stringify(people.getChanges()) });
     * }
     *
     * // only what a save sends: the new and edited rows
     * people.validate(people.getAllData().filter((row) => row.__rowState === 'N' || row.__rowState === 'M'));
     * ```
     */
    public validate(rows?: Entity | Entity[]): ValidationError<T>[] {
        const errors = this.__dataContainer.__validate(rows) as ValidationError<T>[];
        this.__callSubscribers('validate', { errors });
        return errors;
    }

    /**
     * The validation errors the rows have now, without validating: from the edits, and the last
     * {@link validate}. Every row's, or the rows given. Same entries as `validate()` returns. A row
     * marked for deletion has none (its errors are back when it is unmarked).
     *
     * The server's error of a row (`setErrors()`) is not in it, read it as `row.__rowError`.
     *
     * @param rows a row or a list of rows, default every row
     *
     * @sample validation
     * @example
     * ```ts
     * import { isGroupRow } from '@simple-html/grid';
     *
     * // the errors of the current row, for a form next to the grid
     * const row = datasource.currentEntity;
     * if (row && !isGroupRow(row)) {
     *     for (const { field, messages } of datasource.getErrors(row)) {
     *         console.log(datasource.getField(field).label, messages.join(', '));
     *     }
     * }
     * ```
     */
    public getErrors(rows?: Entity | Entity[]): ValidationError<T>[] {
        return this.__dataContainer.__getErrors(rows) as ValidationError<T>[];
    }

    /**
     * `true` when a row has a validation error now: from an edit, or the last {@link validate}. It does
     * not validate - before a save, call `validate()`, which also checks the fields never edited. The
     * rows marked for deletion and the server's errors (`__rowError`) do not count.
     *
     * The errors are those of the data container, so of every datasource sharing it.
     *
     * @sample validation
     * @example
     * ```ts
     * declare const saveButton: HTMLButtonElement;
     *
     * // the grid sends no event for an edit: check when it matters
     * saveButton.disabled = datasource.hasErrors();
     * ```
     */
    public hasErrors(): boolean {
        return this.__dataContainer.__hasErrors();
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
     * A step of the undo history: {@link undo} (Ctrl+Z in the grid) takes the marks off again.
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
     * edit is undone. A step of the undo history, like {@link markForDeletion}.
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
     * - the row's error (`setErrors()`) and its validation errors are cleared
     *
     * Then `getChanges()` lists none of them, `hasChanges()` is `false` when every row was accepted,
     * and `resetData()` goes back to these values. The undo history is cleared - also when only some
     * rows were accepted: the saved values are the originals now, undoing past them would make edits
     * of them. The displayed rows are rebuilt and `collection-filtered` is sent once, with
     * `info: 'acceptChanges'`. When the current row was
     * removed, {@link currentEntity} is set to `null` and `current-entity` is sent after; a removed
     * row leaves the selection (`selection-change`).
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

        const rowsBefore = this.getAllData();
        this.__dataContainer.acceptChanges(options);

        for (const [row, before] of keysBefore) {
            if (before !== undefined && row.__KEY !== undefined && row.__KEY !== before) {
                this.__selection.replaceKey(before, row.__KEY);
            }
        }
        // the rows marked for deletion are gone
        const notify = this.__forgetRemovedRows(rowsBefore);
        this.__afterRowStateChange('acceptChanges');
        notify();
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
     * Lets go of the rows a method just removed from the data: the current row is set to null when it
     * is one of them (as setData() does), and their keys leave the selection. Done before the method
     * sends its own event, so every handler reads the new state.
     * @param before the rows before the removal, from getAllData()
     * @returns sends `current-entity` and `selection-change` when they changed: call it after the
     * method's own event
     */
    private __forgetRemovedRows(before: readonly Entity[]): () => void {
        const kept = new Set<Entity>(this.getAllData());
        return this.__forgetRows(before.filter((row) => !kept.has(row)));
    }

    /**
     * {@link __forgetRemovedRows} for a method that knows the rows it removed
     * @param removed the rows removed from the data
     */
    private __forgetRows(removed: readonly Entity[]): () => void {
        const current = this.currentEntity;
        const currentGone = removed.some((row) => row === current);
        if (currentGone) {
            this.currentEntity = null;
        }

        const removedKeys = new Set(removed.map((row) => row.__KEY));
        const selected = this.__selection.getSelectedKeys();
        const stillSelected = selected.filter((key) => !removedKeys.has(key));
        const selectionChanged = stillSelected.length !== selected.length;
        if (selectionChanged) {
            this.__selection.setSelectedKeys(stillSelected);
        }

        return () => {
            if (currentGone) {
                this.__callSubscribers('current-entity', {});
            }
            if (selectionChanged) {
                this.__callSubscribers('selection-change', {});
            }
        };
    }

    /**
     * Removes rows for good: they are not marked for deletion, `getChanges()` does not list them and
     * `resetData()` does not bring them back. Use {@link markForDeletion} to delete rows on a server.
     * Their changes leave the undo history, and a step left without changes is dropped: undo never
     * writes into a row that is gone.
     *
     * Sends `collection-changed`. A removed row leaves the selection (`selection-change` is sent
     * after), and when it was the current row {@link currentEntity} is set to `null`
     * (`current-entity` is sent after).
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
        const before = this.getAllData();
        const removed = this.__dataContainer.removeData(rows);
        const notify = this.__forgetRemovedRows(before);
        if (refilter) {
            this.__internalUpdate(true);
        }
        this.__callSubscribers('collection-changed', { removed: true, info: 'removeData', data: rows });
        notify();
        return removed;
    }

    /**
     * Removes every row for good, see {@link removeData}. Was `removeData(null, true)` in v5. Sends
     * the same `collection-changed` event, with `data: null`. The rows leave the selection and
     * {@link currentEntity} is set to `null`, with their events after it. The undo history is cleared.
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
        const before = this.getAllData();
        const removed = this.__dataContainer.removeAllData();
        const notify = this.__forgetRemovedRows(before);
        this.__internalUpdate(true);
        this.__callSubscribers('collection-changed', { removed: true, info: 'removeData', data: null });
        notify();
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
     * Without `add` the undo history is cleared, the rows start over. Rows added are not in the
     * history: {@link undo} never removes a row.
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
            // concat, not push(...rows): a spread of very many rows is more arguments than a call takes
            this.__collectionFiltered = this.__collectionFiltered.concat(this.__dataContainer.setData(rows, { add }));
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
     * Merges rows from a server into the data by their key: for polling, or for changes a server
     * pushes. Needs a key (`new Datasource({ key: 'id' })`).
     *
     * - **A row whose key is in the data** gets the values of the fields the incoming row has, as the
     *   server's values: the value and its original - the row is not edited by them. A field the
     *   incoming row does not have stays as it is. Not a step of the undo history; the fields are
     *   validated as for an edit.
     * - **A field the user has edited** keeps the user's value. The server's value becomes its original,
     *   so `getChanges()` sends the user's value as an edit of what the server has now. When the server
     *   changed the field too, it is a conflict (see {@link getConflicts}); when the server has the
     *   user's value, the edit is done - not edited any more. A cell the user is typing in counts as
     *   edited: it is never overwritten.
     * - **A row marked for deletion** gets the values too, and keeps its mark.
     * - **A key that is not in the data**: the row is added, a loaded row (not new, not edited) - the
     *   object itself, as `setData()` adds it.
     * - **A new row** (`addNewEmpty()`) is not on the server: its key is a generated one, it never matches.
     * - **`removeMissing`**: the rows whose key is not among the rows are removed for good (their changes
     *   leave the undo history) - not a new row, and not a row with changes of the user's (edits, a
     *   deletion mark, a cell being typed in): that one stays, in conflict (`field: null`).
     *
     * The keys are compared as text: `7` and `'7'` are the same key. The key field is never written. A
     * key given twice: the second row updates what the first one added or updated.
     *
     * Then the displayed rows are rebuilt once - filtered (see `refilter`, and `filterChangedOnly()`),
     * sorted, grouped. The selection (it follows the key), the expanded groups and the grid's scroll
     * position stay; a removed row leaves the selection, and {@link currentEntity} is set to `null`
     * when it is removed. `collection-changed` (`info: 'upsert'`) is sent once when rows were added or
     * removed or the displayed rows changed - not when only values changed: the grid renders those
     * from `rows-changed`, which follows in a microtask with the rows changed, then `conflicts-changed`
     * when the conflicts changed.
     *
     * Cheap on many rows: one look up per row, by its key. The rows of the other datasources on the same
     * container are merged too, call `reloadDatasource()` on them to show it.
     *
     * @param rows the server's rows, plain objects: each with its key, and the fields sent
     * @param options `removeMissing` and `refilter`, see {@link UpsertOptions}
     * @returns the rows added, updated and removed, and the conflicts it made, see {@link UpsertResult}
     * @throws a `TypeError` when the datasource has no key, `rows` is no array, or a row has no key
     * (blank) - checked first, nothing is merged then
     *
     * @sample live-data
     * @example
     * ```ts
     * import { Datasource } from '@simple-html/grid';
     *
     * interface Stock {
     *     id: number;
     *     name: string;
     *     price: number;
     * }
     * declare function fetchStocks(): Promise<Stock[]>;
     *
     * const stocks = new Datasource<Stock>({ key: 'id', fields: { price: 'number' } });
     * stocks.setData(await fetchStocks());
     *
     * // every second the rows the server has: gone there is gone here, unless it has changes here
     * setInterval(async () => {
     *     stocks.upsert(await fetchStocks(), { removeMissing: true });
     * }, 1000);
     *
     * // one value pushed by the server: only the fields sent change
     * stocks.upsert([{ id: 7, price: 12.5 }]);
     * ```
     */
    public upsert(rows: Partial<T>[], options: UpsertOptions = {}): UpsertResult<T> {
        assertOptions('upsert', options, 'upsert(rows, { removeMissing: true })');
        const { removeMissing = false, refilter = true } = options;
        // a copy: without grouping the displayed rows can be the filtered ones, which change in place
        const displayedBefore = this.__collectionDisplayed.slice();
        const result = this.__dataContainer.__upsert(rows, removeMissing) as UpsertResult<T>;
        const notify = this.__forgetRows(result.removed);

        if (!refilter) {
            // the rows shown stay shown, the new ones are shown too
            if (result.removed.length) {
                const gone = new Set<Entity>(result.removed);
                this.__collectionFiltered = this.__collectionFiltered.filter((row) => !gone.has(row));
            }
            // concat, not push(...added): a spread of very many rows is more arguments than a call takes
            this.__collectionFiltered = this.__collectionFiltered.concat(result.added);
        }
        this.__internalUpdate(refilter, false);

        // only values changed: rows-changed renders them, a rebuild of the grid is not needed
        const added = result.added.length > 0;
        const removed = result.removed.length > 0;
        if (added || removed || !isSameDisplay(displayedBefore, this.__collectionDisplayed)) {
            this.__callSubscribers(
                'collection-changed',
                removed ? { info: 'upsert', added, removed } : { info: 'upsert', added }
            );
        }
        notify();
        return result;
    }

    /**
     * The conflicts {@link upsert} found: a field the server changed that the user has edited (the
     * user's value is kept), or a row the server no longer has that has changes here (the row is kept) -
     * see {@link Conflict}. Every row's, or the rows given, in the order of the rows. New objects every
     * call: `local` is the value the row has now.
     *
     * A conflict stays until it is resolved ({@link resolveConflict}) or what it is about is gone: the
     * field is not edited any more (reverted with `resetField()` or `resetRows()`, undone, typed back
     * to the server's value, saved with `acceptChanges()`), the row has no changes any more, or the row
     * leaves the data (`removeData()`, `setData()` without `add` ...). `resetData()` clears every one.
     * `conflicts-changed` is sent when they change.
     *
     * The conflicts are those of the data container, so of every datasource sharing it.
     *
     * @param rows a row or a list of rows, default every row
     *
     * @sample live-data
     * @example
     * ```ts
     * declare const conflictCount: HTMLElement;
     *
     * datasource.on('conflicts-changed', () => {
     *     conflictCount.textContent = String(datasource.getConflicts().length);
     * });
     *
     * for (const conflict of datasource.getConflicts()) {
     *     if (conflict.field === null) {
     *         console.log(`row ${conflict.row.__KEY} was removed on the server`);
     *     } else {
     *         console.log(`${conflict.field}: yours ${conflict.local}, the server's ${conflict.remote}`);
     *     }
     * }
     * ```
     */
    public getConflicts(rows?: Entity | Entity[]): Conflict<T>[] {
        return this.__dataContainer.__getConflicts(rows) as Conflict<T>[];
    }

    /**
     * `true` when a row is in conflict, see {@link getConflicts}. Before a save, say: the user's values
     * of a field in conflict overwrite the server's newer ones.
     *
     * @sample live-data
     * @example
     * ```ts
     * declare const saveButton: HTMLButtonElement;
     *
     * datasource.on('conflicts-changed', () => {
     *     saveButton.title = datasource.hasConflicts() ? 'Some of your changes were also changed on the server' : '';
     * });
     * ```
     */
    public hasConflicts(): boolean {
        return this.__dataContainer.__hasConflicts();
    }

    /**
     * Resolves a conflict, see {@link getConflicts}:
     *
     * - `'local'`: the user's value stays, still edited - `getChanges()` sends it, as an edit of the
     *   server's value. For a row the server removed: the row stays with its changes, and a later
     *   `upsert(rows, { removeMissing: true })` gives it no conflict again (it removes it once it has no
     *   changes)
     * - `'remote'`: the field gets the server's value - its original - as {@link resetField} does: an
     *   edit, validated, a step of the undo history ({@link undo} brings the user's value back). For a
     *   row the server removed: the row is removed, as {@link removeData} does, with its events
     *
     * The grid shows it on its own (`rows-changed`). Nothing happens when there is no such conflict.
     *
     * @param row the row
     * @param field the field, `null` for a row the server removed
     * @param take `'local'` for the user's value, `'remote'` for the server's
     * @throws a `TypeError` when `take` is neither
     *
     * @sample live-data
     * @example
     * ```ts
     * // the server wins every conflict
     * for (const conflict of datasource.getConflicts()) {
     *     datasource.resolveConflict(conflict.row, conflict.field, 'remote');
     * }
     * ```
     */
    public resolveConflict(row: Entity, field: string | null, take: 'local' | 'remote'): void {
        if (take !== 'local' && take !== 'remote') {
            throw new TypeError(`resolveConflict(row, field, take): take is 'local' or 'remote', not '${take}'`);
        }
        if (field === null && take === 'remote') {
            if (this.__dataContainer.__rowConflicts(row)?.has(null)) {
                this.removeData(row);
            }
            return;
        }
        this.__dataContainer.__resolveConflict(row, field, take);
    }

    /**
     * When the last {@link upsert} changed the value of a field of a row: the `Date.now()` of that upsert.
     * `undefined` when no upsert changed it. A value set by the user or by code does not count, nor
     * does a conflict (the value stays the user's). The grid flashes the cells a merge changed on its own
     * (`GridConfig.mergeHighlight`); for a look of your own a `cellClass` hook can read it - the grid
     * renders the rows an upsert changed.
     *
     * @param row the row
     * @param field the field
     *
     * @sample live-data
     * @example
     * ```ts
     * // the cells an upsert changed in the last second get a class, with a css animation that runs once
     * gridInterface.updateHooks({
     *     cellClass: (row, field) => {
     *         const at = datasource.getMergedAt(row, field);
     *         return at !== undefined && Date.now() - at < 1000 ? { input: 'just-changed' } : null;
     *     }
     * });
     * ```
     */
    public getMergedAt(row: Entity, field: string): number | undefined {
        return this.__dataContainer.__mergedAt(row, field);
    }

    /**
     * @internal
     * the conflicts of a row, by field (`null` for the row as a whole): undefined when it has none. The
     * grid reads it for every cell it renders, getConflicts() searches the rows and copies
     */
    public __getRowConflicts(
        row: Entity
    ): ReadonlyMap<string | null, { readonly remote: unknown; readonly original: unknown }> | undefined {
        return this.__dataContainer.__rowConflicts(row);
    }

    /**
     * Adds a new row at the end: `getChanges()` lists it in `newEntities`, its `__rowState` is `'N'`.
     * When grouped it is put in its group, and the group is expanded.
     *
     * The row gets a generated key, a negative number: with a key field it is written there
     * (`{ company: 'NEW COMPANY', id: -1 }`), else it is the row's `__KEY`. After the save,
     * `acceptChanges({ newKeys })` gives it the key from the server, see {@link acceptChanges}.
     *
     * Adding the row is not a step of the undo history: {@link undo} never removes it. Its edits after
     * are steps, like any edit.
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
     * @param notifyForced `false` to leave out the `'__internalUpdate, forced'` event: upsert() sends
     * its own event, when the displayed rows changed
     */
    private __internalUpdate(reRunFilter: boolean, notifyForced = true) {
        let forceUpdate = false;
        if (
            notifyForced &&
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
            // and the changed rows only, see filterChangedOnly()
            if (this.__changedOnly) {
                this.__collectionFiltered = this.__collectionFiltered.filter(isChangedRow);
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
        if (type === 'history-changed') {
            // the history is the container's, shared by the datasources on it - and so is its event
            return this.__dataContainer.__history.on(handler as EventHandler<DatasourceEvents['history-changed']>);
        }
        if (type === 'rows-changed' || type === 'conflicts-changed') {
            // the rows and their conflicts are the container's too
            return this.__dataContainer.__on(
                type,
                handler as EventHandler<DatasourceEvents['rows-changed' | 'conflicts-changed']>
            );
        }
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
     * Sums up a field over rows: its sum, average, smallest or largest number, or how many values it
     * has - see {@link AggregateFunction}. Blank values are left out, `sum`, `avg`, `min` and `max`
     * take numbers only. Nothing is rounded, format the result with the field's formatter
     * (`getFormatter(field).format(value)`).
     *
     * - **No rows given**: the rows the filter lets through, `getDataRows()` - when grouped, the rows of
     *   collapsed groups too. Rows marked for deletion count until they are saved, as they are rows
     *   of the grid until then.
     * - **A group row**: the data rows of the group, of its sub groups - collapsed ones too.
     * - **A list of rows**: those rows, e.g. `getSelectedRows()`. Computed on each call.
     *
     * The value of the filtered rows and of a group row is kept until a value of the field changes (set
     * on a row: an edit, `undo()`, `upsert()` ...) or other rows are filtered (`filter()`, `setData()`,
     * rows added or removed). Asking again is cheap: the grid asks on every rebuild, and for every
     * group row it renders. A sort changes no value; a filter, sort or `group()` makes new group rows.
     *
     * The grid shows these in its group rows and its totals row: a column's `aggregate` in the grid
     * config, see the aggregates guide.
     *
     * @param field the field, the property on the row
     * @param fn `'sum'`, `'avg'`, `'min'`, `'max'` or `'count'`
     * @param rows the rows: left out the filtered rows, a group row, or a list of data rows
     * @returns the number, `null` for the average, smallest or largest of no numbers
     * @throws a `TypeError` when `fn` is no aggregate function
     *
     * @sample aggregates
     * @example
     * ```ts
     * import { isGroupRow } from '@simple-html/grid';
     *
     * datasource.aggregate('balance', 'sum'); // 1234567.89, over the rows the filter lets through
     * datasource.aggregate('age', 'avg'); // 38.5, or null when no row has an age
     * datasource.aggregate('email', 'count'); // the rows with an email
     *
     * // per group, the rows of collapsed groups included
     * datasource.group([{ attribute: 'country', title: 'Country' }]);
     * for (const row of datasource.getRows()) {
     *     if (isGroupRow(row)) {
     *         console.log(row.__groupName, datasource.aggregate('balance', 'sum', row));
     *     }
     * }
     *
     * // the selected rows, formatted as the field shows its values
     * const sum = datasource.aggregate('balance', 'sum', datasource.getSelectedRows());
     * datasource.getFormatter('balance').format(sum);
     * ```
     */
    public aggregate(field: string, fn: AggregateFunction, rows?: Entity[] | GroupRow): number | null {
        // plain js and JSON can give anything
        if (!isAggregateFunction(fn)) {
            throw new TypeError(
                `Datasource.aggregate: '${String(fn)}' is no aggregate function, use ${AGGREGATE_FUNCTIONS.map((name) => `'${name}'`).join(', ')}`
            );
        }
        if (Array.isArray(rows)) {
            return aggregateRows(rows, field, fn);
        }
        const changeCount = this.__dataContainer.__getChangeCount(field);

        if (rows === undefined) {
            // the filtered rows: kept while they are the same list. Every change of which rows they are
            // makes a new list (filter(), setData(), upsert(), removeData() ...) or adds to it
            // (addNewEmpty() pushes: its length). A sort reorders it in place, the values stay
            const filtered = this.__collectionFiltered;
            if (this.__filteredAggregates.rows !== filtered || this.__filteredAggregates.length !== filtered.length) {
                this.__filteredAggregates = { rows: filtered, length: filtered.length, values: new Map() };
            }
            return keptAggregate(this.__filteredAggregates.values, field, fn, changeCount, () => filtered);
        }

        // a group row: a group row is made new when the rows are grouped again, so it never has to be
        // told that rows came or went
        let kept = this.__groupAggregates.get(rows);
        if (!kept) {
            kept = new Map();
            this.__groupAggregates.set(rows, kept);
        }
        return keptAggregate(kept, field, fn, changeCount, () => groupDataRows(rows));
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
     * @internal
     * Sorts a field on a text made from its value, see Sort.setSortValue: the grid sorts a lookup
     * column (`ColumnConfig.editor`) on the label it shows. Takes effect on the next sort
     * @param sortValue the text of a value, null to sort on the value again
     */
    public __setSortValue(field: string, sortValue: ((value: unknown) => string) | null): void {
        this.__sorting.setSortValue(field, sortValue);
    }

    /**
     * @internal
     * the function __setSortValue() was given for a field, undefined without one
     */
    public __getSortValue(field: string): ((value: unknown) => string) | undefined {
        return this.__sorting.getSortValue(field);
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
     * Shows only the changed rows: the new rows, the edited ones and the ones marked for deletion -
     * the rows with a `__rowState`. On top of the filter there is: a row is shown when the filter lets
     * it through AND it is changed. Runs the filter, as `filter()` does.
     *
     * - **It is not part of the filter**: `getFilter()`, the header filters, the filter editor,
     *   `getFilterString()` and the grid's state (`GridState.filter`) do not have it, and setting the
     *   filter (`filter()`, the header filters, the filter editor) leaves it on. It stays on until it
     *   is turned off: `filterChangedOnly(false)`, the grid's row menu (View › Changed rows only) or the
     *   footer's Clear.
     * - **It is applied when the rows are filtered**, as the filter is: `filter()`, a header filter,
     *   `setData()`, `reloadDatasource()`, marking rows for deletion, `acceptChanges()` ... An edit does
     *   not filter the rows again, so a row edited back to its original values stays shown until the
     *   rows are filtered next - it does not disappear while the user types in it.
     * - The grid shows it in the footer, as a chip in front of the filter's.
     *
     * @param on `true` for the changed rows only, `false` for every row the filter lets through
     *
     * @sample editing
     * @example
     * ```ts
     * import { where } from '@simple-html/grid';
     *
     * datasource.filter(where('country', 'EQUAL', 'Norway'));
     * datasource.filterChangedOnly(true); // the changed rows in Norway
     * datasource.isChangedOnly(); // true
     * datasource.getFilter(); // still { field: 'country', operator: 'EQUAL', value: 'Norway' }
     * datasource.filterChangedOnly(false); // every row in Norway again
     * ```
     */
    public filterChangedOnly(on: boolean): void {
        this.__changedOnly = on;
        this.filter();
    }

    /**
     * `true` while only the changed rows are shown, see {@link filterChangedOnly}.
     *
     * @example
     * ```ts
     * datasource.isChangedOnly(); // false
     * datasource.filterChangedOnly(true);
     * datasource.isChangedOnly(); // true
     * ```
     */
    public isChangedOnly(): boolean {
        return this.__changedOnly;
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
     * The operators and AND / OR are texts, the ids `filterString.*` of {@link TEXTS}: change them with
     * {@link setTexts} (`'filterString.operator.EQUAL': 'equal_to'` is shown as `<<EQUAL_TO>>`).
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
                const operator = getText(expression.group === 'OR' ? 'filterString.or' : 'filterString.and');
                const children = expression.children.filter((child) => this.__isShown(child));
                return `(${children.map(parser).join(` ${operator} `)})`;
            }

            // an operator of plain js that is not one is shown as it is
            const operator = findText(`filterString.operator.${expression.operator}`) ?? expression.operator;
            const condition = `[${label(expression.field)}] <<${operator}>>`;
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

/**
 * aggregates kept, by `fn:field`: the value, and the change count of the field it was computed at
 */
type KeptAggregates = Map<string, { changeCount: number; value: number | null }>;

/**
 * An aggregate kept in `kept`: computed over the rows when it is not kept, or the field changed since
 * (its change count moved, see DataContainer.__getChangeCount). An edit of another field keeps it
 * @param changeCount the change count of the field now
 * @param rows gives the rows, called only when the value is computed
 */
function keptAggregate(
    kept: KeptAggregates,
    field: string,
    fn: AggregateFunction,
    changeCount: number,
    rows: () => readonly Entity[]
): number | null {
    const key = `${fn}:${field}`;
    const entry = kept.get(key);
    if (entry && entry.changeCount === changeCount) {
        return entry.value;
    }
    const value = aggregateRows(rows(), field, fn);
    kept.set(key, { changeCount, value });
    return value;
}

/**
 * true for a changed row: new, edited or marked for deletion - a row with a `__rowState`. What
 * filterChangedOnly() shows
 */
function isChangedRow(row: Entity): boolean {
    return row.__rowState !== undefined;
}

/**
 * true when two lists of displayed rows show the same: the same data rows at the same places, and
 * group rows that show the same group the same way. Grouping makes new group rows every time, so
 * those are compared by what the grid shows of them
 */
function isSameDisplay(before: readonly (Entity | GroupRow)[], after: readonly (Entity | GroupRow)[]): boolean {
    if (before.length !== after.length) {
        return false;
    }
    for (let i = 0; i < before.length; i++) {
        const a = before[i];
        const b = after[i];
        if (a === b) {
            continue;
        }
        if (
            !isGroupRow(a) ||
            !isGroupRow(b) ||
            a.__groupID !== b.__groupID ||
            a.__groupName !== b.__groupName ||
            a.__groupLvl !== b.__groupLvl ||
            a.__groupTotal !== b.__groupTotal ||
            a.__groupExpanded !== b.__groupExpanded
        ) {
            return false;
        }
    }
    return true;
}
