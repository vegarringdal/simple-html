import { Datasource } from '../src/dataSource';

const simpleArray = [
    { name: 'person1' },
    { name: 'person2' },
    { name: 'person3' },
    { name: 'person4' },
    { name: 'person5' }
];

let datasource: Datasource;

describe('datasource selection', () => {
    beforeAll(() => {
        datasource = new Datasource();
        datasource.setData(simpleArray.slice());
    });

    it('expect currentEntity to be null by default', (done) => {
        expect(datasource.currentEntity).toEqual(null);
        done();
    });

    it('expect select() to set currentEntity to first entity in collection [0]', (done) => {
        datasource.select();
        expect(datasource.currentEntity).toEqual(simpleArray[0]);
        done();
    });

    it('expect selectLast() to set currentEntity to last entity [4]', (done) => {
        datasource.selectLast();
        expect(datasource.currentEntity).toEqual(simpleArray[4]);
        done();
    });

    it('expect selectFirst() to set currentEntity to first entity [0]', (done) => {
        datasource.selectFirst();
        expect(datasource.currentEntity).toEqual(simpleArray[0]);
        done();
    });

    it('expect selectNext() to set currentEntity to next entity [1]', (done) => {
        datasource.selectNext();
        expect(datasource.currentEntity).toEqual(simpleArray[1]);
        done();
    });

    it('expect selectNext() to set currentEntity to next entity [2]', (done) => {
        datasource.selectNext();
        expect(datasource.currentEntity).toEqual(simpleArray[2]);
        done();
    });

    it('expect selectPrev() to set currentEntity to next entity [1]', (done) => {
        datasource.selectPrev();
        expect(datasource.currentEntity).toEqual(simpleArray[1]);
        done();
    });

    it('expect selectLast() + selectNext() to set currentEntity to first [0]', (done) => {
        datasource.selectLast();
        datasource.selectNext();
        expect(datasource.currentEntity).toEqual(simpleArray[0]);
        done();
    });

    it('expect selectFist() + selectPrev() to set currentEntity to first [4]', (done) => {
        datasource.selectFirst();
        datasource.selectPrev();
        expect(datasource.currentEntity).toEqual(simpleArray[4]);
        done();
    });

    // todo clear currentEntity on filter ?
});
