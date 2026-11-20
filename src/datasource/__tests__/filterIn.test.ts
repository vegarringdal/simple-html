import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

/**
 * IN / NOT_IN compare the list and the row value as upper case text, the same in AND and OR groups.
 */

describe('IN filter - value types', () => {
    it('expect numbers in a text column to match the list (AND group)', () => {
        const ds = new Datasource();
        ds.setData([{ c: 5 }, { c: 6 }, { c: 'x' }]);
        ds.filter({ attribute: 'c', operator: 'IN', value: [5, 'X'] as any, attributeType: 'text' });
        expect(ds.getRows().map((r) => r.c)).toEqual([5, 'x']);
    });

    it('expect NOT_IN with numbers in a text column to leave them out', () => {
        const ds = new Datasource();
        ds.setData([{ c: 5 }, { c: 6 }, { c: 'x' }]);
        ds.filter({ attribute: 'c', operator: 'NOT_IN', value: [5] as any, attributeType: 'text' });
        expect(ds.getRows().map((r) => r.c)).toEqual([6, 'x']);
    });

    it('expect booleans to match a typed list', () => {
        const ds = new Datasource();
        ds.setData([{ b: true }, { b: false }]);
        ds.filter({ attribute: 'b', operator: 'IN', value: 'true', attributeType: 'boolean' });
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
        ds.filter({
            type: 'GROUP',
            logicalOperator: 'OR',
            filterArguments: [
                { attribute: 'a', operator: 'IN', value: null, attributeType: 'text' },
                { attribute: 'b', operator: 'EQUAL', value: 'y', attributeType: 'text' }
            ]
        });
        expect(ds.getRows().map((r) => r.b)).toEqual(['y']);
    });

    it('expect numbers in a text column to match the list in an OR group too', () => {
        const ds = new Datasource();
        ds.setData([{ c: 5 }, { c: 6 }]);
        ds.filter({
            type: 'GROUP',
            logicalOperator: 'OR',
            filterArguments: [{ attribute: 'c', operator: 'IN', value: [5] as any, attributeType: 'text' }]
        });
        expect(ds.getRows().map((r) => r.c)).toEqual([5]);
    });
});
