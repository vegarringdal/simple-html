import { Datasource } from '../src/dataSource';

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

    it('single', (done) => {
        ds.filter({ attribute: 'name', operator: 'EQUAL', value: 'person1' });
        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group2', age: 34, index: 2 },
            { name: 'person1', group: 'group1', age: 32, index: 3 },
            { name: 'person1', group: 'group1', age: 56, index: 4 }
        ]);
        done();
    });

    it('2 attributes, default to and', (done) => {
        ds.filter([
            { attribute: 'group', operator: 'EQUAL', value: 'group1' },
            { attribute: 'name', operator: 'EQUAL', value: 'person1' }
        ]);
        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group1', age: 32, index: 3 },
            { name: 'person1', group: 'group1', age: 56, index: 4 }
        ]);
        done();
    });

    it('or statement', (done) => {
        ds.filter({
            logicalOperator: 'OR',
            filterArguments: [
                { attribute: 'group', operator: 'EQUAL', value: 'group1' },
                { attribute: 'name', operator: 'EQUAL', value: 'person1' }
            ]
        });
        expect(ds.getRows()).toEqual([
            { name: 'person1', group: 'group2', age: 34, index: 2 },
            { name: 'person1', group: 'group1', age: 32, index: 3 },
            { name: 'person1', group: 'group1', age: 56, index: 4 },
            { name: 'person4', group: 'group1', age: 55, index: 5 }
        ]);
        expect(ds.getRows().length).toEqual(4);
        done();
    });
});
