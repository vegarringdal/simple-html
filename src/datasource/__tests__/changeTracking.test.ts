import { describe, expect, it } from 'vitest';
import type { Changes, ModifiedEntity } from '../changes';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';

/**
 * Change tracking: getChanges() and the edit tracking behind it (EntityHandler).
 * - a field edited back to its original value is no change
 * - two dates compare by the field's type: a `date` field on the day, every other field to the
 *   second (a time only change on a `datetime` field is an edit)
 * - the field types come from the datasources on the container
 */

interface Person {
    id: number;
    name: string;
    city?: string;
    born?: Date | null;
    lastLogin?: Date | null;
    note?: unknown;
}

const people = (): Person[] => [
    { id: 1, name: 'Ann', city: 'Oslo', born: new Date(1990, 4, 17, 8, 30), lastLogin: new Date(2026, 10, 20, 8, 15, 0) },
    { id: 2, name: 'Bob', city: 'Bergen', born: new Date(1985, 0, 2, 0, 0), lastLogin: new Date(2026, 10, 19, 22, 0, 0) }
];

const datasource = () => {
    const ds = new Datasource<Person>({ key: 'id', fields: { born: 'date', lastLogin: 'datetime' } });
    ds.setData(people());
    return ds;
};

/** the data row with the id - getAllData() is in the order set */
const row = (ds: Datasource<Person>, id: number) => ds.getAllData().filter((r) => r.id === id)[0];

describe('change tracking - edited back to the original', () => {
    it('expect a field edited back to its original value to not be in the modified entry', () => {
        const ds = datasource();
        const ann = row(ds, 1);
        ann.name = 'Anna';
        ann.city = 'Trondheim';
        ann.name = 'Ann';

        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 1, city: 'Trondheim' }]);
    });

    it('expect a row with every field edited back to not be modified', () => {
        const ds = datasource();
        const ann = row(ds, 1);
        ann.name = 'Anna';
        ann.city = 'Trondheim';
        ann.name = 'Ann';
        ann.city = 'Oslo';

        expect(ds.getChanges().modifiedEntities).toEqual([]);
        expect(ann.__rowState).toBeUndefined();
    });

    it('expect a field edited back and then edited again to be in it', () => {
        const ds = datasource();
        const ann = row(ds, 1);
        ann.name = 'Anna';
        ann.name = 'Ann';
        ann.name = 'Annie';

        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 1, name: 'Annie' }]);
    });

    it('expect a date edited back to the same moment to not be in it', () => {
        const ds = datasource();
        const ann = row(ds, 1);
        ann.lastLogin = new Date(2026, 0, 1);
        ann.lastLogin = new Date(2026, 10, 20, 8, 15, 0);

        expect(ds.getChanges().modifiedEntities).toEqual([]);
    });
});

describe('change tracking - date field compares on the day', () => {
    it('expect the same day with another time to be no edit', () => {
        const ds = datasource();
        const ann = row(ds, 1);
        // what typing 1990-05-17 into the cell stores: the day with the current time
        ann.born = new Date(1990, 4, 17, 15, 45, 12, 345);

        expect(ds.getChanges().modifiedEntities).toEqual([]);
        expect(ann.__rowState).toBeUndefined();
    });

    it('expect another day to be an edit', () => {
        const ds = datasource();
        const ann = row(ds, 1);
        ann.born = new Date(1990, 4, 18, 8, 30);

        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 1, born: new Date(1990, 4, 18, 8, 30) }]);
        expect(ann.__rowState).toEqual('M');
    });

    it('expect the original to be kept after a same day edit, so resetData brings it back', () => {
        const ds = datasource();
        const ann = row(ds, 1);
        ann.born = new Date(1990, 4, 17, 15, 0); // no edit
        ann.born = new Date(2000, 0, 1); // an edit, of the first value

        ds.resetData();
        expect(ann.born).toEqual(new Date(1990, 4, 17, 8, 30));
    });

    it('expect a date cleared to be an edit, and set to the same day again no edit', () => {
        const ds = datasource();
        const ann = row(ds, 1);
        ann.born = null;
        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 1, born: null }]);

        ann.born = new Date(1990, 4, 17, 23, 59);
        expect(ds.getChanges().modifiedEntities).toEqual([]);
    });
});

