import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { where } from '../filterExpression';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    {
        name: `somef\n\rcool\nthing`,
        group: 'group2',
        age: 23,
        born: new Date(1980, 0, 1),
        index: 1
    },
    { name: 'abcd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'cdef', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'tgyh', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'eref\n\r', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
];

let ds: Datasource;

describe('string filter', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('string with EQUAL - wildcard multiline', () => {
        ds.filter(where('name', 'EQUAL', '*som*'));

        expect(ds.getRows()).toEqual([
            {
                name: `somef\n\rcool\nthing`,
                group: 'group2',
                age: 23,
                born: new Date(1980, 0, 1),
                index: 1
            }
            /*   { name: 'abcd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'cdef', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'tgyh', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'eref\n\r', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 } */
        ]);
    });

    it('string with NOT_EQUAL_TO - wildcard multiline', () => {
        ds.filter(where('name', 'NOT_EQUAL_TO', '*som*'));

        expect(ds.getRows()).toEqual([
            { name: 'abcd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'cdef', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'tgyh', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'eref\n\r', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string with NOT_EQUAL_TO - wildcard multiline', () => {
        ds.filter(where('name', 'NOT_EQUAL_TO', '*ef*'));

        expect(ds.getRows()).toEqual([
            { name: 'abcd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'tgyh', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }
        ]);
    });

    it('string with EQUAL - wildcard multiline', () => {
        ds.filter(where('name', 'EQUAL', '*ef*'));

        expect(ds.getRows()).toEqual([
            {
                name: `somef\n\rcool\nthing`,
                group: 'group2',
                age: 23,
                born: new Date(1980, 0, 1),
                index: 1
            },
            /*   { name: 'abcd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }, */
            { name: 'cdef', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            /*     { name: 'tgyh', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },  */
            { name: 'eref\n\r', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });
});
