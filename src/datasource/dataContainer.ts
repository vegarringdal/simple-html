import { Emitter, type EventHandler } from '../emitter';
import { assertOptions } from './assertOptions';
import type { Changes, ModifiedEntity } from './changes';
import type { DatasourceEvents } from './datasourceEvents';
import type { DataEntity, Entity } from './entity';
import { EntityHandler, isSameValue } from './entityHandler';
import type { FieldType } from './field';
import { History } from './history';
import { isBlank } from './isBlank';
import type { Conflict, UpsertResult } from './liveData';
import type { ValidationError } from './validator';
import { type ResolvedRule, runRules } from './validatorRegistry';

/**
 * a conflict as the container keeps it, see DataContainer.__conflicts. `getConflicts()` makes a
 * {@link Conflict} of it, with the value the row has then
 */
interface ConflictRecord {
    /** the server's value, `'removed'` for the row as a whole */
    remote: unknown;
    /** the value the user's edit started from, `undefined` for the row as a whole */
    original: unknown;
}

/**
 * the events of the container itself, see DataContainer.__on
 */
type ContainerEvents = Pick<DatasourceEvents, 'rows-changed' | 'conflicts-changed'>;

let globalKeyCount = 0;

// we need 1 for all datasources not using uniqueKeyAttribute
export const getNextKey = () => {
    globalKeyCount--;
    return globalKeyCount;
};

/**
 * acceptChanges() takes an options object, `{ rows }`. Plain JavaScript can pass the rows themselves,
 * which would read as no options at all and accept every row - so that throws.
 */
function assertAcceptChangesOptions(options: unknown) {
    if (Array.isArray(options) || typeof options !== 'object' || options === null || (options as Entity).__controller) {
        throw new TypeError('acceptChanges() takes an options object: acceptChanges({ rows, newKeys })');
    }
}

/**
 * Holds the rows and tracks their edits (`getChanges()`). Every datasource has one: a new one by
 * default, or the one given as `DatasourceOptions.container` - several datasources can share it and
 * so show the same rows, each with its own filter, sort, grouping and selection. The field types for
 * the edit tracking come from the `fields` of the datasources made on it.
 *
 * Most of the time you do not use it directly: the datasource's methods call it and also rebuild the
 * displayed rows and send the events. The container's own methods do neither - after changing the rows
 * here, call `datasource.reloadDatasource()` to show them.
 *
 * @example
 * ```ts
 * import { DataContainer, Datasource } from '@simple-html/grid';
 *
 * // two datasources, e.g. two grids, on the same rows
 * const container = new DataContainer('id');
 * const left = new Datasource({ container, fields: { born: 'date' } });
 * const right = new Datasource({ container, fields: { born: 'date' } });
 *
 * left.setData([{ id: 1, name: 'Ann', born: new Date(1990, 4, 17) }]);
 * right.getAllData(); // the same row
 * ```
 */
export class DataContainer {
    private __collection: DataEntity[] = [];
    private __keyAttribute: string | undefined = '';
    private EntityHandler = EntityHandler;

    /**
     * the type of every field the datasources on this container list in their `fields`, see
     * __addFields. The rows' edit tracking reads it
     */
    private __fieldTypes = new Map<string, FieldType>();

    /**
     * the validation rules of the fields that have them (`FieldConfig.validate`), from the datasources
     * on this container, see __addFields. An edit of a row validates its field with them
     */
    private __rules = new Map<string, ResolvedRule[]>();

    /**
     * the validation errors per row: the messages per field, only the fields that have one, and only
     * the rows that have one. Keyed by the row, so a row that leaves the container takes its errors
     * with it
     */
    private __errors = new WeakMap<Entity, Map<string, string[]>>();

    /**
     * @internal
     * The undo/redo history of the rows' edits and deletion marks: the container's, like the edits,
     * so the datasources sharing it share it. `datasource.undo()` ... call it, the grid writes what
     * the user types through `__history.typing()`. A field compares as the edit tracking does
     */
    public readonly __history = new History(
        (field, before, after) => isSameValue(before, after, this.__fieldTypes.get(field)),
        (row) => this.afterMarkChange(row)
    );

    /**
     * the conflicts of upsert(), per row: field -> the server's value and the original the user's
     * edit started from, `null` for the row as a whole (removed on the server). Only the rows that
     * have one: a field in conflict is edited, a row in conflict has local changes - see
     * settleConflicts
     */
    private __conflicts = new Map<DataEntity, Map<string | null, ConflictRecord>>();

    /**
     * the rows the user kept with `resolveConflict(row, null, 'local')` after the server removed them:
     * a later `upsert(rows, { removeMissing: true })` gives them no conflict again
     */
    private __kept = new WeakSet<Entity>();

    /** per row, the time (`Date.now()`) the last upsert changed each field it changed, see __mergedAt */
    private __merged = new WeakMap<Entity, Map<string, number>>();

    /** the rows (and their fields) changed in this run of code, sent as `rows-changed`, see changed() */
    private __changed = new Map<Entity, Set<string>>();

    /** true when the conflicts changed in this run of code, sent as `conflicts-changed` */
    private __conflictsChanged = false;

    /** true while the microtask that sends the events of this run of code is queued */
    private __flushQueued = false;

    /** the handlers of `rows-changed` and `conflicts-changed`, see __on */
    private __events = new Emitter<ContainerEvents>();

    /**
     * counts the values set, per field, see changed(): one up on every value set on a row, right away -
     * not in the microtask of `rows-changed`. What is computed from the values of a field and kept is
     * out of date once its count has moved, see __getChangeCount
     */
    private __changeCounts = new Map<string, number>();

    /**
     * @param UniqueKeyAttribute the field that identifies a row, e.g. `'id'`. The selection follows it,
     * so it survives replacing the rows with fresh ones from a server. Left out, every row gets a
     * generated key (a negative number)
     *
     * @example
     * ```ts
     * import { DataContainer, Datasource } from '@simple-html/grid';
     *
     * const container = new DataContainer('id');
     * const datasource = new Datasource({ container });
     * ```
     */
    constructor(UniqueKeyAttribute?: string) {
        // we want to add sufix just incase its something like a new
        this.__keyAttribute = UniqueKeyAttribute;
    }

    /**
     * The field that identifies a row, as given to the constructor. `undefined` when there is none,
     * then every row gets a generated key.
     *
     * @example
     * ```ts
     * import { DataContainer } from '@simple-html/grid';
     *
     * const container = new DataContainer('id');
     * container.getKeyAttribute(); // 'id'
     * ```
     */
    public getKeyAttribute(): string | undefined {
        return this.__keyAttribute;
    }

