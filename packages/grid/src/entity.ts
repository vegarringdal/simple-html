import { IEntity } from './interfaces';

/**
 * Entity will keep track of edited properties of the row object
 */

export class EntityHandler {
    __editedProps? = {};
    __originalValues? = {};
    __currentValues? = {};
    __newprops? = {};
    __edited? = false;
    __controller?: EntityHandler;
    __KEY?: string | number;
    __KEYSTRING?: string | number;
    __group?: boolean;
    __groupID?: string;
    __groupName?: string;
    __groupLvl?: number;
    __groupTotal?: number;
    __groupChildren?: IEntity[];
    __groupExpanded?: boolean;

    constructor(keyString?: string) {
        this.__KEYSTRING = keyString;
    }

    get(target: object, prop: string) {
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
                } else {
                    return target[prop];
                }
            }
            return this[prop];
        }
        return target[prop];
    }

    set(obj: object, prop: string, value: any) {
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
