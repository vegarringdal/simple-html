import { Datasource } from '../src/dataSource';

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

    it('string with wilcard (EQUAL)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'EQUAL',
            value: 'per*on2'
        });

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
        done();
    });

    it('string with wilcard (EQUAL)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'EQUAL',
            value: 'per%on2'
        });

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
        done();
    });

    it('string with wilcard (EQUAL)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'EQUAL',
            value: '%per%on2%'
        });

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
        done();
    });

    it('string with wilcard (EQUAL)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'EQUAL',
            value: '*per*on2*'
        });

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
        done();
    });

    it('string with wilcard (EQUAL)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'EQUAL',
            value: '*s*'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string with wilcard (EQUAL)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'EQUAL',
            value: '*ls*'
        });

        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
        done();
    });

    it('string with wilcard (NOT_EQUAL_TO)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'NOT_EQUAL_TO',
            value: '*ls*'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string with wilcard  (NOT_EQUAL_TO)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'NOT_EQUAL_TO',
            value: '*l*n'
        });
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string with wilcard  (NOT_EQUAL_TO)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'NOT_EQUAL_TO',
            value: '*l*s'
        });
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            /*  { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }, */
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string with wilcard  (BEGIN_WITH)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'BEGIN_WITH',
            value: 'per**'
        });
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            /*  { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }, */
            /*  { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }, */
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string with wilcard  (NOT_EQUAL_TO)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'NOT_EQUAL_TO',
            value: 'per**'
        });
        expect(ds.getRows()).toEqual([
            /*   { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }, */
            /*     { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }, */
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
            /* { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 } */
        ]);
        done();
    });

    it('string with wilcard  (NOT_EQUAL_TO)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'NOT_EQUAL_TO',
            value: '*per**'
        });
        expect(ds.getRows()).toEqual([
            /*   { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }, */
            /*     { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }, */
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
            /* { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 } */
        ]);
        done();
    });

    it('string with wilcard  (BEGIN_WITH)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'BEGIN_WITH',
            value: '*p*e*r**'
        });
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            /*  { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }, */
            /*  { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }, */
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string with wilcard  (BEGIN_WITH)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'BEGIN_WITH',
            value: 'per*'
        });
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            /*  { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }, */
            /*  { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }, */
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string with wilcard  (BEGIN_WITH)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'END_WITH',
            value: 'n'
        });
        expect(ds.getRows()).toEqual([
            /*    { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }, */
            /*  { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }, */
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
            /*  { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 } */
        ]);
        done();
    });
});