    /**
     * @internal
     * Called by every datasource made on this container, with the type of each field in its
     * `fields` and the validation rules of the fields that have them. Edit tracking and validation
     * are the container's - the rows are shared, an edit is one edit whichever datasource shows it -
     * so it needs one type and one list of rules per field: a field listed by one datasource has its
     * type and rules, and datasources that both list a field must give it the same type, and the
     * same rules when both give it rules.
     *
     * @throws when a field already has another type, or other rules, from a datasource made earlier
     * on this container. Nothing is added then.
     */
    public __addFields(types: Map<string, FieldType>, rules: Map<string, ResolvedRule[]>): void {
        for (const [field, type] of types) {
            const known = this.__fieldTypes.get(field);
            if (known !== undefined && known !== type) {
                throw new Error(
                    `Datasource: field '${field}' is '${type}' here and '${known}' in another datasource on the same container, give it the same type in both`
                );
            }
        }
        for (const [field, fieldRules] of rules) {
            const known = this.__rules.get(field);
            if (known !== undefined && rulesText(known) !== rulesText(fieldRules)) {
                throw new Error(
                    `Datasource: field '${field}' has other validation rules here than in another datasource on the same container, give it the same rules in both (or rules in one of them only)`
                );
            }
        }
        for (const [field, type] of types) {
            this.__fieldTypes.set(field, type);
        }
        for (const [field, fieldRules] of rules) {
            this.__rules.set(field, fieldRules);
        }
    }

    /**
     * A field of a row was set: the proxy (EntityHandler) calls this after the value is in. The field
     * is validated, and so are the row's other fields that have an error - an error that depends on
     * the edited value (a validator that reads the row) clears once it is fixed. A field without an
     * error is not checked: an edit never adds an error to another field.
     */
    private validateEdit(row: Entity, field: string) {
        const errors = this.__errors.get(row);
        if (!errors && !this.__rules.has(field)) {
            return; // the common case: nothing to check
        }
        const fields = new Set([field, ...(errors?.keys() ?? [])]);
        this.validateRow(row, fields);
    }

    /**
     * validates the fields of a row with their rules, and keeps the errors: a field that passes loses
     * its error, the other fields keep theirs. A field without rules has no error
     */
    private validateRow(row: Entity, fields: Iterable<string>) {
        const checked = new Map<string, string[]>();
        for (const field of fields) {
            const rules = this.__rules.get(field);
            checked.set(field, rules ? runRules(rules, row[field], row) : []);
        }
        const before = this.__errors.get(row);
        // in the order of the rules, so the errors are listed the same way every time
        const errors = new Map<string, string[]>();
        for (const field of this.__rules.keys()) {
            const messages = checked.get(field) ?? before?.get(field);
            if (messages?.length) {
                errors.set(field, messages);
            }
        }
        if (errors.size) {
            this.__errors.set(row, errors);
        } else {
            this.__errors.delete(row);
        }
    }

    /**
     * @internal
     * `datasource.validate()`: validates every field that has rules, of every row or the rows given -
     * the rows marked for deletion are skipped, they are not saved. Keeps the errors (a field that
     * passes loses its error) and returns them, see __getErrors
     * @param rows a row or a list of rows, default every row. Rows not in the container are skipped
     */
    public __validate(rows?: Entity | Entity[]): ValidationError[] {
        const checked = (rows === undefined ? this.__collection : this.rowsIn(rows)).filter(
            (row) => !row.__controller.__isDeleted
        );
        if (this.__rules.size) {
            for (const row of checked) {
                this.validateRow(row, this.__rules.keys());
            }
        }
        return this.__getErrors(checked);
    }

    /**
     * @internal
     * `datasource.getErrors()`: the validation errors the rows have now, one entry per field with an
     * error: in the order of the rows in the container, the fields in the order of the rules (as the
     * datasources listed them in `fields`). A row
     * marked for deletion has none, it is not saved - its errors are back when it is unmarked
     * @param rows a row or a list of rows, default every row. Rows not in the container are skipped
     */
    public __getErrors(rows?: Entity | Entity[]): ValidationError[] {
        const result: ValidationError[] = [];
        for (const row of rows === undefined ? this.__collection : this.rowsIn(rows)) {
            for (const [field, messages] of this.__rowErrors(row) ?? []) {
                // a copy: the list is the container's
                result.push({ row, field, messages: [...messages] });
            }
        }
        return result;
    }

    /**
     * @internal
     * The validation errors of one row, the messages by field in the order of the rules: the container's
     * own map, do not change it. `undefined` when the row has none, or is marked for deletion (see
     * __getErrors). For the grid, which asks for every cell it renders: no search, no copy
     */
    public __rowErrors(row: Entity): ReadonlyMap<string, readonly string[]> | undefined {
        return row.__controller?.__isDeleted ? undefined : this.__errors.get(row);
    }

    /**
     * @internal
     * `datasource.hasErrors()`: true when a row has a validation error. The rows marked for deletion
     * do not count, see __getErrors
     */
    public __hasErrors(): boolean {
        return this.__collection.some((row) => !row.__controller.__isDeleted && this.__errors.has(row));
    }

    /**
     * @internal
     * Subscribes to the container's own events, `rows-changed` and `conflicts-changed`, see
     * DatasourceEvents: the rows are the container's, so every datasource on it sends them -
     * `datasource.on()` subscribes here
     */
    public __on<Type extends keyof ContainerEvents>(type: Type, handler: EventHandler<ContainerEvents[Type]>): () => void {
        return this.__events.on(type, handler);
    }

    /**
     * @internal
     * How many times a value of the field was set on a row so far, by anything (see changed()): goes
     * up right away, before `rows-changed` is sent. A deletion mark, a server error or a conflict about
     * a whole row change no value, they do not count. The datasource keeps the aggregates of a field
     * while it stays the same, see Datasource.aggregate()
     */
    public __getChangeCount(field: string): number {
        return this.__changeCounts.get(field) ?? 0;
    }

    /**
     * A row changed, for `rows-changed`: a field was set on it (`field`), or its deletion mark, its
     * server error or a conflict about the whole row changed (`null`). Collected for this run of code
     */
    private changed(row: Entity, field: string | null) {
        if (field !== null) {
            this.__changeCounts.set(field, (this.__changeCounts.get(field) ?? 0) + 1);
        }
        let fields = this.__changed.get(row);
        if (!fields) {
            fields = new Set();
            this.__changed.set(row, fields);
        }
        if (field !== null) {
            fields.add(field);
        }
        this.flushLater();
    }

    /**
     * sends `rows-changed` and `conflicts-changed` once this run of code is done: one of each, however
     * many rows changed. A handler that changes rows again gets the next ones
     */
    private flushLater() {
        if (this.__flushQueued) {
            return;
        }
        this.__flushQueued = true;
        queueMicrotask(() => {
            this.__flushQueued = false;
            const changed = this.__changed;
            const conflictsChanged = this.__conflictsChanged;
            this.__changed = new Map();
            this.__conflictsChanged = false;
            if (changed.size) {
                this.__events.emit('rows-changed', { rows: Array.from(changed.keys()), fields: changed });
            }
            if (conflictsChanged) {
                this.__events.emit('conflicts-changed', {});
            }
        });
    }

    /**
     * a row's deletion mark changed: setDeleted(), or undo / redo of one. Not through the proxy, so
     * the conflicts and the grid are told here
     */
    private afterMarkChange(row: DataEntity) {
        this.settleConflicts(row);
        this.changed(row, null);
    }

