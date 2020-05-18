import { DataContainer } from '@simple-html/datasource';
import { Generator } from './generator';
import { GridInterface } from '@simple-html/grid';

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

export function add(ds: DataContainer | GridInterface, howMany: number) {
    if (ds.setData) {
        ds.setData(generator.generateData(howMany), true);
    }
}

export function set(ds: DataContainer | GridInterface, howMany: number) {
    if (ds.setData) {
        ds.setData(generator.generateData(howMany), false);
    }
}
