import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';
import type { DatasourceEvents } from '../datasourceEvents';
import type { DatasourceOptions } from '../datasourceOptions';
import { HISTORY_LIMIT } from '../history';

/**
 * The undo/redo history: undo(), redo(), canUndo(), canRedo(), clearHistory(), the history-changed
 * event, and the reverts resetField() / resetRows().
 *
 * A step is closed in a microtask, so the tests wait for the next task (`nextTask()`) where two edits
 * must be two steps.
 */

interface Person {
    id: number;
    name?: string | null;
    age?: number | null;
    born?: Date | null;
}

const nextTask = () => new Promise((resolve) => setTimeout(resolve));

function people(fields: DatasourceOptions['fields'] = {}) {
    const ds = new Datasource<Person>({ key: 'id', fields });
    ds.setData([
        { id: 1, name: 'Ann', age: 36 },
        { id: 2, name: 'Bob', age: 40 },
        { id: 3, name: 'Cid', age: 50 }
    ]);
    return ds;
}

const names = (ds: Datasource<Person>) => ds.getAllData().map((row) => row.name);
const states = (ds: Datasource<Person>) => ds.getAllData().map((row) => row.__rowState);

/** the infos of the history-changed events sent from now on */
function historyEvents(ds: Datasource<Person>) {
    const infos: DatasourceEvents['history-changed']['info'][] = [];
    ds.on('history-changed', (data) => infos.push(data.info));
    return infos;
}

/** a keystroke as the grid writes it: inside typing(), its own task */
function type(ds: Datasource<Person>, row: Person, value: string) {
    ds.getDataContainer().__history.typing(() => {
        row.name = value;
    });
}

