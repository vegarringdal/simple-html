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
