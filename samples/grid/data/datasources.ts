import { DataContainer, Datasource, EntityHandler } from '@simple-html/datasource';
import { Generator } from './generator';

const generator = new Generator();

const EntityHandlerOverride = class extends EntityHandler {
    get(target: any, prop: string) {
        if (prop === 'superman') {
            return (target['word4'] || '') + ' - ' + (target['work5'] || '');
        } else {
            return super.get(target, prop);
        }
    }

    set(obj: any, prop: string, value: any) {
        if (prop === 'superman') {
            return false;
        } else {
            return super.set(obj, prop, value);
        }
    }
};

export const WordDatasource01 = new DataContainer();
WordDatasource01.overrideEntityHandler(EntityHandlerOverride);
export const WordDatasource02 = new DataContainer();
export const WordDatasource03 = new DataContainer();
export const WordDatasource04 = new DataContainer();

// add some default data
console.time('generate');
const x = generator.generateData(500);
console.timeEnd('generate');
WordDatasource01.setData(x);
WordDatasource02.setData(generator.generateData(10));
//same data into both
WordDatasource03.setData(generator.generateData(10));

export function add(ds: Datasource, howMany: number) {
    if (ds.setData) {
        ds.setData(generator.generateData(howMany), true);
    }
}

export function set(ds: Datasource, howMany: number) {
    if (ds.setData) {
        ds.setData(generator.generateData(howMany), false);
    }
}