describe('change tracking - datetime field compares to the second', () => {
    it('expect a time only change to be an edit', () => {
        const ds = datasource();
        const ann = row(ds, 1);
        ann.lastLogin = new Date(2026, 10, 20, 9, 15, 0);

        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 1, lastLogin: new Date(2026, 10, 20, 9, 15, 0) }]);
        expect(ann.__rowState).toEqual('M');
    });

    it('expect a change of one second to be an edit', () => {
        const ds = datasource();
        row(ds, 1).lastLogin = new Date(2026, 10, 20, 8, 15, 1);

        expect(ds.getChanges().modifiedEntities).toHaveLength(1);
    });

    it('expect other milliseconds to be no edit - typing the same time stamps the current ones', () => {
        const ds = datasource();
        row(ds, 1).lastLogin = new Date(2026, 10, 20, 8, 15, 0, 789);

        expect(ds.getChanges().modifiedEntities).toEqual([]);
    });
});

describe('change tracking - a field that is not listed compares a date to the second', () => {
    it('expect a time only change to be an edit', () => {
        const ds = new Datasource({ key: 'id' });
        ds.setData([{ id: 1, when: new Date(2020, 0, 1, 8, 30) }]);
        ds.getAllData()[0].when = new Date(2020, 0, 1, 17, 45);

        expect(ds.getChanges().modifiedEntities).toEqual([{ id: 1, when: new Date(2020, 0, 1, 17, 45) }]);
    });

    it('expect the same moment to be no edit', () => {
        const ds = new Datasource({ key: 'id' });
        ds.setData([{ id: 1, when: new Date(2020, 0, 1, 8, 30) }]);
        ds.getAllData()[0].when = new Date(2020, 0, 1, 8, 30);

        expect(ds.getChanges().modifiedEntities).toEqual([]);
    });
});

describe('change tracking - the field types of a shared container', () => {
    it('expect the types of a datasource to be used for edits made through another one on the container', () => {
        const container = new DataContainer('id');
        new Datasource({ container, fields: { born: 'date' } });
        const other = new Datasource({ container }); // does not list born
        other.setData(people());

        other.getAllData()[0].born = new Date(1990, 4, 17, 20, 0);
        expect(other.getChanges().modifiedEntities).toEqual([]);
    });

    it('expect the types of a datasource made after the rows were set to be used', () => {
        const container = new DataContainer('id');
        container.setData(people());
        new Datasource({ container, fields: { born: 'date' } });

        container.getDataSet()[0].born = new Date(1990, 4, 17, 20, 0);
        expect(container.getChanges().modifiedEntities).toEqual([]);
    });

    it('expect datasources that give a field the same type to share the container', () => {
        const container = new DataContainer('id');
        new Datasource({ container, fields: { born: 'date', age: 'number' } });
        expect(() => new Datasource({ container, fields: { born: { type: 'date', label: 'Born' } } })).not.toThrow();
    });

    it('expect a field with another type than in a datasource made earlier to throw', () => {
        const container = new DataContainer('id');
        new Datasource({ container, fields: { born: 'date' } });

        expect(() => new Datasource({ container, fields: { born: 'datetime' } })).toThrow(
            "Datasource: field 'born' is 'datetime' here and 'date' in another datasource on the same container, give it the same type in both"
        );
    });

    it('expect a field listed without a type to be text, so it can not be a date in another datasource', () => {
        const container = new DataContainer('id');
        new Datasource({ container, fields: { born: { label: 'Born' } } });

        expect(() => new Datasource({ container, fields: { born: 'date' } })).toThrow("field 'born' is 'date' here and 'text'");
    });

    it('expect a datasource that throws to leave the types as they were', () => {
        const container = new DataContainer('id');
        new Datasource({ container, fields: { born: 'date' } });
        expect(() => new Datasource({ container, fields: { lastLogin: 'datetime', born: 'datetime' } })).toThrow();

        // lastLogin was not added: it can still be a date
        expect(() => new Datasource({ container, fields: { lastLogin: 'date' } })).not.toThrow();
    });

    it('expect a container used without a datasource to compare a date to the second', () => {
        const container = new DataContainer('id');
        container.setData(people());
        container.getDataSet()[0].born = new Date(1990, 4, 17, 20, 0);

        expect(container.getChanges().modifiedEntities).toEqual([{ id: 1, born: new Date(1990, 4, 17, 20, 0) }]);
    });
});

