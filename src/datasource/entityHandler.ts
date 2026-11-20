import type { Entity } from './entity';
import type { FieldType } from './field';

/**
 * Entity will keep track of edited properties of the row object.
 * Not exported from the package, but part of the typings: it is the type of `Entity.__controller`.
 */

export class EntityHandler {
    [key: string]: any | undefined;
    /**
     * per property set on the row: `true` while its value differs from the original, `false` once
     * it was set back to it. `getChanges()` reports the `true` ones
     */
    __editedProps: Record<string, boolean> = {};
    __originalValues: Record<string, any> = {};
    __currentValues: Record<string, any> = {};
    __newprops: Record<string, any> = {};
    __isNew? = false;
    __isDeleted? = false;
    __edited? = false; // change to isModified?
    __controller?: EntityHandler;
    __KEY?: string | number;
    __KEYSTRING?: string | number;
    __group?: boolean;
    __rowState?: string;
    __groupID?: string;
    __rowError?: string | null;
    __groupName?: string;
    __groupLvl?: number;
    __groupTotal?: number;
    __groupChildren?: Entity[];
    __groupExpanded?: boolean;

    /**
     * the type of a field, from the datasources on the container. Decides how two dates compare
     */
    private __fieldType: (field: string) => FieldType | undefined;

    /**
     * @param options.key the key field of the container, `__KEY` reads and writes it
     * @param options.isNew the row is new: `__rowState` is `'N'` and `getChanges()` lists it in `newEntities`
     * @param options.fieldType the type of a field: a `date` field compares two dates on the day,
     * every other field to the second. Without it every field compares to the second
     */
    constructor(options: { key?: string; isNew?: boolean; fieldType?: (field: string) => FieldType | undefined } = {}) {
        this.__KEYSTRING = options.key;
        this.__isNew = options.isNew ?? false;
        this.__fieldType = options.fieldType ?? (() => undefined);
    }

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

    set(obj: any, prop: string, value: any) {
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

            this.__currentValues[prop] = value;
            obj[prop] = value;
            this.__edited = Object.values(this.__editedProps).includes(true);
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
