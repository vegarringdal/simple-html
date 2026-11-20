import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { where } from '../filterExpression';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { name: '4person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'qperson22', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: '4person244', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'qperson244', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
];

let ds: Datasource;

describe('string filter', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('string with BEGIN_WITH', () => {
        ds.filter(where('name', 'BEGIN_WITH', 'per'));

        expect(ds.getRows()).toEqual([
            /* { name: '4person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'qperson22', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: '4person244', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'qperson244', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }, */
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string with BEGIN_WITH', () => {
        ds.filter(where('name', 'BEGIN_WITH', 'p*er'));

        expect(ds.getRows()).toEqual([
            /* { name: '4person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'qperson22', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: '4person244', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'qperson244', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }, */
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string with END_WITH', () => {
        ds.filter(where('name', 'END_WITH', 'son2'));

        expect(ds.getRows()).toEqual([
            { name: '4person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }
            /*  { name: 'qperson22', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: '4person244', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'qperson244', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 } */
        ]);
    });

    it('string with END_WITH', () => {
        ds.filter(where('name', 'END_WITH', '*son2'));

        expect(ds.getRows()).toEqual([
            { name: '4person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }
            /*  { name: 'qperson22', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: '4person244', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'qperson244', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 } */
        ]);
    });

    it('string with END_WITH', () => {
        ds.filter(where('name', 'NOT_EQUAL_TO', '*son2'));

        expect(ds.getRows().length).toEqual(4);
        expect(ds.getRows()).toEqual([
            /*  { name: '4person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }, */
            { name: 'qperson22', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: '4person244', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'qperson244', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });
});
