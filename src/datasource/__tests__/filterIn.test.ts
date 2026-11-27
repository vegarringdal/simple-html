import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { or, where } from '../filterExpression';
import { registerFormatter } from '../formatterRegistry';

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

describe('IN filter - a number field compares the formatted text', () => {
    /**
     * the row's number is formatted, so was a number in the list not: [1.5] never found the 1.5 a
     * numberComma field shows as '1,5', [2] never the 2 shown as '2.00'. The value list of a lookup
     * column on a number field and its header filter put the values in the list
     */
    it('expect a number in the list to be formatted as the row values are', () => {
        const ds = new Datasource({ fields: { n: { type: 'number', formatter: 'numberComma' } } });
        ds.setData([{ n: 1.5 }, { n: 2 }, { n: null }]);
        ds.filter(where('n', 'IN', [1.5]));
        expect(ds.getRows().map((r) => r.n)).toEqual([1.5]);
        ds.filter(where('n', 'NOT_IN', [1.5, 'NULL']));
        expect(ds.getRows().map((r) => r.n)).toEqual([2]);
    });

    it('expect a formatter of its own too: [2] finds the 2 shown as 2.00', () => {
        registerFormatter('filterIn-twoDecimals', {
            format: (value: unknown) => (typeof value === 'number' ? value.toFixed(2) : ''),
            parse: (text: string) => Number(text)
        });
        const ds = new Datasource({ fields: { n: { type: 'number', formatter: 'filterIn-twoDecimals' } } });
        ds.setData([{ n: 2 }, { n: 3 }]);
        ds.filter(where('n', 'IN', [2]));
        expect(ds.getRows().map((r) => r.n)).toEqual([2]);
    });

    it('expect text in the list to be compared as it is: what the formatter shows, typed', () => {
        const ds = new Datasource({ fields: { n: { type: 'number', formatter: 'numberComma' } } });
        ds.setData([{ n: 1.5 }, { n: 2 }]);
        ds.filter(where('n', 'IN', '1,5'));
        expect(ds.getRows().map((r) => r.n)).toEqual([1.5]);
        // not the number's text
        ds.filter(where('n', 'IN', ['1.5']));
        expect(ds.getRows()).toEqual([]);
    });

    it('expect a list changed between two runs of the same condition to be read again', () => {
        const ds = new Datasource({ fields: { n: 'number' } });
        ds.setData([{ n: 1 }, { n: 2 }]);
        const condition = where('n', 'IN', [1]);
        ds.filter(condition);
        expect(ds.getRows().map((r) => r.n)).toEqual([1]);
        (condition.value as number[]).push(2);
        ds.filter(condition);
        expect(ds.getRows().map((r) => r.n)).toEqual([1, 2]);
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
