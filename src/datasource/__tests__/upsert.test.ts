import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import { Datasource, type EntityUnion } from '../dataSource';
import type { DatasourceEvents } from '../datasourceEvents';
import type { DatasourceOptions } from '../datasourceOptions';
import { where } from '../filterExpression';

/**
 * datasource.upsert(rows, options): merges rows from a server by key - updates the rows it has (as
 * server values: the value and its original), adds the new keys, and with removeMissing removes the
 * rows the server did not send. The conflicts it makes are tested in conflicts.test.ts, the
 * rows-changed event in rowsChanged.test.ts.
 */

interface Stock {
    id: number;
    name?: string;
    price?: number | null;
    group?: string;
}

const nextTask = () => new Promise((resolve) => setTimeout(resolve));

function stocks(fields: DatasourceOptions['fields'] = { price: 'number' }) {
    const ds = new Datasource<Stock>({ key: 'id', fields });
    ds.setData([
        { id: 1, name: 'Ann', price: 10, group: 'a' },
        { id: 2, name: 'Bob', price: 20, group: 'a' },
        { id: 3, name: 'Cid', price: 30, group: 'b' }
    ]);
    return ds;
}

const names = (ds: Datasource<Stock>) => ds.getAllData().map((row) => row.name);
const displayed = (ds: Datasource<Stock>) => ds.getDataRows().map((row) => row.name);
const row = (ds: Datasource<Stock>, id: number) => ds.getAllData().find((r) => r.id === id) as EntityUnion<Stock>;

/** the events of the datasource from now on, by name, with the payload */
function events(ds: Datasource<Stock>) {
    const sent: { type: keyof DatasourceEvents; data: unknown }[] = [];
    const types: (keyof DatasourceEvents)[] = [
        'collection-changed',
        'collection-filtered',
        'collection-sorted',
        'collection-grouped',
        'current-entity',
        'selection-change',
        'history-changed',
        'rows-changed',
        'conflicts-changed'
    ];
    for (const type of types) {
        ds.on(type, (data: unknown) => sent.push({ type, data }));
    }
    return sent;
}

describe('upsert - the key', () => {
    it('expect a TypeError without a key', () => {
        const ds = new Datasource();
        ds.setData([{ id: 1, name: 'Ann' }]);
        expect(() => ds.upsert([{ id: 1, name: 'Anna' }])).toThrow(TypeError);
        expect(() => ds.upsert([{ id: 1, name: 'Anna' }])).toThrow(/key/);
        expect(ds.getAllData()[0].name).toBe('Ann');
    });

    it('expect a TypeError for a row without its key, and nothing merged then', () => {
        const ds = stocks();
        for (const id of [null, undefined, '']) {
            expect(() =>
                ds.upsert([
                    { id: 1, name: 'Anna' },
                    { id: id as any, name: 'X' }
                ])
            ).toThrow("upsert(): the row at index 1 has no key, its 'id' is blank");
        }
        expect(() => ds.upsert([{ name: 'X' }] as Stock[])).toThrow(TypeError);
        expect(() => ds.upsert([null as any])).toThrow(TypeError);
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid']);
    });

    it('expect a TypeError when the rows are no list, one row given as it is', () => {
        const ds = stocks();
        expect(() => ds.upsert({ id: 1, name: 'Anna' } as any)).toThrow(TypeError);
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid']);
    });

    it('expect a TypeError for options it does not take, the v5 way of an options flag', () => {
        const ds = stocks();
        expect(() => ds.upsert([], true as any)).toThrow(TypeError);
    });

    it('expect a key of a container made with one', () => {
        const container = new DataContainer('id');
        const ds = new Datasource<Stock>({ container });
        ds.setData([{ id: 1, name: 'Ann' }]);
        ds.upsert([{ id: 1, name: 'Anna' }]);
        expect(names(ds)).toEqual(['Anna']);
    });

    it('expect the keys compared as text, and the key field never written', () => {
        const ds = stocks();
        ds.upsert([{ id: '2' as any, name: 'Bobby' }]);
        expect(names(ds)).toEqual(['Ann', 'Bobby', 'Cid']);
        expect(row(ds, 2).id).toBe(2);
        // not the same text: a key of its own
        ds.upsert([{ id: '02' as any, name: 'Zero two' }]);
        expect(names(ds)).toEqual(['Ann', 'Bobby', 'Cid', 'Zero two']);
    });

    it('expect text keys in the data to match a number of the server, also for removeMissing', () => {
        const ds = new Datasource({ key: 'code' });
        ds.setData([
            { code: '7', name: 'seven' },
            { code: 'x', name: 'ex' },
            { code: '8', name: 'eight' }
        ]);
        ds.upsert(
            [
                { code: 7, name: 'Seven' },
                { code: 'x', name: 'Ex' }
            ],
            { removeMissing: true }
        );
        expect(ds.getAllData().map((r) => [r.code, r.name])).toEqual([
            ['7', 'Seven'],
            ['x', 'Ex']
        ]);
    });
});

