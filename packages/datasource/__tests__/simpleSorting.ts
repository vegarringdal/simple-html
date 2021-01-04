import { Datasource } from '../src/dataSource';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { name: 'person2', group: 'group2', localCompare: 'a', num: 3 },
    { name: 'person1', group: 'group2', localCompare: 'b', num: 1 },
    { name: 'person3', group: 'group1', localCompare: 'ø', num: 4 },
    { name: 'person5', group: 'group1', localCompare: 'æ', num: 5 },
    { name: 'person4', group: 'group1', localCompare: 'å', num: 2 }
];

let datasource: Datasource;

describe('datasource sort', () => {
    beforeAll(() => {
        datasource = new Datasource();
        datasource.setData(simpleArray.slice());
    });

    it('sort name ascending', (done) => {
        datasource.sort({ attribute: 'name', ascending: true });
        const obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person1');
        done();
    });

    it('sort name descending', (done) => {
        datasource.sort({ attribute: 'name', ascending: false });
        const obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person5');
        done();
    });

    it('sort group ascending, name ascending', (done) => {
        datasource.sort([
            { attribute: 'group', ascending: true },
            { attribute: 'name', ascending: true }
        ]);
        const obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person3');
        done();
    });

    it('sort group ascending, name descending', (done) => {
        datasource.sort([
            { attribute: 'group', ascending: true },
            { attribute: 'name', ascending: false }
        ]);
        const obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person5');
        done();
    });

    it('sort group descending, name ascending', (done) => {
        datasource.sort([
            { attribute: 'group', ascending: false },
            { attribute: 'name', ascending: true }
        ]);
        const obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person1');
        done();
    });

    it('sort group ascending, name descending', (done) => {
        datasource.sort([
            { attribute: 'group', ascending: false },
            { attribute: 'name', ascending: false }
        ]);
        const obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person2');
        done();
    });

    it('test adding to sort', (done) => {
        datasource.sort({ attribute: 'group', ascending: false });
        datasource.sort({ attribute: 'name', ascending: false }, true);

        let obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person2');

        //if we skip adding it will just sort name...
        datasource.sort({ attribute: 'name', ascending: false });
        obj = datasource.getRow(0);
        expect(obj.name).toEqual('person5');

        done();
    });

    it('local compare on string', (done) => {
        datasource.setLocalCompare('no'); // need node 14.xx.xx or new browser for this to work

        datasource.sort([{ attribute: 'localCompare', ascending: true }]);
        const arr: string[] = datasource.getRows().map((x: any) => x.localCompare);
        expect(arr).toEqual(['a', 'b', 'æ', 'ø', 'å']);
        done();
    });

    it('local compare on string2', (done) => {
        datasource.setLocalCompare('no'); // need node 14.xx.xx or new browser for this to work

        datasource.sort([{ attribute: 'localCompare', ascending: false }]);
        const arr: string[] = datasource.getRows().map((x: any) => x.localCompare);
        expect(arr).toEqual(['å', 'ø', 'æ', 'b', 'a']);
        done();
    });

    it('reset sort with default attribute', (done) => {
        datasource.resetSort('name');
        datasource.sort();
        expect((datasource.getRow(0) as any).name).toEqual('person1');
        done();
    });

    it('numbersort', (done) => {
        datasource.resetSort('num');
        datasource.sort();
        const arr: string[] = datasource.getRows().map((x: any) => x.num);
        expect(arr).toEqual([1, 2, 3, 4, 5]);
        done();
    });

    it('numbersort2', (done) => {
        datasource.sort({ attribute: 'num', ascending: false });
        const arr: string[] = datasource.getRows().map((x: any) => x.num);
        expect(arr).toEqual([1, 2, 3, 4, 5].reverse());
        done();
    });
});
