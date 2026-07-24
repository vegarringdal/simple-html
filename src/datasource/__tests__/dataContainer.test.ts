import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';

/**
 * DataContainer owns the raw rows and all of the change tracking
 * (new / deleted / modified) that getChanges() reports back to the user.
 */

const people = () => [{ name: 'person1' }, { name: 'person2' }, { name: 'person3' }];

describe('dataContainer - setData', () => {
    it('expect setData to store the rows', () => {
        const container = new DataContainer();
        container.setData(people());
        expect(container.lenght()).toEqual(3);
    });

    it('expect setData to replace by default', () => {
        const container = new DataContainer();
        container.setData(people());
        container.setData([{ name: 'other' }]);
        expect(container.lenght()).toEqual(1);
        expect(container.getDataSet()[0].name).toEqual('other');
    });

    it('expect setData with add to append', () => {
        const container = new DataContainer();
        container.setData(people());
        container.setData([{ name: 'person4' }], true);
        expect(container.lenght()).toEqual(4);
    });

    it('expect setData to return the rows it wrapped', () => {
        const container = new DataContainer();
        const added = container.setData(people());
        expect(added).toHaveLength(3);
        expect(added?.[0].__controller).toBeDefined();
    });

    it('expect setData with tagAsNew to mark rows as new', () => {
        const container = new DataContainer();
        container.setData(people(), false, true);
        container.getDataSet().forEach((row) => {
            expect(row.__rowState).toEqual('N');
        });
    });

    it('expect getDataSet to return a copy, so callers cannot mutate the collection', () => {
        const container = new DataContainer();
        container.setData(people());
        const copy = container.getDataSet();
        copy.pop();
        expect(container.lenght()).toEqual(3);
    });

    it('expect rows that are already entities to not be wrapped twice', () => {
        const container = new DataContainer();
        container.setData(people());
        const existing = container.getDataSet()[0];

        const second = new DataContainer();
        second.setData([existing]);
        expect(second.getDataSet()[0]).toBe(existing);
    });
});

describe('dataContainer - removeData', () => {
    it('expect removeData to remove a single row and return it', () => {
        const container = new DataContainer();
        container.setData(people());
        const row = container.getDataSet()[1];

        const removed = container.removeData(row);
        expect(container.lenght()).toEqual(2);
        expect(removed).toHaveLength(1);
    });

    it('expect removeData to remove an array of rows', () => {
        const container = new DataContainer();
        container.setData(people());
        const rows = container.getDataSet().slice(0, 2);

        const removed = container.removeData(rows);
        expect(container.lenght()).toEqual(1);
        expect(removed).toHaveLength(2);
    });

    it('expect removeData with all to clear the collection', () => {
        const container = new DataContainer();
        container.setData(people());

        const removed = container.removeData(null, true);
        expect(container.lenght()).toEqual(0);
        expect(removed).toHaveLength(3);
    });

    it('expect removing a row that is not in the collection to be a no-op', () => {
        const container = new DataContainer();
        container.setData(people());

        const removed = container.removeData({ name: 'stranger' } as any);
        expect(container.lenght()).toEqual(3);
        expect(removed).toHaveLength(0);
    });
});

describe('dataContainer - markForDeletion', () => {
    it('expect an existing row to be flagged rather than removed', () => {
        const container = new DataContainer();
        container.setData(people());
        const row = container.getDataSet()[0];

        container.markForDeletion(row);
        expect(container.lenght()).toEqual(3);
        expect(row.__rowState).toEqual('D');
    });

    it('expect getMarkedForDeletion to return the flagged rows', () => {
        const container = new DataContainer();
        container.setData(people());
        const row = container.getDataSet()[0];

        container.markForDeletion(row);
        expect(container.getMarkedForDeletion()).toHaveLength(1);
    });

    it('expect a new row to be dropped outright instead of flagged', () => {
        const container = new DataContainer();
        container.setData(people());
        container.setData([{ name: 'brand new' }], true, true);
        const newRow = container.getDataSet()[3];

        container.markForDeletion(newRow);
        expect(container.lenght()).toEqual(3);
        expect(container.getMarkedForDeletion()).toHaveLength(0);
    });

    it('expect markForDeletion to accept an array', () => {
        const container = new DataContainer();
        container.setData(people());
        const rows = container.getDataSet().slice(0, 2);

        container.markForDeletion(rows);
        expect(container.getMarkedForDeletion()).toHaveLength(2);
    });

    it('expect markForDeletion with all to flag every existing row', () => {
        const container = new DataContainer();
        container.setData(people());

        container.markForDeletion(null, true);
        expect(container.getMarkedForDeletion()).toHaveLength(3);
    });

    it('expect clearMarkedForDeletion to remove the flagged rows for good', () => {
        const container = new DataContainer();
        container.setData(people());
        container.markForDeletion(container.getDataSet()[0]);

        container.clearMarkedForDeletion();
        expect(container.lenght()).toEqual(2);
        expect(container.getMarkedForDeletion()).toHaveLength(0);
    });
});