describe('upsert - a row whose key is in the data', () => {
    it('expect the values of the fields sent, the others left as they are', () => {
        const ds = stocks();
        const bob = row(ds, 2);
        ds.upsert([{ id: 2, price: 21 }]);
        expect(bob.price).toBe(21);
        expect(bob.name).toBe('Bob');
        expect(bob.group).toBe('a');
        // the row itself is updated, no new object
        expect(ds.getAllData()).toHaveLength(3);
        expect(ds.getAllData()[1]).toBe(bob);
    });

    it('expect a server value to be no edit: not edited, its original, no change to save', () => {
        const ds = stocks();
        const bob = row(ds, 2);
        ds.upsert([{ id: 2, price: 21, name: 'Bobby' }]);
        expect(bob.__rowState).toBeUndefined();
        expect(bob.__controller?.__edited).toBe(false);
        expect(bob.__controller?.__originalValues.price).toBe(21);
        expect(ds.getChanges()).toEqual({ newEntities: [], modifiedEntities: [], deletedEntities: [] });
        expect(ds.hasChanges()).toBe(false);
    });

    it('expect resetData() to keep the server values: they are the originals', () => {
        const ds = stocks();
        ds.upsert([{ id: 2, price: 21 }]);
        row(ds, 2).price = 99;
        ds.resetData();
        expect(row(ds, 2).price).toBe(21);
    });

    it('expect a later edit to be an edit of the server value', () => {
        const ds = stocks();
        const bob = row(ds, 2);
        ds.upsert([{ id: 2, price: 21 }]);
        bob.price = 25;
        expect(bob.__rowState).toBe('M');
        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 2, price: 25 }]);
        bob.price = 21;
        expect(bob.__rowState).toBeUndefined();
    });

    it('expect nothing in the undo history, and no history event', async () => {
        const ds = stocks();
        const sent = events(ds);
        ds.upsert([{ id: 2, price: 21 }]);
        await nextTask();
        expect(ds.canUndo()).toBe(false);
        expect(sent.filter((e) => e.type === 'history-changed')).toEqual([]);
    });

    it('expect the steps of the user to stay, the server value not in them', async () => {
        const ds = stocks();
        row(ds, 1).name = 'Anna';
        await nextTask();
        ds.upsert([{ id: 2, price: 21 }]);
        ds.undo();
        expect(row(ds, 1).name).toBe('Ann');
        expect(row(ds, 2).price).toBe(21);
        expect(ds.canUndo()).toBe(false);
    });

    it("expect undo of an edit after the server changed the field to go back to the server's value", async () => {
        const ds = stocks();
        const bob = row(ds, 2);
        bob.price = 22;
        await nextTask();
        bob.price = 25;
        await nextTask();
        ds.upsert([{ id: 2, price: 21 }]);
        ds.undo();
        expect(bob.price).toBe(22);
        ds.undo();
        // not 20: that would be an edit of the server's value, and a save would send it
        expect(bob.price).toBe(21);
        expect(bob.__rowState).toBeUndefined();
        ds.redo();
        ds.redo();
        expect(bob.price).toBe(25);
    });

    it('expect undo of a field edited and set back, then changed by the server, to give the server value', async () => {
        const ds = stocks();
        const bob = row(ds, 2);
        bob.price = 25;
        await nextTask();
        bob.price = 20;
        await nextTask();
        // not edited: the server's value is written
        ds.upsert([{ id: 2, price: 21 }]);
        expect(bob.price).toBe(21);
        ds.undo();
        expect(bob.price).toBe(25);
        ds.undo();
        expect(bob.price).toBe(21);
        expect(bob.__rowState).toBeUndefined();
    });

    it('expect a step that does nothing after the server changed the field to be dropped', async () => {
        const ds = stocks();
        const sent = events(ds);
        const bob = row(ds, 2);
        bob.price = 21;
        await nextTask();
        // the server has the user's value: the edit is done, undoing it would change nothing
        ds.upsert([{ id: 2, price: 21 }]);
        expect(ds.canUndo()).toBe(false);
        expect(sent.filter((e) => e.type === 'history-changed').map((e) => e.data)).toEqual([
            { info: 'edit' },
            { info: 'remove' }
        ]);
    });

    it('expect the fields it changed to be validated, as an edit', () => {
        const ds = stocks({ price: { type: 'number', validate: [{ id: 'min', value: 0 }] } });
        const bob = row(ds, 2);
        ds.upsert([{ id: 2, price: -5 }]);
        expect(ds.getErrors(bob).map((e) => [e.field, e.messages])).toEqual([['price', ['Must be at least 0']]]);
        ds.upsert([{ id: 2, price: 5 }]);
        expect(ds.getErrors(bob)).toEqual([]);
    });

    it('expect a field sent with the value it has to change nothing', async () => {
        const ds = stocks();
        const sent = events(ds);
        const result = ds.upsert([{ id: 1, name: 'Ann', price: 10 }]);
        await nextTask();
        expect(result.updated).toEqual([]);
        expect(sent).toEqual([]);
    });

    it('expect a date compared as the field compares it: the same day of a date field is no change', () => {
        const ds = new Datasource({ key: 'id', fields: { born: 'date' } });
        ds.setData([{ id: 1, born: new Date(2000, 1, 2) }]);
        const first = ds.getAllData()[0];
        const before = first.born;
        const result = ds.upsert([{ id: 1, born: new Date(2000, 1, 2, 10, 30) }]);
        expect(result.updated).toEqual([]);
        expect(first.born).toBe(before);
        ds.upsert([{ id: 1, born: new Date(2000, 1, 3) }]);
        expect(first.born).toEqual(new Date(2000, 1, 3));
    });

    it('expect a row marked for deletion to get the values, and keep its mark', () => {
        const ds = stocks();
        const bob = row(ds, 2);
        ds.markForDeletion(bob);
        ds.upsert([{ id: 2, price: 21 }]);
        expect(bob.price).toBe(21);
        expect(bob.__rowState).toBe('D');
        expect(ds.getChanges().deletedEntities).toEqual([{ id: 2, name: 'Bob', price: 21, group: 'a' }]);
    });

    it('expect the __ fields of an incoming row left out', () => {
        const ds = stocks();
        ds.upsert([{ id: 2, price: 21, __rowState: 'M' } as Stock]);
        expect(row(ds, 2).__rowState).toBeUndefined();
        expect(row(ds, 2).price).toBe(21);
    });
});

