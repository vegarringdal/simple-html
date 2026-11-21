import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';

/**
 * The conflicts of upsert(): getConflicts(), hasConflicts(), resolveConflict(), the conflicts-changed
 * event, and everything that takes a conflict away - a conflict lasts while what it is about is there:
 * the field edited, the row with local changes, the row in the data.
 */

interface Stock {
    id: number;
    name?: string;
    price?: number | null;
}

const nextTask = () => new Promise((resolve) => setTimeout(resolve));

function stocks() {
    const ds = new Datasource<Stock>({ key: 'id', fields: { price: 'number' } });
    ds.setData([
        { id: 1, name: 'Ann', price: 10 },
        { id: 2, name: 'Bob', price: 20 },
        { id: 3, name: 'Cid', price: 30 }
    ]);
    return ds;
}

/** Bob's price edited to 25, the server's is 21 now: a conflict */
function withConflict() {
    const ds = stocks();
    const bob = ds.getAllData()[1];
    bob.price = 25;
    ds.upsert([{ id: 2, price: 21 }]);
    return { ds, bob };
}

/** how many conflicts-changed events are sent from now on */
function conflictEvents(ds: Datasource<Stock>) {
    const counter = { count: 0 };
    ds.on('conflicts-changed', () => counter.count++);
    return counter;
}

const fields = (ds: Datasource<Stock>) => ds.getConflicts().map((c) => [c.row.name, c.field]);

describe('conflicts - what getConflicts() lists', () => {
    it('expect a value conflict: the user value, the server value and where the edit started', () => {
        const { ds, bob } = withConflict();
        expect(ds.getConflicts()).toEqual([{ row: bob, field: 'price', local: 25, remote: 21, original: 20 }]);
        expect(ds.hasConflicts()).toBe(true);
    });

    it('expect the value the row has now as local', () => {
        const { ds, bob } = withConflict();
        bob.price = 26;
        expect(ds.getConflicts()[0]).toMatchObject({ local: 26, remote: 21, original: 20 });
    });

    it('expect none on new data, and hasConflicts() false', () => {
        const ds = stocks();
        expect(ds.getConflicts()).toEqual([]);
        expect(ds.hasConflicts()).toBe(false);
    });

    it('expect a second change of the server to give the newer value, the start of the edit kept', () => {
        const { ds, bob } = withConflict();
        ds.upsert([{ id: 2, price: 22 }]);
        expect(ds.getConflicts()).toEqual([{ row: bob, field: 'price', local: 25, remote: 22, original: 20 }]);
        expect(bob.__controller?.__originalValues.price).toBe(22);
    });

    it('expect the conflict to go when the server goes back to where the edit started, the edit to stay', () => {
        const { ds, bob } = withConflict();
        ds.upsert([{ id: 2, price: 20 }]);
        expect(ds.getConflicts()).toEqual([]);
        expect(bob.price).toBe(25);
        expect(bob.__rowState).toBe('M');
    });

    it("expect the conflict to go when the server gets the user's value", () => {
        const { ds, bob } = withConflict();
        ds.upsert([{ id: 2, price: 25 }]);
        expect(ds.getConflicts()).toEqual([]);
        expect(bob.__rowState).toBeUndefined();
    });

    it('expect the conflicts in the order of the rows, every field, and of the rows given', () => {
        const ds = stocks();
        const [ann, bob, cid] = ds.getAllData();
        cid.price = 35;
        ann.name = 'Anna';
        ann.price = 15;
        bob.price = 25;
        ds.upsert([
            { id: 3, price: 31 },
            { id: 1, name: 'Annie', price: 11 }
        ]);
        expect(fields(ds)).toEqual([
            ['Anna', 'name'],
            ['Anna', 'price'],
            ['Cid', 'price']
        ]);
        expect(ds.getConflicts(cid).map((c) => c.field)).toEqual(['price']);
        expect(ds.getConflicts([cid, ann]).map((c) => c.row)).toEqual([ann, ann, cid]);
        expect(ds.getConflicts(bob)).toEqual([]);
    });

    it('expect the conflicts of the container, seen from every datasource on it', () => {
        const container = new DataContainer('id');
        const left = new Datasource<Stock>({ container });
        const right = new Datasource<Stock>({ container });
        left.setData([{ id: 1, price: 10 }]);
        left.getAllData()[0].price = 15;
        let rightEvents = 0;
        right.on('conflicts-changed', () => rightEvents++);
        left.upsert([{ id: 1, price: 11 }]);
        expect(right.getConflicts().map((c) => c.field)).toEqual(['price']);
        return nextTask().then(() => expect(rightEvents).toBe(1));
    });
});

