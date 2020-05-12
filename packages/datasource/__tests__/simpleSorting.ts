import { Datasource } from '../src/dataSource';

const simpleArray = [
    { name: 'person2', group: 'group2' },
    { name: 'person1', group: 'group2' },
    { name: 'person3', group: 'group1' },
    { name: 'person5', group: 'group1' },
    { name: 'person4', group: 'group1' }
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
});
