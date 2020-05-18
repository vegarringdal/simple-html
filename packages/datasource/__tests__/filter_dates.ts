import { Datasource } from '../src/dataSource';

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

    it('date equal to', (done) => {
        ds.filter({
            attribute: 'born',
            operator: 'EQUAL',
            value: new Date(1990, 0, 1),
            attributeType: 'date'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }
        ]);
        done();
    });

    it('date equal to, auto guess type based on input', (done) => {
        ds.filter({ attribute: 'born', operator: 'EQUAL', value: new Date(1990, 0, 1) });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }
        ]);
        done();
    });

    it('date greater than ', (done) => {
        ds.filter({ attribute: 'born', operator: 'GREATER_THAN', value: new Date(1990, 0, 1) });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('date less than ', (done) => {
        ds.filter({ attribute: 'born', operator: 'LESS_THAN', value: new Date(1990, 0, 1) });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }
        ]);
        done();
    });

    it('date greater or equal than ', (done) => {
        ds.filter({
            attribute: 'born',
            operator: 'GREATER_THAN_OR_EQUAL_TO',
            value: new Date(1990, 0, 1)
        });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('date less than ', (done) => {
        ds.filter({
            attribute: 'born',
            operator: 'LESS_THAN_OR_EQUAL_TO',
            value: new Date(1990, 0, 1)
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 }
        ]);
        done();
    });

    it('date less than ', (done) => {
        ds.filter({
            attribute: 'born',
            operator: 'NOT_EQUAL_TO',
            value: new Date(1990, 0, 1)
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('date contains will use greater or equal to ', (done) => {
        ds.filter({
            attribute: 'born',
            operator: 'CONTAINS',
            value: new Date(1990, 0, 1)
        });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('date begin with will use greater or equal to ', (done) => {
        ds.filter({
            attribute: 'born',
            operator: 'BEGIN_WITH',
            value: new Date(1990, 0, 1)
        });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('date end with will use greater or equal to ', (done) => {
        ds.filter({
            attribute: 'born',
            operator: 'END_WITH',
            value: new Date(1990, 0, 1)
        });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });
});
