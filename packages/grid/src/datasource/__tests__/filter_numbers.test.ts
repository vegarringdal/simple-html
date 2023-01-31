import { describe, beforeAll, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

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

    it('number equal to', () => {
        ds.filter({
            attribute: 'age',
            operator: 'EQUAL',
            value: 40,
            attributeType: 'number'
        });

        expect(ds.getRows()).toEqual([{ name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 }]);
    });

    it('number equal to, auto guess type based on input', () => {
        ds.filter({ attribute: 'age', operator: 'EQUAL', value: 40 });

        expect(ds.getRows()).toEqual([{ name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 }]);
    });

    it('number greater than ', () => {
        ds.filter({ attribute: 'age', operator: 'GREATER_THAN', value: 40 });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 67, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('number less than ', () => {
        ds.filter({ attribute: 'age', operator: 'LESS_THAN', value: 40 });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }
        ]);
    });

    it('number greater or equal than ', () => {
        ds.filter({
            attribute: 'age',
            operator: 'GREATER_THAN_OR_EQUAL_TO',
            value: 40
        });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 67, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('number less than ', () => {
        ds.filter({
            attribute: 'age',
            operator: 'LESS_THAN_OR_EQUAL_TO',
            value: 40
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 }
        ]);
    });

    it('number less than ', () => {
        ds.filter({
            attribute: 'age',
            operator: 'NOT_EQUAL_TO',
            value: 40
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 67, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('number contains will use greater or equal to ', () => {
        ds.filter({
            attribute: 'age',
            operator: 'CONTAINS',
            value: 40
        });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 67, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('number begin with will use greater or equal to ', () => {
        ds.filter({
            attribute: 'age',
            operator: 'BEGIN_WITH',
            value: 40
        });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 67, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('number end with will use less or equal to ', () => {
        ds.filter({
            attribute: 'age',
            operator: 'END_WITH',
            value: 40
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 }
        ]);
    });

    it('number does not cotains will use less than ', () => {
        ds.filter({
            attribute: 'age',
            operator: 'DOES_NOT_CONTAIN',
            value: 40
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }
        ]);
    });
});
