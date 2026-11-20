import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { isGroupRow } from '../entity';

/**
 * Groups are built from runs of equal values in the sorted rows, so the group key has to agree
 * with what the sort treats as equal: all blanks are one ' blank' group, 0 and false are real values.
 * A mismatch left equal values in several groups with the same id.
 */

const groups = (ds: Datasource) =>
    ds
        .getRows()
        .filter(isGroupRow)
        .map((r) => [r.__groupID, r.__groupTotal]);

describe('grouping - one group per value', () => {
    it('expect false and blanks in a boolean column to give one group each', () => {
        const ds = new Datasource();
        ds.setData([{ b: false }, { b: null }, { b: false }, { b: true }, { b: undefined }, { b: false }]);
        ds.group([{ attribute: 'b', title: 'b' }]);
        expect(groups(ds)).toEqual([
            [' blank', 2],
            ['false', 3],
            ['true', 1]
        ]);
    });

    it('expect 0, negatives and blanks in a number column to give one group each, in order', () => {
        const ds = new Datasource();
        ds.setData([{ n: -5 }, { n: 0 }, { n: -5 }, { n: 3 }, { n: null }, { n: -1 }, { n: 0 }, { n: '' }]);
        ds.group([{ attribute: 'n', title: 'n' }]);
        expect(groups(ds)).toEqual([
            [' blank', 2],
            ['-5', 2],
            ['-1', 1],
            ['0', 2],
            ['3', 1]
        ]);
    });

    it('expect expanding a group to only expand that one group', () => {
        const ds = new Datasource();
        ds.setData([
            { b: false, v: 1 },
            { b: null, v: 2 },
            { b: false, v: 3 }
        ]);
        ds.group([{ attribute: 'b', title: 'b' }]);
        ds.expandGroup('false');
        expect(ds.getRows().map((r) => (isGroupRow(r) ? `G:${r.__groupID}` : r.v))).toEqual(['G: blank', 'G:false', 1, 3]);
    });

    it('expect false to be its own sub group, not part of the blank sub group', () => {
        const ds = new Datasource();
        ds.setData([
            { g: 'a', b: false },
            { g: 'a', b: null },
            { g: 'a', b: true }
        ]);
        ds.group([
            { attribute: 'g', title: 'g' },
            { attribute: 'b', title: 'b' }
        ]);
        ds.expandGroup();
        expect(groups(ds)).toEqual([
            ['a', 3],
            ['a- blank', 1],
            ['a-false', 1],
            ['a-true', 1]
        ]);
    });
});
