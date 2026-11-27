import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';

/**
 * The kinds of change (ChangeKinds) of getChanges(), hasChanges() and getChangedRows(), and the helpers
 * of a row: getChangedFields(), getOriginalValue().
 */

interface Person {
    id: number;
    name: string;
    city: string;
}

/** Ann edited, Bob marked for deletion, Cid as it was, a new row, a new row marked for deletion */
function changed() {
    const datasource = new Datasource<Person>({ key: 'id' });
    datasource.setData([
        { id: 1, name: 'Ann', city: 'Oslo' },
        { id: 2, name: 'Bob', city: 'Bergen' },
        { id: 3, name: 'Cid', city: 'Molde' }
    ]);
    const [ann, bob, cid] = datasource.getDataRows();
    ann.name = 'Anna';
    ann.city = 'Bergen';
    datasource.markForDeletion(bob);
    // edited back: no change
    cid.name = 'Cecil';
    cid.name = 'Cid';
    datasource.addNewEmpty({ name: 'New' });
    datasource.addNewEmpty({ name: 'Gone' });
    const added = datasource.getAllData().find((row) => row.name === 'New') as Person;
    datasource.markForDeletion(datasource.getAllData().find((row) => row.name === 'Gone') as Person);
    return { datasource, ann, bob, cid, added };
}

const names = (rows: Person[]) => rows.map((row) => row.name);

describe('the kinds of change: getChanges(), hasChanges(), getChangedRows()', () => {
    it('expect all of them without kinds, and with null or {}', () => {
        const { datasource } = changed();
        const all = datasource.getChanges();
        expect([all.newEntities.length, all.modifiedEntities.length, all.deletedEntities.length]).toEqual([1, 1, 1]);
        expect(datasource.getChanges(null)).toEqual(all);
        expect(datasource.getChanges({})).toEqual(all);
        expect(datasource.getChanges({ new: null, modified: null, deleted: null })).toEqual(all);
        expect(names(datasource.getChangedRows())).toEqual(['Anna', 'Bob', 'New']);
    });

    it('expect the kinds true only - the other lists []', () => {
        const { datasource } = changed();
        expect(datasource.getChanges({ deleted: true })).toEqual({
            newEntities: [],
            modifiedEntities: [],
            deletedEntities: [{ id: 2, name: 'Bob', city: 'Bergen' }]
        });
        expect(datasource.getChanges({ modified: true }).modifiedEntities).toEqual([{ id: 1, name: 'Anna', city: 'Bergen' }]);
        expect(names(datasource.getChangedRows({ new: true, modified: true }))).toEqual(['Anna', 'New']);
        // a kind true wins over false ones
        expect(names(datasource.getChangedRows({ new: true, deleted: false }))).toEqual(['New']);
    });

    it('expect only kinds false: all but those', () => {
        const { datasource } = changed();
        expect(names(datasource.getChangedRows({ deleted: false }))).toEqual(['Anna', 'New']);
        expect(names(datasource.getChangedRows({ new: false, modified: false }))).toEqual(['Bob']);
        expect(datasource.getChangedRows({ new: false, modified: false, deleted: false })).toEqual([]);
    });

    it('expect the rows themselves, in the order of the data; hasChanges of the kinds', () => {
        const { datasource, ann } = changed();
        expect(datasource.getChangedRows({ modified: true })[0]).toBe(ann);
        expect(datasource.hasChanges({ deleted: true })).toBe(true);
        datasource.unmarkForDeletion(datasource.getChangedRows({ deleted: true }));
        expect(datasource.hasChanges({ deleted: true })).toBe(false);
        expect(datasource.hasChanges({ deleted: false })).toBe(true);
        datasource.acceptChanges();
        expect([datasource.hasChanges(), datasource.getChangedRows()]).toEqual([false, []]);
    });

    it('expect kinds that are none to throw a TypeError', () => {
        const { datasource } = changed();
        expect(() => datasource.getChanges({ added: true } as never)).toThrow(/'added' is no kind of change/);
        expect(() => datasource.getChanges({ new: 'yes' } as never)).toThrow(/new is true, false or null/);
        expect(() => datasource.hasChanges([] as never)).toThrow(TypeError);
        expect(() => datasource.getChangedRows('new' as never)).toThrow(TypeError);
    });

    it('expect the container to take the kinds too', () => {
        const container = new DataContainer('id');
        container.setData([{ id: 1, name: 'Ann' }]);
        container.getDataSet()[0].name = 'Anna';
        expect(container.hasChanges({ modified: true })).toBe(true);
        expect(container.hasChanges({ new: true })).toBe(false);
        expect(container.getChanges({ new: true }).modifiedEntities).toEqual([]);
    });
});

describe('getChangedFields() and getOriginalValue()', () => {
    it('expect the fields edited in the order of the edits, a field edited back left out', () => {
        const { datasource, ann, cid, added, bob } = changed();
        expect(datasource.getChangedFields(ann)).toEqual(['name', 'city']);
        expect(datasource.getChangedFields(cid)).toEqual([]);
        // new: no original
        expect(datasource.getChangedFields(added)).toEqual([]);
        expect(datasource.getChangedFields(bob)).toEqual([]);
        expect(datasource.getChangedFields({ id: 9, name: 'x', city: 'y' })).toEqual([]);
    });

    it('expect the value before the edit; the value now when not edited; none for a new row or another object', () => {
        const { datasource, ann, cid, added } = changed();
        expect(datasource.getOriginalValue(ann, 'name')).toBe('Ann');
        expect(datasource.getOriginalValue(ann, 'city')).toBe('Oslo');
        expect(datasource.getOriginalValue(cid, 'name')).toBe('Cid');
        expect(datasource.getOriginalValue(added, 'name')).toBeUndefined();
        expect(datasource.getOriginalValue({ id: 9, name: 'x', city: 'y' }, 'name')).toBeUndefined();
        // accepted: the new value is the original
        datasource.acceptChanges();
        expect(datasource.getOriginalValue(ann, 'name')).toBe('Anna');
        expect(datasource.getChangedFields(ann)).toEqual([]);
    });
});
