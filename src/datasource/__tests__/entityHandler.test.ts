import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import type { Entity } from '../entity';

/**
 * EntityHandler is the proxy handler behind every row.
 * It tracks which properties have been edited so getChanges()/__rowState can report them.
 *
 * Rows are always created through DataContainer.setData, so that is how we build them here.
 */

function makeRow(data: Record<string, any>, keyAttribute?: string, tagAsNew = false): Entity {
    const container = new DataContainer(keyAttribute);
    container.setData([data], false, tagAsNew);
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
     * only the day matters - both sides are normalised to midnight before comparing,
     * so a different time on the same day is not treated as a change
     */
    it('expect a different time on the same day to not count as an edit', () => {
        const row = makeRow({ when: new Date(2020, 0, 1, 8, 30, 0) });
        row.when = new Date(2020, 0, 1, 17, 45, 0);
        expect(row.__controller.__edited).toEqual(false);
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
            row.__KEY = null;
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

        row.__group = true;
        row.__groupLvl = 2;
        row.__groupName = 'group1';

        expect(row.__group).toEqual(true);
        expect(row.__groupLvl).toEqual(2);
        expect(row.__groupName).toEqual('group1');
        expect(data.__group).toBeUndefined();
    });

    it('expect group properties to not count as edits', () => {
        const row = makeRow({ name: 'person1' });
        row.__group = true;
        row.__groupID = 'id1';
        row.__groupExpanded = true;
        expect(row.__controller.__edited).toEqual(false);
    });

    it('expect __rowError to be settable and readable', () => {
        const row = makeRow({ name: 'person1' });
        row.__rowError = 'something went wrong';
        expect(row.__rowError).toEqual('something went wrong');
        expect(row.__controller.__edited).toEqual(false);
    });
});
