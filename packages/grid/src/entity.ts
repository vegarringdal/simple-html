
/**
 * Entity will keep track of edited properties of the row object
 */

export class Entity {
    __editedProps = {};
    __originalValues = {};
    __currentValues = {};
    __newprops = {};
    __edited = false;

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
