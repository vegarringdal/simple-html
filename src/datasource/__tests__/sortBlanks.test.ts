import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

/**
 * Blanks are null, undefined, '' (and an invalid Date). They sort first ascending, last descending.
 * 0 and false are real values: 0 sorts between negative and positive numbers, false before true.
 */

const sorted = (data: any[], attribute: string, ascending: boolean) => {
    const ds = new Datasource();
    ds.setData(data);
    ds.sort({ attribute, ascending });
    return ds.getRows().map((r) => r[attribute]);
};

const isBlankValue = (v: any) => v === null || v === undefined || v === '';

describe('sort - blanks, 0 and negative numbers', () => {
    const numbers = () => [-5, 0, -3, 2, null, -1, 7, undefined, '', -10, 0].map((n) => ({ n }));

    it('expect blanks first, then 0 between negatives and positives when ascending', () => {
        const result = sorted(numbers(), 'n', true);
        expect(result.slice(0, 3).every(isBlankValue)).toBe(true);
        expect(result.slice(3)).toEqual([-10, -5, -3, -1, 0, 0, 2, 7]);
    });

    it('expect numbers reversed and blanks last when descending', () => {
        const result = sorted(numbers(), 'n', false);
        expect(result.slice(0, 8)).toEqual([7, 2, 0, 0, -1, -3, -5, -10]);
        expect(result.slice(8).every(isBlankValue)).toBe(true);
    });

    it('expect false before true, blanks first', () => {
        const data = [true, false, null, true, false].map((b) => ({ b }));
        expect(sorted(data, 'b', true)).toEqual([null, false, false, true, true]);
    });

    it('expect 0 not to be equal to a blank, so the next sort argument does not decide', () => {
        const ds = new Datasource();
        ds.setData([
            { n: 0, i: 1 },
            { n: null, i: 2 }
        ]);
        ds.sort([
            { attribute: 'n', ascending: true },
            { attribute: 'i', ascending: true }
        ]);
        expect(ds.getRows().map((r) => r.i)).toEqual([2, 1]);
    });

    it('expect an invalid Date to sort as a blank', () => {
        const data = [new Date(2020, 0, 1), new Date('not a date'), new Date(2019, 0, 1)].map((d) => ({ d }));
        const result = sorted(data, 'd', true);
        expect(Number.isNaN(result[0].getTime())).toBe(true);
        expect(result.slice(1)).toEqual([new Date(2019, 0, 1), new Date(2020, 0, 1)]);
    });
});
