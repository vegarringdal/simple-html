import { IEntity } from './interfaces';
import { EntityHandler } from './entity';

export class DataSource {
    /**
     * Have all the data
     **/
    private __DATASET_ALL: IEntity[] = [];
    private __KEY_ATTRIBUTE = '';
    private __KEY_COUNT = 0;

    constructor(UniqueKeyAttribute?: string) {
        // we want to add sufix just incase its something like a new
        this.__KEY_ATTRIBUTE = UniqueKeyAttribute;
    }

    get DATA_SET() {
        return this.__DATASET_ALL;
    }

    private getKey() {
        this.__KEY_COUNT++;
        return this.__KEY_COUNT;
    }

    removeData(data: IEntity | IEntity[], all = false) {
        if (all) {
            const removed = this.__DATASET_ALL.slice();
            this.__DATASET_ALL = [];
            return removed;
        }

        if (data) {
            if (Array.isArray(data)) {
                const removed: IEntity[] = [];
                data.forEach((d) => {
                    const i = this.__DATASET_ALL.indexOf(d);
                    if (i !== -1) {
                        removed.push(this.__DATASET_ALL.splice(i, 1)[0]);
                    }
                });
                return removed;
            } else {
                const i = this.__DATASET_ALL.indexOf(data);
                if (i !== -1) {
                    return this.__DATASET_ALL.splice(i, 1);
                }
            }
        }

        return [];
    }

    setData(data: any[], add = false): IEntity[] | void {
        // todo
        // do I want to have a set to check we dont have duplicates on keys?

        if (add) {
            const x = Array.from(data, (o: any | IEntity) => {
                if (o && o.__controller) {
                    return o;
                } else {
                    return new Proxy(o, new EntityHandler(this.__KEY_ATTRIBUTE) as any);
                }
            });
            this.__DATASET_ALL.push(...x);

            this.__DATASET_ALL.forEach((entity, i) => {
                if (entity && !(entity as any).__KEY) {
                    (entity as any).__KEY = this.getKey();
                } else {
                    if (!this.__DATASET_ALL[i]) {
                        this.__DATASET_ALL[i] = { __KEY: this.getKey() };
                    }
                }
            });
            return x;
        } else {
            this.__DATASET_ALL = Array.from(data, (o: any | IEntity) => {
                if (o && o.__controller) {
                    return o;
                } else {
                    return new Proxy(o, new EntityHandler(this.__KEY_ATTRIBUTE) as any);
                }
            });

            this.__DATASET_ALL.forEach((entity, i) => {
                if (entity && !(entity as any).__KEY) {
                    (entity as any).__KEY = this.getKey();
                } else {
                    if (!this.__DATASET_ALL[i]) {
                        this.__DATASET_ALL[i] = { __KEY: this.getKey() };
                    }
                }
            });
        }
    }
}
