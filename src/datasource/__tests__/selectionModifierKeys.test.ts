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
