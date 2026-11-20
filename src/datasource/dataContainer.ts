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
 * Holds the rows and tracks their edits (`getChanges()`). One container can be shared by several
 * datasources, see `DatasourceOptions.container`. The field types for the edit tracking come from
 * the `fields` of the datasources made on it.
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
     *
     * @param UniqueKeyAttribute fo selection usage, this way it can be persistant when dealing with remote data
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
     * so user can override if they want
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
     * index of the entity in the collection, -1 if it is not there
     * @param entity any entity, a group row or an unknown object is just not found
     */
    private indexOf(entity: Entity) {
        const collection: Entity[] = this.__collection;
        return collection.indexOf(entity);
    }

    /**
     * return collection slice
     * @returns
     */
    public getDataSet() {
        return this.__collection.slice();
    }

    /**
     * gives you the entire collection
     * @returns array of entities
     */
    public length() {
        return this.__collection.length;
    }

    /**
     * return entities marked for deletion
     * @returns
     */
    public getMarkedForDeletion() {
        return this.__collection.filter((e) => e.__controller.__isDeleted);
    }

    /**
     * set data on __rowError on entities where key matches
     * @param errors key, errormsg
     */
    public setErrors(errors: Map<string, string>) {
        this.__collection.forEach((e) => {
            // setData and replace give every row a key
            const err = errors.get(e.__KEY!.toString());
            e.__rowError = err || null;
        });
    }

    /**
     * for selected rows only
     * resets data, all edits are resets/tags are reset
     * new entities are removed
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
     * resets data, all edits are resets/tags are reset
     * new entities are removed
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
                changes.deletedEntities.push({ ...row });
                continue;
            }
            if (controller.__isNew) {
                changes.newEntities.push({ ...row });
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
     * Marks rows for deletion: `getChanges()` lists them in `deletedEntities`, `__rowState` is
     * `'D'`, and `resetData()` unmarks them. They stay in the container until
     * `clearMarkedForDeletion()`. A new row (from `addNewEmpty()`) is removed instead, there is
     * nothing to delete on a server.
     *
     * @param rows a row or a list of rows. Rows that are not in the container are skipped.
     *
     * @example
     * ```ts
     * const [first, second] = container.getDataSet();
     * container.markForDeletion(first);
     * container.markForDeletion([first, second]);
     * ```
     */
    public markForDeletion(rows: Entity | Entity[]) {
        // v5 was markForDeletion(data, all)
        assertOptions('markForDeletion', arguments[1], 'markForDeletion(rows), or markAllForDeletion()');
        for (const row of Array.isArray(rows) ? rows : [rows]) {
            const i = this.indexOf(row);
            if (i === -1) {
                continue;
            }
            if (this.__collection[i].__controller.__isNew) {
                this.__collection.splice(i, 1);
            } else {
                this.__collection[i].__controller.__isDeleted = true;
            }
        }
    }

    /**
     * Marks every row for deletion, like {@link markForDeletion} with all of them: new rows are
     * removed, the rest flagged. Was `markForDeletion(null, true)` in v5.
     *
     * @example
     * ```ts
     * container.markAllForDeletion();
     * container.getChanges().deletedEntities; // every row that is not new
     * ```
     */
    public markAllForDeletion() {
        // new rows are dropped, the rest flagged. Splicing inside forEach skipped the row
        // after every new row, leaving it neither removed nor flagged
        this.__collection = this.__collection.filter((e) => !e.__controller.__isNew);
        this.__collection.forEach((e) => {
            e.__controller.__isDeleted = true;
        });
    }

    /**
     *
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
     * replaced entity wtih index
     * @param data
     * @param index
     * @param remove
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
