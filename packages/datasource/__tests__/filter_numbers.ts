import { Datasource } from '../src/dataSource';

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

    it('number equal to', (done) => {
        ds.filter({
            attribute: 'age',
            operator: 'EQUAL',
            value: 40,
            attributeType: 'number'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 }
        ]);
        done();
    });

    it('number equal to, auto guess type based on input', (done) => {
        ds.filter({ attribute: 'age', operator: 'EQUAL', value: 40 });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 40, born: new Date(1990, 0, 1), index: 3 }
        ]);
        done();
    });

    it('number greater than ', (done) => {
        ds.filter({ attribute: 'age', operator: 'GREATER_THAN', value: 40 });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 67, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('number less than ', (done) => {
        ds.filter({ attribute: 'age', operator: 'LESS_THAN', value: 40 });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }
        ]);
        done();
    });

    it('number greater or equal than ', (done) => {
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
        done();
    });

    it('number less than ', (done) => {
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
        done();
    });

    it('number less than ', (done) => {
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
        done();
    });
});