    /**
     * true when the row has changes of the user's that are not saved: an edit, a deletion mark, or a
     * cell of it being edited right now (History.editingCell). `upsert(rows, { removeMissing })` does
     * not remove such a row
     */
    private hasLocalChanges(row: DataEntity): boolean {
        const controller = row.__controller;
        return controller.__edited === true || controller.__isDeleted === true || this.__history.editingCell()?.row === row;
    }

    /**
     * After an edit or a change of the deletion mark: a conflict of the row whose cause is gone goes
     * too - one about a field that is not edited any more (reverted, undone, typed back to the
     * server's value), one about the whole row once it has no local changes
     */
    private settleConflicts(row: DataEntity) {
        const conflicts = this.__conflicts.get(row);
        if (!conflicts) {
            return;
        }
        // deleting the entry the loop is at is fine, a Map's iterator goes on with the next one
        for (const field of conflicts.keys()) {
            const settled = field === null ? !this.hasLocalChanges(row) : row.__controller.__editedProps[field] !== true;
            if (settled) {
                this.deleteConflict(row, field);
            }
        }
    }

    /** sets a conflict of a row, `field` `null` for the row as a whole */
    private setConflict(row: DataEntity, field: string | null, record: ConflictRecord) {
        let conflicts = this.__conflicts.get(row);
        if (!conflicts) {
            conflicts = new Map();
            this.__conflicts.set(row, conflicts);
        }
        conflicts.set(field, record);
        this.__conflictsChanged = true;
        this.changed(row, field);
    }

    /** removes a conflict of a row, when it has it */
    private deleteConflict(row: DataEntity, field: string | null) {
        const conflicts = this.__conflicts.get(row);
        if (conflicts?.delete(field)) {
            if (!conflicts.size) {
                this.__conflicts.delete(row);
            }
            this.__conflictsChanged = true;
            this.changed(row, field);
        }
    }

    /**
     * the rows lost their conflicts and their "kept" mark: they left the data, or their changes were
     * saved. Not in `rows-changed`: the methods that do this rebuild the displayed rows
     */
    private dropConflicts(rows: Iterable<Entity>) {
        for (const row of rows) {
            this.__kept.delete(row);
            if (this.__conflicts.delete(row as DataEntity)) {
                this.__conflictsChanged = true;
                this.flushLater();
            }
        }
    }

    /**
     * Rows left the container: their changes leave the undo history (it never writes into a row that
     * is not there) and their conflicts go
     */
    private rowsLeft(rows: readonly Entity[]) {
        this.__history.forget(rows);
        this.dropConflicts(rows);
    }

    /**
     * Every row left the container (setData() without add, removeAllData()): the undo history is
     * cleared and every conflict goes
     */
    private allRowsLeft() {
        this.__history.clear();
        this.clearConflicts();
    }

    /** every conflict goes, and every "kept" mark */
    private clearConflicts() {
        this.__kept = new WeakSet();
        if (this.__conflicts.size) {
            this.__conflicts.clear();
            this.__conflictsChanged = true;
            this.flushLater();
        }
    }

    /**
     * @internal
     * `datasource.upsert()`: merges rows from a server into the rows by their key - the container's
     * part, the rows and their values and conflicts. The datasource rebuilds the displayed rows and
     * sends the events. See there for the rules.
     * @param rows plain objects from the server, each with its key
     * @param removeMissing remove the rows whose key is not among them, see UpsertOptions
     * @throws a `TypeError` without a key field, when `rows` is no array, or for a row without its key -
     * checked first, nothing is merged then
     */
    public __upsert(rows: readonly any[], removeMissing: boolean): UpsertResult {
        const keyField = this.__keyAttribute;
        if (!keyField) {
            throw new TypeError(
                "upsert() merges the rows by their key, the datasource has none: new Datasource({ key: 'id' }) or new DataContainer('id')"
            );
        }
        if (!Array.isArray(rows)) {
            throw new TypeError('upsert() takes a list of rows: upsert([row]), upsert(rows, { removeMissing: true })');
        }
        rows.forEach((row, i) => {
            if (isBlank(row?.[keyField])) {
                throw new TypeError(`upsert(): the row at index ${i} has no key, its '${keyField}' is blank`);
            }
        });

        // the rows by key. A new row is not on the server, its key is a generated one: it never
        // matches. A key that is in the data twice matches its first row
        const byKey = new Map<unknown, DataEntity>();
        for (const row of this.__collection) {
            if (!row.__controller.__isNew) {
                const key = row.__KEY;
                if (!byKey.has(key)) {
                    byKey.set(key, row);
                }
            }
        }

        const added: DataEntity[] = [];
        const updated = new Set<DataEntity>();
        const removed: DataEntity[] = [];
        const conflicts: Conflict[] = [];
        // the keys the server sent, for removeMissing
        const sent = new Map<unknown, true>();
        // one time for every field this upsert changes, see __mergedAt
        const time = Date.now();
        const editing = this.__history.editingCell();
        // the fields whose original changed, for the history
        const originals = new Map<Entity, Map<string, { from: unknown; to: unknown }>>();

        // what mergeRow() shares between the rows, made once
        const merge = { time, editing, conflicts, originals };

        // the server's values are no edits: nothing of this is a step of the undo history
        this.__history.withoutRecording(() => {
            for (const source of rows) {
                const key = source[keyField];
                if (removeMissing) {
                    sent.set(key, true);
                }
                const row = findKey(byKey, key);
                if (row) {
                    if (this.mergeRow(row, source, keyField, merge)) {
                        updated.add(row);
                    }
                } else {
                    // a key given twice: the second one updates the row the first one added
                    const entity = this.toEntity(source, false);
                    this.__collection.push(entity);
                    byKey.set(key, entity);
                    added.push(entity);
                }
            }
        });
        // undoing the user's edits goes back to the server's values, not to the old originals
        this.__history.rebase(originals);

        if (removeMissing) {
            for (const row of this.__collection) {
                if (row.__controller.__isNew || findKey(sent, row.__KEY)) {
                    continue;
                }
                if (!this.hasLocalChanges(row)) {
                    removed.push(row);
                } else if (!this.__kept.has(row) && !this.__conflicts.get(row)?.has(null)) {
                    // the user's changes are not thrown away: the row stays, in conflict
                    this.setConflict(row, null, { remote: 'removed', original: undefined });
                    conflicts.push({ row, field: null, remote: 'removed' });
                }
            }
            if (removed.length) {
                const gone = new Set<Entity>(removed);
                this.__collection = this.__collection.filter((row) => !gone.has(row));
                this.rowsLeft(removed);
            }
        }

        return { added, updated: Array.from(updated), removed, conflicts };
    }

