import { Entity } from './index';
import { EntityHandler } from './entity';

let globalKeyCount = 0;

// we need 1 for all datasources not using uniqueKeyAttribute
export const getNextKey = function () {
    globalKeyCount--;
    return globalKeyCount;
};

/**
 * Datacontainer, this can be used as input for multible datasources
 */
export class DataContainer {
    private __collection: Entity[] = [];
    private __markedForDeletion: Entity[] = [];
    private __keyAttribute = '';
    private EntityHandler = EntityHandler;
    /**
     *
     * @param UniqueKeyAttribute fo selection usage, this way it can be persistant when dealing with remote data
     */
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
     * @internal
     */
    public get type() {
        return 'DataContainer';
    }

    private getKey() {
        return getNextKey();
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
    public lenght() {
        return this.__collection.length;
    }

    /**
     * return entities marked for deletion
     * @returns
     */
    public getMarkedForDeletion() {
        return this.__markedForDeletion;
    }

    /**
     * resets data, all edits are resets and marked for deletetion if returned
     */
    public resetData() {
        const newEntities: Entity[] = [];
        this.setData(this.__markedForDeletion, true);
        this.__collection.forEach((row) => {
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

        this.__markedForDeletion = [];
    }

    /**
     * mark data for deletion, will not show in searches/grouping
     * @param data set null if all
     * @param all remove all
     */
    public markForDeletion(data: Entity | Entity[], all = false) {
        if (all) {
            const removed = this.__collection.slice();
            this.__collection = [];
            this.__markedForDeletion = removed;
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
                this.__markedForDeletion = this.__markedForDeletion.concat(removed);
            } else {
                const i = this.__collection.indexOf(data);
                if (i !== -1) {
                    this.__markedForDeletion.push(this.__collection.splice(i, 1)[0]);
                }
            }
        }
    }

    /**
     *
     */
    public clearMarkedForDeletion() {
        this.__markedForDeletion = [];
    }

    /**
     * will remove from dataset, this is not the same as mark for deletion
     * @param data entity or entirty array you want to remove
     * @param all if set to true, you remove all
     * @returns returns removed
     */
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

    /**
     * set data
     * @param data
     * @param add
     * @param tagAsNew
     * @returns
     */
    public setData(data: any[], add = false, tagAsNew = false): Entity[] | void {
        if (!add) {
            this.__markedForDeletion = [];
            this.__collection = [];
        }

        const x = Array.from(data, (o: any | Entity) => {
            if (o && o.__controller) {
                if (o && !(o as any).__KEY) {
                    (o as any).__KEY = this.getKey();
                }
                return o;
            } else {
                const entity = new Proxy(o, new this.EntityHandler(this.__keyAttribute, tagAsNew) as any);
                if (entity && !(entity as any).__KEY) {
                    (entity as any).__KEY = this.getKey();
                }
                return entity;
            }
        });
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
        // todo
        const x = Array.from(data, (o: any | Entity) => {
            if (o && o.__controller) {
                return o;
            } else {
                return new Proxy(o, new this.EntityHandler(this.__keyAttribute, false) as any);
            }
        });

        this.__collection.splice(index, remove, ...x);
    }
}
