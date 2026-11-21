import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';
import { type DataEntity, isGroupRow } from '../entity';

/**
 * EntityHandler is the proxy handler behind every row.
 * It tracks which properties have been edited so getChanges()/__rowState can report them.
 *
 * Rows are always created through DataContainer.setData, so that is how we build them here.
 */

function makeRow(data: Record<string, any>, keyAttribute?: string, tagAsNew = false): DataEntity {
    const container = new DataContainer(keyAttribute);
    container.setData([data], { isNew: tagAsNew });
    return container.getDataSet()[0];
}

describe('entityHandler - reading values', () => {
    it('expect plain properties to be read straight off the target', () => {
        const row = makeRow({ name: 'person1', age: 10 });
        expect(row.name).toEqual('person1');
        expect(row.age).toEqual(10);
    });

    it('expect __controller to return the handler itself', () => {
        const row = makeRow({ name: 'person1' });
        expect(row.__controller).toBeDefined();
        expect(row.__controller.__editedProps).toEqual({});
    });

    it('expect unknown properties to be undefined', () => {
        const row = makeRow({ name: 'person1' });
        expect(row.doesNotExist).toBeUndefined();
    });
});

describe('entityHandler - __rowState', () => {
    it('expect __rowState to be undefined for an untouched row', () => {
        const row = makeRow({ name: 'person1' });
        expect(row.__rowState).toBeUndefined();
    });

    it('expect __rowState to be N for a row tagged as new', () => {
        const row = makeRow({ name: 'person1' }, undefined, true);
        expect(row.__rowState).toEqual('N');
    });

    it('expect __rowState to be M once a property is edited', () => {
        const row = makeRow({ name: 'person1' });
        row.name = 'changed';
        expect(row.__rowState).toEqual('M');
    });

    it('expect __rowState to be D when marked deleted, taking priority over M', () => {
        const row = makeRow({ name: 'person1' });
        row.name = 'changed';
        row.__controller.__isDeleted = true;
        expect(row.__rowState).toEqual('D');
    });

    it('expect __rowState N to take priority over M', () => {
        const row = makeRow({ name: 'person1' }, undefined, true);
        row.name = 'changed';
        expect(row.__rowState).toEqual('N');
    });

    it('expect assigning to __rowState to be ignored', () => {
        const row = makeRow({ name: 'person1' });
        row.__rowState = 'whatever';
        expect(row.__rowState).toBeUndefined();
    });
});