    /**
     * Merges one row from the server into the row with its key, see `datasource.upsert()`: per field
     * it has (the key and the `__` fields left out)
     *
     * - a field that is not edited gets the server's value as its value and its original: through the
     *   proxy, so it is validated and in `rows-changed` - the history is not recording - then the edit
     *   tracking is set back to "not edited"
     * - a field the user has edited, or is editing (`editing`), keeps the user's value. The server's value
     *   becomes its original, and it is a conflict unless the server has the user's value (the edit is
     *   resolved) or the value the user's edit started from (nothing to choose)
     *
     * @param merge what the upsert shares between the rows: its time, the cell being edited, and the
     * lists it fills - the conflicts, and the fields whose original changed (for History.rebase)
     * @returns true when a value or a conflict changed
     */
    private mergeRow(
        row: DataEntity,
        source: Record<string, unknown>,
        keyField: string,
        merge: {
            time: number;
            editing: { row: Entity; field: string } | null;
            conflicts: Conflict[];
            originals: Map<Entity, Map<string, { from: unknown; to: unknown }>>;
        }
    ): boolean {
        const { time, editing, conflicts, originals } = merge;
        const controller = row.__controller;
        let changed = false;

        // the server has the row again: not removed there after all
        this.__kept.delete(row);
        if (this.__conflicts.get(row)?.has(null)) {
            this.deleteConflict(row, null);
            changed = true;
        }

        for (const field of Object.keys(source)) {
            // the key is what the row is, the __ fields are not the row's own
            if (field === keyField || field.startsWith('__')) {
                continue;
            }
            const remote = source[field];
            const type = this.__fieldTypes.get(field);
            const local = controller.__editedProps[field] === true || (editing?.row === row && editing.field === field);

            if (!local) {
                if (isSameValue(row[field], remote, type)) {
                    continue;
                }
                // a field set before (edited and set back, say) can be in the history
                if (Object.hasOwn(controller.__originalValues, field)) {
                    rebaseLater(originals, row, field, controller.__originalValues[field], remote);
                }
                row[field] = remote;
                // a value of the server, no edit: it is the original too
                controller.__originalValues[field] = remote;
                controller.__editedProps[field] = false;
                controller.__edited = Object.values(controller.__editedProps).includes(true);
                let times = this.__merged.get(row);
                if (!times) {
                    times = new Map();
                    this.__merged.set(row, times);
                }
                times.set(field, time);
                changed = true;
                continue;
            }

            // an edited field has its original (the proxy took it on the first edit)
            const original = Object.hasOwn(controller.__originalValues, field) ? controller.__originalValues[field] : row[field];
            if (isSameValue(original, remote, type)) {
                // the server did not change it: the user's edit stays as it is
                continue;
            }
            const value = row[field];
            const existing = this.__conflicts.get(row)?.get(field);
            // where the user's edit started from: a conflict from an earlier upsert keeps it
            const base = existing ? existing.original : original;

            // the user's value stays, the server's is the original now: getChanges() sends the user's
            // value as an edit of what the server has. __newprops: the next edit keeps this original
            controller.__newprops[field] = true;
            controller.__originalValues[field] = remote;
            rebaseLater(originals, row, field, original, remote);
            if (isSameValue(remote, value, type) || isSameValue(base, remote, type)) {
                // the server has the user's value (no edit any more), or is back where the edit started
                // (the edit stays): nothing to choose between
                controller.__editedProps[field] = !isSameValue(remote, value, type);
                if (existing) {
                    this.deleteConflict(row, field);
                } else {
                    this.changed(row, field);
                }
            } else {
                controller.__editedProps[field] = true;
                this.setConflict(row, field, { remote, original: base });
                conflicts.push({ row, field, local: value, remote, original: base });
            }
            controller.__edited = Object.values(controller.__editedProps).includes(true);
            changed = true;
        }
        return changed;
    }

    /**
     * @internal
     * `datasource.getConflicts()`: the conflicts, in the order of the rows in the container. `local` is
     * the value the row has now
     * @param rows a row or a list of rows, default every row. Rows not in the container are skipped
     */
    public __getConflicts(rows?: Entity | Entity[]): Conflict[] {
        if (!this.__conflicts.size) {
            return [];
        }
        const result: Conflict[] = [];
        for (const row of rows === undefined ? this.__collection : this.rowsIn(rows)) {
            for (const [field, record] of this.__conflicts.get(row) ?? []) {
                result.push(
                    field === null
                        ? { row, field: null, remote: 'removed' }
                        : { row, field, local: row[field], remote: record.remote, original: record.original }
                );
            }
        }
        return result;
    }

    /**
     * @internal
     * `datasource.hasConflicts()`: true when a row has a conflict
     */
    public __hasConflicts(): boolean {
        return this.__conflicts.size > 0;
    }

    /**
     * @internal
     * the conflicts of one row: the server's value per field, `null` for the row as a whole. The
     * container's own map, do not change it. `undefined` when the row has none. For the grid, which
     * asks for every cell it renders: no search, no copy
     */
    public __rowConflicts(
        row: Entity
    ): ReadonlyMap<string | null, { readonly remote: unknown; readonly original: unknown }> | undefined {
        return this.__conflicts.get(row as DataEntity);
    }

    /**
     * @internal
     * `datasource.resolveConflict()`, but for a row removed on the server taken as `'remote'` - the
     * datasource removes that row. Nothing happens when the field has no conflict
     *
     * - `'local'`: the conflict goes, the user's value (or the row) stays as it is. A row kept so gets
     *   no conflict from a later `upsert(rows, { removeMissing: true })`
     * - `'remote'`: the field gets the server's value, which is its original - an edit like
     *   `resetField()`: a step of the undo history, validated. Not edited any more, so the conflict goes
     */
    public __resolveConflict(row: Entity, field: string | null, take: 'local' | 'remote') {
        const record = this.__conflicts.get(row as DataEntity)?.get(field);
        if (!record) {
            return;
        }
        if (field === null) {
            // 'remote' is the datasource's, it removes the row
            if (take === 'local') {
                this.__kept.add(row);
                this.deleteConflict(row as DataEntity, null);
            }
            return;
        }
        if (take === 'local') {
            this.deleteConflict(row as DataEntity, field);
            return;
        }
        // settleConflicts() takes the conflict away: the value is the original now
        row[field] = record.remote;
    }

    /**
     * @internal
     * `datasource.getMergedAt()`: when the last `upsert()` changed the value of this field of the row,
     * as `Date.now()` gave it. `undefined` when no upsert changed it
     */
    public __mergedAt(row: Entity, field: string): number | undefined {
        return this.__merged.get(row)?.get(field);
    }

    /**
     * Replaces the class that wraps every row in a `Proxy` and tracks its edits, for the rows set from
     * now on. An advanced hook: the class gets the {@link EntityHandler} constructor options
     * (`{ key, isNew, fieldType, onEdit }`) and must implement the proxy traps and the fields the grid
     * reads (`__isNew`, `__isDeleted`, `__edited` ...). Its set trap calls `onEdit(row, field, oldValue)`
     * after a field is set, with the value the field had before: without the call the fields are not
     * validated on edit and the edits are not in the undo history (`datasource.undo()`), and without
     * the old value undo can not put it back. `EntityHandler` is exported as a type only, so it can
     * not be extended - you write the whole handler.
     *
     * @param entityHandler the class to use instead of `EntityHandler`
     *
     * @example
     * ```ts
     * import { DataContainer, type FieldType } from '@simple-html/grid';
     *
     * // a handler class of your own, with the same constructor as EntityHandler
     * declare const MyEntityHandler: new (options: {
     *     key?: string;
     *     isNew?: boolean;
     *     fieldType?: (field: string) => FieldType | undefined;
     *     onEdit?: (row: object, field: string, oldValue: unknown) => void;
     * }) => ProxyHandler<object>;
     *
     * const container = new DataContainer('id');
     * container.overrideEntityHandler(MyEntityHandler);
     * ```
     */
    public overrideEntityHandler(entityHandler: any) {
        this.EntityHandler = entityHandler;
    }