describe('dataContainer - resetData', () => {
    it('expect edits to be rolled back to the original values', () => {
        const container = new DataContainer();
        container.setData(people());
        const row = container.getDataSet()[0];
        row.name = 'changed';

        container.resetData();
        expect(row.name).toEqual('person1');
        expect(row.__controller.__edited).toEqual(false);
    });

    it('expect deletion flags to be cleared', () => {
        const container = new DataContainer();
        container.setData(people());
        container.markForDeletion(container.getDataSet()[0]);

        container.resetData();
        expect(container.getMarkedForDeletion()).toHaveLength(0);
    });

    it('expect new rows to be removed', () => {
        const container = new DataContainer();
        container.setData(people());
        container.setData([{ name: 'brand new' }], true, true);
        expect(container.lenght()).toEqual(4);

        container.resetData();
        expect(container.lenght()).toEqual(3);
    });

    it('expect resetDataSelection to only reset the rows it is given', () => {
        const container = new DataContainer();
        container.setData(people());
        const [first, second] = container.getDataSet();
        first.name = 'changed1';
        second.name = 'changed2';

        container.resetDataSelection([first]);
        expect(first.name).toEqual('person1');
        expect(second.name).toEqual('changed2');
    });
});

describe('dataContainer - getChanges', () => {
    it('expect no changes on untouched data', () => {
        const container = new DataContainer();
        container.setData(people());

        const changes = container.getChanges();
        expect(changes.newEntities).toHaveLength(0);
        expect(changes.deletedEntities).toHaveLength(0);
        expect(changes.modifiedEntities).toHaveLength(0);
    });

    it('expect an edited row to be reported as modified', () => {
        const container = new DataContainer();
        container.setData(people());
        container.getDataSet()[0].name = 'changed';

        const changes = container.getChanges();
        expect(changes.modifiedEntities).toHaveLength(1);
        expect(changes.modifiedEntities[0].name).toEqual('changed');
    });

    it('expect a modified row to only report the edited properties', () => {
        const container = new DataContainer('id');
        container.setData([{ id: 'a', name: 'person1', age: 10 }]);
        container.getDataSet()[0].name = 'changed';

        const changes = container.getChanges();
        expect(changes.modifiedEntities[0]).toEqual({ id: 'a', name: 'changed' });
    });

    it('expect a new row to be reported as new', () => {
        const container = new DataContainer();
        container.setData(people());
        container.setData([{ name: 'brand new' }], true, true);

        const changes = container.getChanges();
        expect(changes.newEntities).toHaveLength(1);
        expect(changes.newEntities[0].name).toEqual('brand new');
    });

    it('expect a deleted row to be reported as deleted', () => {
        const container = new DataContainer();
        container.setData(people());
        container.markForDeletion(container.getDataSet()[0]);

        const changes = container.getChanges();
        expect(changes.deletedEntities).toHaveLength(1);
    });

    it('expect a deleted row to not also be reported as modified', () => {
        const container = new DataContainer();
        container.setData(people());
        const row = container.getDataSet()[0];
        row.name = 'changed';
        container.markForDeletion(row);

        const changes = container.getChanges();
        expect(changes.deletedEntities).toHaveLength(1);
        expect(changes.modifiedEntities).toHaveLength(0);
    });

    it('expect getChanges to return a detached copy', () => {
        const container = new DataContainer();
        container.setData(people());
        const row = container.getDataSet()[0];
        row.name = 'changed';

        const changes = container.getChanges();
        changes.modifiedEntities[0].name = 'tampered';
        expect(row.name).toEqual('changed');
    });

    it('expect a row edited back to its original value to not be reported', () => {
        const container = new DataContainer();
        container.setData(people());
        const row = container.getDataSet()[0];
        row.name = 'changed';
        row.name = 'person1';

        const changes = container.getChanges();
        expect(changes.modifiedEntities).toHaveLength(0);
    });
});

describe('dataContainer - setErrors', () => {
    it('expect errors to be attached to the row with the matching key', () => {
        const container = new DataContainer('id');
        container.setData([
            { id: 'a', name: 'person1' },
            { id: 'b', name: 'person2' }
        ]);

        container.setErrors(new Map([['a', 'bad row']]));

        const [first, second] = container.getDataSet();
        expect(first.__rowError).toEqual('bad row');
        expect(second.__rowError).toEqual(null);
    });

    it('expect setErrors to clear previously set errors', () => {
        const container = new DataContainer('id');
        container.setData([{ id: 'a', name: 'person1' }]);

        container.setErrors(new Map([['a', 'bad row']]));
        container.setErrors(new Map());

        expect(container.getDataSet()[0].__rowError).toEqual(null);
    });
});

describe('dataContainer - replace', () => {
    it('expect replace to swap rows at the given index', () => {
        const container = new DataContainer();
        container.setData(people());

        container.replace([{ name: 'replaced' }], 1, 1);

        expect(container.lenght()).toEqual(3);
        expect(container.getDataSet()[1].name).toEqual('replaced');
    });

    it('expect replaced rows to be wrapped as entities', () => {
        const container = new DataContainer();
        container.setData(people());

        container.replace([{ name: 'replaced' }], 0, 1);

        expect(container.getDataSet()[0].__controller).toBeDefined();
    });

    it('expect replace to be able to insert without removing', () => {
        const container = new DataContainer();
        container.setData(people());

        container.replace([{ name: 'inserted' }], 1, 0);

        expect(container.lenght()).toEqual(4);
        expect(container.getDataSet()[1].name).toEqual('inserted');
    });
});