describe('history - a step', () => {
    it('expect nothing to undo or redo on new data', () => {
        const ds = people();
        expect(ds.canUndo()).toBe(false);
        expect(ds.canRedo()).toBe(false);
        expect(ds.undo()).toBe(false);
        expect(ds.redo()).toBe(false);
    });

    it('expect an edit to be a step: undo puts the value back and the row is not edited any more', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        ann.name = 'Anna';
        expect(ds.canUndo()).toBe(true);
        await nextTask();

        expect(ds.undo()).toBe(true);
        expect(ann.name).toEqual('Ann');
        expect(ann.__rowState).toBeUndefined();
        expect(ann.__controller?.__edited).toBe(false);
        expect(ds.getChanges().modifiedEntities).toEqual([]);
        expect(ds.canUndo()).toBe(false);
        expect(ds.canRedo()).toBe(true);
    });

    it('expect redo to set the value again, edited again', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        ann.name = 'Anna';
        await nextTask();
        ds.undo();

        expect(ds.redo()).toBe(true);
        expect(ann.name).toEqual('Anna');
        expect(ann.__rowState).toEqual('M');
        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 1, name: 'Anna' }]);
        expect(ds.canRedo()).toBe(false);
        expect(ds.canUndo()).toBe(true);
    });

    it('expect two edits in two tasks to be two steps, undone last first', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        ann.name = 'Anna';
        await nextTask();
        ann.name = 'Annie';
        await nextTask();

        ds.undo();
        expect(ann.name).toEqual('Anna');
        ds.undo();
        expect(ann.name).toEqual('Ann');
        ds.redo();
        ds.redo();
        expect(ann.name).toEqual('Annie');
    });

    it('expect the edits of one synchronous run to be one step - a paste or clear over many rows', async () => {
        const ds = people();
        for (const row of ds.getAllData()) {
            row.name = null;
            row.age = 0;
        }
        await nextTask();

        ds.undo();
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid']);
        expect(ds.getAllData().map((row) => row.age)).toEqual([36, 40, 50]);
        expect(ds.canUndo()).toBe(false);
    });

    it('expect an await in between to start a new step', async () => {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        ann.name = 'Anna';
        await Promise.resolve();
        bob.name = 'Bobby';
        await nextTask();

        ds.undo();
        expect(names(ds)).toEqual(['Anna', 'Bob', 'Cid']);
    });

    it('expect the same field set twice in one step to undo to the value before the first', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        ann.name = 'A';
        ann.name = 'B';
        await nextTask();

        ds.undo();
        expect(ann.name).toEqual('Ann');
        ds.redo();
        expect(ann.name).toEqual('B');
    });

    it('expect a write that changes nothing not to be recorded', async () => {
        const ds = people({ born: 'date' });
        const [ann] = ds.getAllData();
        ann.born = new Date(1990, 4, 17, 10);
        await nextTask();
        ann.name = 'Ann';
        // a date field compares on the day, as the edit tracking does
        ann.born = new Date(1990, 4, 17, 13);
        await nextTask();

        ds.undo();
        expect(ann.born).toBeUndefined();
        expect(ds.canUndo()).toBe(false);
    });

    it('expect undo in the run that made the step to take it back, and the next edit to be a new step', async () => {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        ann.name = 'Anna';
        ds.undo();
        bob.name = 'Bobby';
        await nextTask();

        expect(names(ds)).toEqual(['Ann', 'Bobby', 'Cid']);
        ds.undo();
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid']);
        expect(ds.canUndo()).toBe(false);
    });

    it('expect a new step to empty redo', async () => {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        ann.name = 'Anna';
        await nextTask();
        ds.undo();
        expect(ds.canRedo()).toBe(true);

        bob.name = 'Bobby';
        expect(ds.canRedo()).toBe(false);
        expect(ds.redo()).toBe(false);
        expect(ann.name).toEqual('Ann');
    });

    it(`expect the last ${HISTORY_LIMIT} steps to be kept`, async () => {
        const ds = people();
        const [, , cid] = ds.getAllData();
        expect(HISTORY_LIMIT).toEqual(100);
        for (let i = 1; i <= HISTORY_LIMIT + 5; i++) {
            cid.age = i;
            await Promise.resolve();
        }

        let undone = 0;
        while (ds.undo()) {
            undone++;
        }
        expect(undone).toEqual(HISTORY_LIMIT);
        // the 5 oldest steps were dropped: back to the value of the 5th edit
        expect(cid.age).toEqual(5);
    });

    it('expect edits from code and edits of new rows to be recorded, adding a row not', async () => {
        const ds = people();
        ds.addNewEmpty({ name: 'New' });
        ds.setData([{ id: 9, name: 'Added' }], { add: true });
        expect(ds.canUndo()).toBe(false);

        const added = ds.getAllData()[3];
        added.name = 'Changed';
        await nextTask();
        ds.undo();
        expect(added.name).toEqual('New');
        expect(added.__rowState).toEqual('N');
        expect(ds.getAllData()).toHaveLength(5);
    });
});

describe('history - typing in a cell is one step', () => {
    it('expect the keystrokes in one cell to join one step', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        for (const value of ['A', 'An', 'Ana']) {
            type(ds, ann, value);
            await nextTask();
        }

        expect(ds.getDataContainer().__history.isTyping(ann, 'name')).toBe(true);
        ds.undo();
        expect(ann.name).toEqual('Ann');
        expect(ds.canUndo()).toBe(false);
        ds.redo();
        expect(ann.name).toEqual('Ana');
    });

    it('expect endTyping() - the focus leaving the cell - to make the next keystroke a new step', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        type(ds, ann, 'Anna');
        await nextTask();
        ds.getDataContainer().__history.endTyping();
        expect(ds.getDataContainer().__history.isTyping(ann, 'name')).toBe(false);
        type(ds, ann, 'Annie');
        await nextTask();

        ds.undo();
        expect(ann.name).toEqual('Anna');
        ds.undo();
        expect(ann.name).toEqual('Ann');
    });

    it('expect a keystroke in another cell, an edit from code or an undo in between to start a new step', async () => {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        type(ds, ann, 'Anna');
        await nextTask();
        type(ds, bob, 'Bobby');
        await nextTask();
        expect(ds.getDataContainer().__history.isTyping(ann, 'name')).toBe(false);
        type(ds, ann, 'Annie');
        await nextTask();
        ann.age = 1; // from code
        await nextTask();
        type(ds, ann, 'An');
        await nextTask();

        // An, the age, Annie, Bobby, Anna: five steps
        let steps = 0;
        while (ds.undo()) {
            steps++;
        }
        expect(steps).toEqual(5);
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid']);

        // after an undo the next keystroke is a step of its own
        ds.redo();
        type(ds, ann, 'Anne');
        await nextTask();
        ds.undo();
        expect(ann.name).toEqual('Anna');
    });

    it('expect typing back to the value it started from to drop the step, and send edit', async () => {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        bob.name = 'Bobby';
        await nextTask();
        const infos = historyEvents(ds);

        type(ds, ann, 'Annx');
        await nextTask();
        type(ds, ann, 'Ann');
        await nextTask();

        expect(infos).toEqual(['edit', 'edit']);
        expect(ds.getDataContainer().__history.isTyping(ann, 'name')).toBe(false);
        ds.undo();
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid']);
        expect(ds.canUndo()).toBe(false);
    });
});

