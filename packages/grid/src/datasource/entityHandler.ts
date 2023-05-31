import { Entity } from './entity';

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
    __edited? = false;
    __controller?: EntityHandler;
    __KEY?: string | number;
    __KEYSTRING?: string | number;
    __group?: boolean;
    __groupID?: string;
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
                        return (obj[this.__KEYSTRING] = value);
                    } else {
                        this[prop] = value;
                    }
                } else {
                    this[prop] = value;
                }
            }
        }

        if (update) {
            if (!this.__newprops.hasOwnProperty(prop)) {
                this.__originalValues[prop] = obj[prop];
                this.__newprops[prop] = true;
            }

            if (!this.__editedProps.hasOwnProperty(prop) && !this.__isNew) {
                this.__originalValues[prop] = obj[prop];
                this.__editedProps[prop] = true;
            } else {
                this.__editedProps[prop] = true;
            }
            // if user just set back to original value we want to remove the "edited" part
            let _original = this.__originalValues[prop];
            let _value = value;

            // if date, clear the "timezone/time part"
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
                    );
                } catch (e) {
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
                );
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
