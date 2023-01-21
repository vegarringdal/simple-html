import { describe, beforeAll, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { name: 'person2', group: 0, age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'person1', group: '', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'Nils', group: 's', age: 32, born: new Date(1990, 0, 1), index: 3 },
    { name: 'Nilsman', group: null, age: 56, born: new Date(1995, 0, 1), index: 4 },
    { name: 'person4', group: undefined, age: 55, born: new Date(2000, 0, 1), index: 5 }
];

let ds: Datasource;

describe('string filter', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('string equal to', () => {
        ds.filter({
            attribute: 'group',
            operator: 'IS_BLANK'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 0, age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: '', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'Nilsman', group: null, age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: undefined, age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string equal to', () => {
        ds.filter({
            attribute: 'group',
            operator: 'IS_NOT_BLANK'
        });

        expect(ds.getRows()).toEqual([{ name: 'Nils', group: 's', age: 32, born: new Date(1990, 0, 1), index: 3 }]);
    });
});