describe('entityHandler - edit tracking', () => {
    it('expect an untouched row to not be edited', () => {
        const row = makeRow({ name: 'person1' });
        expect(row.__controller.__edited).toEqual(false);
    });

    it('expect editing a property to flag the row as edited', () => {
        const row = makeRow({ name: 'person1' });
        row.name = 'changed';
        expect(row.__controller.__edited).toEqual(true);
        expect(row.__controller.__editedProps.name).toEqual(true);
    });

    it('expect the original value to be kept when a property is edited', () => {
        const row = makeRow({ name: 'person1' });
        row.name = 'changed';
        expect(row.__controller.__originalValues.name).toEqual('person1');
    });

    it('expect the new value to be readable after an edit', () => {
        const row = makeRow({ name: 'person1' });
        row.name = 'changed';
        expect(row.name).toEqual('changed');
    });

    it('expect setting a value back to the original to clear the edited flag', () => {
        const row = makeRow({ name: 'person1' });
        row.name = 'changed';
        expect(row.__controller.__edited).toEqual(true);
        row.name = 'person1';
        expect(row.__controller.__edited).toEqual(false);
    });

    it('expect a row to stay edited if one of two properties is still changed', () => {
        const row = makeRow({ name: 'person1', age: 10 });
        row.name = 'changed';
        row.age = 11;
        row.name = 'person1';
        expect(row.__controller.__edited).toEqual(true);
    });

    it('expect blanking a null property to not count as an edit', () => {
        const row = makeRow({ name: null });
        row.name = '';
        expect(row.__controller.__edited).toEqual(false);
    });

    it('expect blanking an undefined property to not count as an edit', () => {
        const row = makeRow({ name: undefined });
        row.name = '';
        expect(row.__controller.__edited).toEqual(false);
    });

    /**
     * dates are compared as timestamps - two Date objects are never === even when they
     * hold the same moment, so comparing the objects would leave the row flagged forever
     */
    it('expect a date set back to its original value to clear the edited flag', () => {
        const row = makeRow({ when: new Date(2020, 0, 1) });
        row.when = new Date(2021, 5, 5);
        expect(row.__controller.__edited).toEqual(true);

        row.when = new Date(2020, 0, 1);
        expect(row.__controller.__edited).toEqual(false);
    });

    it('expect a date changed to a different day to stay edited', () => {
        const row = makeRow({ when: new Date(2020, 0, 1) });
        row.when = new Date(2020, 0, 2);
        expect(row.__controller.__edited).toEqual(true);
    });

    /**
     * the container has no field types here (no datasource), so `when` is not a date field: it
     * compares to the second, a time change is an edit. v5 compared every date on the day - a
     * `date` field still does, see changeTracking.test.ts
     */
    it('expect a different time on the same day to count as an edit when the field is not a date field', () => {
        const row = makeRow({ when: new Date(2020, 0, 1, 8, 30, 0) });
        row.when = new Date(2020, 0, 1, 17, 45, 0);
        expect(row.__controller.__edited).toEqual(true);
    });

    it('expect only the milliseconds changed to not count as an edit', () => {
        const row = makeRow({ when: new Date(2020, 0, 1, 8, 30, 0, 0) });
        row.when = new Date(2020, 0, 1, 8, 30, 0, 999);
        expect(row.__controller.__edited).toEqual(false);
    });

    it('expect a different time on the same day to not count as an edit on a date field', () => {
        const container = new DataContainer();
        new Datasource({ container, fields: { when: 'date' } });
        container.setData([{ when: new Date(2020, 0, 1, 8, 30, 0) }]);
        const row = container.getDataSet()[0];

        row.when = new Date(2020, 0, 1, 17, 45, 0);
        expect(row.__controller.__edited).toEqual(false);
    });

    it('expect a prop set back to its original to stay in __editedProps as false', () => {
        const row = makeRow({ name: 'person1' });
        row.name = 'changed';
        row.name = 'person1';
        expect(row.__controller.__editedProps).toEqual({ name: false });
    });

    it('expect a non date value set back to its original to clear the flag, for contrast', () => {
        const row = makeRow({ when: 'a' });
        row.when = 'b';
        row.when = 'a';
        expect(row.__controller.__edited).toEqual(false);
    });

    it('expect editing a new row to not mark it as edited', () => {
        const row = makeRow({ name: 'person1' }, undefined, true);
        row.name = 'changed';
        expect(row.__controller.__isNew).toEqual(true);
        expect(row.name).toEqual('changed');
    });

    it('expect falsy values to be assignable', () => {
        const row = makeRow({ count: 5, flag: true, text: 'x' });
        row.count = 0;
        row.flag = false;
        row.text = '';
        expect(row.count).toEqual(0);
        expect(row.flag).toEqual(false);
        expect(row.text).toEqual('');
    });
});

