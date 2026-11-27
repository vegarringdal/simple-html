// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GridConfig } from '../gridConfig';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The keys of the cells of the rows (cellRowKeyNavigationCellRowHandler.ts), every section: Tab and
 * Shift+Tab, Alt+arrows - within a column of stacked fields, from one column and section to the next,
 * from one row to the next (wrapping), up into the header filters, group rows skipped, and the plain
 * arrows left to the input.
 *
 * The layout: left a | b, center c over d | e, right f over g; three rows.
 */

const data = () =>
    [1, 2, 3].map((n) => ({
        a: `a${n}`,
        b: `b${n}`,
        c: `c${n}`,
        d: `d${n}`,
        e: `e${n}`,
        f: `f${n}`,
        g: `g${n}`,
        group: n < 3 ? 'x' : 'y'
    }));

const config = (): GridConfig => ({
    readonly: false,
    columns: { a: {}, b: {}, c: {}, d: {}, e: {}, f: {}, g: {} },
    layout: {
        left: [
            { fields: ['a'], width: 100 },
            { fields: ['b'], width: 100 }
        ],
        center: [
            { fields: ['c', 'd'], width: 100 },
            { fields: ['e'], width: 100 }
        ],
        right: [{ fields: ['f', 'g'], width: 100 }]
    }
});

type Section = 'left' | 'middle' | 'right';

/** the class of a cell of the rows: its section, row, column and field */
const cell = (section: Section, row: number, column: number, field: number) =>
    `cellpos-${section}-pinned-${row}-${column}-${field}`;

/** the class of a header filter */
const filter = (section: Section, column: number, field: number) => `filter-cellpos-${section}-pinned-0-${column}-${field}`;

/** presses a key on the input with the class, after focusing it; returns the event */
function press(element: HTMLElement, from: string, code: string, modifiers: { altKey?: boolean; shiftKey?: boolean } = {}) {
    const input = element.querySelector(`input.${from}`) as HTMLElement;
    input.focus();
    const event = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true, ...modifiers });
    input.dispatchEvent(event);
    return event;
}

/** the cellpos class of the element with the focus */
function focused() {
    const className = (document.activeElement as HTMLElement)?.className || '';
    return className.split(' ').find((name) => name.startsWith('cellpos-') || name.startsWith('filter-cellpos-'));
}

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('the cells of the rows - Tab and Shift+Tab', () => {
    it.each([
        [cell('left', 0, 0, 0), cell('left', 0, 1, 0)],
        [cell('left', 0, 1, 0), cell('middle', 0, 0, 0)],
        [cell('middle', 0, 0, 0), cell('middle', 0, 0, 1)],
        [cell('middle', 0, 0, 1), cell('middle', 0, 1, 0)],
        [cell('middle', 0, 1, 0), cell('right', 0, 0, 0)],
        [cell('right', 0, 0, 0), cell('right', 0, 0, 1)],
        // the end of a row: the start of the next
        [cell('right', 0, 0, 1), cell('left', 1, 0, 0)]
    ])('expect Tab from %s to go to %s', async (from, to) => {
        const { element } = await mountGrid(config(), data());
        expect(press(element, from, 'Tab').defaultPrevented).toBe(true);
        expect(focused()).toEqual(to);
    });

    it.each([
        // the start of a row: the end of the one above
        [cell('left', 1, 0, 0), cell('right', 0, 0, 1)],
        [cell('right', 1, 0, 1), cell('right', 1, 0, 0)],
        [cell('right', 1, 0, 0), cell('middle', 1, 1, 0)],
        [cell('middle', 1, 1, 0), cell('middle', 1, 0, 1)],
        [cell('middle', 1, 0, 1), cell('middle', 1, 0, 0)],
        [cell('middle', 1, 0, 0), cell('left', 1, 1, 0)],
        [cell('left', 1, 1, 0), cell('left', 1, 0, 0)]
    ])('expect Shift+Tab from %s to go to %s', async (from, to) => {
        const { element } = await mountGrid(config(), data());
        expect(press(element, from, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
        expect(focused()).toEqual(to);
    });
});

describe('the cells of the rows - Alt+arrows', () => {
    it.each([
        ['ArrowRight', cell('left', 1, 0, 0), cell('left', 1, 1, 0)],
        ['ArrowRight', cell('left', 1, 1, 0), cell('middle', 1, 0, 0)],
        ['ArrowRight', cell('middle', 1, 0, 1), cell('middle', 1, 1, 0)],
        ['ArrowRight', cell('middle', 1, 1, 0), cell('right', 1, 0, 0)],
        ['ArrowLeft', cell('right', 1, 0, 0), cell('middle', 1, 1, 0)],
        ['ArrowLeft', cell('middle', 1, 1, 0), cell('middle', 1, 0, 0)],
        ['ArrowLeft', cell('middle', 1, 0, 0), cell('left', 1, 1, 0)],
        ['ArrowLeft', cell('left', 1, 1, 0), cell('left', 1, 0, 0)],
        // down: the field under it, else the next row's top field
        ['ArrowDown', cell('middle', 0, 0, 0), cell('middle', 0, 0, 1)],
        ['ArrowDown', cell('middle', 0, 0, 1), cell('middle', 1, 0, 0)],
        ['ArrowDown', cell('left', 0, 0, 0), cell('left', 1, 0, 0)],
        ['ArrowDown', cell('right', 0, 0, 1), cell('right', 1, 0, 0)],
        // up: the field above it, else the row above's bottom field
        ['ArrowUp', cell('middle', 1, 0, 1), cell('middle', 1, 0, 0)],
        ['ArrowUp', cell('middle', 1, 0, 0), cell('middle', 0, 0, 1)],
        ['ArrowUp', cell('left', 1, 0, 0), cell('left', 0, 0, 0)],
        ['ArrowUp', cell('right', 1, 0, 0), cell('right', 0, 0, 1)],
        // up from the first row: its header filter, the bottom field's
        ['ArrowUp', cell('middle', 0, 0, 0), filter('middle', 0, 1)],
        ['ArrowUp', cell('left', 0, 0, 0), filter('left', 0, 0)],
        ['ArrowUp', cell('right', 0, 0, 0), filter('right', 0, 1)]
    ])('expect Alt+%s from %s to go to %s', async (key, from, to) => {
        const { element } = await mountGrid(config(), data());
        expect(press(element, from, key, { altKey: true }).defaultPrevented).toBe(true);
        expect(focused()).toEqual(to);
    });

    it("expect the arrows without Alt to be the input's", async () => {
        const { element } = await mountGrid(config(), data());
        for (const key of ['ArrowLeft', 'ArrowRight']) {
            expect(press(element, cell('middle', 1, 0, 0), key).defaultPrevented).toBe(false);
            expect(focused()).toEqual(cell('middle', 1, 0, 0));
        }
    });

    it('expect a group row to be skipped going down and up', async () => {
        const { element, datasource } = await mountGrid(config(), data());
        datasource.group([{ attribute: 'group', title: 'Group' }]);
        datasource.expandGroup();
        await new Promise((resolve) => setTimeout(resolve, 50));
        // 0 group x, 1 and 2 its rows, 3 group y, 4 its row
        press(element, cell('left', 2, 0, 0), 'ArrowDown', { altKey: true });
        expect(focused()).toEqual(cell('left', 4, 0, 0));
        press(element, cell('left', 4, 0, 0), 'ArrowUp', { altKey: true });
        expect(focused()).toEqual(cell('left', 2, 0, 0));
    });
});
