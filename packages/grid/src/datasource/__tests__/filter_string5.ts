import { Datasource } from '../dataSource';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    {
        name: `somef\n\r\cool\nthing`,
        group: 'group2',
        age: 23,
        born: new Date(1980, 0, 1),
        index: 1
    },
    { name: 'abcd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'cdef', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
    { name: 'tgyh', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
    { name: 'eref\n\r', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
];

let ds: Datasource;

describe('string filter', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('string with EQUAL - wildcard multiline', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'EQUAL',
            value: '*som*'
        });

        expect(ds.getRows()).toEqual([
            {
                name: `somef\n\r\cool\nthing`,
                group: 'group2',
                age: 23,
                born: new Date(1980, 0, 1),
                index: 1
            }
            /*   { name: 'abcd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'cdef', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'tgyh', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'eref\n\r', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 } */
        ]);
        done();
    });

    it('string with NOT_EQUAL_TO - wildcard multiline', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'NOT_EQUAL_TO',
            value: '*som*'
        });

        expect(ds.getRows()).toEqual([
            { name: 'abcd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'cdef', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            { name: 'tgyh', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'eref\n\r', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });

    it('string with NOT_EQUAL_TO - wildcard multiline', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'NOT_EQUAL_TO',
            value: '*ef*'
        });

        expect(ds.getRows()).toEqual([
            { name: 'abcd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },
            { name: 'tgyh', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }
        ]);
        done();
    });

    it('string with EQUAL - wildcard multiline', (done) => {
        ds.filter({
            attribute: 'name',
            operator: 'EQUAL',
            value: '*ef*'
        });

        expect(ds.getRows()).toEqual([
            {
                name: `somef\n\r\cool\nthing`,
                group: 'group2',
                age: 23,
                born: new Date(1980, 0, 1),
                index: 1
            },
            /*   { name: 'abcd', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 }, */
            { name: 'cdef', group: 'group2', age: 23, born: new Date(1980, 0, 1), index: 1 },
            /*     { name: 'tgyh', group: 'group2', age: 34, born: new Date(1985, 0, 1), index: 2 },  */
            { name: 'eref\n\r', group: 'group1', age: 55, born: new Date(2000, 0, 1), index: 5 }
        ]);
        done();
    });
});
