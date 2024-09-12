import { describe, beforeAll, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'Nils(610)_wow', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
    { name: 'Nil(wow)_sman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
    { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 },
    { name: 'aperson4a', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
];

let ds: Datasource;

describe('string filter', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('string not equal to', () => {
        ds.filter({
            attribute: 'name',
            operator: 'EQUAL',
            value: 'Nil(wow)*'
        });

        expect(ds.getRows()).toEqual([{ name: 'Nil(wow)_sman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }]);
    });
});