describe('upsert - a field the user has edited', () => {
    it("expect the user's value to stay, the server's to be its original", () => {
        const ds = stocks();
        const bob = row(ds, 2);
        bob.price = 25;
        ds.upsert([{ id: 2, price: 21, name: 'Bobby' }]);
        expect(bob.price).toBe(25);
        expect(bob.name).toBe('Bobby');
        expect(bob.__controller?.__originalValues.price).toBe(21);
        expect(bob.__rowState).toBe('M');
        // the user's value, as an edit of what the server has now
        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 2, price: 25 }]);
        // and reverting goes to the server's value
        ds.resetField(bob, 'price');
        expect(bob.price).toBe(21);
        expect(bob.__rowState).toBeUndefined();
    });

    it("expect the edit to be done when the server has the user's value", () => {
        const ds = stocks();
        const bob = row(ds, 2);
        bob.price = 25;
        const result = ds.upsert([{ id: 2, price: 25 }]);
        expect(bob.price).toBe(25);
        expect(bob.__rowState).toBeUndefined();
        expect(ds.hasChanges()).toBe(false);
        expect(result.conflicts).toEqual([]);
        expect(ds.getConflicts()).toEqual([]);
    });

    it('expect the edit to stay as it is when the server did not change the field', () => {
        const ds = stocks();
        const bob = row(ds, 2);
        bob.price = 25;
        const result = ds.upsert([{ id: 2, price: 20, name: 'Bob' }]);
        expect(bob.price).toBe(25);
        expect(bob.__controller?.__originalValues.price).toBe(20);
        expect(bob.__rowState).toBe('M');
        expect(result.updated).toEqual([]);
        expect(result.conflicts).toEqual([]);
    });

    it('expect the other edited fields of the row to stay edited when one is done', () => {
        const ds = stocks();
        const bob = row(ds, 2);
        bob.price = 25;
        bob.name = 'Bobby';
        ds.upsert([{ id: 2, price: 25 }]);
        expect(bob.__rowState).toBe('M');
        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 2, name: 'Bobby' }]);
    });

    it('expect a cell being typed in to keep what is typed, also when it is not edited', () => {
        const ds = stocks();
        const bob = row(ds, 2);
        const history = ds.getDataContainer().__history;
        // typed back to the value it had: not edited, but the user is in the cell
        history.typing(() => {
            bob.price = 20;
        });
        ds.upsert([{ id: 2, price: 21 }]);
        expect(bob.price).toBe(20);
        expect(bob.__controller?.__originalValues.price).toBe(21);
        expect(bob.__rowState).toBe('M');
        expect(ds.getConflicts().map((c) => c.field)).toEqual(['price']);

        // left: the next upsert writes the field again
        history.endTyping();
        ds.resolveConflict(bob, 'price', 'local');
        bob.price = 21;
        ds.upsert([{ id: 2, price: 22 }]);
        expect(bob.price).toBe(22);
    });

    it('expect a cell an editor of its own edits (startEditing) to be left as it is', () => {
        const ds = stocks();
        const bob = row(ds, 2);
        ds.getDataContainer().__history.startEditing(bob, 'name');
        ds.upsert([{ id: 2, name: 'Bobby', price: 21 }]);
        expect(bob.name).toBe('Bob');
        expect(bob.price).toBe(21);
    });
});

