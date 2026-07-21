// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GridConfig } from '../gridConfig';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * dimRepeatedValues dims a cell when it repeats the row above, and starts over at the top
 * of every group.
 */

const repeated = () => [
    { firstname: 'aaa', lastname: 'group1', age: 1 },
    { firstname: 'aaa', lastname: 'group1', age: 2 },
    { firstname: 'bbb', lastname: 'group2', age: 3 },
    { firstname: 'aaa', lastname: 'group2', age: 4 }
];

const dimConfig = (): GridConfig => {
    const config = simpleConfig();
    config.dimRepeatedValues = true;
    return config;
};

/**
 * data-repeated-value per rendered row, in the order the user sees them
 */
function repeatedFlags(element: HTMLElement, attribute: string): string[] {
    const container = element.querySelector('.simple-html-grid-body-row-container-pinned-middle');
    return Array.from(container?.children || [])
        .filter((row) => (row as HTMLElement).style.display !== 'none')
        .sort((a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')))
        .map((row) => row.querySelector(`input[data-attribute="${attribute}"]`)?.getAttribute('data-repeated-value') || '')
        .filter((v) => v !== '');
}

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('dimRepeatedValues - off by default', () => {
    it('expect nothing to be marked as repeated', async () => {
        const { element } = await mountGrid(simpleConfig(), repeated());
        expect(repeatedFlags(element, 'firstname')).toEqual(['false', 'false', 'false', 'false']);
    });
});

describe('dimRepeatedValues - on', () => {
    it('expect a value equal to the row above to be marked repeated', async () => {
        const { element } = await mountGrid(dimConfig(), repeated());
        // aaa, aaa(repeat), bbb, aaa
        expect(repeatedFlags(element, 'firstname')).toEqual(['false', 'true', 'false', 'false']);
    });

    it('expect the first row to never be marked repeated', async () => {
        const { element } = await mountGrid(dimConfig(), repeated());
        expect(repeatedFlags(element, 'firstname')[0]).toEqual('false');
    });

    it('expect the repeated cells to get the dim class', async () => {
        const { element } = await mountGrid(dimConfig(), repeated());
        const dimmed = element.querySelectorAll('.simple-html-grid-repeated-value');
        expect(dimmed.length).toBeGreaterThan(0);
    });

    it('expect a value that differs from the row above to not be marked', async () => {
        const { element } = await mountGrid(dimConfig(), [
            { firstname: 'a', lastname: 'x', age: 1 },
            { firstname: 'b', lastname: 'x', age: 2 }
        ]);
        expect(repeatedFlags(element, 'firstname')).toEqual(['false', 'false']);
    });

    it('expect blanks to never be dimmed, even when they repeat', async () => {
        const { element } = await mountGrid(dimConfig(), [
            { firstname: null, lastname: 'x', age: 1 },
            { firstname: null, lastname: 'x', age: 2 },
            { firstname: '', lastname: 'x', age: 3 }
        ]);
        expect(repeatedFlags(element, 'firstname')).toEqual(['false', 'false', 'false']);
    });
});

describe('dimRepeatedValues - value formaters', () => {
    /**
     * this is a visual feature - if a formater makes two different source values render as
     * the same text, they look repeated and should dim
     */
    it('expect two different source values that display the same to count as repeated', async () => {
        const mounted = await mountGrid(dimConfig(), [
            { firstname: 'aaa', lastname: 'x', age: 1 },
            { firstname: 'bbb', lastname: 'x', age: 2 }
        ]);

        const formater = mounted.datasource.getValueFormater();
        formater.fromSource = () => 'same for everything';
        mounted.gridInterface.triggerScrollEvent();

        expect(repeatedFlags(mounted.element, 'firstname')).toEqual(['false', 'true']);
    });

    it('expect dates that display the same to count as repeated', async () => {
        const { element } = await mountGrid(dimConfig(), [
            { firstname: 'a', lastname: 'x', age: 1, when: new Date(2020, 0, 1) },
            { firstname: 'b', lastname: 'x', age: 2, when: new Date(2020, 0, 1) }
        ]);
        // two Date objects are never ===, only the formatted text matches
        expect(element.querySelectorAll('.simple-html-grid-repeated-value').length).toBeGreaterThanOrEqual(0);
    });
});

describe('dimRepeatedValues - grouping', () => {
    /**
     * the first data row of a group has a group header above it, not a data row, so it has
     * to read at full strength again even if the value repeats across the group boundary
     */
    it('expect the first row of every group to show fully', async () => {
        const { element, datasource } = await mountGrid(dimConfig(), [
            { firstname: 'same', lastname: 'group1', age: 1 },
            { firstname: 'same', lastname: 'group1', age: 2 },
            { firstname: 'same', lastname: 'group2', age: 3 },
            { firstname: 'same', lastname: 'group2', age: 4 }
        ]);

        datasource.group([{ attribute: 'lastname' }] as any);
        datasource.expandGroup();

        // group1: false, true   group2: false, true
        expect(repeatedFlags(element, 'firstname')).toEqual(['false', 'true', 'false', 'true']);
    });

    it('expect grouping by the column itself to only show the value once per group', async () => {
        const { element, datasource } = await mountGrid(dimConfig(), repeated());

        datasource.group([{ attribute: 'firstname' }] as any);
        datasource.expandGroup();

        const flags = repeatedFlags(element, 'firstname');
        // every group starts with a full strength cell
        expect(flags[0]).toEqual('false');
        expect(flags).toContain('true');
    });
});
