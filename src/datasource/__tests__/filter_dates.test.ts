import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { where } from '../filterExpression';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
    { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
    { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
];

let ds: Datasource;

describe('date filter', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('date equal to, the type from the fields', () => {
        const typed = new Datasource({ fields: { born: 'date' } });
        typed.setData(simpleArray.slice());
        typed.filter(where('born', 'EQUAL', new Date(1990, 0, 1)));

        expect(typed.getRows()).toEqual([{ name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }]);
    });

    it('date equal to, auto guess type based on input', () => {
        ds.filter(where('born', 'EQUAL', new Date(1990, 0, 1)));

        expect(ds.getRows()).toEqual([{ name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }]);
    });

    it('date greater than ', () => {
        ds.filter(where('born', 'GREATER_THAN', new Date(1990, 0, 1)));

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('date less than ', () => {
        ds.filter(where('born', 'LESS_THAN', new Date(1990, 0, 1)));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }
        ]);
    });

    it('date greater or equal than ', () => {
        ds.filter(where('born', 'GREATER_THAN_OR_EQUAL_TO', new Date(1990, 0, 1)));

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('date less than ', () => {
        ds.filter(where('born', 'LESS_THAN_OR_EQUAL_TO', new Date(1990, 0, 1)));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }
        ]);
    });

    it('date less than ', () => {
        ds.filter(where('born', 'NOT_EQUAL_TO', new Date(1990, 0, 1)));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('date contains will use greater or equal to ', () => {
        ds.filter(where('born', 'CONTAINS', new Date(1990, 0, 1)));

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('date begin with will use greater or equal to ', () => {
        ds.filter(where('born', 'BEGIN_WITH', new Date(1990, 0, 1)));

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('date end with will use less than or equal to', () => {
        ds.filter(where('born', 'END_WITH', new Date(1990, 0, 1)));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }
        ]);
    });

    it('date does not contain will use less than ', () => {
        ds.filter(where('born', 'DOES_NOT_CONTAIN', new Date(1990, 0, 1)));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }
        ]);
    });
});
