import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { isGroupRow } from '../entity';
import { where } from '../filterExpression';

/**
 * Bugs found while writing the v6 docs: the guides were checked against what the code does.
 */

// the groups are interleaved in the data, so they only come out right when the rows are sorted
const rows = () => [
    { id: 1, name: 'Ann', country: 'Norway', city: 'Oslo' },
    { id: 2, name: 'Bob', country: 'Sweden', city: 'Malmo' },
    { id: 3, name: 'Cid', country: 'Norway', city: 'Bergen' },
    { id: 4, name: 'Dan', country: 'Sweden', city: 'Malmo' },
    { id: 5, name: 'Eve', country: 'Norway', city: 'Oslo' }
];

const groupIds = (ds: Datasource) => ds.getRows().flatMap((row) => (isGroupRow(row) ? [row.__groupID] : []));
const names = (ds: Datasource) => ds.getRows().flatMap((row) => (isGroupRow(row) ? [] : [row.name]));

function datasourceWithRows() {
    const ds = new Datasource({ key: 'id' });
    ds.setData(rows());
    return ds;
}

describe('setData() runs the filter that is set', () => {
    it('expect replaced rows to be filtered', () => {
        const ds = datasourceWithRows();
        ds.filter(where('country', 'EQUAL', 'Norway'));

        ds.setData(rows());

        // used to show every row while the filter was still set
        expect(names(ds)).toEqual(['Ann', 'Cid', 'Eve']);
    });

    it('expect added rows to be filtered', () => {
        const ds = datasourceWithRows();
        ds.filter(where('country', 'EQUAL', 'Norway'));

        ds.setData(
            [
                { id: 6, name: 'Fay', country: 'Norway' },
                { id: 7, name: 'Gus', country: 'Denmark' }
            ],
            { add: true }
        );

        expect(names(ds)).toEqual(['Ann', 'Cid', 'Eve', 'Fay']);
    });

    it('expect { refilter: false } to show every row, the filter stays set', () => {
        const ds = datasourceWithRows();
        const filter = where('country', 'EQUAL', 'Norway');
        ds.filter(filter);

        ds.setData([{ id: 7, name: 'Gus', country: 'Denmark' }], { add: true, refilter: false });

        expect(names(ds)).toEqual(['Ann', 'Cid', 'Eve', 'Gus']);
        expect(ds.getFilter()).toBe(filter);
    });
});

describe('grouping always works on rows sorted by the grouped fields', () => {
    it('expect setGrouping() then filter() to build each group once', () => {
        const ds = datasourceWithRows();
        ds.setGrouping([{ attribute: 'country', title: 'Country' }]);

        ds.filter();

        // used to be Norway, Sweden, Norway, Sweden, Norway: a group per run of equal values
        expect(groupIds(ds)).toEqual(['Norway', 'Sweden']);
        expect(ds.getLastSorting()).toEqual([{ attribute: 'country', ascending: true }]);
    });

    it('expect setGrouping() then setData() to build each group once', () => {
        const ds = datasourceWithRows();
        ds.setGrouping([{ attribute: 'country', title: 'Country' }]);

        ds.setData(rows());

        expect(groupIds(ds)).toEqual(['Norway', 'Sweden']);
    });

    it('expect resetSort() while grouped to keep the rows sorted on the grouped fields', () => {
        const ds = datasourceWithRows();
        ds.group([{ attribute: 'country', title: 'Country' }]);

        ds.resetSort();
        ds.filter();

        expect(groupIds(ds)).toEqual(['Norway', 'Sweden']);
    });

    it('expect setOrderBy() while grouped to sort within the groups, the grouped field first', () => {
        const ds = datasourceWithRows();
        ds.setExpanded(['Norway', 'Sweden']);
        ds.group([{ attribute: 'country', title: 'Country' }]);

        ds.setOrderBy({ attribute: 'name', ascending: false });
        ds.filter();

        expect(groupIds(ds)).toEqual(['Norway', 'Sweden']);
        expect(names(ds)).toEqual(['Eve', 'Cid', 'Ann', 'Dan', 'Bob']);
        expect(ds.getLastSorting()).toEqual([
            { attribute: 'country', ascending: true },
            { attribute: 'name', ascending: false }
        ]);
    });

    it('expect the direction the sort gives a grouped field to be kept', () => {
        const ds = datasourceWithRows();
        ds.group([{ attribute: 'country', title: 'Country' }]);

        ds.setOrderBy([
            { attribute: 'name', ascending: true },
            { attribute: 'country', ascending: false }
        ]);
        ds.filter();

        expect(groupIds(ds)).toEqual(['Sweden', 'Norway']);
        expect(ds.getLastSorting()).toEqual([
            { attribute: 'country', ascending: false },
            { attribute: 'name', ascending: true }
        ]);
    });
});