describe('change tracking - the result', () => {
    it('expect the result to be typed with the row type of the datasource', () => {
        const ds = datasource();
        row(ds, 1).city = 'Trondheim';

        // compile time: the result and its entries are typed
        const changes: Changes<Person> = ds.getChanges();
        const entry: ModifiedEntity<Person> = changes.modifiedEntities[0];
        const city: string | undefined = entry.city;
        const firstNew: Person | undefined = changes.newEntities[0];
        expect(city).toEqual('Trondheim');
        expect(firstNew).toBeUndefined();
    });

    it('expect a modified entry to be the key and the changed fields', () => {
        const ds = datasource();
        const bob = row(ds, 2);
        bob.city = 'Stavanger';
        bob.lastLogin = new Date(2026, 10, 19, 23, 0, 0);

        expect(ds.getChanges().modifiedEntities).toEqual([
            { id: 2, city: 'Stavanger', lastLogin: new Date(2026, 10, 19, 23, 0, 0) }
        ]);
    });

    it('expect the key to be __KEY when there is no key field', () => {
        const ds = new Datasource();
        ds.setData([{ name: 'Ann' }]);
        const ann = ds.getAllData()[0];
        ann.name = 'Anna';

        expect(ds.getChanges().modifiedEntities).toEqual([{ __KEY: ann.__KEY, name: 'Anna' }]);
    });

    it('expect new and deleted entries to be copies of the rows with their own fields only', () => {
        const ds = datasource();
        ds.addNewEmpty({ id: 3, name: 'New' });
        ds.markForDeletion(row(ds, 2));

        const changes = ds.getChanges();
        expect(changes.newEntities).toEqual([{ id: 3, name: 'New' }]);
        expect(changes.deletedEntities).toEqual([people()[1]]);
        expect(changes.newEntities[0]).not.toBe(row(ds, 3));
        expect('__controller' in changes.deletedEntities[0]).toBe(false);
    });

    it('expect a Date to stay a Date (v5 returned a JSON copy, with the date as text)', () => {
        const ds = datasource();
        ds.markForDeletion(row(ds, 1));
        row(ds, 2).lastLogin = new Date(2026, 0, 1);

        const changes = ds.getChanges();
        expect(changes.deletedEntities[0].born).toBeInstanceOf(Date);
        expect(changes.modifiedEntities[0].lastLogin).toBeInstanceOf(Date);
    });

    it('expect JSON.stringify of the result to give what v5 returned', () => {
        const ds = datasource();
        row(ds, 1).name = 'Anna';
        ds.markForDeletion(row(ds, 2));

        expect(JSON.parse(JSON.stringify(ds.getChanges()))).toEqual({
            newEntities: [],
            modifiedEntities: [{ id: 1, name: 'Anna' }],
            deletedEntities: [{ ...people()[1], born: people()[1].born?.toJSON(), lastLogin: people()[1].lastLogin?.toJSON() }]
        });
    });

    it('expect a change to the result to not change the row', () => {
        const ds = datasource();
        const ann = row(ds, 1);
        ann.name = 'Anna';
        ds.markForDeletion(row(ds, 2));

        const changes = ds.getChanges();
        changes.modifiedEntities[0].name = 'tampered';
        changes.deletedEntities[0].name = 'tampered';
        expect(ann.name).toEqual('Anna');
        expect(row(ds, 2).name).toEqual('Bob');
    });

    it("expect an object in a field to be the row's own object - the copy is shallow", () => {
        const ds = datasource();
        const note = { text: 'hi' };
        row(ds, 1).note = note;

        expect(ds.getChanges().modifiedEntities[0].note).toBe(note);
    });
});