describe('upsert - new keys and new rows', () => {
    it('expect a new key to be added at the end: a loaded row, not new and not edited', () => {
        const ds = stocks();
        const incoming = { id: 4, name: 'Dan', price: 40 };
        const result = ds.upsert([incoming]);
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid', 'Dan']);
        const dan = row(ds, 4);
        expect(dan.__rowState).toBeUndefined();
        expect(ds.hasChanges()).toBe(false);
        expect(result.added).toEqual([dan]);
        // the object itself, as setData() adds it
        expect({ ...dan }).toEqual(incoming);
        dan.name = 'Danny';
        expect(incoming.name).toBe('Danny');
    });

    it('expect a key given twice: the second row updates what the first added', () => {
        const ds = stocks();
        const result = ds.upsert([
            { id: 4, name: 'Dan', price: 40 },
            { id: 4, price: 41 }
        ]);
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid', 'Dan']);
        expect(row(ds, 4).price).toBe(41);
        expect(result.added).toHaveLength(1);
    });

    it('expect a new row (addNewEmpty) never to match a key of the server', () => {
        const ds = stocks();
        ds.addNewEmpty({ name: 'New' });
        const added = ds.getAllData()[3];
        const temporary = added.id;
        expect(added.__rowState).toBe('N');

        ds.upsert([{ id: temporary, name: 'Server' }]);
        expect(added.name).toBe('New');
        expect(added.__rowState).toBe('N');
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid', 'New', 'Server']);
    });

    it('expect the rows added to be filtered, sorted and grouped as the rest', () => {
        const ds = stocks();
        ds.filter(where('price', 'GREATER_THAN', 15));
        ds.sort({ attribute: 'price', ascending: false });
        ds.upsert([
            { id: 4, name: 'Dan', price: 25, group: 'b' },
            { id: 5, name: 'Eve', price: 5, group: 'b' }
        ]);
        expect(displayed(ds)).toEqual(['Cid', 'Dan', 'Bob']);
    });
});

