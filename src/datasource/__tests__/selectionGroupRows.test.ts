import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { isGroupRow } from '../entity';

/**
 * Group header rows can never be selected. They have no key, and selecting one put `undefined`
 * into the selection, which then made every group header count as selected.
 * select/selectAll/next/prev/first/last skip them.
 */

const grouped = () => {
    const ds = new Datasource();
    ds.setData([
        { g: 'a', v: 1 },
        { g: 'a', v: 2 },
        { g: 'b', v: 3 }
    ]);
    ds.group([{ attribute: 'g', title: 'g' }]);
    ds.expandGroup();
    // displayed: [G:a, 1, 2, G:b, 3]
    return ds;
};

const selectedValues = (ds: Datasource) => ds.getSelectedRows().map((r) => (isGroupRow(r) ? `G:${r.__groupID}` : r.v));

describe('selection - group header rows', () => {
    it('expect selectAll to only select data rows', () => {
        const ds = grouped();
        ds.selectAll();
        expect(selectedValues(ds)).toEqual([1, 2, 3]);
        expect(ds.getSelection().isSelected(0)).toBe(false);
        expect(ds.getSelection().isSelected(3)).toBe(false);
    });

    it('expect selectAll with all groups collapsed to select nothing', () => {
        const ds = grouped();
        ds.collapseGroup();
        ds.selectAll();
        expect(ds.getSelection().getSelectedKeys()).toEqual([]);
        expect(selectedValues(ds)).toEqual([]);
    });

    it('expect selectFirst to select the first data row, not the group header', () => {
        const ds = grouped();
        ds.selectFirst();
        expect(ds.currentEntity?.v).toEqual(1);
        expect(selectedValues(ds)).toEqual([1]);
    });

    it('expect select(1) to skip to the first data row', () => {
        const ds = grouped();
        ds.select(1);
        expect(ds.currentEntity?.v).toEqual(1);
    });

    it('expect selectNext and selectPrev to skip group headers and wrap', () => {
        const ds = grouped();
        ds.selectFirst();
        ds.selectNext();
        expect(ds.currentEntity?.v).toEqual(2);
        ds.selectNext();
        expect(ds.currentEntity?.v).toEqual(3);
        ds.selectNext();
        expect(ds.currentEntity?.v).toEqual(1);
        ds.selectPrev();
        expect(ds.currentEntity?.v).toEqual(3);
        ds.selectPrev();
        expect(ds.currentEntity?.v).toEqual(2);
        expect(selectedValues(ds)).toEqual([2]);
    });

    it('expect selectLast to select the last data row', () => {
        const ds = grouped();
        ds.collapseGroup('b');
        // displayed: [G:a, 1, 2, G:b]
        ds.selectLast();
        expect(ds.currentEntity?.v).toEqual(2);
    });

    it('expect selectFirst with all groups collapsed to select nothing', () => {
        const ds = grouped();
        ds.collapseGroup();
        ds.selectFirst();
        expect(ds.currentEntity).toEqual(null);
        expect(ds.getSelection().getSelectedKeys()).toEqual([]);
    });

    it('expect clicking a group header row to change nothing', () => {
        const ds = grouped();
        ds.getSelection().highlightRow({} as any, 1);
        ds.getSelection().highlightRow({} as any, 0);
        expect(ds.currentEntity?.v).toEqual(1);
        expect(selectedValues(ds)).toEqual([1]);
    });

    it('expect a shift range over a group header to only select data rows', () => {
        const ds = grouped();
        ds.getSelection().highlightRow({} as any, 1);
        ds.getSelection().highlightRow({ shiftKey: true } as any, 4);
        expect(selectedValues(ds)).toEqual([1, 2, 3]);
        expect(ds.getSelection().getSelectedKeys()).not.toContain(undefined);
    });

    it('expect selectLast on an empty datasource to add no key', () => {
        const ds = new Datasource();
        ds.selectLast();
        ds.selectPrev();
        expect(ds.getSelection().getSelectedKeys()).toEqual([]);
    });
});
