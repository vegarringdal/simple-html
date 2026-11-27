import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { where } from '../filterExpression';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
    { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
    { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 },
    { name: 'aperson4a', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
];

let ds: Datasource;

describe('string filter', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('string equal to', () => {
        ds.filter(where('name', 'EQUAL', 'person2'));

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
    });

    it('string not equal to', () => {
        ds.filter(where('name', 'NOT_EQUAL_TO', 'person2'));

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 },
            { name: 'aperson4a', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string begin with ', () => {
        ds.filter(where('name', 'BEGIN_WITH', 'person'));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string end with ', () => {
        ds.filter(where('name', 'END_WITH', 'n2'));

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
    });

    it('string constains ', () => {
        ds.filter(where('name', 'CONTAINS', 'son'));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 },
            { name: 'aperson4a', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string does not constains ', () => {
        ds.filter(where('name', 'DOES_NOT_CONTAIN', 'son'));

        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
    });

    it('string equal with wildcard * (same as begin with)', () => {
        ds.filter(where('name', 'EQUAL', 'person*'));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string equal with wildcard * (same as end with)', () => {
        ds.filter(where('name', 'EQUAL', '*son2'));

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
    });

    it('string begin with & wildcard in the begining = contains', () => {
        ds.filter(where('name', 'BEGIN_WITH', '*rson'));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 },
            { name: 'aperson4a', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string end with wildcard in the end = contains', () => {
        ds.filter(where('name', 'END_WITH', 'rson*'));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 },
            { name: 'aperson4a', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });
});
