import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

/**
 * markAllForDeletion() (v5: markForDeletion(null, true)) marks every row. It used to drop the new rows,
 * splicing them out while looping over the same array, so the row after every new row was skipped.
 * Since v6 a new row is marked like any other row, so the delete can be undone: it is left out of
 * getChanges() while it is marked.
 */

describe('markAllForDeletion', () => {
    it('expect every row to be marked when several new rows are next to each other', () => {
        const ds = new Datasource();
        ds.setData([{ a: 'old1' }]);
        ds.addNewEmpty({ a: 'n1' }, { scrollTo: false });
        ds.addNewEmpty({ a: 'n2' }, { scrollTo: false });
        ds.addNewEmpty({ a: 'n3' }, { scrollTo: false });
        ds.setData([{ a: 'old2' }], { add: true });

        ds.markAllForDeletion();

        expect(ds.getAllData().map((e) => [e.a, e.__rowState])).toEqual([
            ['old1', 'D'],
            ['n1', 'D'],
            ['n2', 'D'],
            ['n3', 'D'],
            ['old2', 'D']
        ]);
        const changes = ds.getChanges();
        expect(changes.newEntities).toEqual([]);
        expect(changes.deletedEntities.map((e) => e.a)).toEqual(['old1', 'old2']);
    });

    it('expect unmarkAllForDeletion to bring the new rows back as new rows', () => {
        const ds = new Datasource();
        ds.setData([{ a: 'old1' }]);
        ds.addNewEmpty({ a: 'n1' }, { scrollTo: false });
        ds.addNewEmpty({ a: 'n2' }, { scrollTo: false });

        ds.markAllForDeletion();
        ds.unmarkAllForDeletion();

        expect(ds.getAllData().map((e) => [e.a, e.__rowState])).toEqual([
            ['old1', undefined],
            ['n1', 'N'],
            ['n2', 'N']
        ]);
        expect(ds.getChanges().newEntities.map((e) => e.a)).toEqual(['n1', 'n2']);
    });
});
