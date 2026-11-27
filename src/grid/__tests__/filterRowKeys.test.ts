// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GridConfig } from '../gridConfig';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The keys of the header filter row (cellFilterKeyNavigationCellRowHandler.ts), every section: Tab and
 * Shift+Tab, Alt+arrows - within a column of stacked fields, from one column to the next, from one section
 * to the next, down into the rows (group rows skipped), and the plain arrows left to the input.
 *
 * The layout: left a | b, center c over d | e, right f over g.
 */

const data = () => [
    { a: 'a1', b: 'b1', c: 'c1', d: 'd1', e: 'e1', f: 'f1', g: 'g1', group: 'x' },
    { a: 'a2', b: 'b2', c: 'c2', d: 'd2', e: 'e2', f: 'f2', g: 'g2', group: 'y' }
];

const config = (more: Partial<GridConfig> = {}): GridConfig => ({
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
    },
    ...more
});

/** the class of a filter: its section, column and field (the row is 0) */
const filter = (section: 'left' | 'middle' | 'right', column: number, field: number) =>
    `filter-cellpos-${section}-pinned-0-${column}-${field}`;

/** the class of a cell of the rows */
const cell = (section: 'left' | 'middle' | 'right', row: number, column: number, field: number) =>
    `cellpos-${section}-pinned-${row}-${column}-${field}`;

/** presses a key on the element with the class, after focusing it; returns the event */
function press(element: HTMLElement, from: string, code: string, modifiers: { altKey?: boolean; shiftKey?: boolean } = {}) {
    const input = element.querySelector(`.${from}`) as HTMLElement;
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

describe('the header filter row - Tab and Shift+Tab', () => {
    it.each([
        [filter('left', 0, 0), filter('left', 1, 0)],
        [filter('left', 1, 0), filter('middle', 0, 0)],
        [filter('middle', 0, 0), filter('middle', 0, 1)],
        [filter('middle', 0, 1), filter('middle', 1, 0)],
        [filter('middle', 1, 0), filter('right', 0, 0)],
        [filter('right', 0, 0), filter('right', 0, 1)]
    ])('expect Tab from %s to go to %s', async (from, to) => {
        const { element } = await mountGrid(config(), data());
        const event = press(element, from, 'Tab');
        expect(event.defaultPrevented).toBe(true);
        expect(focused()).toEqual(to);
    });

    it.each([
        [filter('right', 0, 1), filter('right', 0, 0)],
        [filter('right', 0, 0), filter('middle', 1, 0)],
        [filter('middle', 1, 0), filter('middle', 0, 1)],
        [filter('middle', 0, 1), filter('middle', 0, 0)],
        [filter('middle', 0, 0), filter('left', 1, 0)],
        [filter('left', 1, 0), filter('left', 0, 0)]
    ])('expect Shift+Tab from %s to go to %s', async (from, to) => {
        const { element } = await mountGrid(config(), data());
        press(element, from, 'Tab', { shiftKey: true });
        expect(focused()).toEqual(to);
    });

    it("expect Tab from the last filter to go to the first cell of the rows, Shift+Tab from the first to be the browser's", async () => {
        const { element } = await mountGrid(config(), data());
        expect(press(element, filter('right', 0, 1), 'Tab').defaultPrevented).toBe(true);
        expect(focused()).toEqual(cell('left', 0, 0, 0));
        expect(press(element, filter('left', 0, 0), 'Tab', { shiftKey: true }).defaultPrevented).toBe(false);
    });
});

describe('the header filter row - Alt+arrows', () => {
    it.each([
        // right: the next column, the next section; the top field of a column of two
        ['ArrowRight', filter('left', 0, 0), filter('left', 1, 0)],
        ['ArrowRight', filter('left', 1, 0), filter('middle', 0, 0)],
        ['ArrowRight', filter('middle', 0, 1), filter('middle', 1, 0)],
        ['ArrowRight', filter('middle', 1, 0), filter('right', 0, 0)],
        // past the last filter: the first cell of the first row
        ['ArrowRight', filter('right', 0, 0), cell('left', 0, 0, 0)],
        // left
        ['ArrowLeft', filter('right', 0, 0), filter('middle', 1, 0)],
        ['ArrowLeft', filter('middle', 1, 0), filter('middle', 0, 0)],
        ['ArrowLeft', filter('middle', 0, 0), filter('left', 1, 0)],
        ['ArrowLeft', filter('left', 1, 0), filter('left', 0, 0)],
        // the first filter: nowhere to go, it keeps the focus
        ['ArrowLeft', filter('left', 0, 0), filter('left', 0, 0)],
        // down: the field under it, else the first row
        ['ArrowDown', filter('middle', 0, 0), filter('middle', 0, 1)],
        ['ArrowDown', filter('middle', 0, 1), cell('middle', 0, 0, 0)],
        ['ArrowDown', filter('left', 0, 0), cell('left', 0, 0, 0)],
        ['ArrowDown', filter('right', 0, 0), filter('right', 0, 1)],
        ['ArrowDown', filter('right', 0, 1), cell('right', 0, 0, 0)],
        // up: the field above it
        ['ArrowUp', filter('middle', 0, 1), filter('middle', 0, 0)],
        ['ArrowUp', filter('right', 0, 1), filter('right', 0, 0)]
    ])('expect Alt+%s from %s to go to %s', async (key, from, to) => {
        const { element } = await mountGrid(config(), data());
        const event = press(element, from, key, { altKey: true });
        expect(event.defaultPrevented).toBe(true);
        expect(focused()).toEqual(to);
    });

    it('expect Alt+ArrowUp from the top field to go to its label, and to stay without labels', async () => {
        const { element } = await mountGrid(config(), data());
        press(element, filter('middle', 0, 0), 'ArrowUp', { altKey: true });
        // the label of the column's last field, d: the second label of the first center column
        const label = document.activeElement as HTMLElement;
        expect(label.getAttribute('type')).toEqual('label');
        expect(label.getAttribute('cellno')).toEqual('1');

        document.body.innerHTML = '';
        const hidden = await mountGrid(config({ hideLabels: true }), data());
        for (const section of ['left', 'middle', 'right'] as const) {
            press(hidden.element, filter(section, 0, 0), 'ArrowUp', { altKey: true });
            expect(focused()).toEqual(filter(section, 0, 0));
        }
    });

    it("expect the arrows without Alt to be the input's: the caret moves, not the focus", async () => {
        const { element } = await mountGrid(config(), data());
        for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
            const event = press(element, filter('middle', 0, 0), key);
            expect(event.defaultPrevented).toBe(false);
            expect(focused()).toEqual(filter('middle', 0, 0));
        }
    });

    it('expect Alt+ArrowDown into the rows to skip a group row: the first data row', async () => {
        const { element, datasource } = await mountGrid(config(), data());
        datasource.group([{ attribute: 'group', title: 'Group' }]);
        datasource.expandGroup();
        await new Promise((resolve) => setTimeout(resolve, 50));
        // row 0 is the group row of x, row 1 its data row
        press(element, filter('middle', 0, 1), 'ArrowDown', { altKey: true });
        expect(focused()).toEqual(cell('middle', 1, 0, 0));
    });
});
