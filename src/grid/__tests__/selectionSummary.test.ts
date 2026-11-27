// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { Grid } from '../grid';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { selectionSummary } from '../gridFunctions/selectionSummary';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The summary of the selected cells in the footer (plan item 35), like the status bar of a spreadsheet:
 * for ranges of more than one cell, how many cells have a value, and of the numbers of the number
 * fields the sum, average, smallest and largest (selectionSummary.ts, rebuildFooter.ts). The real
 * browser places it at the footer's right, clear of the filter chips (footer-summary-check.js).
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

// name | age, balance (numberComma), code (a text of digits), active
const config = (options: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    layout: {
        left: [{ fields: ['name'], width: 100 }],
        center: [
            { fields: ['age'], width: 100 },
            { fields: ['balance'], width: 100 },
            { fields: ['code'], width: 100 },
            { fields: ['active'], width: 100 }
        ]
    },
    ...options
});

const rows = () => [
    { id: 1, name: 'Ann', group: 'a', age: 30, balance: 1000.5, code: '12', active: true },
    { id: 2, name: null, group: 'a', age: 0, balance: null, code: '', active: false },
    { id: 3, name: 'Cid', group: 'b', age: 50, balance: -4.25, code: '7', active: null },
    { id: 4, name: 'Dan', group: 'b', age: null, balance: 2, code: null, active: true }
];

const fields = (): DatasourceOptions => ({
    key: 'id',
    fields: { id: 'number', age: 'number', balance: { type: 'number', formatter: 'numberComma' }, active: 'boolean' }
});

const mount = (options: Partial<GridConfig> = {}) => mountGrid(config(options), rows(), fields());

/** the summary the grid element's grid computes */
const summaryOf = (element: GridElement) => selectionSummary((element as unknown as { grid: Grid }).grid);

/** the items the footer shows, null when it shows no summary */
function footerSummary(element: GridElement): string[] | null {
    const summary = element.querySelector('.footer-summary');
    return summary
        ? Array.from(summary.querySelectorAll('.footer-summary-item'), (item) => item.textContent?.trim() ?? '')
        : null;
}

/** waits for the grid's animation frame: the rows-changed microtask asks for it first */
const frame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
};

describe('selection summary - what it counts', () => {
    it('expect none without ranges, and none for one cell', async () => {
        const { element, gridInterface } = await mount();
        expect(summaryOf(element)).toBeNull();

        gridInterface.setRanges([{ fromRow: 0, fromField: 'age', toRow: 0, toField: 'age' }]);
        expect(summaryOf(element)).toBeNull();
    });

    it('expect the cells with a value counted, any type; the numbers of the number fields summed', async () => {
        const { element, gridInterface } = await mount();
        // every cell of every row: 20 cells, 5 of them blank (name, balance, code '' and null, active null, age null)
        gridInterface.setRanges([{ fromRow: 0, fromField: 'name', toRow: 3, toField: 'active' }]);

        expect(summaryOf(element)).toEqual({
            // blank: row 2 name, balance, code; row 3 active; row 4 age, code
            count: 14,
            // age 30, 0, 50 and balance 1000.5, -4.25, 2 - the code '12' is text, not a number
            sum: 1078.25,
            avg: 1078.25 / 6,
            min: -4.25,
            max: 1000.5,
            numberField: 'age'
        });
    });

    it('expect a 0 and false to count as values, the count alone without numbers', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([{ fromRow: 0, fromField: 'code', toRow: 2, toField: 'active' }]);

        // code '12', '7' and active true, false: '' and null are blank
        expect(summaryOf(element)).toEqual({ count: 4, sum: null, avg: null, min: null, max: null, numberField: null });

        gridInterface.setRanges([{ fromRow: 1, fromField: 'age', toRow: 2, toField: 'age' }]);
        expect(summaryOf(element)).toMatchObject({ count: 2, sum: 50, min: 0, max: 50 });
    });

    it('expect overlapping ranges to count their common cells once', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([
            { fromRow: 0, fromField: 'age', toRow: 2, toField: 'age' },
            { fromRow: 2, fromField: 'age', toRow: 0, toField: 'balance' }
        ]);

        // age 30, 0, 50 once each, balance 1000.5, -4.25
        expect(summaryOf(element)).toMatchObject({ count: 5, sum: 1076.25, numberField: 'age' });
    });

    it('expect the number field furthest left to give the formatter, and group rows skipped', async () => {
        const { element, gridInterface, datasource } = await mount();
        gridInterface.setRanges([{ fromRow: 0, fromField: 'balance', toRow: 3, toField: 'balance' }]);
        expect(summaryOf(element)?.numberField).toEqual('balance');

        // grouped: group a, its 2 rows, group b, its 2 rows - the group rows have no cells
        datasource.group([{ attribute: 'group', title: 'Group' }]);
        datasource.expandGroup();
        gridInterface.setRanges([{ fromRow: 0, fromField: 'age', toRow: 5, toField: 'age' }]);
        expect(summaryOf(element)).toMatchObject({ count: 3, sum: 80 });
    });
});