describe('history - validation follows', () => {
    it('expect an edit that made an error, undone, to clear it - and redo to bring it back', async () => {
        const ds = people({ name: { validate: ['required'] } });
        const [ann] = ds.getAllData();
        ann.name = '';
        expect(ds.hasErrors()).toBe(true);
        await nextTask();

        ds.undo();
        expect(ds.hasErrors()).toBe(false);
        ds.redo();
        expect(ds.getErrors().map(({ field, messages }) => [field, messages])).toEqual([['name', ['Required']]]);
    });
});

describe('history - deletion marks', () => {
    it('expect markForDeletion() to be a step: undo unmarks, redo marks again', async () => {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        ds.markForDeletion([ann, bob]);
        await nextTask();

        ds.undo();
        expect(states(ds)).toEqual([undefined, undefined, undefined]);
        ds.redo();
        expect(states(ds)).toEqual(['D', 'D', undefined]);
    });

    it('expect markAllForDeletion() and unmarkAllForDeletion() to be a step each', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        ds.markForDeletion(ann);
        await nextTask();
        ds.markAllForDeletion();
        await nextTask();
        ds.unmarkAllForDeletion();
        await nextTask();

        ds.undo();
        expect(states(ds)).toEqual(['D', 'D', 'D']);
        ds.undo();
        // ann was marked before: only the two others are unmarked
        expect(states(ds)).toEqual(['D', undefined, undefined]);
        ds.undo();
        expect(states(ds)).toEqual([undefined, undefined, undefined]);
    });

    it('expect unmarkForDeletion() to be a step, and a row already marked to change nothing', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        ds.markForDeletion(ann);
        await nextTask();
        ds.markForDeletion(ann); // already marked
        await nextTask();
        ds.unmarkForDeletion(ann);
        await nextTask();

        ds.undo();
        expect(ann.__rowState).toEqual('D');
        ds.undo();
        expect(ann.__rowState).toBeUndefined();
        expect(ds.canUndo()).toBe(false);
    });

    it('expect an edit and a mark in one run to be one step', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        ann.name = 'Anna';
        ds.markForDeletion(ann);
        await nextTask();

        ds.undo();
        expect([ann.name, ann.__rowState]).toEqual(['Ann', undefined]);
    });
});

