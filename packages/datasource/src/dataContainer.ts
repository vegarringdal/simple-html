import { Entity } from './index';
import { EntityHandler } from './entity';

let globalKeyCount = 0;

// we need 1 for all datasources not using uniqueKeyAttribute
export const getNextKey = function () {
    globalKeyCount++;
    return globalKeyCount;
};

export class DataContainer {
    private __collection: Entity[] = [];
    private __keyAttribute = '';
    private EntityHandler = EntityHandler;

    constructor(UniqueKeyAttribute?: string) {
        // we want to add sufix just incase its something like a new
        this.__keyAttribute = UniqueKeyAttribute;
    }

    /**
     * so user can override if they want
     */
    public overrideEntityHandler(entityHandler: any) {
        this.EntityHandler = entityHandler;
    }

    /**
     * so I can check
     */
    public get type() {
        return 'DataContainer';
    }

    private getKey() {
        return getNextKey();
    }

    public getDataSet() {
        return this.__collection.slice();
    }

    public lenght() {
        return this.__collection;
    }

    public removeData(data: Entity | Entity[], all = false) {
        if (all) {
            const removed = this.__collection.slice();
            this.__collection = [];
            return removed;
        }

        if (data) {
            if (Array.isArray(data)) {
                const removed: Entity[] = [];
                data.forEach((d) => {
                    const i = this.__collection.indexOf(d);
                    if (i !== -1) {
                        removed.push(this.__collection.splice(i, 1)[0]);
                    }
                });
                return removed;
            } else {
                const i = this.__collection.indexOf(data);
                if (i !== -1) {
                    return this.__collection.splice(i, 1);
                }
            }
        }

        return [];
    }

    public setData(data: any[], add = false, tagAsNew = false): Entity[] | void {
        if (add) {
            const x = Array.from(data, (o: any | Entity) => {
                if (o && o.__controller) {
                    return o;
                } else {
                    return new Proxy(
                        o,
                        new this.EntityHandler(this.__keyAttribute, tagAsNew) as any
                    );
                }
            });
            this.__collection.push(...x);

            this.__collection.forEach((entity, i) => {
                if (entity && !(entity as any).__KEY) {
                    (entity as any).__KEY = this.getKey();
                } else {
                    if (!this.__collection[i]) {
                        this.__collection[i] = { __KEY: this.getKey() };
                    }
                }
            });
            return x;
        } else {
            this.__collection = Array.from(data, (o: any | Entity) => {
                if (o && o.__controller) {
                    return o;
                } else {
                    return new Proxy(
                        o,
                        new this.EntityHandler(this.__keyAttribute, tagAsNew) as any
                    );
                }
            });

            this.__collection.forEach((entity, i) => {
                if (entity && !(entity as any).__KEY) {
                    (entity as any).__KEY = this.getKey();
                } else {
                    if (!this.__collection[i]) {
                        this.__collection[i] = { __KEY: this.getKey() };
                    }
                }
            });
        }
    }
}
