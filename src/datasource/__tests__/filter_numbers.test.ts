import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { where } from '../filterExpression';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 },
    { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
    { name: 'person4', group: 'group1', age: 67, born: new Date(2000, 0, 1), index: 5 }
];

let ds: Datasource;

describe('number filter', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('number equal to, the type from the fields', () => {
        const typed = new Datasource({ fields: { age: 'number' } });
        typed.setData(simpleArray.slice());
        typed.filter(where('age', 'EQUAL', 40));

        expect(typed.getRows()).toEqual([{ name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 }]);
    });

    it('number equal to, auto guess type based on input', () => {
        ds.filter(where('age', 'EQUAL', 40));

        expect(ds.getRows()).toEqual([{ name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 }]);
    });

    it('number greater than ', () => {
        ds.filter(where('age', 'GREATER_THAN', 40));

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 67, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('number less than ', () => {
        ds.filter(where('age', 'LESS_THAN', 40));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }
        ]);
    });

    it('number greater or equal than ', () => {
        ds.filter(where('age', 'GREATER_THAN_OR_EQUAL_TO', 40));

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 67, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('number less than ', () => {
        ds.filter(where('age', 'LESS_THAN_OR_EQUAL_TO', 40));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 }
        ]);
    });

    it('number less than ', () => {
        ds.filter(where('age', 'NOT_EQUAL_TO', 40));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 67, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('number contains will use greater or equal to ', () => {
        ds.filter(where('age', 'CONTAINS', 40));

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 67, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('number begin with will use greater or equal to ', () => {
        ds.filter(where('age', 'BEGIN_WITH', 40));

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 67, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('number end with will use less or equal to ', () => {
        ds.filter(where('age', 'END_WITH', 40));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 }
        ]);
    });

    it('number does not cotains will use less than ', () => {
        ds.filter(where('age', 'DOES_NOT_CONTAIN', 40));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }
        ]);
    });
});
