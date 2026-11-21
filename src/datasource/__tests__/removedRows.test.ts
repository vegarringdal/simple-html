import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import type { DatasourceEvents } from '../datasourceEvents';

/**
 * A method that removes rows lets go of them: the current row is set to null when it was removed
 * (as setData() does, with `current-entity` after the method's own event), and a removed row leaves
 * the selection (`selection-change`). Before, currentEntity and the selection kept pointing at a row
 * that was no longer in the data - and a row added later with the same key came back selected.
 */

interface Row {
    id: number;
    name: string;
}

const rows = (): Row[] => [
    { id: 1, name: 'Ann' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Cid' }
];

/** a datasource with Bob (row 2) selected and current */
function withBobCurrent() {
    const ds = new Datasource<Row>({ key: 'id' });
    ds.setData(rows());
    ds.select(2);
    return ds;
}

/** the events sent, in order */
function recordEvents(ds: Datasource<Row>) {
    const events: string[] = [];
    const types: (keyof DatasourceEvents)[] = ['collection-changed', 'collection-filtered', 'current-entity', 'selection-change'];
    for (const type of types) {
        ds.on(type, () => events.push(type));
    }
    return events;
}

function bob(ds: Datasource<Row>) {
    const row = ds.getAllData().find((candidate) => candidate.name === 'Bob');
    if (!row) {
        throw new Error('Bob is not in the data');
    }
    return row;
}

describe('removed rows - currentEntity and the selection', () => {
    it('expect removeData() of the current row to set it to null, and take it out of the selection', () => {
        const ds = withBobCurrent();
        const events = recordEvents(ds);

        ds.removeData(bob(ds));

        expect(ds.currentEntity).toBeNull();
        expect(ds.getSelection().getSelectedKeys()).toEqual([]);
        // after the method's own event, so every handler reads the new state
        expect(events).toEqual(['collection-changed', 'current-entity', 'selection-change']);
    });

    it('expect a row added again with the same key not to come back selected', () => {
        const ds = withBobCurrent();
        ds.removeData(bob(ds));
        ds.setData([{ id: 2, name: 'Bob again' }], { add: true });

        expect(ds.getSelectedRows()).toEqual([]);
    });

    it('expect removeData() with refilter: false to let go of the row too', () => {
        const ds = withBobCurrent();
        ds.removeData(bob(ds), { refilter: false });

        expect(ds.currentEntity).toBeNull();
        expect(ds.getSelection().getSelectedKeys()).toEqual([]);
    });

    it('expect removing another row to keep the current row and the selection, and send no more events', () => {
        const ds = withBobCurrent();
        const current = ds.currentEntity;
        const events = recordEvents(ds);

        ds.removeData(ds.getAllData()[0]);

        expect(ds.currentEntity).toBe(current);
        expect(ds.getSelection().getSelectedKeys()).toEqual([2]);
        expect(events).toEqual(['collection-changed']);
    });

    it('expect removeAllData() to let go of every row', () => {
        const ds = withBobCurrent();
        const events = recordEvents(ds);

        ds.removeAllData();

        expect(ds.currentEntity).toBeNull();
        expect(ds.getSelection().getSelectedKeys()).toEqual([]);
        expect(events).toEqual(['collection-changed', 'current-entity', 'selection-change']);
    });

    it('expect clearMarkedForDeletion() of the current row to set it to null', () => {
        const ds = withBobCurrent();
        ds.markForDeletion(bob(ds));
        const events = recordEvents(ds);

        ds.clearMarkedForDeletion();

        expect(ds.currentEntity).toBeNull();
        expect(ds.getSelection().getSelectedKeys()).toEqual([]);
        expect(events).toEqual(['collection-changed', 'current-entity', 'selection-change']);
    });

    it('expect acceptChanges() that removes the current row to set it to null', () => {
        const ds = withBobCurrent();
        ds.markForDeletion(bob(ds));
        const events = recordEvents(ds);

        ds.acceptChanges();

        expect(ds.currentEntity).toBeNull();
        expect(ds.getSelection().getSelectedKeys()).toEqual([]);
        expect(events).toEqual(['collection-filtered', 'current-entity', 'selection-change']);
    });

    it('expect acceptChanges() to keep a current row it does not remove, and a new row selected under its new key', () => {
        const ds = new Datasource<Row>({ key: 'id' });
        ds.setData(rows());
        ds.addNewEmpty({ name: 'Dan' }); // selected and current
        const dan = ds.currentEntity;
        const temporaryKey = ds.getAllData()[3].id;
        ds.markForDeletion(ds.getAllData()[0]);

        ds.acceptChanges({ newKeys: new Map([[temporaryKey, 4]]) });

        expect(ds.currentEntity).toBe(dan);
        expect(ds.getSelection().getSelectedKeys()).toEqual([4]);
    });

    it('expect resetData() of a new current row to set it to null', () => {
        const ds = new Datasource<Row>({ key: 'id' });
        ds.setData(rows());
        ds.addNewEmpty({ name: 'Dan' });
        expect(ds.currentEntity).not.toBeNull();
        const events = recordEvents(ds);

        ds.resetData();

        expect(ds.currentEntity).toBeNull();
        expect(ds.getSelection().getSelectedKeys()).toEqual([]);
        expect(events).toEqual(['collection-filtered', 'current-entity', 'selection-change']);
    });

    it('expect resetDataSelectionOnly() of a new current row to set it to null', () => {
        const ds = new Datasource<Row>({ key: 'id' });
        ds.setData(rows());
        ds.addNewEmpty({ name: 'Dan' });

        ds.resetDataSelectionOnly();

        expect(ds.getAllData().map((row) => row.name)).toEqual(['Ann', 'Bob', 'Cid']);
        expect(ds.currentEntity).toBeNull();
        expect(ds.getSelection().getSelectedKeys()).toEqual([]);
    });

    it('expect resetData() to keep a current row that is not new', () => {
        const ds = withBobCurrent();
        bob(ds).name = 'Robert';
        const current = ds.currentEntity;

        ds.resetData();

        expect(ds.currentEntity).toBe(current);
        expect(ds.getSelection().getSelectedKeys()).toEqual([2]);
    });
});
