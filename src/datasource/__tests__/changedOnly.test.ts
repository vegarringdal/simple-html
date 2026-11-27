import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { isGroupRow } from '../entity';
import { and, where } from '../filterExpression';

/**
 * "Changed rows only": `filterChangedOnly(on)` shows the new, edited and deleted rows of the rows the
 * filter lets through - AND, on top of the filter, not part of it. Applied when the rows are filtered.
 */

interface Person {
    id: number;
    name: string;
    country: string;
    age: number;
}

const people = (): Person[] => [
    { id: 1, name: 'Ann', country: 'Norway', age: 36 },
    { id: 2, name: 'Bob', country: 'Sweden', age: 17 },
    { id: 3, name: 'Cid', country: 'Norway', age: 52 },
    { id: 4, name: 'Dan', country: 'Sweden', age: 40 },
    { id: 5, name: 'Eve', country: 'Norway', age: 28 }
];

function create() {
    const datasource = new Datasource<Person>({ key: 'id', fields: { age: 'number' } });
    datasource.setData(people());
    return datasource;
}

/** the ids of the displayed data rows, in order. A new row's id is generated, a negative number: 'new' */
const shown = (datasource: Datasource<Person>) => datasource.getDataRows().map((row) => (row.id < 0 ? 'new' : row.id));

/** Ann edited, Cid marked for deletion, a new row: Bob, Dan and Eve as they were */
function change(datasource: Datasource<Person>) {
    const [ann, , cid] = datasource.getAllData();
    ann.name = 'Anna';
    datasource.markForDeletion(cid);
    datasource.addNewEmpty({ name: 'New', country: 'Norway' }, { scrollTo: false });
}

