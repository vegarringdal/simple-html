import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

/**
 * Datasource.__setSortValue: a field sorted on a text made from its value - the grid sorts a lookup
 * column on the label it shows (ColumnConfig.editor). The same text for two values is no tie: they
 * are sorted on the value after it, so grouping keeps a value's rows together.
 */

const LABELS: Record<string, string> = { NO: 'Norway', SE: 'Sweden', DK: 'Denmark', XX: 'Denmark' };
const label = (value: unknown) => (typeof value === 'string' ? (LABELS[value] ?? value) : '');

function datasource() {
    const ds = new Datasource();
    ds.setData([
        { id: 1, country: 'SE' },
        { id: 2, country: 'XX' },
        { id: 3, country: 'NO' },
        { id: 4, country: null },
        { id: 5, country: 'DK' },
        { id: 6, country: 'XX' }
    ]);
    return ds;
}

const countries = (ds: Datasource) => ds.getDataRows().map((row) => row.country);

describe('datasource - sorting on a text of the value', () => {
    it('expect the field sorted on the text, the same text sorted on the value after it, blanks first', () => {
        const ds = datasource();
        ds.__setSortValue('country', label);
        ds.sort({ attribute: 'country', ascending: true });
        expect(countries(ds)).toEqual([null, 'DK', 'XX', 'XX', 'NO', 'SE']);

        // descending flips both, so the blank is last
        ds.sort({ attribute: 'country', ascending: false });
        expect(countries(ds)).toEqual(['SE', 'NO', 'XX', 'XX', 'DK', null]);
    });

    it('expect the value again once the text is taken away', () => {
        const ds = datasource();
        ds.__setSortValue('country', label);
        expect(ds.__getSortValue('country')).toBe(label);
        ds.__setSortValue('country', null);
        expect(ds.__getSortValue('country')).toBeUndefined();
        ds.sort({ attribute: 'country', ascending: true });
        expect(countries(ds)).toEqual([null, 'DK', 'NO', 'SE', 'XX', 'XX']);
    });

    it('expect a grouping on the field to keep the rows of a value together, the groups in the order of the text', () => {
        const ds = datasource();
        ds.__setSortValue('country', label);
        ds.group([{ attribute: 'country', title: 'Country' }]);
        const groups = ds.getRows().map((row) => ('__groupName' in row ? String(row.__groupName) : null));
        expect(groups).toEqual(['Country: blank', 'Country: DK', 'Country: XX', 'Country: NO', 'Country: SE']);
    });

    it('expect the other fields of the sort to be as before', () => {
        const ds = datasource();
        ds.__setSortValue('country', label);
        ds.sort([
            { attribute: 'country', ascending: true },
            { attribute: 'id', ascending: false }
        ]);
        expect(ds.getDataRows().map((row) => row.id)).toEqual([4, 5, 6, 2, 3, 1]);
    });
});

describe('datasource - two sort texts of grids on one datasource', () => {
    it('expect the last given used, the one before it again when it is taken back', () => {
        const ds = datasource();
        const reversed = (value: unknown) => (typeof value === 'string' ? [...label(value)].reverse().join('') : '');
        ds.__setSortValue('country', label);
        ds.__setSortValue('country', reversed);
        expect(ds.__getSortValue('country')).toBe(reversed);
        ds.__unsetSortValue('country', reversed);
        expect(ds.__getSortValue('country')).toBe(label);
        ds.__unsetSortValue('country', label);
        expect(ds.__getSortValue('country')).toBeUndefined();
    });
});

describe('datasource - a field of values of more than one kind', () => {
    it('expect every value compared as its text: equal values next to each other, one order', () => {
        const ds = new Datasource();
        const date = new Date(2026, 0, 1);
        const values = [3, 10, date, 25, 100, 3, 10, null, 2];
        ds.setData(values.map((value, id) => ({ id, value })));
        ds.sort({ attribute: 'value', ascending: true });
        const sorted = ds.getDataRows().map((row) => row.value);
        // the text of each: "10" < "100" < "2" < "2026-01-01" < "25" < "3", the blank first
        expect(sorted).toEqual([null, 10, 10, 100, 2, date, 25, 3, 3]);
        // the same order whatever order the rows came in
        ds.setData([...values].reverse().map((value, id) => ({ id, value })));
        ds.sort({ attribute: 'value', ascending: true });
        expect(ds.getDataRows().map((row) => row.value)).toEqual(sorted);
    });

    it('expect values of one kind still compared as that kind: 3 before 10', () => {
        const ds = new Datasource({ fields: { value: 'number' } });
        ds.setData([10, 3, null, 25].map((value, id) => ({ id, value })));
        ds.sort({ attribute: 'value', ascending: true });
        expect(ds.getDataRows().map((row) => row.value)).toEqual([null, 3, 10, 25]);
    });
});
