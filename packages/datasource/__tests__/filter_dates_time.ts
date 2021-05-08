import { Datasource } from '../src/dataSource';

const simpleArray = [
    { name: 'person2', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'person1', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    {
        name: 'person1',
        group: 'group1',
        age: 32,
        born: new Date(1990, 0, 1, 6, 12, 1, 200),
        index: 3
    },
    { name: 'person1', group: 'group1', age: 56, born: new Date(1995, 0, 1), index: 4 },
    { name: 'person4', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
];

let ds: Datasource;

describe('date filter equal, use only date and not time', () => {
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

        expect(ds.getRows()).toEqual([simpleArray[2]]);
        done();
    });
});

describe('date filter equal, use only date and not time', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('date equal to', (done) => {
        ds.filter({
            attribute: 'born',
            operator: 'NOT_EQUAL_TO',
            value: new Date(1990, 0, 1),
            attributeType: 'date'
        });
        expect(ds.getRows()).toEqual([
            simpleArray[0],
            simpleArray[1],
            simpleArray[3],
            simpleArray[4]
        ]);
        done();
    });
});

describe('date filter greater', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('date equal to', (done) => {
        ds.filter({
            attribute: 'born',
            operator: 'GREATER_THAN',
            value: new Date(1990, 0, 1),
            attributeType: 'date'
        });

        expect(ds.getRows()).toEqual([simpleArray[3], simpleArray[4]]);
        done();
    });
});

describe('date filter greater or equal', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('date equal to', (done) => {
        ds.filter({
            attribute: 'born',
            operator: 'GREATER_THAN_OR_EQUAL_TO',
            value: new Date(1990, 0, 1),
            attributeType: 'date'
        });

        expect(ds.getRows()).toEqual([simpleArray[2], simpleArray[3], simpleArray[4]]);
        done();
    });
});

describe('date filter less', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('date equal to', (done) => {
        ds.filter({
            attribute: 'born',
            operator: 'LESS_THAN',
            value: new Date(1990, 0, 1),
            attributeType: 'date'
        });

        expect(ds.getRows()).toEqual([simpleArray[0], simpleArray[1]]);
        done();
    });
});

describe('date filter less or equal', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('date equal to', (done) => {
        ds.filter({
            attribute: 'born',
            operator: 'LESS_THAN_OR_EQUAL_TO',
            value: new Date(1990, 0, 1),
            attributeType: 'date'
        });

        expect(ds.getRows()).toEqual([simpleArray[0], simpleArray[1], simpleArray[2]]);
        done();
    });
});

describe('date filter missing filer to use greater than or equal to', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('date equal to', (done) => {
        ds.filter({
            attribute: 'born',
            //            operator: 'GREATER_THAN',
            value: new Date(1990, 0, 1),
            attributeType: 'date'
        });

        expect(ds.getRows()).toEqual([simpleArray[2], simpleArray[3], simpleArray[4]]);
        done();
    });
});