describe('changed rows only - the datasource', () => {
    it('expect it off by default', () => {
        expect(create().isChangedOnly()).toBe(false);
    });

    it('expect the new, edited and deleted rows, not the rows as they were', () => {
        const datasource = create();
        change(datasource);

        datasource.filterChangedOnly(true);

        expect(datasource.isChangedOnly()).toBe(true);
        expect(shown(datasource)).toEqual([1, 3, 'new']);
        expect(datasource.length()).toBe(3);
    });

    it('expect every row again when turned off', () => {
        const datasource = create();
        change(datasource);
        datasource.filterChangedOnly(true);

        datasource.filterChangedOnly(false);

        expect(datasource.isChangedOnly()).toBe(false);
        expect(shown(datasource)).toEqual([1, 2, 3, 4, 5, 'new']);
    });

    it('expect collection-filtered, as filter() sends', () => {
        const datasource = create();
        const infos: string[] = [];
        datasource.on('collection-filtered', (data) => infos.push(data.info));

        datasource.filterChangedOnly(true);

        expect(infos).toEqual(['filter']);
    });

    it('expect it ANDed with the filter, and not part of it: getFilter() and getFilterString() do not have it', () => {
        const datasource = create();
        change(datasource);
        const norway = where('country', 'EQUAL', 'Norway');
        datasource.filter(norway);

        datasource.filterChangedOnly(true);

        // Ann (Norway, edited), Cid (Norway, deleted), the new row (Norway)
        expect(shown(datasource)).toEqual([1, 3, 'new']);
        expect(datasource.getFilter()).toBe(norway);
        expect(datasource.getFilterString()).toEqual("([COUNTRY] <<EQUAL_TO>> 'NORWAY')");
    });

    it('expect a new filter to keep it on', () => {
        const datasource = create();
        change(datasource);
        datasource.filterChangedOnly(true);

        datasource.filter(and(where('age', 'GREATER_THAN', 30)));
        expect(datasource.isChangedOnly()).toBe(true);
        // the new row has no age: 0 is not greater than 30
        expect(shown(datasource)).toEqual([1, 3]);

        datasource.filter(null);
        expect(shown(datasource)).toEqual([1, 3, 'new']);
    });

    it('expect it to stay on after setData(): the new rows are not changed, nothing is shown', () => {
        const datasource = create();
        change(datasource);
        datasource.filterChangedOnly(true);

        datasource.setData(people());

        expect(datasource.isChangedOnly()).toBe(true);
        expect(shown(datasource)).toEqual([]);
        expect(datasource.getAllData()).toHaveLength(5);
    });

    it('expect rows added with setData({ add: true }) to be filtered too, unless refilter is false', () => {
        const datasource = create();
        datasource.getAllData()[0].name = 'Anna';
        datasource.filterChangedOnly(true);

        datasource.setData([{ id: 6, name: 'Fay', country: 'Norway', age: 30 }], { add: true });
        expect(shown(datasource)).toEqual([1]);

        datasource.setData([{ id: 7, name: 'Gus', country: 'Norway', age: 30 }], { add: true, refilter: false });
        expect(shown(datasource)).toEqual([1, 7]);
    });

    it('expect reloadDatasource() to apply it', () => {
        const datasource = create();
        datasource.filterChangedOnly(true);
        // edited in the container directly: no filter runs
        datasource.getDataContainer().getDataSet()[1].name = 'Bobby';
        expect(shown(datasource)).toEqual([]);

        datasource.reloadDatasource();

        expect(shown(datasource)).toEqual([2]);
    });

    it('expect a row edited back to stay until the rows are filtered again, then to drop out', () => {
        const datasource = create();
        const ann = datasource.getAllData()[0];
        ann.name = 'Anna';
        datasource.filterChangedOnly(true);
        expect(shown(datasource)).toEqual([1]);

        // an edit does not filter: the row does not disappear while the user types in it
        ann.name = 'Ann';
        expect(ann.__rowState).toBeUndefined();
        expect(shown(datasource)).toEqual([1]);

        datasource.filter();
        expect(shown(datasource)).toEqual([]);
    });

    it('expect a row edited while it is not shown to come in on the next filter run', () => {
        const datasource = create();
        datasource.filterChangedOnly(true);
        datasource.getAllData()[3].age = 41;
        expect(shown(datasource)).toEqual([]);

        datasource.filter();

        expect(shown(datasource)).toEqual([4]);
    });

    it('expect marking and unmarking for deletion to filter: a row unmarked without edits drops out', () => {
        const datasource = create();
        datasource.filterChangedOnly(true);
        const bob = datasource.getAllData()[1];

        datasource.markForDeletion(bob);
        expect(shown(datasource)).toEqual([2]);

        datasource.unmarkForDeletion(bob);
        expect(shown(datasource)).toEqual([]);
    });

    it('expect nothing after acceptChanges(): nothing is changed', () => {
        const datasource = create();
        change(datasource);
        datasource.filterChangedOnly(true);

        datasource.acceptChanges();

        expect(shown(datasource)).toEqual([]);
        expect(datasource.isChangedOnly()).toBe(true);
    });

    it('expect the undo of an edit not to filter: the row stays until the next filter run', () => {
        const datasource = create();
        const ann = datasource.getAllData()[0];
        ann.name = 'Anna';
        datasource.filterChangedOnly(true);

        datasource.undo();

        expect(ann.name).toEqual('Ann');
        expect(shown(datasource)).toEqual([1]);
        datasource.filter();
        expect(shown(datasource)).toEqual([]);
    });

    it('expect the groups to have the changed rows only', () => {
        const datasource = create();
        change(datasource);
        datasource.group([{ attribute: 'country', title: 'Country' }]);
        datasource.expandGroup();

        datasource.filterChangedOnly(true);

        const rows = datasource
            .getRows()
            .map((row) => (isGroupRow(row) ? `${row.__groupName} (${row.__groupTotal})` : row.id < 0 ? 'new' : row.id));
        expect(rows).toEqual(['Country: Norway (3)', 1, 3, 'new']);
    });

    it('expect a new row added while it is on to be shown: it is changed', () => {
        const datasource = create();
        datasource.filterChangedOnly(true);

        datasource.addNewEmpty({ name: 'New' }, { scrollTo: false });

        expect(shown(datasource)).toEqual(['new']);
    });

    it('expect a datasource of its own: another datasource on the same container is not filtered', () => {
        const datasource = create();
        const other = new Datasource<Person>({ container: datasource.getDataContainer() });
        other.reloadDatasource();
        datasource.getAllData()[0].name = 'Anna';

        datasource.filterChangedOnly(true);
        other.reloadDatasource();

        expect(shown(datasource)).toEqual([1]);
        expect(other.getDataRows()).toHaveLength(5);
    });

    it('expect a filter on __rowState to give one state: the guide shows it for the new rows', () => {
        const datasource = create();
        change(datasource);

        datasource.filter(where('__rowState', 'IN', ['N']));
        expect(shown(datasource)).toEqual(['new']);

        datasource.filter(where('__rowState', 'IN', ['M', 'D']));
        expect(shown(datasource)).toEqual([1, 3]);
    });
});
