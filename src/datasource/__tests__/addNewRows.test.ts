import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { isGroupRow } from '../entity';

/**
 * datasource.addNewRows(): several new rows at once - what the grid's import adds - and the container's
 * __recordAdded() (the import as one step of the undo history) and __checkRow() (the rules of a row
 * before it is added)
 */

interface Person {
    id?: number;
    name?: string | null;
    age?: number | null;
    country?: string;
}

const nextTask = () => new Promise((resolve) => setTimeout(resolve));

function people() {
    const datasource = new Datasource<Person>({
        key: 'id',
        fields: { name: { validate: ['required'] }, age: { type: 'number', validate: [{ id: 'min', value: 0 }] } }
    });
    datasource.setData([
        { id: 1, name: 'Cid', age: 30, country: 'Norway' },
        { id: 2, name: 'Ann', age: 20, country: 'Sweden' }
    ]);
    return datasource;
}

describe('addNewRows', () => {
    it('expect new rows at the end, in newEntities, with generated keys, the objects themselves', () => {
        const datasource = people();
        const values = [{ name: 'Dan' }, { name: 'Eve', age: 5 }];
        const added = datasource.addNewRows(values);
        expect(added.map((row) => row.name)).toEqual(['Dan', 'Eve']);
        expect(added.map((row) => row.__rowState)).toEqual(['N', 'N']);
        expect(added.map((row) => row.id)).toEqual([-1, -2]);
        expect(datasource.getChanges().newEntities.map((row) => row.name)).toEqual(['Dan', 'Eve']);
        expect(datasource.getRows().map((row) => (isGroupRow(row) ? '' : row.name))).toEqual(['Cid', 'Ann', 'Dan', 'Eve']);
        // the objects become the rows, as addNewEmpty()
        values[0].name = 'Changed';
        expect(added[0].name).toBe('Changed');
    });

    it('expect the rows at the end also when sorted or filtered, until the next sort', () => {
        const datasource = people();
        datasource.sort({ attribute: 'name', ascending: true });
        datasource.addNewRows([{ name: 'Bob' }, { name: 'Abe' }]);
        expect(datasource.getRows().map((row) => (isGroupRow(row) ? '' : row.name))).toEqual(['Ann', 'Cid', 'Bob', 'Abe']);
        datasource.sort({ attribute: 'name', ascending: true });
        expect(datasource.getRows().map((row) => (isGroupRow(row) ? '' : row.name))).toEqual(['Abe', 'Ann', 'Bob', 'Cid']);
    });

    it('expect the rows in their groups when grouped, the group of the first expanded', () => {
        const datasource = people();
        datasource.group([{ attribute: 'country', title: 'Country' }]);
        datasource.collapseGroup();
        datasource.addNewRows([
            { name: 'Dan', country: 'Sweden' },
            { name: 'Eve', country: 'Denmark' }
        ]);
        const shown = datasource.getRows().map((row) => (isGroupRow(row) ? `[${row.__groupName}]` : row.name));
        expect(shown).toEqual(['[Country: Denmark]', '[Country: Norway]', '[Country: Sweden]', 'Ann', 'Dan']);
    });

    it('expect the first new row selected and current, select sent once - or nothing with scrollTo: false', () => {
        const datasource = people();
        const events: string[] = [];
        datasource.on('select', ({ row }) => events.push(`select ${row}`));
        datasource.on('collection-changed', ({ added }) => events.push(`changed ${added}`));
        const added = datasource.addNewRows([{ name: 'Dan' }, { name: 'Eve' }]);
        expect(datasource.currentEntity).toBe(added[0]);
        expect(datasource.getSelectedRows()).toEqual([added[0]]);
        expect(events).toEqual(['changed true', 'select 2']);

        const quiet = people();
        quiet.select(1);
        quiet.addNewRows([{ name: 'Fay' }], { scrollTo: false });
        expect(quiet.currentEntity).toBe(quiet.getDataRows()[0]);
    });

    it('expect no rows to do nothing, and not to be validated, not a step of the undo history', async () => {
        const datasource = people();
        let changed = 0;
        datasource.on('collection-changed', () => changed++);
        expect(datasource.addNewRows([])).toEqual([]);
        expect(changed).toBe(0);
        datasource.addNewRows([{ age: -1 }]);
        await nextTask();
        expect(datasource.hasErrors()).toBe(false);
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect a TypeError for rows that are not an array, and for a boolean as the options', () => {
        const datasource = people();
        expect(() => datasource.addNewRows({ name: 'x' } as never)).toThrow(TypeError);
        expect(() => datasource.addNewRows([], true as never)).toThrow(TypeError);
    });
});

describe('DataContainer.__recordAdded - the import as one step of the undo history', () => {
    it('expect undo to take the rows out (marked for deletion, in no list of getChanges), redo to bring them back', async () => {
        const datasource = people();
        const container = datasource.getDataContainer();
        const added = datasource.addNewRows([{ name: 'Dan' }, { name: 'Eve' }]);
        container.__recordAdded(added);
        await nextTask();
        expect(datasource.canUndo()).toBe(true);

        expect(datasource.undo()).toBe(true);
        expect(added.map((row) => row.__rowState)).toEqual(['D', 'D']);
        expect(datasource.getChanges()).toEqual({ newEntities: [], modifiedEntities: [], deletedEntities: [] });
        expect(datasource.hasChanges()).toBe(false);

        expect(datasource.redo()).toBe(true);
        expect(added.map((row) => row.__rowState)).toEqual(['N', 'N']);
        expect(datasource.getChanges().newEntities).toHaveLength(2);
    });

    it('expect an edit after the import to be a step of its own: undo takes the edit back first', async () => {
        const datasource = people();
        const added = datasource.addNewRows([{ name: 'Dan' }]);
        datasource.getDataContainer().__recordAdded(added);
        await nextTask();
        added[0].name = 'Danny';
        await nextTask();
        datasource.undo();
        expect(added[0].name).toBe('Dan');
        expect(added[0].__rowState).toBe('N');
        datasource.undo();
        expect(added[0].__rowState).toBe('D');
    });

    it('expect rows that are not new, marked already or not in the container to be left out', async () => {
        const datasource = people();
        const [cid] = datasource.getDataRows();
        datasource.getDataContainer().__recordAdded([cid, { name: 'stranger' } as never]);
        await nextTask();
        expect(datasource.canUndo()).toBe(false);
    });
});

describe('DataContainer.__checkRow - the rules of a row before it is added', () => {
    it('expect the messages of every field with rules, nothing kept', () => {
        const datasource = people();
        const container = datasource.getDataContainer();
        expect(container.__checkRow({ name: 'Ok', age: 3 })).toEqual(new Map());
        expect([...container.__checkRow({ age: -2 })]).toEqual([
            ['name', ['Required']],
            ['age', ['Must be at least 0']]
        ]);
        expect(datasource.hasErrors()).toBe(false);
    });
});