describe('conflicts - resolveConflict()', () => {
    it("expect 'local' to keep the user's value, still edited, the conflict gone", () => {
        const { ds, bob } = withConflict();
        ds.resolveConflict(bob, 'price', 'local');
        expect(bob.price).toBe(25);
        expect(bob.__rowState).toBe('M');
        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 2, price: 25 }]);
        expect(ds.getConflicts()).toEqual([]);
        // and the server's next value is a conflict again only when the server changes it again
        ds.upsert([{ id: 2, price: 21 }]);
        expect(ds.getConflicts()).toEqual([]);
        ds.upsert([{ id: 2, price: 23 }]);
        expect(ds.getConflicts()).toEqual([{ row: bob, field: 'price', local: 25, remote: 23, original: 21 }]);
    });

    it("expect 'remote' to take the server's value, not edited, a step undo takes back", async () => {
        const { ds, bob } = withConflict();
        await nextTask();
        ds.resolveConflict(bob, 'price', 'remote');
        expect(bob.price).toBe(21);
        expect(bob.__rowState).toBeUndefined();
        expect(ds.getConflicts()).toEqual([]);
        await nextTask();
        ds.undo();
        expect(bob.price).toBe(25);
        expect(bob.__rowState).toBe('M');
    });

    it("expect 'remote' to validate the value", () => {
        const ds = new Datasource({ key: 'id', fields: { price: { type: 'number', validate: [{ id: 'min', value: 0 }] } } });
        ds.setData([{ id: 1, price: 10 }]);
        const row = ds.getAllData()[0];
        row.price = 5;
        ds.upsert([{ id: 1, price: -1 }]);
        expect(ds.getErrors()).toEqual([]);
        ds.resolveConflict(row, 'price', 'remote');
        expect(ds.getErrors().map((e) => e.field)).toEqual(['price']);
    });

    it("expect 'local' for a row the server removed to keep it, and no conflict for it again", () => {
        const ds = stocks();
        const bob = ds.getAllData()[1];
        bob.price = 25;
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        ds.resolveConflict(bob, null, 'local');
        expect(ds.getConflicts()).toEqual([]);
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        expect(ds.getConflicts()).toEqual([]);
        expect(ds.getAllData()).toContain(bob);
        expect(bob.price).toBe(25);

        // without its changes it is removed, as any row the server does not have
        ds.resetRows(bob);
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        expect(ds.getAllData()).not.toContain(bob);
    });

    it("expect 'remote' for a row the server removed to remove it, as removeData() does", () => {
        const ds = stocks();
        const bob = ds.getAllData()[1];
        bob.price = 25;
        ds.select(2);
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        const sent: string[] = [];
        ds.on('collection-changed', (data) => sent.push(`collection-changed ${data.info}`));
        ds.on('current-entity', () => sent.push('current-entity'));
        ds.resolveConflict(bob, null, 'remote');
        expect(ds.getAllData()).not.toContain(bob);
        expect(ds.getDataRows()).not.toContain(bob);
        expect(ds.getConflicts()).toEqual([]);
        expect(ds.hasChanges()).toBe(false);
        expect(sent).toEqual(['collection-changed removeData', 'current-entity']);
    });

    it('expect nothing to happen for a field or row without a conflict', () => {
        const { ds, bob } = withConflict();
        const ann = ds.getAllData()[0];
        ann.price = 15;
        ds.resolveConflict(ann, 'price', 'remote');
        ds.resolveConflict(bob, 'name', 'remote');
        ds.resolveConflict(bob, null, 'remote');
        expect(ann.price).toBe(15);
        expect(ds.getAllData()).toHaveLength(3);
        expect(ds.getConflicts()).toHaveLength(1);
    });

    it("expect a TypeError when take is neither 'local' nor 'remote'", () => {
        const { ds, bob } = withConflict();
        expect(() => ds.resolveConflict(bob, 'price', 'server' as any)).toThrow(TypeError);
        expect(ds.getConflicts()).toHaveLength(1);
    });
});

