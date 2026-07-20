import type { Entity } from './entity';

/**
 * @internal
 * Entity will keep track of edited properties of the row object
 */

export class EntityHandler {
    [key: string]: any | undefined;
    __editedProps?: Record<string, any> = {};
    __originalValues?: Record<string, any> = {};
    __currentValues?: Record<string, any> = {};
    __newprops?: Record<string, any> = {};
    __isNew? = false;
    __isDeleted? = false;
    __edited? = false; // change to isModified?
    __controller?: EntityHandler;
    __KEY?: string | number;
    __KEYSTRING?: string | number;
    __group?: boolean;
    __rowState?: string;
    __groupID?: string;
    __rowError?: string;
    __groupName?: string;
    __groupLvl?: number;
    __groupTotal?: number;
    __groupChildren?: Entity[];
    __groupExpanded?: boolean;

    constructor(keyString?: string, tagAsNew = false) {
        this.__KEYSTRING = keyString;
        this.__isNew = tagAsNew;
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

            if (!Object.hasOwn(this.__editedProps, prop) && !this.__isNew) {
                this.__originalValues[prop] = obj[prop];
                this.__editedProps[prop] = true;
            } else {
                this.__editedProps[prop] = true;
            }
            // if user just set back to original value we want to remove the "edited" part
            let _original = this.__originalValues[prop];
            let _value = value;

            // if date, clear the "timezone/time part"
            // compared as a timestamp - two Date objects are never === even when equal
            if (_original instanceof Date) {
                try {
                    _original = new Date(
                        new Date(_original).getFullYear(),
                        new Date(_original).getMonth(),
                        new Date(_original).getDate(),
                        0,
                        0,
                        0,
                        0
                    ).getTime();
                } catch {
                    _original = null;
                }
            }
            if (_value instanceof Date) {
                _value = new Date(
                    new Date(_value).getFullYear(),
                    new Date(_value).getMonth(),
                    new Date(_value).getDate(),
                    0,
                    0,
                    0,
                    0
                ).getTime();
            }

            if (_original === _value || ((_original === null || _original === undefined) && _value === '')) {
                this.__editedProps[prop] = false;
            }

            this.__currentValues[prop] = value;
            obj[prop] = value;

            this.__edited = Object.values(this.__editedProps).includes(true);
            this.__currentValues[prop] = value;
            obj[prop] = value;
        }

        return true;
    }
}