describe('upsert - removeMissing', () => {
    it('expect the rows the server did not send to be removed, by default not', () => {
        const ds = stocks();
        ds.upsert([{ id: 1, price: 11 }]);
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid']);

        const result = ds.upsert([{ id: 1, price: 12 }, { id: 3 }], { removeMissing: true });
        expect(names(ds)).toEqual(['Ann', 'Cid']);
        expect(displayed(ds)).toEqual(['Ann', 'Cid']);
        expect(result.removed.map((r) => r.name)).toEqual(['Bob']);
    });

    it('expect an empty list to remove every row without changes', () => {
        const ds = stocks();
        row(ds, 2).name = 'Bobby';
        ds.upsert([], { removeMissing: true });
        expect(names(ds)).toEqual(['Bobby']);
    });

    it('expect a new row to stay: the server does not have it yet', () => {
        const ds = stocks();
        ds.addNewEmpty({ name: 'New' });
        const result = ds.upsert([], { removeMissing: true });
        expect(names(ds)).toEqual(['New']);
        expect(result.conflicts).toEqual([]);
    });

    it('expect an edited row to stay, with a conflict for the row', () => {
        const ds = stocks();
        const bob = row(ds, 2);
        bob.price = 25;
        const result = ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid']);
        expect(result.conflicts).toEqual([{ row: bob, field: null, remote: 'removed' }]);
        expect(ds.getConflicts()).toEqual([{ row: bob, field: null, remote: 'removed' }]);
        expect(result.removed).toEqual([]);
    });

    it('expect a row marked for deletion to stay, with a conflict for the row', () => {
        const ds = stocks();
        const bob = row(ds, 2);
        ds.markForDeletion(bob);
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid']);
        expect(ds.getConflicts()).toEqual([{ row: bob, field: null, remote: 'removed' }]);
        expect(ds.getChanges().deletedEntities).toHaveLength(1);
    });

    it('expect a row with a cell being typed in to stay, with a conflict for the row', () => {
        const ds = stocks();
        const bob = row(ds, 2);
        ds.getDataContainer().__history.typing(() => {
            bob.price = 20;
        });
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid']);
        expect(ds.getConflicts().map((c) => c.field)).toEqual([null]);
    });

    it('expect the conflict once: the next upsert without the row does not make it again', () => {
        const ds = stocks();
        row(ds, 2).price = 25;
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        const result = ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        expect(result.conflicts).toEqual([]);
        expect(ds.getConflicts()).toHaveLength(1);
    });

    it('expect the conflict to go when the server sends the row again', () => {
        const ds = stocks();
        const bob = row(ds, 2);
        bob.price = 25;
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        const result = ds.upsert([{ id: 1 }, { id: 2 }, { id: 3 }], { removeMissing: true });
        expect(ds.getConflicts()).toEqual([]);
        expect(result.updated).toEqual([bob]);
        expect(bob.price).toBe(25);
    });

    it('expect the changes of the rows removed to leave the undo history', async () => {
        const ds = stocks();
        const sent = events(ds);
        // edited and set back: not edited, but in the history
        row(ds, 2).name = 'Bobby';
        row(ds, 2).name = 'Bob';
        await nextTask();
        expect(ds.canUndo()).toBe(true);
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        expect(ds.canUndo()).toBe(false);
        expect(sent.filter((e) => e.type === 'history-changed').map((e) => e.data)).toEqual([
            { info: 'edit' },
            { info: 'remove' }
        ]);
    });

    it('expect a removed row to leave the selection and the current row', () => {
        const ds = stocks();
        ds.select(2);
        expect(ds.currentEntity).toBe(row(ds, 2));
        const sent = events(ds);
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        expect(ds.currentEntity).toBeNull();
        expect(ds.getSelection().getSelectedKeys()).toEqual([]);
        expect(sent.map((e) => e.type)).toEqual(['collection-changed', 'current-entity', 'selection-change']);
    });
});

