import { DataSource } from '@simple-html/grid';
import { Generator } from './generator';
import { GridInterface } from '@simple-html/grid';

const generator = new Generator();

export const WordDatasource01 = new DataSource();
export const WordDatasource02 = new DataSource();
export const WordDatasource03 = new DataSource();
export const WordDatasource04 = new DataSource();

// add some default data
WordDatasource01.setData(generator.generateData(50));
WordDatasource02.setData(generator.generateData(10));
//same data into both
WordDatasource03.setData(generator.generateData(10));

export function add(ds: DataSource | GridInterface, howMany: number) {
    if (ds.setData) {
        ds.setData(generator.generateData(howMany), true);
    }
}

export function set(ds: DataSource | GridInterface, howMany: number) {
    if (ds.setData) {
        ds.setData(generator.generateData(howMany), false);
    }
}
