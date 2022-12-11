import { Datasource } from '../dataSource';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { company: 'comp5', product: 'group2', index: 1 },
    { company: 'comp5', product: 'group2', index: 2 },
    { company: 'comp1', product: 'group1', index: 3 },
    { company: 'comp3', product: 'group1', index: 4 },
    { company: 'comp3', product: 'group1', index: 5 }
];

let ds: Datasource;

describe('string filter', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('single group - company', (done) => {
        ds.group([{ attribute: 'company', title: 'Company' }]);
        const rows = ds.getRows();
        expect(rows.length).toEqual(3);

        expect(rows[0].__groupName).toEqual('Company: comp1');
        expect(rows[1].__groupName).toEqual('Company: comp3');
        expect(rows[2].__groupName).toEqual('Company: comp5');
        done();
    });

    it('single group - product', (done) => {
        ds.group([{ attribute: 'product', title: 'Product' }]);
        const rows = ds.getRows();
        expect(rows.length).toEqual(2);

        expect(rows[0].__groupName).toEqual('Product: group1');
        expect(rows[1].__groupName).toEqual('Product: group2');
        done();
    });

    it('single group - company - expand all & collpse all', (done) => {
        ds.group([{ attribute: 'company', title: 'Company' }]);
        const rows1 = ds.getRows();
        expect(rows1.length).toEqual(3);

        ds.expandGroup();
        const rows2 = ds.getRows();
        expect(rows2.length).toEqual(8);
        expect((rows2[3] as any).company).toEqual('comp3');

        ds.collapseGroup();
        const rows3 = ds.getRows();
        expect(rows3.length).toEqual(3);

        done();
    });

    it('single group - company - expand first', (done) => {
        ds.group([{ attribute: 'company', title: 'Company' }]);
        const rows1 = ds.getRows();
        expect(rows1.length).toEqual(3);

        ds.expandGroup(rows1[0].__groupID);
        const rows2 = ds.getRows();
        expect(rows2.length).toEqual(4);
        expect((rows2[1] as any).company).toEqual('comp1');

        ds.collapseGroup(rows2[0].__groupID);
        const rows3 = ds.getRows();
        expect(rows3.length).toEqual(3);
        done();
    });

    it('remove groups', (done) => {
        ds.group([{ attribute: 'company', title: 'Company' }]);
        const rows1 = ds.getRows();
        expect(rows1.length).toEqual(3);
        ds.removeGroup();
        expect(ds.getRows().length).toEqual(5);
        done();
    });
});
