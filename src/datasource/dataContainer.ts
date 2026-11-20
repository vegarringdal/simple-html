import { assertOptions } from './assertOptions';
import type { Changes, ModifiedEntity } from './changes';
import type { DataEntity, Entity } from './entity';
import { EntityHandler } from './entityHandler';
import type { FieldType } from './field';
import { isBlank } from './isBlank';

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
     * __addFieldTypes. The rows' edit tracking reads it
     */
    private __fieldTypes = new Map<string, FieldType>();
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
     * `fields`. Edit tracking is the container's - the rows are shared, an edit is one edit whichever
     * datasource shows it - so it needs one type per field: a field listed by one datasource has that
     * type, and datasources that both list a field must give it the same type.
     *
     * @throws when a field already has another type from a datasource made earlier on this container.
     * Nothing is added then.
     */
    public __addFieldTypes(types: Map<string, FieldType>): void {
        for (const [field, type] of types) {
            const known = this.__fieldTypes.get(field);
            if (known !== undefined && known !== type) {
                throw new Error(
                    `Datasource: field '${field}' is '${type}' here and '${known}' in another datasource on the same container, give it the same type in both`
                );
            }
        }
        for (const [field, type] of types) {
            this.__fieldTypes.set(field, type);
        }
    }

    /**
     * Replaces the class that wraps every row in a `Proxy` and tracks its edits, for the rows set from
     * now on. An advanced hook: the class gets the {@link EntityHandler} constructor options
     * (`{ key, isNew, fieldType }`) and must implement the proxy traps and the fields the grid reads
     * (`__isNew`, `__isDeleted`, `__edited` ...). `EntityHandler` is exported as a type only, so it can
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
     * The grid does not show `__rowError` itself: read it in the `cellClass` hook (to color the row)
     * or show it next to the grid, and call `gridInterface.refresh()` after this to render the cells
     * again.
     *
     * @param errors the error message per row, keyed by the row's key as text (`'7'` for `id: 7`)
     *
     * @example
     * ```ts
     * datasource.getDataContainer().setErrors(new Map([['7', 'Name is already taken']]));
     * gridInterface.refresh();
     *
     * datasource.getAllData().filter((row) => row.__rowError); // the rows with an error
     * ```
     */
    public setErrors(errors: Map<string, string>) {
        this.__collection.forEach((e) => {
            // setData and replace give every row a key
            const err = errors.get(e.__KEY!.toString());
            e.__rowError = err || null;
        });
    }

    /**
     * {@link resetData} for the given rows only: their edits are undone, a row marked for deletion is
     * unmarked, and a new row is removed. `datasource.resetDataSelectionOnly()` calls it with the
     * selected rows. Does not rebuild a datasource's displayed rows.
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
        const newEntities: Entity[] = [];

        if (data) {
            if (Array.isArray(data)) {
                data.forEach((d) => {
                    const i = this.indexOf(d);
                    if (i !== -1 && this.__collection[i]) {
                        const row = this.__collection[i];
                        if (row.__controller.__isDeleted) {
                            row.__controller.__isDeleted = false;
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
                    }
                });
            }
        }

        this.removeData(newEntities);
    }

    /**
     * Throws away every change since the data was set: edited rows get their original values back,
     * rows marked for deletion are unmarked, and new rows (from `addNewEmpty()`) are removed. Rows
     * removed for good (`removeData()`, `clearMarkedForDeletion()`) do not come back.
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

        this.__collection.forEach((row) => {
            if (row.__controller.__isDeleted) {
                row.__controller.__isDeleted = false;
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
            row.__controller.__isDeleted = true;
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
            row.__controller.__isDeleted = true;
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
            row.__controller.__isDeleted = false;
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
            row.__controller.__isDeleted = false;
        }
    }

    /**
     * Call it after a successful save: the changes are now on the server, so they are no changes any
     * more. For every row (or the `rows` given):
     *
     * - a row marked for deletion is removed from the container, a new one too
     * - a new row becomes an ordinary row (`__rowState` `undefined`)
     * - the values a row has now become its original values: nothing counts as edited
     * - the row's error (`setErrors()`) is cleared
     *
     * Then `getChanges()` lists none of them, `hasChanges()` is `false` when every row was accepted,
     * and `resetData()` goes back to these values. `datasource.acceptChanges()` calls it and also
     * rebuilds the displayed rows - use that one.
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
        }
        if (removed.size) {
            this.__collection = this.__collection.filter((row) => !removed.has(row));
        }
    }

    /**
     * Removes the rows marked for deletion from the container, for good: `getChanges()` no longer lists
     * them in `deletedEntities` and `resetData()` does not bring them back. Call it once the deletes
     * are saved - or call {@link acceptChanges}, which also accepts the new and edited rows.
     * `datasource.clearMarkedForDeletion()` calls it and rebuilds the displayed rows.
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
    }

    /**
     * Removes rows from the container, for good: they are not marked for deletion, `getChanges()`
     * does not list them and `resetData()` does not bring them back.
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
        return removed;
    }

    /**
     * Removes every row from the container, like {@link removeData} with all of them. Was
     * `removeData(null, true)` in v5.
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
        return removed;
    }

    /**
     * Sets the rows. Every row is wrapped in the proxy that tracks its edits, and gets a key.
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
        }

        const x = Array.from(rows, (o: any | Entity) => this.toEntity(o, isNew));
        this.__collection = this.__collection.concat(x);

        return x;
    }

    /**
     * Puts rows in at a position in the container, replacing `remove` rows there - `Array.splice` for
     * the container's rows. The new rows are wrapped and get a key like `setData()` gives them, they are
     * not new rows. Call `datasource.reloadDatasource()` after to show them.
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

        this.__collection.splice(index, remove, ...x);
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
                      fieldType: (field) => this.__fieldTypes.get(field)
                  }) as any
              );
        if (isBlank(entity.__KEY)) {
            entity.__KEY = this.getKey();
        }
        return entity;
    }
}