describe('conflicts - what takes them away', () => {
    it('expect acceptChanges() to clear the conflicts of the rows saved, the others stay', () => {
        const ds = stocks();
        const [ann, bob] = ds.getAllData();
        ann.price = 15;
        bob.price = 25;
        ds.upsert([
            { id: 1, price: 11 },
            { id: 2, price: 21 }
        ]);
        ds.acceptChanges({ rows: [bob] });
        expect(fields(ds)).toEqual([['Ann', 'price']]);
        ds.acceptChanges();
        expect(ds.getConflicts()).toEqual([]);
        expect(bob.price).toBe(25);
    });

    it('expect acceptChanges() to clear the conflict of a row the server removed', () => {
        const ds = stocks();
        ds.getAllData()[1].price = 25;
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        ds.acceptChanges();
        expect(ds.getConflicts()).toEqual([]);
    });

    it('expect resetField() to take the conflict with the edit', () => {
        const { ds, bob } = withConflict();
        ds.resetField(bob, 'price');
        expect(bob.price).toBe(21);
        expect(ds.getConflicts()).toEqual([]);
    });

    it('expect resetRows() and resetDataSelectionOnly() to take the conflicts of the rows', () => {
        const { ds, bob } = withConflict();
        ds.resetRows(bob);
        expect(ds.getConflicts()).toEqual([]);

        bob.price = 25;
        ds.upsert([{ id: 2, price: 22 }]);
        ds.select(2);
        ds.resetDataSelectionOnly();
        expect(bob.price).toBe(22);
        expect(ds.getConflicts()).toEqual([]);
    });

    it('expect resetData() to clear every conflict, also of a row only marked for deletion', () => {
        const ds = stocks();
        const [ann, bob] = ds.getAllData();
        ann.price = 15;
        ds.markForDeletion(bob);
        ds.upsert([{ id: 1, price: 11 }, { id: 3 }], { removeMissing: true });
        expect(fields(ds)).toEqual([
            ['Ann', 'price'],
            ['Bob', null]
        ]);
        ds.resetData();
        expect(ds.getConflicts()).toEqual([]);
    });

    it('expect an undo of the edit to take the conflict', async () => {
        const ds = stocks();
        const bob = ds.getAllData()[1];
        bob.price = 25;
        await nextTask();
        ds.upsert([{ id: 2, price: 21 }]);
        ds.undo();
        // back to what the server has now, not to the value the edit started from
        expect(bob.price).toBe(21);
        expect(bob.__rowState).toBeUndefined();
        expect(ds.getConflicts()).toEqual([]);
        ds.redo();
        expect(bob.price).toBe(25);
    });

    it("expect the conflict to go when the user sets the server's value", () => {
        const { ds, bob } = withConflict();
        ds.getDataContainer().__history.typing(() => {
            bob.price = 21;
        });
        expect(ds.getConflicts()).toEqual([]);
        expect(bob.__rowState).toBeUndefined();
    });

    it('expect the conflict of a row the server removed to go once the row has no changes', () => {
        const ds = stocks();
        const bob = ds.getAllData()[1];
        bob.price = 25;
        ds.markForDeletion(bob);
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        bob.price = 20;
        expect(ds.getConflicts()).toHaveLength(1);
        ds.unmarkForDeletion(bob);
        expect(ds.getConflicts()).toEqual([]);
    });

    it('expect setData() to clear them, setData() with add not', () => {
        const { ds } = withConflict();
        ds.setData([{ id: 4, name: 'Dan' }], { add: true });
        expect(ds.getConflicts()).toHaveLength(1);
        ds.setData([{ id: 1, name: 'Ann' }]);
        expect(ds.getConflicts()).toEqual([]);
        expect(ds.hasConflicts()).toBe(false);
    });

    it('expect the conflicts of a row removed to go: removeData(), clearMarkedForDeletion(), removeAllData()', () => {
        let { ds, bob } = withConflict();
        ds.removeData(bob);
        expect(ds.hasConflicts()).toBe(false);

        ({ ds, bob } = withConflict());
        ds.markForDeletion(bob);
        ds.clearMarkedForDeletion();
        expect(ds.hasConflicts()).toBe(false);

        ({ ds, bob } = withConflict());
        ds.removeAllData();
        expect(ds.hasConflicts()).toBe(false);

        ({ ds, bob } = withConflict());
        ds.getDataContainer().replace([{ id: 9 }], 1, 1);
        expect(ds.hasConflicts()).toBe(false);
    });
});

describe('conflicts - the conflicts-changed event', () => {
    it('expect one event for an upsert that made conflicts, after its rows-changed', async () => {
        const ds = stocks();
        const [ann, bob] = ds.getAllData();
        ann.price = 15;
        bob.price = 25;
        const sent: string[] = [];
        ds.on('rows-changed', () => sent.push('rows-changed'));
        ds.on('conflicts-changed', () => sent.push('conflicts-changed'));
        ds.upsert([
            { id: 1, price: 11 },
            { id: 2, price: 21 }
        ]);
        expect(sent).toEqual([]);
        await nextTask();
        expect(sent).toEqual(['rows-changed', 'conflicts-changed']);
    });

    it('expect an event when one is resolved, and none when nothing changed', async () => {
        const { ds, bob } = withConflict();
        await nextTask();
        const counter = conflictEvents(ds);
        ds.upsert([{ id: 2, price: 21 }]);
        await nextTask();
        expect(counter.count).toBe(0);
        ds.resolveConflict(bob, 'price', 'local');
        await nextTask();
        expect(counter.count).toBe(1);
    });

    it('expect an event when acceptChanges() or setData() clears them', async () => {
        const { ds } = withConflict();
        await nextTask();
        const counter = conflictEvents(ds);
        ds.acceptChanges();
        await nextTask();
        expect(counter.count).toBe(1);
        ds.setData([]);
        await nextTask();
        expect(counter.count).toBe(1);
    });
});
