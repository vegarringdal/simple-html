import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';
import type { DatasourceEvents } from '../datasourceEvents';

/**
 * Delete is a tag, and the save workflow:
 * - markForDeletion() marks every row, a new one too, and unmarkForDeletion() takes the mark off
 * - a new row that is marked is left out of getChanges(), acceptChanges() drops it
 * - acceptChanges() after a save: marked rows removed, new rows ordinary, edits the new originals,
 *   errors cleared. newKeys gives new rows the server's key
 * - hasChanges() is true when getChanges() would list a row
 */

interface Person {
    id: number;
    name: string;
    city?: string;
}

const people = (): Person[] => [
    { id: 1, name: 'Ann', city: 'Oslo' },
    { id: 2, name: 'Bob', city: 'Bergen' },
    { id: 3, name: 'Cid', city: 'Molde' }
];

const datasource = () => {
    const ds = new Datasource<Person>({ key: 'id' });
    ds.setData(people());
    return ds;
};

/** the data row with the name - getAllData() is in the order set */
const row = (ds: Datasource<Person>, name: string) => ds.getAllData().filter((r) => r.name === name)[0];

/** [name, __rowState] of every row, in the order set */
const states = (ds: Datasource<Person>) => ds.getAllData().map((r) => [r.name, r.__rowState]);

const noChanges = { newEntities: [], modifiedEntities: [], deletedEntities: [] };

/** the events the datasource sends while fn runs, with their payload */
const eventsDuring = (ds: Datasource<Person>, fn: () => void) => {
    const sent: [string, unknown][] = [];
    const types: (keyof DatasourceEvents)[] = ['collection-changed', 'collection-filtered', 'selection-change', 'select'];
    const offs = types.map((type) => ds.on(type, (data) => sent.push([type, data])));
    fn();
    for (const off of offs) {
        off();
    }
    return sent;
};

/** the server's side of a save: an id for each new row, from 100 on */
const serverKeys = (ds: Datasource<Person>) =>
    new Map(ds.getChanges().newEntities.map((entity, i): [number, number] => [entity.id, 100 + i]));

describe('unmarkForDeletion', () => {
    it('expect a single row to be as it was, and out of deletedEntities', () => {
        const ds = datasource();
        const bob = row(ds, 'Bob');
        ds.markForDeletion(bob);
        expect(ds.getChanges().deletedEntities).toHaveLength(1);

        ds.unmarkForDeletion(bob);

        expect(bob.__rowState).toBeUndefined();
        expect(ds.getMarkedForDeletion()).toEqual([]);
        expect(ds.getChanges()).toEqual(noChanges);
    });

    it('expect the edits of the row to be kept, unlike resetData', () => {
        const ds = datasource();
        const bob = row(ds, 'Bob');
        bob.city = 'Stavanger';
        ds.markForDeletion(bob);
        expect(bob.__rowState).toEqual('D');

        ds.unmarkForDeletion(bob);

        expect(bob.__rowState).toEqual('M');
        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 2, city: 'Stavanger' }]);
    });

    it('expect a list of rows, and to skip rows that are not marked or not in the data', () => {
        const ds = datasource();
        const [ann, bob, cid] = ds.getAllData();
        ds.markForDeletion([ann, bob, cid]);

        ds.unmarkForDeletion([ann, cid, { id: 9, name: 'Stranger' }]);

        expect(states(ds)).toEqual([
            ['Ann', undefined],
            ['Bob', 'D'],
            ['Cid', undefined]
        ]);
        ds.unmarkForDeletion(ann); // not marked: nothing happens
        expect(ann.__rowState).toBeUndefined();
    });

    it('expect unmarkAllForDeletion to take the mark off every row', () => {
        const ds = datasource();
        ds.markAllForDeletion();

        ds.unmarkAllForDeletion();

        expect(ds.getMarkedForDeletion()).toEqual([]);
        expect(states(ds).map(([, state]) => state)).toEqual([undefined, undefined, undefined]);
    });

    it('expect a marked new row to be a new row again', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        const added = row(ds, 'New');
        ds.markForDeletion(added);

        ds.unmarkForDeletion(added);

        expect(added.__rowState).toEqual('N');
        expect(ds.getChanges().newEntities).toEqual([{ name: 'New', id: added.id }]);
    });

    it('expect one collection-filtered event, info unmarkForDeletion', () => {
        const ds = datasource();
        ds.markAllForDeletion();

        expect(eventsDuring(ds, () => ds.unmarkForDeletion(row(ds, 'Ann')))).toEqual([
            ['collection-filtered', { info: 'unmarkForDeletion' }]
        ]);
        expect(eventsDuring(ds, () => ds.unmarkAllForDeletion())).toEqual([
            ['collection-filtered', { info: 'unmarkForDeletion' }]
        ]);
    });

    it('expect the container to unmark too, without rebuilding a datasource', () => {
        const container = new DataContainer('id');
        container.setData(people());
        const [ann, bob] = container.getDataSet();
        container.markAllForDeletion();

        container.unmarkForDeletion(ann);
        expect(container.getMarkedForDeletion().map((r) => r.name)).toEqual(['Bob', 'Cid']);

        container.unmarkAllForDeletion();
        expect(container.getMarkedForDeletion()).toEqual([]);
        expect(bob.__rowState).toBeUndefined();
    });
});