describe('upsert - the displayed rows and the events', () => {
    it('expect the selection to stay, by key, and the current row', () => {
        const ds = stocks();
        ds.sort({ attribute: 'price', ascending: true });
        ds.select(2);
        const bob = row(ds, 2);
        // Bob is the most expensive now: the displayed rows change, the selection follows the key
        ds.upsert([
            { id: 2, price: 99 },
            { id: 4, name: 'Dan', price: 1 }
        ]);
        expect(displayed(ds)).toEqual(['Dan', 'Ann', 'Cid', 'Bob']);
        expect(ds.getSelectedRows()).toEqual([bob]);
        expect(ds.currentEntity).toBe(bob);
    });

    it('expect the expanded groups to stay expanded', () => {
        const ds = stocks();
        ds.group([{ attribute: 'group', title: 'Group' }]);
        ds.expandGroup('a');
        ds.upsert([
            { id: 4, name: 'Dan', group: 'a' },
            { id: 5, name: 'Eve', group: 'c' }
        ]);
        expect(ds.getExpanded()).toEqual(['a']);
        expect(ds.getRows().map((r) => ('__groupID' in r ? `[${r.__groupID}]` : r.name))).toEqual([
            '[a]',
            'Ann',
            'Bob',
            'Dan',
            '[b]',
            '[c]'
        ]);
    });

    it('expect a row to move to its new group', () => {
        const ds = stocks();
        ds.group([{ attribute: 'group', title: 'Group' }]);
        ds.expandGroup();
        ds.upsert([{ id: 1, group: 'b' }]);
        expect(ds.getRows().map((r) => ('__groupID' in r ? `[${r.__groupID}]` : r.name))).toEqual([
            '[a]',
            'Bob',
            '[b]',
            'Ann',
            'Cid'
        ]);
    });

    it('expect the filter to run on the new values, and with refilter: false not', () => {
        const ds = stocks();
        ds.filter(where('price', 'GREATER_THAN', 15));
        expect(displayed(ds)).toEqual(['Bob', 'Cid']);

        ds.upsert([
            { id: 1, price: 16 },
            { id: 2, price: 5 }
        ]);
        expect(displayed(ds)).toEqual(['Ann', 'Cid']);

        // the rows shown stay, Ann too, and the one added is shown, though the filter leaves it out
        ds.upsert(
            [
                { id: 1, price: 1 },
                { id: 4, name: 'Dan', price: 1 }
            ],
            { refilter: false }
        );
        expect(displayed(ds)).toEqual(['Ann', 'Cid', 'Dan']);
        ds.filter();
        expect(displayed(ds)).toEqual(['Cid']);
    });

    it('expect refilter: false to take a removed row out of the rows shown', () => {
        const ds = stocks();
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true, refilter: false });
        expect(displayed(ds)).toEqual(['Ann', 'Cid']);
    });

    it('expect the sort to run on the new values', () => {
        const ds = stocks();
        ds.sort({ attribute: 'price', ascending: true });
        ds.upsert([{ id: 1, price: 99 }]);
        expect(displayed(ds)).toEqual(['Bob', 'Cid', 'Ann']);
    });

    it('expect filterChangedOnly: the edited rows shown, the server values change no row state', () => {
        const ds = stocks();
        row(ds, 2).price = 25;
        ds.filterChangedOnly(true);
        expect(displayed(ds)).toEqual(['Bob']);
        ds.upsert([
            { id: 1, price: 11 },
            { id: 2, price: 21 },
            { id: 4, name: 'Dan' }
        ]);
        expect(displayed(ds)).toEqual(['Bob']);
        // the server has the user's value: Bob is not changed any more
        ds.upsert([{ id: 2, price: 25 }]);
        expect(displayed(ds)).toEqual([]);
    });

    it('expect one collection-changed when rows were added, after it the rows-changed', async () => {
        const ds = stocks();
        const sent = events(ds);
        ds.upsert([
            { id: 1, price: 11 },
            { id: 4, name: 'Dan' }
        ]);
        expect(sent.map((e) => e.type)).toEqual(['collection-changed']);
        expect(sent[0].data).toEqual({ info: 'upsert', added: true });
        await nextTask();
        expect(sent.map((e) => e.type)).toEqual(['collection-changed', 'rows-changed']);
    });

    it('expect collection-changed with removed when rows were removed', () => {
        const ds = stocks();
        const sent = events(ds);
        ds.upsert([{ id: 1 }, { id: 3 }], { removeMissing: true });
        expect(sent.map((e) => e.data)).toEqual([{ info: 'upsert', added: false, removed: true }]);
    });

    it('expect no collection event when only values changed: rows-changed has the rows', async () => {
        const ds = stocks();
        const sent = events(ds);
        ds.upsert([
            { id: 1, price: 11 },
            { id: 3, name: 'Cyd' }
        ]);
        expect(sent).toEqual([]);
        await nextTask();
        expect(sent.map((e) => e.type)).toEqual(['rows-changed']);
        const data = sent[0].data as DatasourceEvents['rows-changed'];
        expect(data.rows).toEqual([row(ds, 1), row(ds, 3)]);
        expect(Array.from(data.fields.get(row(ds, 1)) ?? [])).toEqual(['price']);
        expect(Array.from(data.fields.get(row(ds, 3)) ?? [])).toEqual(['name']);
    });

    it('expect no collection event when grouped and the groups stay as they are', () => {
        const ds = stocks();
        ds.group([{ attribute: 'group', title: 'Group' }]);
        ds.expandGroup();
        const sent = events(ds);
        ds.upsert([{ id: 1, price: 11 }]);
        expect(sent).toEqual([]);
    });

    it('expect a collection event when the sort order changed', () => {
        const ds = stocks();
        ds.sort({ attribute: 'price', ascending: true });
        const sent = events(ds);
        ds.upsert([{ id: 1, price: 99 }]);
        expect(sent.map((e) => e.data)).toEqual([{ info: 'upsert', added: false }]);
    });

    it('expect the result to list the rows added, updated and removed, and the conflicts', () => {
        const ds = stocks();
        const [ann, bob] = ds.getAllData();
        bob.price = 25;
        const result = ds.upsert(
            [
                { id: 1, price: 11 },
                { id: 2, price: 21 },
                { id: 4, name: 'Dan' }
            ],
            { removeMissing: true }
        );
        expect(result.added).toEqual([row(ds, 4)]);
        expect(result.updated).toEqual([ann, bob]);
        expect(result.removed.map((r) => r.name)).toEqual(['Cid']);
        expect(result.conflicts).toEqual([{ row: bob, field: 'price', local: 25, remote: 21, original: 20 }]);
    });

    it('expect the other datasources on the container to see the values, and the rows after reloadDatasource()', () => {
        const container = new DataContainer('id');
        const left = new Datasource<Stock>({ container });
        const right = new Datasource<Stock>({ container });
        left.setData([{ id: 1, name: 'Ann' }]);
        right.reloadDatasource();
        left.upsert([
            { id: 1, name: 'Anna' },
            { id: 2, name: 'Bob' }
        ]);
        expect(right.getDataRows().map((r) => r.name)).toEqual(['Anna']);
        right.reloadDatasource();
        expect(right.getDataRows().map((r) => r.name)).toEqual(['Anna', 'Bob']);
    });
});