describe('entityHandler - __KEY', () => {
    it('expect a generated negative __KEY when no key attribute is configured', () => {
        const row = makeRow({ name: 'person1' });
        expect(typeof row.__KEY).toEqual('number');
        expect(row.__KEY as number).toBeLessThan(0);
    });

    it('expect generated keys to be unique across rows', () => {
        const container = new DataContainer();
        container.setData([{ name: 'person1' }, { name: 'person2' }, { name: 'person3' }]);
        const keys = container.getDataSet().map((e) => e.__KEY);
        expect(new Set(keys).size).toEqual(3);
    });

    it('expect __KEY to read from the configured key attribute', () => {
        const row = makeRow({ id: 'abc', name: 'person1' }, 'id');
        expect(row.__KEY).toEqual('abc');
    });

    it('expect setting __KEY to write through to the configured key attribute', () => {
        const row = makeRow({ id: 'abc', name: 'person1' }, 'id');
        row.__KEY = 'xyz';
        expect(row.id).toEqual('xyz');
        expect(row.__KEY).toEqual('xyz');
    });

    /**
     * a proxy set trap has to return true - returning the assigned value throws a
     * TypeError in strict mode as soon as that value is falsy
     */
    it('expect setting __KEY to a falsy value to not throw', () => {
        const row = makeRow({ id: 'abc', name: 'person1' }, 'id');
        expect(() => {
            row.__KEY = 0;
        }).not.toThrow();
        expect(row.__KEY).toEqual(0);
    });

    it('expect setting __KEY to an empty string to not throw', () => {
        const row = makeRow({ id: 'abc', name: 'person1' }, 'id');
        expect(() => {
            row.__KEY = '';
        }).not.toThrow();
        expect(row.__KEY).toEqual('');
    });

    it('expect setting __KEY to null to not throw', () => {
        const row = makeRow({ id: 'abc', name: 'person1' }, 'id');
        expect(() => {
            // null! - null is not a valid key type, the proxy has to accept it anyway
            row.__KEY = null!;
        }).not.toThrow();
    });

    it('expect editing the key attribute directly to not be tracked as an edit', () => {
        const row = makeRow({ id: 'abc', name: 'person1' }, 'id');
        row.__KEY = 'xyz';
        expect(row.__controller.__edited).toEqual(false);
    });
});

describe('entityHandler - group properties', () => {
    it('expect group properties to be stored on the handler and not the target', () => {
        const data: Record<string, any> = { name: 'person1' };
        const container = new DataContainer();
        container.setData([data]);
        const row = container.getDataSet()[0];

        // the Entity type says a data row never has __group, set it past the type to test the proxy
        Reflect.set(row, '__group', true);
        row.__groupLvl = 2;
        row.__groupName = 'group1';

        expect(row.__group).toEqual(true);
        expect(row.__groupLvl).toEqual(2);
        expect(row.__groupName).toEqual('group1');
        expect(data.__group).toBeUndefined();
    });

    it('expect group properties to not count as edits', () => {
        const row = makeRow({ name: 'person1' });
        Reflect.set(row, '__group', true);
        row.__groupID = 'id1';
        row.__groupExpanded = true;
        expect(row.__controller.__edited).toEqual(false);
    });

    it('expect a __group property in the data to be hidden, so the row is still a data row', () => {
        const row = makeRow({ name: 'person1', __group: true, __groupID: 'x' });
        expect(row.__group).toBeUndefined();
        expect(row.__groupID).toBeUndefined();
        expect(isGroupRow(row)).toBe(false);
    });

    it('expect __rowError to be settable and readable', () => {
        const row = makeRow({ name: 'person1' });
        row.__rowError = 'something went wrong';
        expect(row.__rowError).toEqual('something went wrong');
        expect(row.__controller.__edited).toEqual(false);
    });
});

describe('entityHandler - names that look like the proxy fields', () => {
    it('expect a field with one underscore, or an empty name, read off the target', () => {
        const row = makeRow({ _id: 7, _: 'x', '': 'empty', __own: 'not a proxy field' });
        expect(row._id).toBe(7);
        expect(row._).toBe('x');
        expect(row['']).toBe('empty');
        // a __ name the proxy does not know is the target's too
        expect(row.__own).toBe('not a proxy field');
    });

    it('expect a symbol property read off the target', () => {
        const tag = Symbol('tag');
        const data: Record<string | symbol, unknown> = { name: 'a' };
        data[tag] = 'tagged';
        const row = makeRow(data as Record<string, any>) as unknown as Record<symbol, unknown>;
        expect(row[tag]).toBe('tagged');
        expect(row[Symbol.iterator]).toBeUndefined();
    });
});
