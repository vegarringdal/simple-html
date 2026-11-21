import type { Entity } from './entity';
import type { FieldType } from './field';

/**
 * The `Proxy` handler every row is wrapped in: it keeps the row's original values and tracks which
 * fields were edited, whether the row is new or marked for deletion, and answers the row's `__` fields
 * (`__KEY`, `__rowState` ...). The data container makes one per row.
 *
 * Exported as a type only: it is the type of `Entity.__controller`. Read its fields, do not change them -
 * use the datasource's methods (`markForDeletion()`, `resetData()` ...).
 *
 * @example
 * ```ts
 * const row = datasource.getDataRows()[0];
 * row.name = 'Anna';
 * row.__controller?.__edited; // true
 * row.__controller?.__originalValues.name; // the name before the edit
 * ```
 */
export class EntityHandler {
    /** the other fields, see the ones below */
    [key: string]: any | undefined;
    /**
     * per property set on the row: `true` while its value differs from the original, `false` once
     * it was set back to it. `getChanges()` reports the `true` ones
     */
    __editedProps: Record<string, boolean> = {};
    /** the value each field had before its first edit, per field that was set */
    __originalValues: Record<string, any> = {};
    /** the value last set, per field that was set */
    __currentValues: Record<string, any> = {};
    /** the fields set on the row since it was made (or its changes were accepted), `true` each */
    __newprops: Record<string, any> = {};
    /**
     * `true` for a new row: `addNewEmpty()`, or the container's `setData(rows, { isNew: true })`. Until
     * `acceptChanges()` makes it an ordinary row. Stays `true` while a new row is marked for deletion
     */
    __isNew? = false;
    /** `true` while the row is marked for deletion, see `markForDeletion()` / `unmarkForDeletion()` */
    __isDeleted? = false;
    /** `true` while a field differs from its original value */
    __edited? = false; // change to isModified?
    /** not used: reading `row.__controller` gives the handler itself */
    __controller?: EntityHandler;
    /** the row's generated key, when the container has no key field */
    __KEY?: string | number;
    /** the container's key field, `undefined` when there is none */
    __KEYSTRING?: string | number;
    /** not used on a data row, it is never a group row */
    __group?: boolean;
    /** not used: `row.__rowState` is computed from `__isNew`, `__isDeleted` and `__edited` */
    __rowState?: string;
    /** not used on a data row */
    __groupID?: string;
    /** the row's error, read as `row.__rowError`, see `DataContainer.setErrors()` */
    __rowError?: string | null;
    /** not used on a data row */
    __groupName?: string;
    /** the grouping level the row sits under, read as `row.__groupLvl` */
    __groupLvl?: number;
    /** not used on a data row */
    __groupTotal?: number;
    /** not used on a data row */
    __groupChildren?: Entity[];
    /** not used on a data row */
    __groupExpanded?: boolean;

    /**
     * the type of a field, from the datasources on the container. Decides how two dates compare
     */
    private __fieldType: (field: string) => FieldType | undefined;

    /**
     * called after a field of the row was set, with the value it had before: the container records
     * the change for undo and validates the field there
     */
    private __onEdit: (row: Entity, field: string, oldValue: unknown) => void;

    /**
     * @param options.key the key field of the container, `__KEY` reads and writes it
     * @param options.isNew the row is new: `__rowState` is `'N'` and `getChanges()` lists it in `newEntities`
     * @param options.fieldType the type of a field: a `date` field compares two dates on the day,
     * every other field to the second. Without it every field compares to the second
     * @param options.onEdit called after a field of the row was set (not the `__` fields), with the
     * row, the field and the value the field had before: the container records the change for undo
     * (`datasource.undo()`) and validates the field there. Without it nothing is called
     */
    constructor(
        options: {
            key?: string;
            isNew?: boolean;
            fieldType?: (field: string) => FieldType | undefined;
            onEdit?: (row: Entity, field: string, oldValue: unknown) => void;
        } = {}
    ) {
        this.__KEYSTRING = options.key;
        this.__isNew = options.isNew ?? false;
        this.__fieldType = options.fieldType ?? (() => undefined);
        this.__onEdit = options.onEdit ?? (() => undefined);
    }

