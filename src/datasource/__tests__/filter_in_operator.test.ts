import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { and, or, where } from '../filterExpression';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
    { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
    { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
];

let ds: Datasource;

describe('string filter', () => {
    beforeAll(() => {
        // IN compares number and date fields as their formatted text, the type comes from the fields
        ds = new Datasource({ fields: { age: 'number', born: 'date' } });
        ds.setData(simpleArray.slice());
    });

    it('simple IN operator test with newline as split', () => {
        ds.filter(where('name', 'IN', 'person2\nNils'));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }
        ]);
    });

    it('simple NOT_IN operator test with newline as split', () => {
        ds.filter(where('name', 'NOT_IN', 'person2\nNils'));

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('simple IN operator test with newline as split 2', () => {
        ds.filter(where('name', 'IN', 'Nilsman\nNils\nawsome'));

        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
    });

    it('simple IN operator test with newline as split, empty', () => {
        ds.filter(where('name', 'IN', ''));

        expect(ds.getRows()).toEqual([]);
    });

    it('simple NOT IN operator test with newline as split, all', () => {
        ds.filter(where('name', 'NOT_IN', ''));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('simple IN operator test with newline as split, search agains numbers', () => {
        ds.filter(where('age', 'IN', '32\n56'));

        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
    });

    it('simple IN operator test with array, search agains numbers', () => {
        ds.filter(where('age', 'IN', ['32', '56']));

        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
    });

    it('simple IN operator test with array, search agains dates', () => {
        ds.filter(
            where(
                'born',
                'IN',
                [new Date(1990, 0, 1), new Date(1995, 0, 1)].map((x) => ds.getFormatter('born').format(x))
            )
        );

        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
    });

    it('simple IN operator test with array, search agains dates with AND logical operator', () => {
        ds.filter(
            and(
                where(
                    'born',
                    'IN',
                    [new Date(1990, 0, 1), new Date(1995, 0, 1)].map((x) => ds.getFormatter('born').format(x))
                ),
                where('age', 'IN', ['32', '56'])
            )
        );
        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
    });

    it('simple IN operator test with array, search agains dates with OR logical operator', () => {
        ds.filter(
            or(
                where(
                    'born',
                    'IN',
                    [new Date(2000, 0, 1), new Date(1995, 0, 1)].map((x) => ds.getFormatter('born').format(x))
                ),
                where('age', 'IN', ['23', '32', '56'])
            )
        );
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });
});