describe('upsert - getMergedAt', () => {
    it('expect the time of the upsert that changed a field, not for a field it did not change', () => {
        const ds = stocks();
        const [ann, bob] = ds.getAllData();
        const before = Date.now();
        ds.upsert([{ id: 1, price: 11, name: 'Ann' }]);
        const at = ds.getMergedAt(ann, 'price');
        expect(at).toBeGreaterThanOrEqual(before);
        expect(at).toBeLessThanOrEqual(Date.now());
        expect(ds.getMergedAt(ann, 'name')).toBeUndefined();
        expect(ds.getMergedAt(bob, 'price')).toBeUndefined();
    });

    it('expect no time for a value of the user, or a conflict: the value stays the user’s', () => {
        const ds = stocks();
        const [ann, bob] = ds.getAllData();
        ann.price = 15;
        bob.price = 25;
        ds.upsert([{ id: 2, price: 21 }]);
        expect(ds.getMergedAt(ann, 'price')).toBeUndefined();
        expect(ds.getMergedAt(bob, 'price')).toBeUndefined();
    });

    it('expect the time of the last upsert that changed it', async () => {
        const ds = stocks();
        const ann = ds.getAllData()[0];
        ds.upsert([{ id: 1, price: 11 }]);
        const first = ds.getMergedAt(ann, 'price') ?? 0;
        await new Promise((resolve) => setTimeout(resolve, 5));
        ds.upsert([{ id: 1, price: 11 }]);
        expect(ds.getMergedAt(ann, 'price')).toBe(first);
        ds.upsert([{ id: 1, price: 12 }]);
        expect(ds.getMergedAt(ann, 'price')).toBeGreaterThan(first);
    });
});

describe('many rows at once', () => {
    // a spread of this many rows into push() is more arguments than a call takes: a RangeError
    const many = (count: number, from = 0) => Array.from({ length: count }, (_, i) => ({ id: from + i, name: `n${from + i}` }));

    it('expect upsert() to add 300 000 rows, with refilter: false too', () => {
        const ds = new Datasource({ key: 'id' });
        ds.setData(many(3));
        ds.upsert(many(300_000, 10));
        expect(ds.getDataRows()).toHaveLength(300_003);
        ds.upsert(many(300_000, 1_000_000), { refilter: false });
        expect(ds.getDataRows()).toHaveLength(600_003);
    });

    it('expect setData(rows, { add: true }) to add 300 000 rows', () => {
        const ds = new Datasource({ key: 'id' });
        ds.setData(many(3));
        ds.setData(many(300_000, 10), { add: true, refilter: false });
        expect(ds.getDataRows()).toHaveLength(300_003);
    });
});