    /**
     * so I can check
     * @internal
     */
    public get type() {
        return 'DataContainer';
    }

    private getKey() {
        return getNextKey();
    }

    /**
     * the rows given that are in the container, in the container's order, each once. Rows that are
     * not in it (a group row, an unknown object) are left out
     * @param rows a row or a list of rows
     */
    private rowsIn(rows: Entity | Entity[]): DataEntity[] {
        const wanted = new Set(Array.isArray(rows) ? rows : [rows]);
        return this.__collection.filter((row) => wanted.has(row));
    }

    /**
     * index of the entity in the collection, -1 if it is not there
     * @param entity any entity, a group row or an unknown object is just not found
     */
    private indexOf(entity: Entity) {
        const collection: Entity[] = this.__collection;
        return collection.indexOf(entity);
    }

    /**
     * Every row in the container, in the order they were set: the rows marked for deletion included,
     * no filter, sort or grouping. A new array, the rows in it are the container's own (not copies).
     * `datasource.getAllData()` is the same.
     *
     * @example
     * ```ts
     * import { DataContainer } from '@simple-html/grid';
     *
     * const container = new DataContainer('id');
     * container.setData([{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }]);
     * container.getDataSet().map((row) => row.name); // ['Ann', 'Bob']
     * ```
     */
    public getDataSet() {
        return this.__collection.slice();
    }

    /**
     * The number of rows in the container, the rows marked for deletion included. Was `lenght()` in v5.
     *
     * @example
     * ```ts
     * const count = datasource.getDataContainer().length(); // every row, no filter
     * ```
     */
    public length() {
        return this.__collection.length;
    }

    /**
     * The rows marked for deletion (`markForDeletion()` / `markAllForDeletion()`), still in the
     * container until `acceptChanges()` or `clearMarkedForDeletion()` removes them. New rows that are
     * marked are in it too, they are not in `getChanges().deletedEntities`.
     *
     * @example
     * ```ts
     * const container = datasource.getDataContainer();
     * container.markForDeletion(datasource.getSelectedRows());
     * container.getMarkedForDeletion().length; // the rows just marked
     * ```
     */
    public getMarkedForDeletion() {
        return this.__collection.filter((e) => e.__controller.__isDeleted);
    }

    /**
     * Sets `__rowError` on the rows: the message for the rows whose key is in the map, `null` for every
     * other row - so each call replaces the errors of the call before. For errors a server sent back
     * after saving.
     *
     * It is apart from the validation errors (`datasource.validate()`, `getErrors()`): this does not
     * change them, and `validate()` / `hasErrors()` do not read `__rowError`. The grid shows both on
     * the row selector - the error class, and the message as its tooltip. The rows whose error changed
     * are in the `rows-changed` event, so the grid shows it without `gridInterface.refresh()`.
     * `acceptChanges()` clears it.
     *
     * @param errors the error message per row, keyed by the row's key as text (`'7'` for `id: 7`)
     *
     * @example
     * ```ts
     * datasource.getDataContainer().setErrors(new Map([['7', 'Name is already taken']]));
     *
     * datasource.getAllData().filter((row) => row.__rowError); // the rows with an error
     * ```
     */
    public setErrors(errors: Map<string, string>) {
        this.__collection.forEach((e) => {
            // setData and replace give every row a key
            const err = errors.get(e.__KEY!.toString()) || null;
            // undefined until a first call, the same as null
            if ((e.__rowError ?? null) !== err) {
                this.changed(e, null);
            }
            e.__rowError = err;
        });
    }

    /**
     * {@link resetData} for the given rows only: their edits are undone, a row marked for deletion is
     * unmarked, a new row is removed, and their validation errors are cleared.
     * `datasource.resetDataSelectionOnly()` calls it with the selected rows. Does not rebuild a
     * datasource's displayed rows.
     *
     * It is one step of the undo history (`datasource.undo()` brings the edits and the marks back),
     * but a new row it removed does not come back: undo never adds a row.
     *
     * @param data the rows to reset. Rows that are not in the container are skipped
     *
     * @example
     * ```ts
     * const container = datasource.getDataContainer();
     * container.resetDataSelection(datasource.getSelectedRows());
     * datasource.reloadDatasource(); // show it
     * ```
     */
    public resetDataSelection(data: Entity[]) {
        const rows = this.rowsIn(data);
        this.__resetRows(rows);
        // the original values are not validated, as resetData()
        for (const row of rows) {
            this.__errors.delete(row);
        }
        this.removeData(rows.filter((row) => row.__controller.__isNew));
    }

    /**
     * @internal
     * `datasource.resetRows()`: the rows get their original values back and lose their deletion mark,
     * through the proxy - one step of the undo history, the fields are validated as for an edit. A
     * new row gets the values it was added with
     * @param rows a row or a list of rows. Rows that are not in the container are skipped
     * @param discardNew `true` (`datasource.resetRows()`): a new row is marked for deletion - as it is on
     * the server, where it is not. `false` (resetDataSelection, which removes new rows): unmarked too
     */
    public __resetRows(rows: Entity | Entity[], discardNew = false) {
        for (const row of this.rowsIn(rows)) {
            const controller = row.__controller;
            this.setDeleted(row, discardNew && controller.__isNew === true);
            if (controller.__edited) {
                for (const field in controller.__originalValues) {
                    row[field] = controller.__originalValues[field];
                }
                controller.__editedProps = {};
                controller.__edited = false;
            }
        }
    }

    /**
     * @internal
     * `datasource.resetField()`: the field of the row gets its original value back, through the proxy -
     * one step of the undo history, validated as for an edit. A field that is not edited is left as it is
     * @param row the row, skipped when it is not in the container
     * @param field the field
     */
    public __resetField(row: Entity, field: string) {
        const [inContainer] = this.rowsIn(row);
        const controller = inContainer?.__controller;
        if (controller?.__editedProps[field]) {
            inContainer[field] = controller.__originalValues[field];
        }
    }

    /**
     * @internal
     * Makes adding new rows one step of the undo history, for the grid's import: undo marks them for
     * deletion - a new row marked for deletion is taken out, in none of the lists of `getChanges()`, as
     * the grid's Delete takes out a new row - and redo takes the marks off again. The rows stay in the
     * container, so undo never removes a row. Recorded as their deletion marks taken off (`before: true`,
     * `after: false`), in the step of this run of code
     * @param rows the rows just added, new and not marked
     */
    public __recordAdded(rows: readonly Entity[]) {
        for (const row of this.rowsIn([...rows])) {
            if (row.__controller.__isNew && !row.__controller.__isDeleted) {
                this.__history.record({ row, field: null, before: true, after: false });
            }
        }
    }

