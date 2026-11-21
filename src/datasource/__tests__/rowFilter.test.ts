import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { type Entity, isGroupRow } from '../entity';
import { where } from '../filterExpression';

/**
 * The grid's own filter of the rows, `__setRowFilter(keep)`: Find's "Filter rows" shows only the rows
 * with a match. On top of the filter and of changed rows only (AND), not part of the filter; set
 * without running it, applied whenever the rows are filtered - not by a sort, a grouping or an edit.
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
    const datasource = new Datasource<Person>({ key: 'id', fields: { id: 'number', age: 'number' } });
    datasource.setData(people());
    return datasource;
}

/** the ids of the displayed data rows, in order */
const shown = (datasource: Datasource<Person>) => datasource.getDataRows().map((row) => row.id);

/** the rows with an n in the name: Ann, Dan - what a find of "n" in the names would keep */
const withN = (row: Entity) => String(row.name).toLowerCase().includes('n');

describe('the row filter - the datasource', () => {
    it('expect every row without one', () => {
        expect(shown(create())).toEqual([1, 2, 3, 4, 5]);
    });

    it('expect it set without running, as setFilter(): filter() runs it', () => {
        const datasource = create();

        datasource.__setRowFilter(withN);
        expect(shown(datasource)).toEqual([1, 2, 3, 4, 5]);

        datasource.filter();
        expect(shown(datasource)).toEqual([1, 4]);
        expect(datasource.length()).toBe(2);
        // the rows there are stay
        expect(datasource.getAllData()).toHaveLength(5);
    });

    it('expect every row again when it is removed and the rows are filtered', () => {
        const datasource = create();
        datasource.__setRowFilter(withN);
        datasource.filter();

        datasource.__setRowFilter(null);
        datasource.filter();

        expect(shown(datasource)).toEqual([1, 2, 3, 4, 5]);
    });

    it('expect collection-filtered, as filter() sends', () => {
        const datasource = create();
        const infos: string[] = [];
        datasource.on('collection-filtered', (data) => infos.push(data.info));

        datasource.__setRowFilter(withN);
        datasource.filter();

        expect(infos).toEqual(['filter']);
    });

    it('expect it ANDed with the filter, and not part of it: getFilter(), getFilterString() and the filter tree do not have it', () => {
        const datasource = create();
        const norway = where('country', 'EQUAL', 'Norway');
        datasource.__setRowFilter(withN);

        datasource.filter(norway);

        // Ann is in Norway, Dan in Sweden
        expect(shown(datasource)).toEqual([1]);
        expect(datasource.getFilter()).toBe(norway);
        expect(datasource.getFilterString()).toEqual("([COUNTRY] <<EQUAL_TO>> 'NORWAY')");
        // the tree the footer shows: as with the filter alone
        const filterOnly = create();
        filterOnly.filter(norway);
        expect(datasource.getFilterTree()).toEqual(filterOnly.getFilterTree());

        // a new filter keeps it, no filter shows every row it keeps
        datasource.filter(null);
        expect(shown(datasource)).toEqual([1, 4]);
        expect(datasource.getFilter()).toBeNull();
        expect(datasource.getFilterString()).toEqual('');
    });

    it('expect it ANDed with changed rows only, and changed only to stay as it is', () => {
        const datasource = create();
        const [ann, bob] = datasource.getAllData();
        ann.age = 37;
        bob.age = 18;
        datasource.__setRowFilter(withN);

        datasource.filterChangedOnly(true);

        // Ann and Bob are changed, Ann has an n
        expect(shown(datasource)).toEqual([1]);
        expect(datasource.isChangedOnly()).toBe(true);

        datasource.filterChangedOnly(false);
        expect(shown(datasource)).toEqual([1, 4]);
    });

    it('expect a sort to sort the rows it keeps, and not to run it again', () => {
        const datasource = create();
        datasource.__setRowFilter(withN);
        datasource.filter();
        // edited: it does not match any more, a sort does not filter
        datasource.getAllData()[0].name = 'Bea';

        datasource.sort({ attribute: 'age', ascending: false });

        expect(shown(datasource)).toEqual([4, 1]);
    });

    it('expect the groups to have the rows it keeps, and their counts', () => {
        const datasource = create();
        datasource.__setRowFilter((row) => row.age > 30);
        datasource.filter();

        datasource.group([{ attribute: 'country', title: 'Country' }]);
        datasource.expandGroup();

        const groups = datasource
            .getRows()
            .filter(isGroupRow)
            .map((row) => [row.__groupName, row.__groupTotal]);
        // Ann and Cid in Norway, Dan in Sweden: Bob (17) and Eve (28) are left out
        expect(groups).toEqual([
            ['Country: Norway', 2],
            ['Country: Sweden', 1]
        ]);
        expect(shown(datasource)).toEqual([1, 3, 4]);
    });

    it('expect the aggregates of the rows it keeps', () => {
        const datasource = create();
        datasource.__setRowFilter(withN);
        datasource.filter();

        // Ann 36, Dan 40
        expect(datasource.aggregate('age', 'sum')).toBe(76);
        expect(datasource.aggregate('age', 'count')).toBe(2);
    });

    it('expect setData() to apply it to the new rows, unless refilter is false', () => {
        const datasource = create();
        datasource.__setRowFilter(withN);
        datasource.filter();

        datasource.setData([...people(), { id: 6, name: 'Nina', country: 'Norway', age: 30 }]);
        expect(shown(datasource)).toEqual([1, 4, 6]);

        datasource.setData([{ id: 7, name: 'Gus', country: 'Norway', age: 30 }], { add: true });
        expect(shown(datasource)).toEqual([1, 4, 6]);

        datasource.setData([{ id: 8, name: 'Hal', country: 'Norway', age: 30 }], { add: true, refilter: false });
        expect(shown(datasource)).toEqual([1, 4, 6, 8]);
    });

    it('expect upsert() to apply it: a row the server changed so it matches comes, one that no longer matches goes', () => {
        const datasource = create();
        datasource.__setRowFilter(withN);
        datasource.filter();

        datasource.upsert([
            { id: 2, name: 'Bono' },
            { id: 4, name: 'Dave' }
        ]);
        expect(shown(datasource)).toEqual([1, 2]);

        // refilter false: the rows shown stay
        datasource.upsert([{ id: 1, name: 'Abe' }], { refilter: false });
        expect(shown(datasource)).toEqual([1, 2]);
    });

    it('expect an edit not to run it: the row stays until the rows are filtered next, then it goes', () => {
        const datasource = create();
        datasource.__setRowFilter(withN);
        datasource.filter();

        datasource.getAllData()[0].name = 'Bea';
        expect(shown(datasource)).toEqual([1, 4]);

        datasource.filter();
        expect(shown(datasource)).toEqual([4]);
    });

    it('expect reloadDatasource() and removeData() to apply it', () => {
        const datasource = create();
        datasource.__setRowFilter(withN);
        datasource.filter();
        // edited in the container directly: no filter runs
        datasource.getDataContainer().getDataSet()[1].name = 'Bonnie';

        datasource.reloadDatasource();
        expect(shown(datasource)).toEqual([1, 2, 4]);

        datasource.removeData(datasource.getAllData()[0]);
        expect(shown(datasource)).toEqual([2, 4]);
    });

    it('expect a new row (addNewEmpty) to be shown, as with any filter, until the rows are filtered next', () => {
        const datasource = create();
        datasource.__setRowFilter(withN);
        datasource.filter();

        datasource.addNewEmpty({ name: 'Zed' }, { scrollTo: false });
        expect(datasource.getDataRows().map((row) => row.name)).toEqual(['Ann', 'Dan', 'Zed']);

        datasource.filter();
        expect(datasource.getDataRows().map((row) => row.name)).toEqual(['Ann', 'Dan']);
    });

    it('expect the selection and the current row as a filter that keeps the same rows leaves them', () => {
        // Bob selected and the current row: a filter on "n" in the name leaves him out
        const prepare = () => {
            const datasource = create();
            datasource.select(2);
            datasource.setRowAsCurrentEntity(1);
            return datasource;
        };
        const state = (datasource: Datasource<Person>) => ({
            shown: shown(datasource),
            selected: datasource.getSelectedRows().map((row) => row.id),
            current: datasource.currentEntity?.id ?? null
        });
        const byRowFilter = prepare();
        const byFilter = prepare();

        byRowFilter.__setRowFilter(withN);
        byRowFilter.filter();
        byFilter.filter(where('name', 'CONTAINS', 'n'));

        expect(state(byRowFilter).shown).toEqual([1, 4]);
        expect(state(byRowFilter)).toEqual(state(byFilter));

        byRowFilter.__setRowFilter(null);
        byRowFilter.filter();
        byFilter.filter(null);
        expect(state(byRowFilter)).toEqual(state(byFilter));
    });
});
