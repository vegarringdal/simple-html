import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

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

    it('sort name ascending', () => {
        datasource.sort({ attribute: 'name', ascending: true });
        const obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person1');
    });

    it('sort name descending', () => {
        datasource.sort({ attribute: 'name', ascending: false });
        const obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person5');
    });

    it('sort group ascending, name ascending', () => {
        datasource.sort([
            { attribute: 'group', ascending: true },
            { attribute: 'name', ascending: true }
        ]);
        const obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person3');
    });

    it('sort group ascending, name descending', () => {
        datasource.sort([
            { attribute: 'group', ascending: true },
            { attribute: 'name', ascending: false }
        ]);
        const obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person5');
    });

    it('sort group descending, name ascending', () => {
        datasource.sort([
            { attribute: 'group', ascending: false },
            { attribute: 'name', ascending: true }
        ]);
        const obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person1');
    });

    it('sort group ascending, name descending', () => {
        datasource.sort([
            { attribute: 'group', ascending: false },
            { attribute: 'name', ascending: false }
        ]);
        const obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person2');
    });

    it('test adding to sort', () => {
        datasource.sort({ attribute: 'group', ascending: false });
        datasource.sort({ attribute: 'name', ascending: false }, { add: true });

        let obj: any = datasource.getRow(0);
        expect(obj.name).toEqual('person2');

        //if we skip adding it will just sort name...
        datasource.sort({ attribute: 'name', ascending: false });
        obj = datasource.getRow(0);
        expect(obj.name).toEqual('person5');
    });

    it('local compare on string', () => {
        datasource.setLocaleCompare('no'); // need node 14.xx.xx or new browser for this to work

        datasource.sort([{ attribute: 'localCompare', ascending: true }]);
        const arr: string[] = datasource.getRows().map((x: any) => x.localCompare);
        expect(arr).toEqual(['a', 'b', 'æ', 'ø', 'å']);
    });

    it('local compare on string2', () => {
        datasource.setLocaleCompare('no'); // need node 14.xx.xx or new browser for this to work

        datasource.sort([{ attribute: 'localCompare', ascending: false }]);
        const arr: string[] = datasource.getRows().map((x: any) => x.localCompare);
        expect(arr).toEqual(['å', 'ø', 'æ', 'b', 'a']);
    });

    it('reset sort with default attribute', () => {
        datasource.resetSort('name');
        datasource.sort();
        expect((datasource.getRow(0) as any).name).toEqual('person1');
    });

    it('numbersort', () => {
        datasource.resetSort('num');
        datasource.sort();
        const arr: string[] = datasource.getRows().map((x: any) => x.num);
        expect(arr).toEqual([1, 2, 3, 4, 5]);
    });

    it('numbersort2', () => {
        datasource.sort({ attribute: 'num', ascending: false });
        const arr: string[] = datasource.getRows().map((x: any) => x.num);
        expect(arr).toEqual([1, 2, 3, 4, 5].reverse());
    });
});

// a collator that calls two different strings equal (sensitivity 'base': 'a' and 'A'). The sort turned
// its 0 into 1 both ways round - 'a' after 'A' and 'A' after 'a' - so the order of such strings was the
// order they came in. They are put by their code points now: the same order whatever came first
describe('sorting with a collator that calls different strings equal', () => {
    const sorted = (names: string[], ascending: boolean) => {
        const datasource = new Datasource();
        datasource.setData(names.map((name) => ({ name })));
        datasource.setLocaleCompare('en', { sensitivity: 'base' });
        datasource.sort({ attribute: 'name', ascending });
        return datasource.getDataRows().map((row: any) => row.name);
    };

    it('expect the same order whatever order the rows came in', () => {
        expect(sorted(['b', 'a', 'B', 'A'], true)).toEqual(['A', 'a', 'B', 'b']);
        expect(sorted(['A', 'B', 'a', 'b'], true)).toEqual(['A', 'a', 'B', 'b']);
        expect(sorted(['a', 'A', 'b', 'B'], true)).toEqual(['A', 'a', 'B', 'b']);
    });

    it('expect descending to be the reverse', () => {
        expect(sorted(['a', 'b', 'A', 'B'], false)).toEqual(['b', 'B', 'a', 'A']);
        expect(sorted(['B', 'A', 'b', 'a'], false)).toEqual(['b', 'B', 'a', 'A']);
    });

    it('expect a group per value still: the collator does not merge groups', () => {
        const datasource = new Datasource();
        datasource.setData(['a', 'A', 'a'].map((name) => ({ name })));
        datasource.setLocaleCompare('en', { sensitivity: 'base' });
        datasource.group([{ attribute: 'name', title: 'Name' }]);

        expect(
            datasource
                .getRows()
                .filter((row: any) => row.__groupID)
                .map((row: any) => row.__groupTotal)
        ).toEqual([1, 2]);
    });
});