describe('a new row marked for deletion', () => {
    it('expect it to stay in the rows, marked, and to be in none of the lists of getChanges', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        const added = row(ds, 'New');
        added.city = 'Hamar';

        ds.markForDeletion(added);

        expect(added.__rowState).toEqual('D');
        expect(ds.getAllData()).toContain(added);
        expect(ds.getDataRows()).toContain(added);
        expect(ds.getMarkedForDeletion()).toEqual([added]);
        expect(ds.getChanges()).toEqual(noChanges);
        expect(ds.hasChanges()).toBe(false);
    });

    it('expect markAllForDeletion to mark it too, and leave it out of getChanges', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });

        ds.markAllForDeletion();

        expect(states(ds)).toEqual([
            ['Ann', 'D'],
            ['Bob', 'D'],
            ['Cid', 'D'],
            ['New', 'D']
        ]);
        expect(ds.getChanges().deletedEntities.map((r) => r.name)).toEqual(['Ann', 'Bob', 'Cid']);
        expect(ds.getChanges().newEntities).toEqual([]);
    });

    it('expect acceptChanges to drop it', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        ds.markForDeletion(row(ds, 'New'));

        ds.acceptChanges();

        expect(ds.getAllData().map((r) => r.name)).toEqual(['Ann', 'Bob', 'Cid']);
        expect(ds.getDataRows().map((r) => r.name)).toEqual(['Ann', 'Bob', 'Cid']);
    });

    it('expect resetData to remove it, as every new row', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        ds.markForDeletion(row(ds, 'New'));

        ds.resetData();

        expect(ds.getAllData().map((r) => r.name)).toEqual(['Ann', 'Bob', 'Cid']);
    });

    it('expect clearMarkedForDeletion to remove it with the other marked rows', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        ds.markForDeletion([row(ds, 'New'), row(ds, 'Ann')]);

        ds.clearMarkedForDeletion();

        expect(ds.getAllData().map((r) => r.name)).toEqual(['Bob', 'Cid']);
    });
});

