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

    it('or statement mpty', (done) => {
        ds.filter({
            logicalOperator: 'OR',
            filterArguments: []
        });
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, index: 1 },
            { name: 'person1', group: 'group2', age: 34, index: 2 },
            { name: 'person1', group: 'group1', age: 32, index: 3 },
            { name: 'person1', group: 'group1', age: 56, index: 4 },
            { name: 'person4', group: 'group1', age: 55, index: 5 }
        ]);
        expect(ds.getRows().length).toEqual(5);
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

    it('or statement with sub and statements', (done) => {
        ds.filter({
            logicalOperator: 'OR',
            filterArguments: [
                {
                    logicalOperator: 'AND',
                    filterArguments: [
                        { attribute: 'group', operator: 'EQUAL', value: 'group2' },
                        { attribute: 'name', operator: 'EQUAL', value: 'person2' }
                    ]
                },
                {
                    logicalOperator: 'AND',
                    filterArguments: [
                        { attribute: 'group', operator: 'EQUAL', value: 'group1' },
                        { attribute: 'name', operator: 'EQUAL', value: 'person4' }
                    ]
                }
            ]
        });
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, index: 1 },
            { name: 'person4', group: 'group1', age: 55, index: 5 }
        ]);
        done();
    });

    it('and statement with sub or statements', (done) => {
        ds.filter({
            logicalOperator: 'AND',
            filterArguments: [
                {
                    logicalOperator: 'OR',
                    filterArguments: [
                        { attribute: 'group', operator: 'EQUAL', value: 'group1' },
                        { attribute: 'name', operator: 'EQUAL', value: 'person2' }
                    ]
                },
                {
                    logicalOperator: 'OR',
                    filterArguments: [
                        { attribute: 'group', operator: 'EQUAL', value: 'group2' },
                        { attribute: 'name', operator: 'EQUAL', value: 'person4' }
                    ]
                }
            ]
        });
        expect(ds.getRows()).toEqual([
            { name: 'person2', group: 'group2', age: 23, index: 1 },
            { name: 'person4', group: 'group1', age: 55, index: 5 }
        ]);
        done();
    });
});