    /**
     * @internal
     * The validation errors a row would have, without keeping any: every field with rules, of any object
     * with the fields - the grid's import checks the rows of a file with it before it adds them. The
     * messages by field, in the order of the rules; empty when it passes every rule
     * @param row the values, a plain object or a row
     */
    public __checkRow(row: object): Map<string, string[]> {
        const errors = new Map<string, string[]>();
        for (const [field, rules] of this.__rules) {
            const messages = runRules(rules, (row as Record<string, unknown>)[field], row as Entity);
            if (messages.length) {
                errors.set(field, messages);
            }
        }
        return errors;
    }

    /**
     * marks or unmarks a row for deletion, recorded in the undo history when the mark changes
     */
    private setDeleted(row: DataEntity, deleted: boolean) {
        if (Boolean(row.__controller.__isDeleted) !== deleted) {
            this.__history.record({ row, field: null, before: !deleted, after: deleted });
            row.__controller.__isDeleted = deleted;
            this.afterMarkChange(row);
        }
    }

    /**
     * Throws away every change since the data was set: edited rows get their original values back,
     * rows marked for deletion are unmarked, new rows (from `addNewEmpty()`) are removed, and the
     * validation errors are cleared - the original values are not validated. Rows removed for good
     * (`removeData()`, `clearMarkedForDeletion()`) do not come back. The undo history is cleared.
     * `datasource.resetData()` calls it and also rebuilds the displayed rows - use that one.
     *
     * @example
     * ```ts
     * datasource.getDataContainer().resetData();
     * datasource.getChanges(); // { newEntities: [], modifiedEntities: [], deletedEntities: [] }
     * ```
     */
    public resetData() {
        const newEntities: Entity[] = [];

        // no step: the history is cleared below, there is nothing left to undo
        this.__history.withoutRecording(() => {
            this.__collection.forEach((row) => {
                if (row.__controller.__isDeleted) {
                    row.__controller.__isDeleted = false;
                    this.changed(row, null);
                }
                if (row.__controller.__isNew) {
                    newEntities.push(row);
                }
                if (row.__controller.__edited) {
                    for (const k in row.__controller.__originalValues) {
                        row[k] = row.__controller.__originalValues[k];
                    }
                    row.__controller.__editedProps = {};
                    row.__controller.__edited = false;
                }
            });
        });
        // after the values are back: setting them validated them again
        this.__errors = new WeakMap();
        // the user's changes are gone, and with them what was in conflict
        this.clearConflicts();
        // before the new rows go: their changes leave with the rest, one 'clear' event
        this.__history.clear();
        this.removeData(newEntities);
    }

    /**
     * The rows added, edited and marked for deletion, as copies - see {@link Changes} for what is
     * in it and when an edit counts. `datasource.getChanges()` is the same, typed with the
     * datasource's row type.
     *
     * A `Date` is compared by its field's type from the `fields` of the datasources on this
     * container. Used without a datasource every field compares a `Date` to the second.
     *
     * @example
     * ```ts
     * import { DataContainer } from '@simple-html/grid';
     *
     * const container = new DataContainer('id');
     * container.setData([{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }]);
     * const [ann, bob] = container.getDataSet();
     * ann.name = 'Anna';
     * bob.name = 'Robert';
     * bob.name = 'Bob'; // back to the original, no edit
     *
     * container.getChanges();
     * // { newEntities: [], modifiedEntities: [{ id: 1, name: 'Anna' }], deletedEntities: [] }
     * ```
     */
    public getChanges(): Changes {
        const changes: Changes = { newEntities: [], modifiedEntities: [], deletedEntities: [] };
        for (const row of this.__collection) {
            const controller = row.__controller;
            // a spread reads the row's own fields through the proxy, the result is a plain object
            if (controller.__isDeleted) {
                // a new row marked for deletion was never saved, there is nothing to send for it
                if (!controller.__isNew) {
                    changes.deletedEntities.push({ ...row });
                }
                continue;
            }
            if (controller.__isNew) {
                // with a key field the generated key is in the row. Without one it is not a field of the
                // row: the copy gets it as __KEY, so the server's key can be given back with acceptChanges()
                changes.newEntities.push(controller.__KEYSTRING ? { ...row } : { ...row, __KEY: row.__KEY });
                continue;
            }
            // __editedProps keeps a prop set back to its original value, as false: leave it out
            const edited = Object.keys(controller.__editedProps).filter((prop) => controller.__editedProps[prop]);
            if (edited.length) {
                const entry: ModifiedEntity<Record<string, unknown>> = { [controller.__KEYSTRING || '__KEY']: row.__KEY };
                for (const prop of edited) {
                    entry[prop] = row[prop];
                }
                changes.modifiedEntities.push(entry);
            }
        }
        return changes;
    }

    /**
     * `true` when there is something to save: `getChanges()` would list a row. For an "unsaved
     * changes" indicator. A new row marked for deletion is no change, and neither is a field edited
     * back to its original value.
     *
     * @example
     * ```ts
     * import { DataContainer } from '@simple-html/grid';
     *
     * const container = new DataContainer('id');
     * container.setData([{ id: 1, name: 'Ann' }]);
     * container.hasChanges(); // false
     *
     * container.getDataSet()[0].name = 'Anna';
     * container.hasChanges(); // true
     * ```
     */
    public hasChanges(): boolean {
        // the same rows getChanges() lists
        return this.__collection.some((row) => {
            const { __isDeleted, __isNew, __edited } = row.__controller;
            return __isDeleted ? !__isNew : __isNew || __edited === true;
        });
    }

    /**
     * Marks rows for deletion: `getChanges()` lists them in `deletedEntities`, `__rowState` is
     * `'D'`. They stay in the container: {@link unmarkForDeletion} (or `resetData()`) takes the mark
     * off again, and {@link acceptChanges} (or `clearMarkedForDeletion()`) removes them once the
     * deletes are saved.
     *
     * A new row (from `addNewEmpty()`) is marked too, so it can be brought back. While it is marked it
     * is in none of the lists of `getChanges()`: it was never saved, there is nothing to send for it.
     *
     * @param rows a row or a list of rows. Rows that are not in the container are skipped.
     *
     * @example
     * ```ts
     * const container = datasource.getDataContainer();
     * const [first, second] = container.getDataSet();
     * container.markForDeletion(first);
     * container.markForDeletion([first, second]);
     * ```
     */
    public markForDeletion(rows: Entity | Entity[]) {
        // v5 was markForDeletion(data, all)
        assertOptions('markForDeletion', arguments[1], 'markForDeletion(rows), or markAllForDeletion()');
        for (const row of this.rowsIn(rows)) {
            this.setDeleted(row, true);
        }
    }

    /**
     * Marks every row for deletion, like {@link markForDeletion} with all of them: the new rows are
     * marked too, and left out of `getChanges()`. Was `markForDeletion(null, true)` in v5.
     *
     * @example
     * ```ts
     * const container = datasource.getDataContainer();
     * container.markAllForDeletion();
     * container.getChanges().deletedEntities; // every row that is not new
     * ```
     */
    public markAllForDeletion() {
        for (const row of this.__collection) {
            this.setDeleted(row, true);
        }
    }