describe('acceptChanges - every row', () => {
    /** a datasource with one row of each kind: Ann edited, Bob deleted, New added, Cid as set */
    const changed = () => {
        const ds = datasource();
        row(ds, 'Ann').city = 'Bergen';
        ds.markForDeletion(row(ds, 'Bob'));
        ds.addNewEmpty({ name: 'New', city: 'Hamar' }, { scrollTo: false });
        return ds;
    };

    it('expect the marked rows to be removed, from the data and the displayed rows', () => {
        const ds = changed();
        ds.acceptChanges();

        expect(ds.getAllData().map((r) => r.name)).toEqual(['Ann', 'Cid', 'New']);
        expect(ds.getDataRows().map((r) => r.name)).toEqual(['Ann', 'Cid', 'New']);
        expect(ds.getMarkedForDeletion()).toEqual([]);
    });

    it('expect new rows to become ordinary rows, and edits to become the originals', () => {
        const ds = changed();
        ds.acceptChanges();

        expect(states(ds)).toEqual([
            ['Ann', undefined],
            ['Cid', undefined],
            ['New', undefined]
        ]);
        expect(ds.getChanges()).toEqual(noChanges);
        expect(ds.hasChanges()).toBe(false);
        expect(row(ds, 'Ann').__controller?.__edited).toBe(false);
        expect(row(ds, 'Ann').__controller?.__originalValues).toEqual({});
    });

    it('expect the accepted value to be the original of the next edit', () => {
        const ds = changed();
        ds.acceptChanges();
        const ann = row(ds, 'Ann');

        ann.city = 'Oslo'; // the value before the save: an edit now
        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 1, city: 'Oslo' }]);

        ann.city = 'Bergen'; // the accepted value: no edit
        expect(ds.getChanges().modifiedEntities).toEqual([]);
    });

    it('expect resetData after it to go back to the accepted values, and keep the new row', () => {
        const ds = changed();
        ds.acceptChanges();
        row(ds, 'Ann').city = 'Tromsø';
        row(ds, 'New').city = 'Lillehammer';

        ds.resetData();

        expect(ds.getAllData().map((r) => [r.name, r.city])).toEqual([
            ['Ann', 'Bergen'],
            ['Cid', 'Molde'],
            ['New', 'Hamar']
        ]);
    });

    it('expect the row errors to be cleared', () => {
        const ds = changed();
        ds.getDataContainer().setErrors(
            new Map([
                ['1', 'taken'],
                ['3', 'too short']
            ])
        );

        ds.acceptChanges();

        expect(ds.getAllData().map((r) => r.__rowError)).toEqual([null, null, null]);
    });

    it('expect one collection-filtered event, info acceptChanges, also when rows were removed', () => {
        const ds = changed();
        expect(eventsDuring(ds, () => ds.acceptChanges())).toEqual([['collection-filtered', { info: 'acceptChanges' }]]);
    });

    it('expect the filter and sort to be run on the rows that are left', () => {
        const ds = changed();
        ds.sort({ attribute: 'name', ascending: false });

        ds.acceptChanges();

        expect(ds.getDataRows().map((r) => r.name)).toEqual(['New', 'Cid', 'Ann']);
    });

    it('expect nothing to happen to rows without changes', () => {
        const ds = datasource();
        ds.acceptChanges();
        expect(states(ds)).toEqual([
            ['Ann', undefined],
            ['Bob', undefined],
            ['Cid', undefined]
        ]);
        expect(ds.getAllData().map((r) => r.city)).toEqual(['Oslo', 'Bergen', 'Molde']);
    });
});

describe('acceptChanges - the rows given', () => {
    it('expect only those rows to be accepted, the others keep their changes', () => {
        const ds = datasource();
        const [ann, bob, cid] = ds.getAllData();
        ann.city = 'Bergen';
        cid.city = 'Hamar';
        ds.markForDeletion(bob);
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        ds.addNewEmpty({ name: 'Newer' }, { scrollTo: false });
        ds.getDataContainer().setErrors(
            new Map([
                ['1', 'taken'],
                ['3', 'too short']
            ])
        );

        ds.acceptChanges({ rows: [ann, bob, row(ds, 'New')] });

        expect(states(ds)).toEqual([
            ['Ann', undefined],
            ['Cid', 'M'],
            ['New', undefined],
            ['Newer', 'N']
        ]);
        expect(ds.getDataRows().map((r) => r.name)).toEqual(['Ann', 'Cid', 'New', 'Newer']);
        expect(ann.__rowError).toBeNull();
        expect(cid.__rowError).toEqual('too short');
        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 3, city: 'Hamar' }]);
        expect(ds.hasChanges()).toBe(true);
    });

    it('expect a single row, and rows that are not in the data to be skipped', () => {
        const ds = datasource();
        const [ann, bob] = ds.getAllData();
        ann.city = 'Bergen';
        bob.city = 'Hamar';

        ds.acceptChanges({ rows: ann });
        ds.acceptChanges({ rows: [{ id: 9, name: 'Stranger' }] });

        expect(states(ds)).toEqual([
            ['Ann', undefined],
            ['Bob', 'M'],
            ['Cid', undefined]
        ]);
    });

    it('expect an empty list to accept nothing', () => {
        const ds = datasource();
        row(ds, 'Ann').city = 'Bergen';

        ds.acceptChanges({ rows: [] });

        expect(row(ds, 'Ann').__rowState).toEqual('M');
    });
});

