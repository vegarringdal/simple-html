import { DataContainer, Datasource } from '@simple-html/datasource';
import { Generator } from './generator';

const generator = new Generator();

export const WordDatasource01 = new DataContainer();
export const WordDatasource02 = new DataContainer();
export const WordDatasource03 = new DataContainer();
export const WordDatasource04 = new DataContainer();

// add some default data
WordDatasource01.setData(generator.generateData(50));
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
