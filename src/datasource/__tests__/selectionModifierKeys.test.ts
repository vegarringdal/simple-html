import { afterEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../dataSource';

/**
 * The first click on a fresh selection used to match no case in highlightRow when it was a ctrl or
 * shift click (the last key used was still undefined), so it selected nothing and logged an error.
 */

const fresh = () => {
    const ds = new Datasource();
    ds.setData([{ v: 1 }, { v: 2 }, { v: 3 }]);
    return ds;
};

describe('selection - first click with a modifier key', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('expect a first ctrl click to select the row', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const ds = fresh();
        ds.getSelection().highlightRow({ ctrlKey: true } as any, 1);
        expect(ds.getSelection().getSelectedRows()).toEqual([1]);
        expect(error).not.toHaveBeenCalled();
    });

    it('expect a first shift click to select the row', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const ds = fresh();
        ds.getSelection().highlightRow({ shiftKey: true } as any, 2);
        expect(ds.getSelection().getSelectedRows()).toEqual([2]);
        expect(error).not.toHaveBeenCalled();
    });

    it('expect a first ctrl click then a second ctrl click to select both rows', () => {
        const ds = fresh();
        ds.getSelection().highlightRow({ ctrlKey: true } as any, 0);
        ds.getSelection().highlightRow({ ctrlKey: true } as any, 2);
        expect(ds.getSelection().getSelectedRows()).toEqual([0, 2]);
    });
});

/**
 * Ctrl+click and Shift+click without the keyboard - a finger's tap on a row number, the row menu's
 * Select › - and the anchor a Shift+click selects from
 */
describe('selection - toggleRow, selectRowsTo and the anchor', () => {
    const five = () => {
        const ds = new Datasource();
        ds.setData([{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }]);
        return ds;
    };

    it('expect no anchor on a fresh selection, the row of a plain click after it, the row of a Ctrl+click in or out', () => {
        const ds = five();
        const selection = ds.getSelection();
        expect(selection.getAnchorRow()).toBe(-1);
        selection.highlightRow({}, 2);
        expect(selection.getAnchorRow()).toBe(2);
        selection.highlightRow({ ctrlKey: true }, 4);
        expect(selection.getAnchorRow()).toBe(4);
        selection.highlightRow({ ctrlKey: true }, 4);
        expect(selection.getSelectedRows()).toEqual([2]);
        expect(selection.getAnchorRow()).toBe(4);
        // a Shift+click keeps it
        selection.highlightRow({ shiftKey: true }, 0);
        expect(selection.getAnchorRow()).toBe(4);
    });

    it('expect the anchor -1 when it is no displayed row any more', () => {
        const ds = five();
        ds.getSelection().highlightRow({ ctrlKey: true }, 4);
        ds.setData([{ v: 1 }, { v: 2 }]);
        expect(ds.getSelection().getAnchorRow()).toBe(-1);
    });

    it("expect toggleRow in 'multiple' mode to add and remove one row, as Ctrl+click, the row current, an event each", () => {
        const ds = five();
        const changes = vi.fn();
        ds.on('selection-change', changes);
        const selection = ds.getSelection();

        selection.toggleRow(1);
        selection.toggleRow(3);
        expect(selection.getSelectedRows()).toEqual([1, 3]);
        selection.toggleRow(1);
        expect(selection.getSelectedRows()).toEqual([3]);
        expect(ds.currentEntity).toBe(ds.getRow(1));
        expect(changes).toHaveBeenCalledTimes(3);
    });

    it("expect toggleRow in 'single' mode to replace the row selected, and to deselect it", () => {
        const ds = five();
        ds.setSelectionMode('single');
        const changes = vi.fn();
        ds.on('selection-change', changes);
        const selection = ds.getSelection();

        selection.toggleRow(1);
        selection.toggleRow(3);
        expect(selection.getSelectedRows()).toEqual([3]);
        selection.toggleRow(3);
        expect(selection.getSelectedRows()).toEqual([]);
        expect(ds.currentEntity).toBe(ds.getRow(3));
        expect(changes).toHaveBeenCalledTimes(3);
    });

    it("expect toggleRow and selectRowsTo to do nothing in 'none' mode, selectRowsTo nothing in 'single' mode", () => {
        const ds = five();
        const changes = vi.fn();
        ds.on('selection-change', changes);
        ds.setSelectionMode('none');
        ds.getSelection().toggleRow(1);
        ds.getSelection().selectRowsTo(3);
        expect(changes).not.toHaveBeenCalled();
        ds.setSelectionMode('single');
        ds.getSelection().highlightRow({}, 0);
        changes.mockClear();
        ds.getSelection().selectRowsTo(3);
        expect(ds.getSelection().getSelectedRows()).toEqual([0]);
        expect(changes).not.toHaveBeenCalled();
    });

    it('expect selectRowsTo to select from the anchor to the row, as Shift+click, either way', () => {
        const ds = five();
        const selection = ds.getSelection();
        selection.highlightRow({}, 2);
        selection.selectRowsTo(4);
        expect(selection.getSelectedRows()).toEqual([2, 3, 4]);
        selection.selectRowsTo(0);
        expect(selection.getSelectedRows()).toEqual([0, 1, 2]);
    });

    it('expect Shift+click after Ctrl+clicks to add the range to them, also to a row above the anchor', () => {
        const ds = five();
        const selection = ds.getSelection();
        selection.toggleRow(0);
        selection.toggleRow(4);
        // above the anchor: this selected nothing, the range was from 4 to 2
        selection.selectRowsTo(2);
        expect(selection.getSelectedRows()).toEqual([0, 2, 3, 4]);

        const other = five().getSelection();
        other.highlightRow({ ctrlKey: true }, 0);
        other.highlightRow({ ctrlKey: true }, 2);
        other.highlightRow({ shiftKey: true }, 4);
        expect(other.getSelectedRows()).toEqual([0, 2, 3, 4]);
    });
});