describe('history - what clears it', () => {
    /** a datasource with a step to undo and one to redo */
    async function withHistory() {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        ann.name = 'Anna';
        await nextTask();
        bob.name = 'Bobby';
        await nextTask();
        ds.undo();
        expect([ds.canUndo(), ds.canRedo()]).toEqual([true, true]);
        return ds;
    }

    it.each([
        ['setData()', (ds: Datasource<Person>) => ds.setData([{ id: 1, name: 'Ann' }])],
        ['removeAllData()', (ds: Datasource<Person>) => ds.removeAllData()],
        ['resetData()', (ds: Datasource<Person>) => ds.resetData()],
        ['acceptChanges()', (ds: Datasource<Person>) => ds.acceptChanges()],
        ['acceptChanges() of some rows', (ds: Datasource<Person>) => ds.acceptChanges({ rows: ds.getAllData()[2] })],
        ['clearHistory()', (ds: Datasource<Person>) => ds.clearHistory()]
    ])('expect %s to clear it, and send clear', async (_name, clear) => {
        const ds = await withHistory();
        const infos = historyEvents(ds);

        clear(ds);
        await nextTask();

        expect([ds.canUndo(), ds.canRedo()]).toEqual([false, false]);
        expect(infos).toEqual(['clear']);
    });

    it('expect resetData() with a new row that was edited to send clear only', async () => {
        const ds = await withHistory();
        ds.addNewEmpty({ name: 'New' });
        ds.getAllData()[3].name = 'Typed';
        await nextTask();
        const infos = historyEvents(ds);

        ds.resetData();
        expect(infos).toEqual(['clear']);
    });

    it('expect clearHistory() to keep the edits, and to send nothing when it is empty', async () => {
        const ds = await withHistory();
        ds.clearHistory();
        const infos = historyEvents(ds);
        ds.clearHistory();
        ds.setData([{ id: 1, name: 'Ann' }]);

        expect(infos).toEqual([]);
    });

    it('expect clearHistory() to keep the values', async () => {
        const ds = await withHistory();
        ds.clearHistory();
        expect(names(ds)).toEqual(['Anna', 'Bob', 'Cid']);
    });

    it('expect setData() with add, and addNewEmpty(), to keep it', async () => {
        const ds = await withHistory();
        ds.setData([{ id: 9, name: 'Zed' }], { add: true });
        ds.addNewEmpty({ name: 'New' });

        expect([ds.canUndo(), ds.canRedo()]).toEqual([true, true]);
        ds.redo();
        expect(names(ds)).toEqual(['Anna', 'Bobby', 'Cid', 'Zed', 'New']);
    });
});

describe('history - rows that leave the data', () => {
    it('expect removeData() to drop their changes, and a step left empty', async () => {
        const ds = people();
        const [ann, bob, cid] = ds.getAllData();
        ann.name = 'Anna';
        await nextTask();
        ann.name = 'Annie';
        bob.name = 'Bobby';
        await nextTask();
        cid.name = 'Cyd';
        await nextTask();
        ds.undo(); // cid's step is in redo
        const infos = historyEvents(ds);

        ds.removeData([ann, cid]);

        expect(infos).toEqual(['remove']);
        // cid's step is gone, ann's first step too: bob's change is left
        expect(ds.canRedo()).toBe(false);
        ds.undo();
        expect(bob.name).toEqual('Bob');
        expect(ann.name).toEqual('Annie'); // not in the data, not written
        expect(ds.canUndo()).toBe(false);
    });

    it('expect removeData() of a row without changes to send nothing', async () => {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        ann.name = 'Anna';
        await nextTask();
        const infos = historyEvents(ds);

        ds.removeData(bob);
        expect(infos).toEqual([]);
        expect(ds.canUndo()).toBe(true);
    });

    it('expect removeData() in the run that made the step to drop it, and the run to go on in a new one', async () => {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        ann.name = 'Anna';
        ds.removeData(ann);
        bob.name = 'Bobby';
        await nextTask();

        ds.undo();
        expect(bob.name).toEqual('Bob');
        expect(ds.canUndo()).toBe(false);
    });

    it('expect clearMarkedForDeletion() to drop the changes of the rows it removed', async () => {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        bob.name = 'Bobby';
        await nextTask();
        ds.markForDeletion(ann);
        await nextTask();

        ds.clearMarkedForDeletion();
        ds.undo();
        expect(bob.name).toEqual('Bob');
        expect(ds.canUndo()).toBe(false);
    });

    it("expect the container's replace() to drop the changes of the rows it replaced", async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        ann.name = 'Anna';
        await nextTask();

        ds.getDataContainer().replace([{ id: 7, name: 'Zed' }], 0, 1);
        expect(ds.canUndo()).toBe(false);
    });
});

