import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { and, or, where } from '../filterExpression';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { name: 'person2', group: 'group2', age: 23, index: 1 },
    { name: 'person1', group: 'group2', age: 34, index: 2 },
    { name: 'person1', group: 'group1', age: 32, index: 3 },
    { name: 'person1', group: 'group1', age: 56, index: 4 },
    { name: 'person4', group: 'group1', age: 55, index: 5 }
];

let ds: Datasource;

describe('datasource filter with ', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('single', () => {
        ds.filter(where('name', 'EQUAL', 'person1'));
        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group2', age: 34, index: 2 },
            { name: 'person1', group: 'group1', age: 32, index: 3 },
            { name: 'person1', group: 'group1', age: 56, index: 4 }
        ]);
    });

    it('2 attributes, default to and', () => {
        ds.filter(and(where('group', 'EQUAL', 'group1'), where('name', 'EQUAL', 'person1')));
        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 32, index: 3 },
            { name: 'person1', group: 'group1', age: 56, index: 4 }
        ]);
    });

    it('or statement mpty', () => {
        ds.filter(or());
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, index: 1 },
            { name: 'person1', group: 'group2', age: 34, index: 2 },
            { name: 'person1', group: 'group1', age: 32, index: 3 },
            { name: 'person1', group: 'group1', age: 56, index: 4 },
            { name: 'person4', group: 'group1', age: 55, index: 5 }
        ]);
        expect(ds.getRows().length).toEqual(5);
    });

    it('or statement', () => {
        ds.filter(or(where('group', 'EQUAL', 'group1'), where('name', 'EQUAL', 'person1')));
        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group2', age: 34, index: 2 },
            { name: 'person1', group: 'group1', age: 32, index: 3 },
            { name: 'person1', group: 'group1', age: 56, index: 4 },
            { name: 'person4', group: 'group1', age: 55, index: 5 }
        ]);
        expect(ds.getRows().length).toEqual(4);
    });

    it('or statement with sub and statements', () => {
        ds.filter(
            or(
                and(where('group', 'EQUAL', 'group2'), where('name', 'EQUAL', 'person2')),
                and(where('group', 'EQUAL', 'group1'), where('name', 'EQUAL', 'person4'))
            )
        );
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, index: 1 },
            { name: 'person4', group: 'group1', age: 55, index: 5 }
        ]);
    });

    it('and statement with sub or statements', () => {
        ds.filter(
            and(
                or(where('group', 'EQUAL', 'group1'), where('name', 'EQUAL', 'person2')),
                or(where('group', 'EQUAL', 'group2'), where('name', 'EQUAL', 'person4'))
            )
        );
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, index: 1 },
            { name: 'person4', group: 'group1', age: 55, index: 5 }
        ]);
    });
});
