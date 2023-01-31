import { describe, beforeAll, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

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
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('simple IN operator test with newline as split', () => {
        ds.filter({
            attribute: 'name',
            operator: 'IN',
            value: 'person2\nNils'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }
        ]);
    });

    it('simple NOT_IN operator test with newline as split', () => {
        ds.filter({
            attribute: 'name',
            operator: 'NOT_IN',
            value: 'person2\nNils'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('simple IN operator test with newline as split 2', () => {
        ds.filter({
            attribute: 'name',
            operator: 'IN',
            value: 'Nilsman\nNils\nawsome'
        });

        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
    });

    it('simple IN operator test with newline as split, empty', () => {
        ds.filter({
            attribute: 'name',
            operator: 'IN',
            value: ''
        });

        expect(ds.getRows()).toEqual([]);
    });

    it('simple NOT IN operator test with newline as split, all', () => {
        ds.filter({
            attribute: 'name',
            operator: 'NOT_IN',
            value: ''
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('simple IN operator test with newline as split, search agains numbers', () => {
        ds.filter({
            attribute: 'age',
            operator: 'IN',
            attributeType: 'number', // no automatic anymore when using array to speed it up
            value: '32\n56'
        });

        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
    });

    it('simple IN operator test with array, search agains numbers', () => {
        ds.filter({
            attribute: 'age',
            operator: 'IN',
            attributeType: 'number', // no automatic anymore when using array to speed it up
            value: ['32', '56'] as any
        });

        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
    });

    it('simple IN operator test with array, search agains dates', () => {
        ds.filter({
            attribute: 'born',
            operator: 'IN',
            attributeType: 'date',
            value: [new Date(1990, 0, 1), new Date(1995, 0, 1)].map((x) =>
                ds.getValueFormater().fromSource(x, 'date', 'x')
            ) as any
        });

        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
    });

    it('simple IN operator test with array, search agains dates with AND logical operator', () => {
        ds.filter({
            logicalOperator: 'AND',
            filterArguments: [
                {
                    attribute: 'born',
                    operator: 'IN',
                    attributeType: 'date', // no automatic anymore when using array to speed it up
                    value: [new Date(1990, 0, 1), new Date(1995, 0, 1)].map((x) =>
                        ds.getValueFormater().fromSource(x, 'date', 'x')
                    ) as any
                },
                {
                    attribute: 'age',
                    operator: 'IN',
                    attributeType: 'number', // no automatic anymore when using array to speed it up
                    value: ['32', '56'] as any
                }
            ]
        });
        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
    });

    it('simple IN operator test with array, search agains dates with OR logical operator', () => {
        ds.filter({
            logicalOperator: 'OR',
            filterArguments: [
                {
                    attribute: 'born',
                    operator: 'IN',
                    attributeType: 'date', // no automatic anymore when using array to speed it up
                    value: [new Date(2000, 0, 1), new Date(1995, 0, 1)].map((x) =>
                        ds.getValueFormater().fromSource(x, 'date', 'x')
                    ) as any
                },
                {
                    attribute: 'age',
                    operator: 'IN',
                    attributeType: 'number', // no automatic anymore when using array to speed it up
                    value: ['23', '32', '56'] as any
                }
            ]
        });
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });
});
