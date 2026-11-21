import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';
import type { DatasourceEvents } from '../datasourceEvents';

/**
 * The rows-changed event: once per run of code (a microtask), with the rows whose values (or deletion
 * mark, server error, conflict) changed and the fields set on each. The grid renders the rows of it
 * that are on screen. And History.editingCell(), the cell the user is editing, which neither an upsert
 * nor the grid's render overwrite.
 */

interface Person {
    id: number;
    name?: string;
    age?: number | null;
}

const nextTask = () => new Promise((resolve) => setTimeout(resolve));

function people() {
    const ds = new Datasource<Person>({ key: 'id', fields: { age: { type: 'number', validate: [{ id: 'min', value: 0 }] } } });
    ds.setData([
        { id: 1, name: 'Ann', age: 36 },
        { id: 2, name: 'Bob', age: 40 },
        { id: 3, name: 'Cid', age: 50 }
    ]);
    return ds;
}

/** the rows-changed events from now on, the rows by name and their fields */
function rowsChanged(ds: Datasource<Person>) {
    const sent: { rows: (string | undefined)[]; fields: string[][] }[] = [];
    ds.on('rows-changed', (data: DatasourceEvents['rows-changed']) => {
        sent.push({
            rows: data.rows.map((row) => row.name),
            fields: data.rows.map((row) => Array.from(data.fields.get(row) ?? []))
        });
    });
    return sent;
}

describe('rows-changed - one event per run of code', () => {
    it('expect one event for every value set in one run, each row once, after the code is done', async () => {
        const ds = people();
        const sent = rowsChanged(ds);
        const [ann, bob] = ds.getAllData();
        bob.name = 'Bobby';
        ann.age = 37;
        bob.age = 41;
        ann.age = 38;
        expect(sent).toEqual([]);
        await Promise.resolve();
        expect(sent).toEqual([{ rows: ['Bobby', 'Ann'], fields: [['name', 'age'], ['age']] }]);
        await nextTask();
        expect(sent).toHaveLength(1);
    });

    it('expect two events for code with an await in between', async () => {
        const ds = people();
        const sent = rowsChanged(ds);
        const [ann, bob] = ds.getAllData();
        ann.name = 'Anna';
        await Promise.resolve();
        bob.name = 'Bobby';
        await nextTask();
        expect(sent.map((e) => e.rows)).toEqual([['Anna'], ['Bobby']]);
    });

    it('expect no event when nothing changed, nor for a value set to what it is', async () => {
        const ds = people();
        const sent = rowsChanged(ds);
        const ann = ds.getAllData()[0];
        // biome-ignore lint/correctness/noSelfAssign: the same value set again
        ann.name = ann.name;
        ds.filter();
        ds.sort({ attribute: 'name', ascending: true });
        await nextTask();
        expect(sent).toEqual([]);
    });

    it('expect the rows of undo and redo, and of resetField() / resetRows()', async () => {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        ann.name = 'Anna';
        bob.age = 1;
        await nextTask();
        const sent = rowsChanged(ds);
        ds.undo();
        await nextTask();
        ds.redo();
        await nextTask();
        ds.resetField(ann, 'name');
        await nextTask();
        ds.resetRows(bob);
        await nextTask();
        expect(sent).toEqual([
            // undo writes the last change of the step first
            { rows: ['Bob', 'Ann'], fields: [['age'], ['name']] },
            { rows: ['Anna', 'Bob'], fields: [['name'], ['age']] },
            { rows: ['Ann'], fields: [['name']] },
            { rows: ['Bob'], fields: [['age']] }
        ]);
    });

    it('expect a row whose deletion mark changed, without fields: from the methods and from undo', async () => {
        const ds = people();
        const bob = ds.getAllData()[1];
        const sent = rowsChanged(ds);
        ds.markForDeletion(bob);
        await nextTask();
        ds.undo();
        await nextTask();
        expect(sent).toEqual([
            { rows: ['Bob'], fields: [[]] },
            { rows: ['Bob'], fields: [[]] }
        ]);
    });

    it('expect the rows whose server error changed (setErrors)', async () => {
        const ds = people();
        const sent = rowsChanged(ds);
        ds.getDataContainer().setErrors(new Map([['2', 'taken']]));
        await nextTask();
        ds.getDataContainer().setErrors(new Map([['2', 'taken']]));
        await nextTask();
        ds.getDataContainer().setErrors(new Map());
        await nextTask();
        expect(sent.map((e) => e.rows)).toEqual([['Bob'], ['Bob']]);
    });

    it('expect the rows an upsert changed, not the ones it added or removed', async () => {
        const ds = people();
        const sent = rowsChanged(ds);
        ds.upsert(
            [
                { id: 1, age: 37 },
                { id: 3, name: 'Cid' },
                { id: 4, name: 'Dan' }
            ],
            { removeMissing: true }
        );
        await nextTask();
        expect(sent).toEqual([{ rows: ['Ann'], fields: [['age']] }]);
    });

    it('expect a row whose conflict came, with the field', async () => {
        const ds = people();
        const bob = ds.getAllData()[1];
        bob.age = 41;
        await nextTask();
        const sent = rowsChanged(ds);
        ds.upsert([{ id: 2, age: 42 }]);
        await nextTask();
        ds.resolveConflict(bob, 'age', 'local');
        await nextTask();
        expect(sent).toEqual([
            { rows: ['Bob'], fields: [['age']] },
            { rows: ['Bob'], fields: [['age']] }
        ]);
    });

    it('expect the validation of an edit done when the event comes', async () => {
        const ds = people();
        const bob = ds.getAllData()[1];
        const errors: string[] = [];
        ds.on('rows-changed', () => errors.push(...ds.getErrors(bob).map((e) => e.field)));
        bob.age = -1;
        await nextTask();
        expect(errors).toEqual(['age']);
    });

    it('expect every datasource on the container to send it, for a change through any of them', async () => {
        const container = new DataContainer('id');
        const left = new Datasource<Person>({ container });
        const right = new Datasource<Person>({ container });
        left.setData([{ id: 1, name: 'Ann' }]);
        const sent: string[] = [];
        left.on('rows-changed', () => sent.push('left'));
        right.on('rows-changed', () => sent.push('right'));
        right.getAllData()[0].name = 'Anna';
        await nextTask();
        expect(sent).toEqual(['left', 'right']);
    });

    it('expect a handler that sets values to get them in the next event', async () => {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        const sent: string[][] = [];
        ds.on('rows-changed', (data) => {
            sent.push(data.rows.map((row) => row.name));
            if (data.rows.includes(ann)) {
                bob.age = ann.age;
            }
        });
        ann.age = 1;
        await nextTask();
        expect(sent).toEqual([['Ann'], ['Bob']]);
    });

    it('expect unsubscribing to stop it', async () => {
        const ds = people();
        let count = 0;
        const off = ds.on('rows-changed', () => count++);
        off();
        ds.getAllData()[0].name = 'Anna';
        await nextTask();
        expect(count).toBe(0);
    });
});

