import { Datasource } from '../src/dataSource';

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

    it('string equal to', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'EQUAL',
            value: 'person2'
        });

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
        done();
    });

    it('string not equal to', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'NOT_EQUAL_TO',
            value: 'person2'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 },
            { name: 'aperson4a', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string begin with ', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'BEGIN_WITH',
            value: 'person'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string end with ', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'END_WITH',
            value: 'n2'
        });

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
        done();
    });

    it('string constains ', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'CONTAINS',
            value: 'son'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 },
            { name: 'aperson4a', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string does not constains ', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'DOES_NOT_CONTAIN',
            value: 'son'
        });

        expect(ds.getRows()).toEqual([
            { name: 'Nils', group: 'group1', age: 32, born: new Date(1990, 0, 1), index: 3 },
            { name: 'Nilsman', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 }
        ]);
        done();
    });

    it('string equal with wildcard * (same as begin with)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'EQUAL',
            value: 'person*'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string equal with wildcard * (same as end with)', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'EQUAL',
            value: '*son2'
        });

        expect(ds.getRows()).toEqual([{ name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 }]);
        done();
    });

    it('string begin with & wildcard in the begining = contains', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'BEGIN_WITH',
            value: '*rson'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 },
            { name: 'aperson4a', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string end with wildcard in the end = contains', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'END_WITH',
            value: 'rson*'
        });

        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 },
            { name: 'aperson4a', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });
});
