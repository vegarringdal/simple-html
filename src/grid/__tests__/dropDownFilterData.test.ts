// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from 'vitest';
import { DROPDOWN_FILTER_MAX_ROWS, dropDownFilterData } from '../gridFunctions/dropDownFilterData';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * data behind the excel style column filter in the filter context menu
 */

const config = () => {
    const base = simpleConfig();
    base.attributes = [{ attribute: 'firstname' }, { attribute: 'lastname' }, { attribute: 'age', type: 'number' }];
    return base;
};

const rows = (values: string[]) => values.map((v, i) => ({ firstname: v, lastname: `last${i}`, age: i }));

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

describe('dropDownFilterData - distinct values', () => {
    it('expect one entry per distinct value', async () => {
        const { element } = await mountGrid(config(), rows(['a', 'b', 'a', 'c']));
        const data = dropDownFilterData((element as any).grid, 'firstname', false, null);

        expect(Array.from(data.dataFilterSetFull).sort()).toEqual(['A', 'B', 'C']);
    });

    it('expect values to be uppercased', async () => {
        const { element } = await mountGrid(config(), rows(['abc']));
        const data = dropDownFilterData((element as any).grid, 'firstname', false, null);

        expect(Array.from(data.dataFilterSetFull)).toContain('ABC');
    });

    it('expect blank values to show up as NULL', async () => {
        const { element } = await mountGrid(config(), [
            { firstname: 'a', lastname: 'x', age: 1 },
            { firstname: null, lastname: 'y', age: 2 }
        ]);
        const data = dropDownFilterData((element as any).grid, 'firstname', false, null);

        expect(Array.from(data.dataFilterSetFull)).toContain('NULL');
    });
});

describe('dropDownFilterData - counts', () => {
    it('expect a count per distinct value', async () => {
        const { element } = await mountGrid(config(), rows(['a', 'b', 'a', 'a']));
        const data = dropDownFilterData((element as any).grid, 'firstname', false, null);

        expect(data.counts.get('A')).toEqual(3);
        expect(data.counts.get('B')).toEqual(1);
    });

    it('expect blanks to be counted too', async () => {
        const { element } = await mountGrid(config(), [
            { firstname: 'a', lastname: 'x', age: 1 },
            { firstname: null, lastname: 'y', age: 2 },
            { firstname: '', lastname: 'z', age: 3 }
        ]);
        const data = dropDownFilterData((element as any).grid, 'firstname', false, null);

        expect(data.counts.get('NULL')).toEqual(2);
    });

    it('expect nothing to be flagged as truncated for a small set', async () => {
        const { element } = await mountGrid(config(), rows(['a', 'b', 'c']));
        const data = dropDownFilterData((element as any).grid, 'firstname', false, null);

        expect(data.truncated).toEqual(false);
    });
});

describe('dropDownFilterData - the row cap', () => {
    const tooMany = () => rows(Array.from({ length: DROPDOWN_FILTER_MAX_ROWS + 25 }, (_, i) => `value${i}`));

    it('expect the list to stop at the cap', async () => {
        const { element } = await mountGrid(config(), tooMany());
        const data = dropDownFilterData((element as any).grid, 'firstname', false, null);

        expect(data.dataFilterSetFull.size).toBeLessThanOrEqual(DROPDOWN_FILTER_MAX_ROWS + 1);
    });

    /**
     * the list size cannot be used to detect this - the cap stops the set at exactly
     * DROPDOWN_FILTER_MAX_ROWS, so "size > max" only ever became true when a blank
     * pushed it one over
     */
    it('expect truncated to be set when values were dropped', async () => {
        const { element } = await mountGrid(config(), tooMany());
        const data = dropDownFilterData((element as any).grid, 'firstname', false, null);

        expect(data.truncated).toEqual(true);
    });

    it('expect counts to still be complete for the values that made it in', async () => {
        const { element } = await mountGrid(config(), [...tooMany(), { firstname: 'value0', lastname: 'x', age: 1 }]);
        const data = dropDownFilterData((element as any).grid, 'firstname', false, null);

        expect(data.counts.get('VALUE0')).toEqual(2);
    });
});

describe('dropDownFilterData - search', () => {
    it('expect the search to narrow the list', async () => {
        const { element } = await mountGrid(config(), rows(['apple', 'banana', 'avocado']));
        const data = dropDownFilterData((element as any).grid, 'firstname', false, 'ap');

        expect(Array.from(data.dataFilterSetFull)).toEqual(['APPLE']);
    });

    it('expect wildcards in the search to be ignored', async () => {
        const { element } = await mountGrid(config(), rows(['apple', 'banana']));
        const data = dropDownFilterData((element as any).grid, 'firstname', false, '*ap*');

        expect(Array.from(data.dataFilterSetFull)).toEqual(['APPLE']);
    });
});