describe('History.editingCell() - the cell being edited', () => {
    it('expect the cell the grid typed in, until endTyping()', () => {
        const ds = people();
        const history = ds.getDataContainer().__history;
        const bob = ds.getAllData()[1];
        expect(history.editingCell()).toBeNull();
        history.typing(() => {
            bob.name = 'Bobby';
        });
        expect(history.editingCell()).toEqual({ row: bob, field: 'name' });
        history.endTyping();
        expect(history.editingCell()).toBeNull();
    });

    it('expect a keystroke that changed nothing to count: the user is in the cell', () => {
        const ds = people();
        const history = ds.getDataContainer().__history;
        const bob = ds.getAllData()[1];
        history.typing(() => {
            bob.name = 'Bob';
        });
        expect(history.editingCell()).toEqual({ row: bob, field: 'name' });
    });

    it('expect a value set from code not to count', () => {
        const ds = people();
        ds.getAllData()[1].name = 'Bobby';
        expect(ds.getDataContainer().__history.editingCell()).toBeNull();
    });

    it('expect startEditing() for an editor of its own, and the cell to go when its row leaves', () => {
        const ds = people();
        const history = ds.getDataContainer().__history;
        const bob = ds.getAllData()[1];
        history.startEditing(bob, 'age');
        expect(history.editingCell()).toEqual({ row: bob, field: 'age' });
        ds.removeData(bob);
        expect(history.editingCell()).toBeNull();
    });
});