describe('removeGroup() finds the group by its field', () => {
    it('expect a copy of a grouping to remove it', () => {
        const ds = datasourceWithRows();
        ds.group([
            { attribute: 'country', title: 'Country' },
            { attribute: 'city', title: 'City' }
        ]);

        // a copy, as from a saved state - used to remove nothing
        ds.removeGroup({ attribute: 'country', title: 'Country' });

        expect(ds.getGrouping()).toEqual([{ attribute: 'city', title: 'City' }]);
        expect(groupIds(ds)).toEqual(['Bergen', 'Malmo', 'Oslo']);
    });

    it('expect a field that is not grouped on to change nothing and send no event', () => {
        const ds = datasourceWithRows();
        ds.group([{ attribute: 'country', title: 'Country' }]);
        const sent: string[] = [];
        ds.on('collection-grouped', (data) => sent.push(data.info));

        ds.removeGroup({ attribute: 'city', title: 'City' });

        expect(ds.getGrouping()).toEqual([{ attribute: 'country', title: 'Country' }]);
        expect(sent).toEqual([]);
    });
});

describe('expandGroup() of a sub group', () => {
    it('expect the groups above it to be expanded too, so it is shown', () => {
        const ds = datasourceWithRows();
        ds.group([
            { attribute: 'country', title: 'Country' },
            { attribute: 'city', title: 'City' }
        ]);
        expect(groupIds(ds)).toEqual(['Norway', 'Sweden']);

        // used to do nothing while Norway was collapsed
        ds.expandGroup('Norway-Oslo');

        expect(groupIds(ds)).toEqual(['Norway', 'Norway-Bergen', 'Norway-Oslo', 'Sweden']);
        expect(names(ds)).toEqual(['Ann', 'Eve']);
        expect(ds.getExpanded().sort()).toEqual(['Norway', 'Norway-Oslo']);
    });

    it('expect an id that is no group to change nothing', () => {
        const ds = datasourceWithRows();
        ds.group([{ attribute: 'country', title: 'Country' }]);

        ds.expandGroup('Denmark');

        expect(groupIds(ds)).toEqual(['Norway', 'Sweden']);
        expect(ds.getExpanded()).toEqual([]);
    });
});

describe('currentEntity after setData()', () => {
    it('expect it to be cleared, with current-entity, when the rows are replaced', () => {
        const ds = datasourceWithRows();
        ds.select(1);
        expect(ds.currentEntity).not.toBeNull();
        const events: (object | null)[] = [];
        ds.on('current-entity', () => events.push(ds.currentEntity));

        // the same key comes back, but as a new object
        ds.setData(rows());

        expect(ds.currentEntity).toBeNull();
        expect(events).toEqual([null]);
    });

    it('expect it to stay when it is still in the data', () => {
        const ds = datasourceWithRows();
        ds.select(1);
        const current = ds.currentEntity;
        let events = 0;
        ds.on('current-entity', () => events++);

        ds.setData([{ id: 6, name: 'Fay', country: 'Norway' }], { add: true });
        ds.setData(ds.getAllData()); // the same row objects set again

        expect(ds.currentEntity).toBe(current);
        expect(events).toBe(0);
    });
});

describe('selectAll() and the selection mode', () => {
    it.each(['single', 'none'] as const)('expect it to select nothing and send nothing in %s mode', (mode) => {
        const ds = new Datasource({ key: 'id', selectionMode: mode });
        ds.setData(rows());
        let events = 0;
        ds.on('selection-change', () => events++);

        ds.selectAll();

        expect(ds.getSelectedRows()).toEqual([]);
        expect(events).toBe(0);
    });

    it('expect it to select every displayed row and send selection-change in multiple mode', () => {
        const ds = datasourceWithRows();
        let events = 0;
        ds.on('selection-change', () => events++);

        ds.selectAll();

        expect(ds.getSelectedRows().length).toBe(5);
        expect(events).toBe(1);
    });
});
