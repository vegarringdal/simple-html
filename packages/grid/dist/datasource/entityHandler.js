/**
 * @internal
 * Entity will keep track of edited properties of the row object
 */
export class EntityHandler {
    __editedProps = {};
    __originalValues = {};
    __currentValues = {};
    __newprops = {};
    __isNew = false;
    __isDeleted = false;
    __edited = false; // change to isModified?
    __controller;
    __KEY;
    __KEYSTRING;
    __group;
    __rowState;
    __groupID;
    __rowError;
    __groupName;
    __groupLvl;
    __groupTotal;
    __groupChildren;
    __groupExpanded;
    constructor(keyString, tagAsNew = false) {
        this.__KEYSTRING = keyString;
        this.__isNew = tagAsNew;
    }
    get(target, prop) {
        if (prop === '__controller') {
            return this;
        }
        if ([
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
        ].indexOf(prop) > -1) {
            if (prop === '__KEY') {
                if (this.__KEYSTRING) {
                    return target[this.__KEYSTRING];
                }
            }
            else if (prop === '__rowState') {
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
    set(obj, prop, value) {
        let update = true;
        if (prop[0] === '_' && prop[1] === '_') {
            update = false;
            if ([
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
            ].indexOf(prop) > -1) {
                if (prop === '__KEY') {
                    if (this.__KEYSTRING) {
                        obj[this.__KEYSTRING] = value;
                        // proxy set trap must return true, returning the value throws on falsy values
                        return true;
                    }
                    else {
                        this[prop] = value;
                    }
                }
                else if (prop === '__rowState') {
                    // nothing
                }
                else {
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
            }
            else {
                this.__editedProps[prop] = true;
            }
            // if user just set back to original value we want to remove the "edited" part
            let _original = this.__originalValues[prop];
            let _value = value;
            // if date, clear the "timezone/time part"
            // compared as a timestamp - two Date objects are never === even when equal
            if (_original instanceof Date) {
                try {
                    _original = new Date(new Date(_original).getFullYear(), new Date(_original).getMonth(), new Date(_original).getDate(), 0, 0, 0, 0).getTime();
                }
                catch {
                    _original = null;
                }
            }
            if (_value instanceof Date) {
                _value = new Date(new Date(_value).getFullYear(), new Date(_value).getMonth(), new Date(_value).getDate(), 0, 0, 0, 0).getTime();
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
//# sourceMappingURL=entityHandler.js.map