describe('acceptChanges - newKeys', () => {
    it("expect the server's key in the key field and in __KEY, and no edit", () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        const added = row(ds, 'New');
        const temporary = added.id;
        expect(temporary).toBeLessThan(0);
        expect(ds.getChanges().newEntities).toEqual([{ name: 'New', id: temporary }]);

        ds.acceptChanges({ newKeys: new Map([[temporary, 100]]) });

        expect(added.id).toEqual(100);
        expect(added.__KEY).toEqual(100);
        expect(added.__rowState).toBeUndefined();
        expect(ds.getChanges()).toEqual(noChanges);
    });

    it("expect a later edit of the row to be sent with the server's key", () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        ds.acceptChanges({ newKeys: serverKeys(ds) });

        row(ds, 'New').city = 'Hamar';

        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 100, city: 'Hamar' }]);
    });

    it('expect the keys to be compared as text: a map made from JSON works', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        const temporary = row(ds, 'New').id;
        const json: Record<string, number> = JSON.parse(`{ "${temporary}": 100 }`);

        ds.acceptChanges({ newKeys: new Map(Object.entries(json)) });

        expect(row(ds, 'New').id).toEqual(100);
    });

    it('expect a text key from the server to be kept as text', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });

        ds.acceptChanges({ newKeys: new Map([[row(ds, 'New').id, 'a-uuid']]) });

        expect(row(ds, 'New').__KEY).toEqual('a-uuid');
    });

    it('expect a new row that is not in newKeys to keep its key, and still become ordinary', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'First' }, { scrollTo: false });
        ds.addNewEmpty({ name: 'Second' }, { scrollTo: false });
        const second = row(ds, 'Second');
        const secondKey = second.id;

        ds.acceptChanges({ newKeys: new Map([[row(ds, 'First').id, 100]]) });

        expect(row(ds, 'First').id).toEqual(100);
        expect(second.id).toEqual(secondKey);
        expect(second.__rowState).toBeUndefined();
    });

    it('expect it to work without a key field: the temporary key is __KEY in newEntities', () => {
        const ds = new Datasource<{ name: string; city?: string }>();
        ds.setData([{ name: 'Ann' }]);
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        const added = ds.getAllData()[1];
        const [entity] = ds.getChanges().newEntities;
        expect(entity).toEqual({ name: 'New', __KEY: added.__KEY });

        ds.acceptChanges({ newKeys: new Map([[entity.__KEY ?? '', 100]]) });

        expect(added.__KEY).toEqual(100);
        expect(Object.keys(added)).toEqual(['name']); // no field added to the row
        expect(added.__rowState).toBeUndefined();
        added.city = 'Hamar';
        expect(ds.getChanges().modifiedEntities).toEqual([{ __KEY: 100, city: 'Hamar' }]);
    });

    it('expect the rows given and newKeys to go together', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'First' }, { scrollTo: false });
        ds.addNewEmpty({ name: 'Second' }, { scrollTo: false });
        const first = row(ds, 'First');

        ds.acceptChanges({ rows: [first], newKeys: new Map([[first.id, 100]]) });

        expect(states(ds).slice(3)).toEqual([
            ['First', undefined],
            ['Second', 'N']
        ]);
        expect(first.id).toEqual(100);
    });

    it('expect a key that is not a new row to throw, and nothing to be accepted', () => {
        const ds = datasource();
        row(ds, 'Ann').city = 'Bergen';
        ds.markForDeletion(row(ds, 'Bob'));
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        const temporary = row(ds, 'New').id;

        // the map the wrong way round: server key -> temporary key
        expect(() => ds.acceptChanges({ newKeys: new Map([[100, temporary]]) })).toThrow(
            "acceptChanges: newKeys has the key '100', but no new row accepted has it"
        );
        // the key of an ordinary row
        expect(() => ds.acceptChanges({ newKeys: new Map([[1, 100]]) })).toThrow("newKeys has the key '1'");

        expect(states(ds)).toEqual([
            ['Ann', 'M'],
            ['Bob', 'D'],
            ['Cid', undefined],
            ['New', 'N']
        ]);
        expect(row(ds, 'New').id).toEqual(temporary);
    });

    it('expect the key of a new row that is not in the rows given, or is marked for deletion, to throw', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'First' }, { scrollTo: false });
        ds.addNewEmpty({ name: 'Second' }, { scrollTo: false });
        const [first, second] = [row(ds, 'First'), row(ds, 'Second')];

        expect(() => ds.acceptChanges({ rows: [first], newKeys: new Map([[second.id, 100]]) })).toThrow(
            `newKeys has the key '${second.id}'`
        );

        ds.markForDeletion(second);
        expect(() => ds.acceptChanges({ newKeys: new Map([[second.id, 100]]) })).toThrow(`newKeys has the key '${second.id}'`);
        expect(states(ds).slice(3)).toEqual([
            ['First', 'N'],
            ['Second', 'D']
        ]);
    });

    it('expect a blank server key to throw, and nothing to be accepted', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        const temporary = row(ds, 'New').id;

        expect(() => ds.acceptChanges({ newKeys: new Map([[temporary, '']]) })).toThrow(
            `acceptChanges: newKeys gives the new row '${temporary}' a blank key`
        );
        expect(row(ds, 'New').__rowState).toEqual('N');
    });

    it('expect a selected new row to stay selected under its new key', () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }); // selected
        expect(ds.getSelectedRows().map((r) => r.name)).toEqual(['New']);

        ds.acceptChanges({ newKeys: serverKeys(ds) });

        expect(ds.getSelectedRows().map((r) => [r.name, r.id])).toEqual([['New', 100]]);
    });

    it('expect a selected new row to stay selected without a key field too', () => {
        const ds = new Datasource<{ name: string }>();
        ds.setData([{ name: 'Ann' }]);
        ds.addNewEmpty({ name: 'New' }); // selected
        const [entity] = ds.getChanges().newEntities;

        ds.acceptChanges({ newKeys: new Map([[entity.__KEY ?? '', 'server-1']]) });

        expect(ds.getSelectedRows().map((r) => [r.name, r.__KEY])).toEqual([['New', 'server-1']]);
    });

    it("expect setErrors to find the row by the server's key after", () => {
        const ds = datasource();
        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        ds.acceptChanges({ newKeys: serverKeys(ds) });

        ds.getDataContainer().setErrors(new Map([['100', 'taken']]));

        expect(row(ds, 'New').__rowError).toEqual('taken');
    });
});

