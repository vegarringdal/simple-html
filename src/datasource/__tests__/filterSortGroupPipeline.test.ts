import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

/**
 * The datasource keeps three collections: all data -> filtered -> displayed.
 * Sorting and grouping both rebuild "displayed" from "filtered", so the risky part is
 * what happens when filter, sort and grouping are combined and re-run in different orders.
 *
 * The existing tests cover each of the three on its own, these cover the interactions.
 */

const data = () => [
    { company: 'comp2', product: 'group1', qty: 3, name: 'e' },
    { company: 'comp1', product: 'group2', qty: 1, name: 'b' },
    { company: 'comp1', product: 'group1', qty: 5, name: 'a' },
    { company: 'comp2', product: 'group2', qty: 2, name: 'd' },
    { company: 'comp1', product: 'group1', qty: 4, name: 'c' }
];

const build = () => {
    const ds = new Datasource();
    ds.setData(data());
    return ds;
};

const names = (ds: Datasource) => ds.getRows().map((r: any) => r.name);
const dataRowNames = (ds: Datasource) => ds.getRows(true).map((r: any) => r.name);

describe('pipeline - filter then sort', () => {
    it('expect sorting to apply to the filtered rows only', () => {
        const ds = build();
        ds.filter([{ attribute: 'company', operator: 'EQUAL', value: 'comp1' }] as any);
        ds.sort([{ attribute: 'name', ascending: true }]);

        expect(names(ds)).toEqual(['a', 'b', 'c']);
    });

    it('expect the sort to survive a later filter change', () => {
        const ds = build();
        ds.sort([{ attribute: 'name', ascending: false }]);
        ds.filter([{ attribute: 'company', operator: 'EQUAL', value: 'comp1' }] as any);

        expect(names(ds)).toEqual(['c', 'b', 'a']);
    });

    it('expect clearing the filter to keep the sort applied to all rows', () => {
        const ds = build();
        ds.sort([{ attribute: 'name', ascending: true }]);
        ds.filter([{ attribute: 'company', operator: 'EQUAL', value: 'comp1' }] as any);
        ds.setFilter(null);
        ds.filter();

        expect(names(ds)).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('expect length() to report displayed rows and length(true) the filtered rows', () => {
        const ds = build();
        ds.filter([{ attribute: 'company', operator: 'EQUAL', value: 'comp1' }] as any);

        expect(ds.length()).toEqual(3);
        expect(ds.length(true)).toEqual(3);
    });
});

describe('pipeline - filter then group', () => {
    it('expect grouping to only contain filtered rows', () => {
        const ds = build();
        ds.filter([{ attribute: 'company', operator: 'EQUAL', value: 'comp1' }] as any);
        ds.group([{ attribute: 'product' }] as any);
        ds.expandGroup();

        expect(dataRowNames(ds).sort()).toEqual(['a', 'b', 'c']);
    });

    it('expect a filter applied after grouping to rebuild the groups', () => {
        const ds = build();
        ds.group([{ attribute: 'company' }] as any);
        expect(ds.getRows()).toHaveLength(2);

        ds.filter([{ attribute: 'company', operator: 'EQUAL', value: 'comp1' }] as any);

        expect(ds.getRows().filter((r: any) => r.__group)).toHaveLength(1);
    });

    it('expect a filter matching nothing to leave no groups', () => {
        const ds = build();
        ds.group([{ attribute: 'company' }] as any);
        ds.filter([{ attribute: 'company', operator: 'EQUAL', value: 'nope' }] as any);

        expect(ds.getRows()).toHaveLength(0);
    });
});

describe('pipeline - grouping with sorting', () => {
    it('expect the group attribute to lead the sort order', () => {
        const ds = build();
        ds.sort([{ attribute: 'name', ascending: true }]);
        ds.group([{ attribute: 'company' }] as any);
        ds.expandGroup();

        const rows = ds.getRows();
        expect(rows[0].__groupName).toContain('comp1');
    });

    it('expect a sort inside a group to be kept', () => {
        const ds = build();
        ds.group([{ attribute: 'company' }] as any);
        ds.sort([{ attribute: 'name', ascending: false }]);
        ds.expandGroup();

        const comp1 = ds
            .getRows()
            .filter((r: any) => !r.__group && r.company === 'comp1')
            .map((r: any) => r.name);
        expect(comp1).toEqual(['c', 'b', 'a']);
    });

    it('expect multi level grouping to nest', () => {
        const ds = build();
        ds.group([{ attribute: 'company' }, { attribute: 'product' }] as any);
        ds.expandGroup();

        const levels = ds
            .getRows()
            .filter((r: any) => r.__group)
            .map((r: any) => r.__groupLvl);
        expect(Math.max(...levels)).toBeGreaterThan(Math.min(...levels));
    });

    it('expect every data row to still be reachable when fully expanded', () => {
        const ds = build();
        ds.group([{ attribute: 'company' }, { attribute: 'product' }] as any);
        ds.expandGroup();

        expect(dataRowNames(ds).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
});

describe('pipeline - expanded state', () => {
    it('expect getExpanded to round trip through setExpanded', () => {
        const ds = build();
        ds.group([{ attribute: 'company' }] as any);
        ds.expandGroup();
        const expanded = ds.getExpanded();
        expect(expanded.length).toBeGreaterThan(0);

        const ds2 = build();
        ds2.setExpanded(expanded);
        ds2.group([{ attribute: 'company' }] as any);

        expect(ds2.getExpanded()).toEqual(expanded);
    });

    it('expect collapseGroup to clear the expanded ids', () => {
        const ds = build();
        ds.group([{ attribute: 'company' }] as any);
        ds.expandGroup();
        ds.collapseGroup();

        expect(ds.getExpanded()).toHaveLength(0);
    });
});

describe('pipeline - setData with active filter/sort/grouping', () => {
    it('expect new data to be sorted with the existing sort', () => {
        const ds = build();
        ds.sort([{ attribute: 'name', ascending: true }]);

        ds.setData([{ company: 'comp3', product: 'group3', qty: 9, name: 'aa' }], false, true);

        expect(names(ds)).toEqual(['aa']);
    });

    it('expect a rerun filter to apply to newly added data', () => {
        const ds = build();
        ds.filter([{ attribute: 'company', operator: 'EQUAL', value: 'comp1' }] as any);
        expect(ds.length()).toEqual(3);

        ds.setData([{ company: 'comp1', product: 'group9', qty: 9, name: 'new' }], true, true);

        expect(ds.length()).toEqual(4);
    });

    it('expect reloadDatasource to reapply the current filter', () => {
        const ds = build();
        ds.filter([{ attribute: 'company', operator: 'EQUAL', value: 'comp1' }] as any);
        ds.reloadDatasource();

        expect(ds.length()).toEqual(3);
    });
});

describe('pipeline - getFilterString', () => {
    it('expect an empty filter to give an empty string', () => {
        const ds = build();
        expect(ds.getFilterString()).toEqual('');
    });

    it('expect a simple filter to be described', () => {
        const ds = build();
        ds.filter([{ attribute: 'company', operator: 'EQUAL', value: 'comp1' }] as any);

        const text = ds.getFilterString();
        expect(text).toContain('COMPANY');
        expect(text).toContain('COMP1');
    });
});