    /**
     * The proxy's get trap, called by the `Proxy` when a field of the row is read. Not for calling
     * yourself.
     */
    get(target: any, prop: string) {
        if (prop === '__controller') {
            return this;
        }
        if (
            [
                '__KEY',
                '__rowState',
                '__rowError',
                '__group',
                '__groupID',
                '__groupName',
                '__groupLvl',
                '__groupTotal',
                '__groupChildren',
                '__groupExpanded'
            ].indexOf(prop) > -1
        ) {
            if (prop === '__KEY') {
                if (this.__KEYSTRING) {
                    return target[this.__KEYSTRING];
                }
            } else if (prop === '__rowState') {
                if (this.__isDeleted) {
                    return 'D';
                }
                if (this.__isNew) {
                    return 'N';
                }

                if (this.__edited) {
                    return 'M';
                }
            }

            return this[prop];
        }

        return target[prop];
    }

    /**
     * The proxy's set trap, called by the `Proxy` when a field of the row is set: it records the edit,
     * and the container records it for undo and validates the field. Not for calling yourself.
     */
    set(obj: any, prop: string, value: any, receiver: Entity) {
        let update = true;

        if (prop[0] === '_' && prop[1] === '_') {
            update = false;
            if (
                [
                    '__KEY',
                    '__rowState',
                    '__rowError',
                    '__group',
                    '__groupID',
                    '__groupName',
                    '__groupLvl',
                    '__groupTotal',
                    '__groupChildren',
                    '__groupExpanded'
                ].indexOf(prop) > -1
            ) {
                if (prop === '__KEY') {
                    if (this.__KEYSTRING) {
                        obj[this.__KEYSTRING] = value;
                        // proxy set trap must return true, returning the value throws on falsy values
                        return true;
                    } else {
                        this[prop] = value;
                    }
                } else if (prop === '__rowState') {
                    // nothing
                } else {
                    this[prop] = value;
                }
            }
        }

        if (update) {
            if (!Object.hasOwn(this.__newprops, prop)) {
                this.__originalValues[prop] = obj[prop];
                this.__newprops[prop] = true;
            }

            // the original is taken on the first edit only. A prop set back to its original keeps
            // its entry (false), so a date set to another time on the same day keeps its real original
            if (!Object.hasOwn(this.__editedProps, prop) && !this.__isNew) {
                this.__originalValues[prop] = obj[prop];
            }
            this.__editedProps[prop] = !isSameValue(this.__originalValues[prop], value, this.__fieldType(prop));

            const oldValue = obj[prop];
            this.__currentValues[prop] = value;
            obj[prop] = value;
            this.__edited = Object.values(this.__editedProps).includes(true);
            // after the value is in: the error is about the value the row has now. The receiver is
            // the row, the proxy - what the validators, the errors and the undo history are keyed on
            this.__onEdit(receiver, prop, oldValue);
        }

        return true;
    }
}

/**
 * @internal
 * true when a value set on a row is no edit of its original value:
 * - the same value (`===`), or a blank (`null` / `undefined`) set to `''`
 * - two dates: a `date` field compares the day, the time of day is ignored - a date typed into a
 *   cell gets the current time, typing the same day again is no edit. Every other field (`datetime`,
 *   and the fields that are not listed) compares to the second: a time only change is an edit, the
 *   milliseconds are ignored, they are not shown and typing a time stamps the current ones.
 *   Two Date objects are never `===`, even when they hold the same moment.
 */
export function isSameValue(original: unknown, value: unknown, type: FieldType | undefined): boolean {
    if (original instanceof Date && value instanceof Date) {
        if (type === 'date') {
            return (
                original.getFullYear() === value.getFullYear() &&
                original.getMonth() === value.getMonth() &&
                original.getDate() === value.getDate()
            );
        }
        return Math.floor(original.getTime() / 1000) === Math.floor(value.getTime() / 1000);
    }
    return original === value || ((original === null || original === undefined) && value === '');
}