    /**
     * Takes the mark of {@link markForDeletion} off rows again: undo a delete. A row is shown and
     * listed in `getChanges()` as before it was marked - a new row as a new row, an edited row with its
     * edits. Unlike `resetData()`, no edit is undone.
     *
     * @param rows a row or a list of rows. Rows that are not in the container, or not marked, are skipped.
     *
     * @example
     * ```ts
     * import { DataContainer } from '@simple-html/grid';
     *
     * const container = new DataContainer('id');
     * container.setData([{ id: 1, name: 'Ann' }]);
     * const [ann] = container.getDataSet();
     *
     * container.markForDeletion(ann);
     * ann.__rowState; // 'D'
     * container.unmarkForDeletion(ann);
     * ann.__rowState; // undefined, as it was
     * ```
     */
    public unmarkForDeletion(rows: Entity | Entity[]) {
        for (const row of this.rowsIn(rows)) {
            this.setDeleted(row, false);
        }
    }

    /**
     * Takes the mark off every row marked for deletion, like {@link unmarkForDeletion} with all of them.
     *
     * @example
     * ```ts
     * const container = datasource.getDataContainer();
     * container.markAllForDeletion();
     * container.unmarkAllForDeletion();
     * container.getMarkedForDeletion(); // []
     * ```
     */
    public unmarkAllForDeletion() {
        for (const row of this.__collection) {
            this.setDeleted(row, false);
        }
    }

    /**
     * Call it after a successful save: the changes are now on the server, so they are no changes any
     * more. For every row (or the `rows` given):
     *
     * - a row marked for deletion is removed from the container, a new one too
     * - a new row becomes an ordinary row (`__rowState` `undefined`)
     * - the values a row has now become its original values: nothing counts as edited
     * - the row's error (`setErrors()`) and its validation errors are cleared
     *
     * Then `getChanges()` lists none of them, `hasChanges()` is `false` when every row was accepted,
     * and `resetData()` goes back to these values. The undo history is cleared, also when only some
     * rows were accepted. `datasource.acceptChanges()` calls it and also rebuilds the displayed rows -
     * use that one.
     *
     * **The keys of new rows.** A new row has a temporary key, a generated negative number: in its key
     * field (`id: -1` with `new DataContainer('id')`), or without a key field as `__KEY` in
     * `getChanges().newEntities`. `newKeys` maps each temporary key to the key the server gave the row.
     * The row gets it in its key field, or as its `__KEY` without a key field - setting it is no edit.
     *
     * @param options.rows a row or a list of rows to accept, default every row. Rows that are not in
     * the container are skipped. Pass the rows that were saved when only some of them were
     * @param options.newKeys the server's key per temporary key. The keys are compared as text: `-1`
     * and `'-1'` are the same key, so a map made from JSON works too. A new row that is not in it
     * keeps its key
     * @throws when a key in `newKeys` is not the key of a new row that is accepted (and not marked
     * for deletion), or the server's key is blank (`null`, `undefined`, `''`) - a map the wrong way
     * round, say. Checked first: nothing is accepted then
     *
     * @example
     * ```ts
     * import { DataContainer } from '@simple-html/grid';
     *
     * // saves the changes in one transaction, and answers with the id it gave each new row
     * declare function save(changes: object): Promise<{ temporaryId: number; id: number }[]>;
     *
     * const container = new DataContainer('id');
     * container.setData([{ id: 1, name: 'Ann' }]);
     * container.setData([{ name: 'Cid' }], { add: true, isNew: true }); // a temporary id: -1, say
     * container.getDataSet()[0].name = 'Anna';
     *
     * const saved = await save(container.getChanges()); // newEntities: [{ name: 'Cid', id: -1 }]
     * container.acceptChanges({ newKeys: new Map(saved.map((row) => [row.temporaryId, row.id])) });
     *
     * container.getDataSet().map((row) => [row.id, row.name, row.__rowState]);
     * // [[1, 'Anna', undefined], [7, 'Cid', undefined]] - if the server gave Cid the id 7
     * container.hasChanges(); // false
     * ```
     */
    public acceptChanges(options: { rows?: Entity | Entity[]; newKeys?: ReadonlyMap<string | number, string | number> } = {}) {
        assertAcceptChangesOptions(options);
        const { rows, newKeys } = options;
        const accepted = rows === undefined ? this.__collection.slice() : this.rowsIn(rows);

        // the server's key per temporary key, as text: -1 and '-1' are the same key
        const serverKeys = new Map<string, string | number>();
        for (const [temporary, key] of newKeys ?? []) {
            serverKeys.set(String(temporary), key);
        }

        // checked before anything changes: a key that is not a new row's is a mistake (the map the
        // wrong way round, or a row that was not saved), and a new row must not end up without a key
        const newRowKeys = new Set(
            accepted.filter((row) => row.__controller.__isNew && !row.__controller.__isDeleted).map((row) => String(row.__KEY))
        );
        for (const [temporary, key] of serverKeys) {
            if (!newRowKeys.has(temporary)) {
                throw new Error(
                    `acceptChanges: newKeys has the key '${temporary}', but no new row accepted has it. The map goes from the temporary key (in getChanges().newEntities) to the server's key`
                );
            }
            if (isBlank(key)) {
                throw new Error(`acceptChanges: newKeys gives the new row '${temporary}' a blank key`);
            }
        }

        const removed = new Set<DataEntity>();
        for (const row of accepted) {
            const controller = row.__controller;
            if (controller.__isDeleted) {
                removed.add(row);
                continue;
            }
            if (controller.__isNew) {
                const key = serverKeys.get(String(row.__KEY));
                if (key !== undefined) {
                    // the key field, or the row's own key without one: setting __KEY is no edit
                    row.__KEY = key;
                }
                controller.__isNew = false;
            }
            // as a row that was just set: the next edit takes the value it has now as its original
            controller.__editedProps = {};
            controller.__originalValues = {};
            controller.__currentValues = {};
            controller.__newprops = {};
            controller.__edited = false;
            row.__rowError = null;
            this.__errors.delete(row);
        }
        if (removed.size) {
            this.__collection = this.__collection.filter((row) => !removed.has(row));
        }
        // saved: the user's values are the server's now, nothing left to choose between
        this.dropConflicts(accepted);
        // the originals are new: undoing past them would make edits of what was saved
        this.__history.clear();
    }

    /**
     * Removes the rows marked for deletion from the container, for good: `getChanges()` no longer lists
     * them in `deletedEntities` and `resetData()` does not bring them back, and their changes leave the
     * undo history. Call it once the deletes are saved - or call {@link acceptChanges}, which also
     * accepts the new and edited rows. `datasource.clearMarkedForDeletion()` calls it and rebuilds the
     * displayed rows.
     *
     * @example
     * ```ts
     * const container = datasource.getDataContainer();
     * const { deletedEntities } = container.getChanges(); // send these first
     * container.clearMarkedForDeletion();
     * ```
     */
    public clearMarkedForDeletion() {
        const tempArr: DataEntity[] = [];
        this.__collection.forEach((e) => {
            if (e.__controller.__isDeleted) {
                tempArr.push(e);
            }
        });
        tempArr.forEach((e) => {
            const i = this.__collection.indexOf(e);
            if (i !== -1) {
                this.__collection.splice(i, 1)[0];
            }
        });
        this.rowsLeft(tempArr);
    }

