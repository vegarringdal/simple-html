import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { where } from '../filterExpression';

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

    it('string with wilcard (EQUAL)', () => {
        ds.filter(where('name', 'EQUAL', 'per*on2'));

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
    });

    it('string with wilcard (EQUAL)', () => {
        ds.filter(where('name', 'EQUAL', 'per%on2'));

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
    });

    it('string with wilcard (EQUAL)', () => {
        ds.filter(where('name', 'EQUAL', '%per%on2%'));

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
    });

    it('string with wilcard (EQUAL)', () => {
        ds.filter(where('name', 'EQUAL', '*per*on2*'));

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
    });

    it('string with wilcard (EQUAL)', () => {
        ds.filter(where('name', 'EQUAL', '*s*'));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string with wilcard (EQUAL)', () => {
        ds.filter(where('name', 'EQUAL', '*ls*'));

        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
    });

    it('string with wilcard (NOT_EQUAL_TO)', () => {
        ds.filter(where('name', 'NOT_EQUAL_TO', '*ls*'));

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string with wilcard  (NOT_EQUAL_TO)', () => {
        ds.filter(where('name', 'NOT_EQUAL_TO', '*l*n'));
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string with wilcard  (NOT_EQUAL_TO)', () => {
        ds.filter(where('name', 'NOT_EQUAL_TO', '*l*s'));
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            /*  { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }, */
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string with wilcard  (BEGIN_WITH)', () => {
        ds.filter(where('name', 'BEGIN_WITH', 'per**'));
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            /*  { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }, */
            /*  { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }, */
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string with wilcard  (NOT_EQUAL_TO)', () => {
        ds.filter(where('name', 'NOT_EQUAL_TO', 'per**'));
        expect(ds.getRows()).toEqual([
            /*   { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }, */
            /*     { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }, */
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
            /* { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 } */
        ]);
    });

    it('string with wilcard  (NOT_EQUAL_TO)', () => {
        ds.filter(where('name', 'NOT_EQUAL_TO', '*per**'));
        expect(ds.getRows()).toEqual([
            /*   { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }, */
            /*     { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }, */
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
            /* { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 } */
        ]);
    });

    it('string with wilcard  (BEGIN_WITH)', () => {
        ds.filter(where('name', 'BEGIN_WITH', '*p*e*r**'));
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            /*  { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }, */
            /*  { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }, */
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string with wilcard  (BEGIN_WITH)', () => {
        ds.filter(where('name', 'BEGIN_WITH', 'per*'));
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            /*  { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }, */
            /*  { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }, */
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
    });

    it('string with wilcard  (BEGIN_WITH)', () => {
        ds.filter(where('name', 'END_WITH', 'n'));
        expect(ds.getRows()).toEqual([
            /*    { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }, */
            /*  { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }, */
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
            /*  { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 } */
        ]);
    });
});
