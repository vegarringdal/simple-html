import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

/**
 * markForDeletion(null, true) drops new rows and flags the rest. It spliced new rows out while
 * looping over the same array, so the row after every new row was skipped.
 */

describe('markForDeletion - all', () => {
    it('expect every new row to be removed when several are next to each other', () => {
        const ds = new Datasource();
        ds.setData([{ a: 'old1' }]);
        ds.addNewEmpty({ a: 'n1' } as any, false);
        ds.addNewEmpty({ a: 'n2' } as any, false);
        ds.addNewEmpty({ a: 'n3' } as any, false);
        ds.setData([{ a: 'old2' }], true);

        ds.markForDeletion(null, true);

        expect(ds.getAllData().map((e) => [e.a, e.__rowState])).toEqual([
            ['old1', 'D'],
            ['old2', 'D']
        ]);
        expect(ds.getChanges().newEntities).toEqual([]);
    });
});
