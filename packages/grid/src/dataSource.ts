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
