import { describe, beforeAll, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { name: 'a', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'b', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'c', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'e', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
];

let ds: Datasource;

describe('string filter', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('string with GREATER_THAN', () => {
        ds.filter({
            attribute: 'name',
            operator: 'GREATER_THAN',
            value: 'b'
        });

        expect(ds.getRows()).toEqual([
            /* { name: 'a', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }, */
            /*   { name: 'b', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }, */
            { name: 'c', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'e', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string with GREATER_THAN_OR_EQUAL_TO', () => {
        ds.filter({
            attribute: 'name',
            operator: 'GREATER_THAN_OR_EQUAL_TO',
            value: 'b'
        });

        expect(ds.getRows()).toEqual([
            /* { name: 'a', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }, */
            { name: 'b', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'c', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'e', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string with LESS_THAN', () => {
        ds.filter({
            attribute: 'name',
            operator: 'LESS_THAN',
            value: 'b'
        });

        expect(ds.getRows()).toEqual([
            { name: 'a', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }
            /*  { name: 'b', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'c', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'e', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 } */
        ]);
    });

    it('string with LESS_THAN', () => {
        ds.filter({
            attribute: 'name',
            operator: 'LESS_THAN_OR_EQUAL_TO',
            value: 'b'
        });

        expect(ds.getRows()).toEqual([
            { name: 'a', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'b', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }
            /*    { name: 'c', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'e', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }  */
        ]);
    });
});