describe('acceptChanges - options', () => {
    it('expect the rows themselves, or a boolean, in place of the options to throw a TypeError', () => {
        const ds = datasource();
        const rows = ds.getAllData();
        ds.markForDeletion(rows[1]);
        // what plain JavaScript can send: acceptChanges(rows) would read as no options, every row accepted
        const call = (target: object, options: unknown) => () =>
            Reflect.apply(Reflect.get(target, 'acceptChanges') as (...a: unknown[]) => unknown, target, [options]);

        expect(call(ds, rows)).toThrow(TypeError);
        expect(call(ds, rows[0])).toThrow('acceptChanges() takes an options object: acceptChanges({ rows, newKeys })');
        expect(call(ds, true)).toThrow(TypeError);
        expect(call(ds, null)).toThrow(TypeError);
        expect(call(ds.getDataContainer(), rows)).toThrow(TypeError);
        expect(states(ds).map(([, state]) => state)).toEqual([undefined, 'D', undefined]);
    });
});

describe('hasChanges', () => {
    it('expect it to follow the edits, new rows and marks', () => {
        const ds = datasource();
        expect(ds.hasChanges()).toBe(false);

        const ann = row(ds, 'Ann');
        ann.city = 'Bergen';
        expect(ds.hasChanges()).toBe(true);
        ann.city = 'Oslo'; // back to the original
        expect(ds.hasChanges()).toBe(false);

        ds.addNewEmpty({ name: 'New' }, { scrollTo: false });
        expect(ds.hasChanges()).toBe(true);
        ds.markForDeletion(row(ds, 'New')); // a marked new row is nothing to save
        expect(ds.hasChanges()).toBe(false);

        ds.markForDeletion(ann);
        expect(ds.hasChanges()).toBe(true);
        ds.unmarkForDeletion(ann);
        expect(ds.hasChanges()).toBe(false);
    });

    it('expect it to agree with getChanges on the container, without a datasource', () => {
        const container = new DataContainer();
        container.setData([{ name: 'Ann' }]);
        expect(container.hasChanges()).toBe(false);

        container.setData([{ name: 'New' }], { add: true, isNew: true });
        expect(container.hasChanges()).toBe(true);

        container.acceptChanges();
        expect(container.hasChanges()).toBe(false);
        expect(container.getChanges()).toEqual(noChanges);
    });
});

