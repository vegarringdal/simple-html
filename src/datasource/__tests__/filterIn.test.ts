import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { or, where } from '../filterExpression';

/**
 * IN / NOT_IN compare the list and the row value as upper case text, the same in AND and OR groups.
 */

describe('IN filter - value types', () => {
    it('expect numbers in a text column to match the list (AND group)', () => {
        const ds = new Datasource();
        ds.setData([{ c: 5 }, { c: 6 }, { c: 'x' }]);
        ds.filter(where('c', 'IN', [5, 'X']));
        expect(ds.getRows().map((r) => r.c)).toEqual([5, 'x']);
    });

    it('expect NOT_IN with numbers in a text column to leave them out', () => {
        const ds = new Datasource();
        ds.setData([{ c: 5 }, { c: 6 }, { c: 'x' }]);
        ds.filter(where('c', 'NOT_IN', [5]));
        expect(ds.getRows().map((r) => r.c)).toEqual([6, 'x']);
    });

    it('expect booleans to match a typed list', () => {
        const ds = new Datasource({ fields: { b: 'boolean' } });
        ds.setData([{ b: true }, { b: false }]);
        ds.filter(where('b', 'IN', 'true'));
        expect(ds.getRows().map((r) => r.b)).toEqual([true]);
    });
});

describe('IN filter - inside an OR group', () => {
    it('expect an IN without a list to not stop the other OR conditions', () => {
        const ds = new Datasource();
        ds.setData([
            { a: 'x', b: 'y' },
            { a: 'z', b: 'q' }
        ]);
        ds.filter(or(where('a', 'IN', null), where('b', 'EQUAL', 'y')));
        expect(ds.getRows().map((r) => r.b)).toEqual(['y']);
    });

    it('expect numbers in a text column to match the list in an OR group too', () => {
        const ds = new Datasource();
        ds.setData([{ c: 5 }, { c: 6 }]);
        ds.filter(or(where('c', 'IN', [5])));
        expect(ds.getRows().map((r) => r.c)).toEqual([5]);
    });
});