    /**
     * Removes rows from the container, for good: they are not marked for deletion, `getChanges()`
     * does not list them and `resetData()` does not bring them back. Their changes leave the undo
     * history: undo never writes into a row that is not there.
     *
     * @param rows a row or a list of rows. Rows that are not in the container are skipped.
     * @returns the rows removed
     *
     * @example
     * ```ts
     * const container = datasource.getDataContainer();
     * const [first] = container.getDataSet();
     * container.removeData(first); // [first]
     * ```
     */
    public removeData(rows: Entity | Entity[]): Entity[] {
        // v5 was removeData(data, all)
        assertOptions('removeData', arguments[1], 'removeData(rows), or removeAllData()');
        const removed: Entity[] = [];
        for (const row of Array.isArray(rows) ? rows : [rows]) {
            const i = this.indexOf(row);
            if (i !== -1) {
                removed.push(this.__collection.splice(i, 1)[0]);
            }
        }
        this.rowsLeft(removed);
        return removed;
    }

    /**
     * Removes every row from the container, like {@link removeData} with all of them, and clears the
     * undo history. Was `removeData(null, true)` in v5.
     *
     * @returns the rows removed
     *
     * @example
     * ```ts
     * const container = datasource.getDataContainer();
     * container.removeAllData();
     * container.getDataSet(); // []
     * ```
     */
    public removeAllData(): Entity[] {
        const removed = this.__collection;
        this.__collection = [];
        this.allRowsLeft();
        return removed;
    }

    /**
     * Sets the rows. Every row is wrapped in the proxy that tracks its edits, and gets a key. Without
     * `add` the undo history is cleared, the rows start over; added rows are not in the history (undo
     * never removes a row).
     *
     * @param rows your objects
     * @param options.add `true` to add the rows to the ones there are, default `false`: they replace them
     * @param options.isNew `true` to make them new rows, like `datasource.addNewEmpty()` does: listed in
     * `getChanges().newEntities`, `__rowState` `'N'`. Default `false`
     * @returns the rows as the container keeps them
     *
     * @example
     * ```ts
     * import { DataContainer } from '@simple-html/grid';
     *
     * const container = new DataContainer('id');
     * container.setData([{ id: 1, name: 'Ann' }]);
     * container.setData([{ id: 2, name: 'Bob' }], { add: true });
     * container.setData([{ id: 3, name: 'New' }], { add: true, isNew: true });
     * ```
     */
    public setData(rows: any[], options: { add?: boolean; isNew?: boolean } = {}): Entity[] {
        assertOptions('setData', options, 'setData(rows, { add: true })');
        const { add = false, isNew = false } = options;
        if (!add) {
            this.__collection = [];
            this.allRowsLeft();
        }

        const x = Array.from(rows, (o: any | Entity) => this.toEntity(o, isNew));
        this.__collection = this.__collection.concat(x);

        return x;
    }

    /**
     * Puts rows in at a position in the container, replacing `remove` rows there - `Array.splice` for
     * the container's rows. The new rows are wrapped and get a key like `setData()` gives them, they are
     * not new rows. The changes of the rows removed leave the undo history. Call
     * `datasource.reloadDatasource()` after to show them.
     *
     * @param data your objects
     * @param index where they go, 0 based
     * @param remove how many rows from `index` on are removed for good
     *
     * @example
     * ```ts
     * const container = datasource.getDataContainer();
     * container.replace([{ id: 9, name: 'Zed' }], 1, 1); // the second row is replaced
     * datasource.reloadDatasource();
     * ```
     */
    public replace(data: any[], index: number, remove: number) {
        const x = Array.from(data, (o: any | Entity) => this.toEntity(o, false));

        this.rowsLeft(this.__collection.splice(index, remove, ...x));
    }

    /**
     * a row as the container keeps it: wrapped in the EntityHandler proxy (if it is not already),
     * with a key. Only a blank key gets a generated one - a falsy check also replaced a real key
     * of 0, writing the generated key into the key attribute of the row
     */
    private toEntity(o: any, isNew: boolean): DataEntity {
        const entity = o?.__controller
            ? o
            : new Proxy(
                  o,
                  new this.EntityHandler({
                      key: this.__keyAttribute,
                      isNew,
                      // read when an edit is made, so a datasource made after the rows were set counts too
                      fieldType: (field) => this.__fieldTypes.get(field),
                      onEdit: (row, field, oldValue) => {
                          this.__history.record({ row: row as DataEntity, field, before: oldValue, after: row[field] });
                          this.validateEdit(row, field);
                          this.settleConflicts(row as DataEntity);
                          // the same value set again shows nothing new
                          if (!Object.is(oldValue, row[field])) {
                              this.changed(row, field);
                          }
                      }
                  }) as any
              );
        if (isBlank(entity.__KEY)) {
            entity.__KEY = this.getKey();
        }
        return entity;
    }
}

/**
 * A field's original is the server's value now: noted for History.rebase(), which upsert() calls once
 * the rows are merged - the history's changes of the field follow
 */
function rebaseLater(
    originals: Map<Entity, Map<string, { from: unknown; to: unknown }>>,
    row: Entity,
    field: string,
    from: unknown,
    to: unknown
) {
    let fields = originals.get(row);
    if (!fields) {
        fields = new Map();
        originals.set(row, fields);
    }
    fields.set(field, { from, to });
}

/**
 * Looks a key up in a Map keyed by keys as they are, as text: 7 and '7' are the same key, as in
 * acceptChanges(). The key as it is first - the common case, a number found as a number - then the
 * other spelling of the same text: a number's text, or the number a text is the text of (`'7'` is 7,
 * `'07'` and `'7.0'` are no number's text). Faster than keying by `String(key)`: no text is made for
 * the keys of 100 000 rows
 * @returns what the Map has for the key, `undefined` when it is not there
 */
function findKey<V>(keys: Map<unknown, V>, key: unknown): V | undefined {
    const found = keys.get(key);
    if (found !== undefined) {
        return found;
    }
    if (typeof key === 'number') {
        return keys.get(String(key));
    }
    if (typeof key === 'string' && key !== '') {
        const number = Number(key);
        return String(number) === key ? keys.get(number) : undefined;
    }
    return undefined;
}

/**
 * the rules of a field as text, to tell whether two datasources gave a field the same rules: the
 * options of each rule in the order of their names, so `{ id, value }` and `{ value, id }` are the same
 */
function rulesText(rules: readonly ResolvedRule[]): string {
    return JSON.stringify(
        rules.map(({ rule }) =>
            Object.keys(rule)
                .sort()
                .map((key) => [key, rule[key]])
        )
    );
}