describe('the container', () => {
    it('expect acceptChanges and newKeys on the container itself', () => {
        const container = new DataContainer('id');
        container.setData(people());
        container.setData([{ name: 'New' }], { add: true, isNew: true });
        const [ann, bob, , added] = container.getDataSet();
        ann.city = 'Bergen';
        container.markForDeletion(bob);

        container.acceptChanges({ newKeys: new Map([[added.id, 100]]) });

        expect(container.getDataSet().map((r) => [r.id, r.name, r.__rowState])).toEqual([
            [1, 'Ann', undefined],
            [3, 'Cid', undefined],
            [100, 'New', undefined]
        ]);
        expect(container.getChanges()).toEqual(noChanges);
    });

    it('expect a datasource sharing the container to show it after reloadDatasource', () => {
        const container = new DataContainer('id');
        const left = new Datasource<Person>({ container });
        const right = new Datasource<Person>({ container });
        left.setData(people());
        right.reloadDatasource();
        left.markForDeletion(left.getAllData()[0]);

        left.acceptChanges();
        right.reloadDatasource();

        expect(right.getDataRows().map((r) => r.name)).toEqual(['Bob', 'Cid']);
        expect(right.hasChanges()).toBe(false);
    });
});

describe('the save round trip', () => {
    it('expect edit + new + delete -> getChanges -> server -> acceptChanges({ newKeys }) to leave nothing to save', () => {
        const ds = datasource();
        row(ds, 'Ann').city = 'Bergen';
        ds.markForDeletion(row(ds, 'Bob'));
        ds.addNewEmpty({ name: 'Dan', city: 'Hamar' }, { scrollTo: false });
        ds.addNewEmpty({ name: 'Eve' }, { scrollTo: false });
        ds.addNewEmpty({ name: 'Gone' }, { scrollTo: false });
        ds.markForDeletion(row(ds, 'Gone')); // added and deleted before the save: never sent

        // what the app sends, in one transaction
        const changes = ds.getChanges();
        expect(changes.modifiedEntities).toEqual([{ id: 1, city: 'Bergen' }]);
        expect(changes.deletedEntities).toEqual([{ id: 2, name: 'Bob', city: 'Bergen' }]);
        expect(changes.newEntities.map((r) => r.name)).toEqual(['Dan', 'Eve']);

        // the server: one id per new row
        const saved = changes.newEntities.map((entity, i) => ({ temporaryId: entity.id, id: 100 + i }));
        ds.acceptChanges({ newKeys: new Map(saved.map((r) => [r.temporaryId, r.id])) });

        expect(ds.getChanges()).toEqual(noChanges);
        expect(ds.hasChanges()).toBe(false);
        expect(ds.getMarkedForDeletion()).toEqual([]);
        expect(ds.getDataRows().map((r) => [r.id, r.name, r.city, r.__rowState])).toEqual([
            [1, 'Ann', 'Bergen', undefined],
            [3, 'Cid', 'Molde', undefined],
            [100, 'Dan', 'Hamar', undefined],
            [101, 'Eve', undefined, undefined]
        ]);

        // and the next round starts from there
        row(ds, 'Eve').city = 'Oslo';
        ds.markForDeletion(row(ds, 'Dan'));
        expect(ds.getChanges()).toEqual({
            newEntities: [],
            modifiedEntities: [{ id: 101, city: 'Oslo' }],
            deletedEntities: [{ id: 100, name: 'Dan', city: 'Hamar' }]
        });
    });
});