describe('history - shared by the datasources on a container', () => {
    it('expect an edit through one to be undone through the other, and both to send the events', async () => {
        const container = new DataContainer('id');
        const left = new Datasource<Person>({ container });
        const right = new Datasource<Person>({ container });
        left.setData([{ id: 1, name: 'Ann' }]);
        right.reloadDatasource();
        const leftInfos = historyEvents(left);
        const rightInfos = historyEvents(right);

        left.getAllData()[0].name = 'Anna';
        await nextTask();
        expect(right.canUndo()).toBe(true);
        right.undo();

        expect(left.getAllData()[0].name).toEqual('Ann');
        expect(left.canRedo()).toBe(true);
        expect(leftInfos).toEqual(['edit', 'undo']);
        expect(rightInfos).toEqual(['edit', 'undo']);
    });

    it('expect on() to return a function that unsubscribes from the history', async () => {
        const ds = people();
        const infos: string[] = [];
        const off = ds.on('history-changed', (data) => infos.push(data.info));
        off();
        ds.getAllData()[0].name = 'Anna';
        await nextTask();
        ds.undo();
        expect(infos).toEqual([]);
    });
});

describe('history - the history-changed event', () => {
    it('expect edit once per step, after the run that made it', async () => {
        const ds = people();
        const infos = historyEvents(ds);
        for (const row of ds.getAllData()) {
            row.name = 'x';
        }
        expect(infos).toEqual([]);
        await nextTask();
        expect(infos).toEqual(['edit']);
    });

    it('expect undo and redo at once, and an undone run to send no edit', async () => {
        const ds = people();
        const infos = historyEvents(ds);
        ds.getAllData()[0].name = 'Anna';
        ds.undo();
        expect(infos).toEqual(['undo']);
        ds.redo();
        expect(infos).toEqual(['undo', 'redo']);
        await nextTask();
        expect(infos).toEqual(['undo', 'redo']);
    });

    it('expect no event for a keystroke that joins the step of the cell', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        const infos = historyEvents(ds);
        type(ds, ann, 'A');
        await nextTask();
        type(ds, ann, 'An');
        await nextTask();
        expect(infos).toEqual(['edit']);
    });

    it('expect the reverts to send edit, resetData() no edit for its own writes', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        ann.name = 'Anna';
        await nextTask();
        const infos = historyEvents(ds);

        ds.resetField(ann, 'name');
        await nextTask();
        ann.name = 'Annie';
        await nextTask();
        ds.resetRows(ann);
        await nextTask();
        ann.name = 'Anna';
        ds.resetData();
        await nextTask();

        expect(infos).toEqual(['edit', 'edit', 'edit', 'clear']);
    });
});

describe('history - resetField()', () => {
    it('expect the original value back, as a step undo takes back', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        ann.name = 'Anna';
        ann.age = 1;
        await nextTask();

        ds.resetField(ann, 'name');
        expect([ann.name, ann.age, ann.__rowState]).toEqual(['Ann', 1, 'M']);
        await nextTask();
        ann.age = 36;
        expect(ann.__rowState).toBeUndefined();
        await nextTask();

        ds.undo(); // age
        ds.undo(); // the revert
        expect([ann.name, ann.age]).toEqual(['Anna', 1]);
    });

    it('expect a field that is not edited, and a row not in the data, to be left as they are', async () => {
        const ds = people();
        const [ann] = ds.getAllData();
        ann.name = 'Anna';
        ann.name = 'Ann'; // back, no edit
        await nextTask();
        ds.clearHistory();

        ds.resetField(ann, 'name');
        ds.resetField(ann, 'age');
        ds.resetField({ id: 9, name: 'x' }, 'name');
        expect(ds.canUndo()).toBe(false);
    });

    it('expect the field to be validated, as an edit', () => {
        const ds = people({ name: { validate: ['required'] } });
        ds.setData([{ id: 1, name: '' }]);
        const [row] = ds.getAllData();
        row.name = 'Ann';
        expect(ds.hasErrors()).toBe(false);

        ds.resetField(row, 'name');
        expect(ds.getErrors().map(({ field }) => field)).toEqual(['name']);
    });
});

