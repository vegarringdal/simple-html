import { Entity } from './types';

/**
 * Entity will keep track of edited properties of the row object
 */

export class EntityHandler {
    __editedProps? = {};
    __originalValues? = {};
    __currentValues? = {};
    __newprops? = {};
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
                this[prop] = value;
            }
        }

        if (update) {
            if (obj.hasOwnProperty(prop)) {
                if (!this.__editedProps.hasOwnProperty(prop)) {
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
                    _original = new Date(_original.toISOString().split('T')[0]).toISOString();
                }
                if (_value instanceof Date) {
                    _value = new Date(_value.toISOString().split('T')[0]).toISOString();
                }

                if (
                    _original === _value ||
                    ((_original === null || _original === null) && _value === '')
                ) {
                    this.__editedProps[prop] = false;
                }

                this.__currentValues[prop] = value;
                obj[prop] = value;
            } else {
                if (!this.__newprops.hasOwnProperty(prop)) {
                    this.__originalValues[prop] = obj[prop];
                    this.__newprops[prop] = true;
                }
            }
            this.__edited = true;
            this.__currentValues[prop] = value;
            obj[prop] = value;
        }

        return true;
    }
}