// the bugs of the row menu's summary that it replaces: the largest of negative numbers was 0, a 0 was
// skipped by min, the average was rounded to a whole number and counted the blanks
describe('selection summary - what the row menu summary got wrong', () => {
    /** the summary of these values, the cells of one number column selected */
    async function summaryOfValues(values: (number | null)[]) {
        const data = values.map((value, i) => ({ id: i + 1, name: `n${i}`, value }));
        const { element, gridInterface } = await mountGrid(
            {
                layout: {
                    center: [
                        { fields: ['name'], width: 100 },
                        { fields: ['value'], width: 100 }
                    ]
                }
            },
            data,
            { key: 'id', fields: { id: 'number', value: 'number' } }
        );
        gridInterface.setRanges([{ fromRow: 0, fromField: 'value', toRow: values.length - 1, toField: 'value' }]);
        return footerSummary(element);
    }

    it('expect the largest of negative numbers to be negative, not 0', async () => {
        expect(await summaryOfValues([-5, -3])).toContain('Max: -3');
    });

    it('expect 0 to be the smallest value, not skipped', async () => {
        expect(await summaryOfValues([0, 5])).toContain('Min: 0');
    });

    it('expect the average of the numbers only, not rounded to a whole number', async () => {
        expect(await summaryOfValues([1, 2, null])).toEqual(['Count: 2', 'Sum: 3', 'Average: 1.5', 'Min: 1', 'Max: 2']);
    });

    it('expect two decimals at most', async () => {
        // 1.875, the average of the two numbers
        expect(await summaryOfValues([1.5, 2.25])).toEqual(['Count: 2', 'Sum: 3.75', 'Average: 1.88', 'Min: 1.5', 'Max: 2.25']);
    });
});

describe('selection summary - in the footer', () => {
    it('expect the items for a range, with the formatter of the first number field', async () => {
        const { element, gridInterface } = await mount();
        expect(footerSummary(element)).toBeNull();

        gridInterface.setRanges([{ fromRow: 0, fromField: 'balance', toRow: 3, toField: 'balance' }]);
        // 1000.5 - 4.25 + 2, with the comma formatter; the average rounded to two decimals
        expect(footerSummary(element)).toEqual(['Count: 3', 'Sum: 998,25', 'Average: 332,75', 'Min: -4,25', 'Max: 1000,5']);
        const summary = element.querySelector('.footer-summary') as HTMLElement;
        expect(summary.getAttribute('role')).toEqual('group');
        expect(summary.getAttribute('aria-label')).toEqual('Selected cells');
        expect(summary.getAttribute('title')).toEqual('Count: 3\nSum: 998,25\nAverage: 332,75\nMin: -4,25\nMax: 1000,5');
    });

    it('expect the count alone for text, nothing for one cell or after clearRanges()', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([{ fromRow: 0, fromField: 'name', toRow: 3, toField: 'name' }]);
        expect(footerSummary(element)).toEqual(['Count: 3']);

        gridInterface.setRanges([{ fromRow: 0, fromField: 'name', toRow: 0, toField: 'name' }]);
        expect(footerSummary(element)).toBeNull();

        gridInterface.setRanges([{ fromRow: 0, fromField: 'age', toRow: 1, toField: 'age' }]);
        gridInterface.clearRanges();
        expect(footerSummary(element)).toBeNull();
    });

    it('expect it to follow an edit of a value in the range, in the next frame', async () => {
        const { element, gridInterface, datasource } = await mount();
        gridInterface.setRanges([{ fromRow: 0, fromField: 'age', toRow: 2, toField: 'age' }]);
        expect(footerSummary(element)?.[1]).toEqual('Sum: 80');

        datasource.getDataRows()[1].age = 20;
        await frame();
        expect(footerSummary(element)?.[1]).toEqual('Sum: 100');
    });

    it('expect the texts of the config', async () => {
        const { element, gridInterface } = await mount({
            texts: {
                'footer.summary.count': 'Antall: {count}',
                'footer.summary.sum': 'Sum: {sum}',
                'footer.summary': 'Valgte celler'
            }
        });
        gridInterface.setRanges([{ fromRow: 0, fromField: 'age', toRow: 2, toField: 'age' }]);

        expect(footerSummary(element)?.slice(0, 2)).toEqual(['Antall: 3', 'Sum: 80']);
        expect(element.querySelector('.footer-summary')?.getAttribute('aria-label')).toEqual('Valgte celler');
    });
});