describe('history - resetRows()', () => {
    it('expect the rows back to their originals and unmarked, as one step', async () => {
        const ds = people();
        const [ann, bob, cid] = ds.getAllData();
        ann.name = 'Anna';
        ann.age = 1;
        bob.name = 'Bobby';
        ds.markForDeletion(bob);
        cid.name = 'Cyd';
        await nextTask();

        ds.resetRows([ann, bob]);
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cyd']);
        expect(ann.age).toEqual(36);
        expect(states(ds)).toEqual([undefined, undefined, 'M']);
        await nextTask();

        ds.undo();
        expect(names(ds)).toEqual(['Anna', 'Bobby', 'Cyd']);
        expect(ann.age).toEqual(1);
        expect(states(ds)).toEqual(['M', 'D', 'M']);
    });

    it('expect a new row to be marked for deletion, with the values it was added with: it is not on the server - and undo to bring it back', async () => {
        const ds = people();
        ds.addNewEmpty({ name: 'New' });
        const added = ds.getAllData()[3];
        added.name = 'Typed';
        added.age = 5;
        await nextTask();

        ds.resetRows(added);
        // still in the data, struck through, no change any more
        expect(ds.getAllData()).toHaveLength(4);
        expect([added.name, added.age, added.__rowState]).toEqual(['New', undefined, 'D']);
        expect(ds.getChanges()).toEqual({ newEntities: [], modifiedEntities: [], deletedEntities: [] });
        expect(ds.hasChanges()).toBe(false);
        await nextTask();

        ds.undo();
        expect([added.name, added.age, added.__rowState]).toEqual(['Typed', 5, 'N']);
        expect(ds.getChanges().newEntities).toHaveLength(1);
    });

    it('expect a new row not edited to be marked too, and one marked already to stay marked', async () => {
        const ds = people();
        ds.addNewEmpty({ name: 'New' });
        ds.addNewEmpty({ name: 'Other' });
        const [added, other] = ds.getAllData().slice(3);
        ds.markForDeletion(other);
        other.name = 'Typed';
        await nextTask();

        ds.resetRows([added, other]);
        expect([added.name, added.__rowState]).toEqual(['New', 'D']);
        expect([other.name, other.__rowState]).toEqual(['Other', 'D']);
        await nextTask();

        ds.undo();
        expect([added.name, added.__rowState]).toEqual(['New', 'N']);
        expect([other.name, other.__rowState]).toEqual(['Typed', 'D']);
    });

    it('expect a row without changes, and one that is not in the data, to make no step', () => {
        const ds = people();
        ds.resetRows([ds.getAllData()[0], { id: 9 }]);
        expect(ds.canUndo()).toBe(false);
    });

    it('expect the fields to be validated as for an edit: an error of an edit goes with it', async () => {
        const ds = people({ name: { validate: ['required'] } });
        const [ann] = ds.getAllData();
        ann.name = '';
        expect(ds.hasErrors()).toBe(true);

        ds.resetRows(ann);
        expect(ds.hasErrors()).toBe(false);
    });
});

describe('history - resetDataSelectionOnly()', () => {
    it('expect a step that brings the edits and marks back, not the new rows it removed', async () => {
        const ds = people();
        const [ann, bob] = ds.getAllData();
        ann.name = 'Anna';
        ds.markForDeletion(bob);
        ds.addNewEmpty({ name: 'New' }); // selected
        const added = ds.getAllData()[3];
        added.name = 'Typed';
        ds.getSelection().selectRowRange(0, 3);
        await nextTask();

        ds.resetDataSelectionOnly();
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid']);
        await nextTask();

        ds.undo();
        expect(names(ds)).toEqual(['Anna', 'Bob', 'Cid']);
        expect(states(ds)).toEqual(['M', 'D', undefined]);
        // the new row's changes left with it
        ds.undo();
        expect(names(ds)).toEqual(['Ann', 'Bob', 'Cid']);
        expect(states(ds)).toEqual([undefined, undefined, undefined]);
        expect(ds.canUndo()).toBe(false);
    });
});
