// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerCellRenderer } from '../cellRendererRegistry';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import { edgeRow, pageIndex, pageRow } from '../gridFunctions/rowSteps';
import { type MountedGrid, mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, headerFilterInput, labelCell, sleep } from './interactionTestHelpers';

/**
 * The keys that jump (jumpKeys.ts): Ctrl+Home / Ctrl+End, Alt+Home / Alt+End, PageUp / PageDown,
 * Alt+PageUp / Alt+PageDown, Ctrl+ArrowUp / Ctrl+ArrowDown - in the cells, with Shift for the ranges, and
 * from a header filter, a column header and the button of a group row. Home and End stay the caret's.
 *
 * The stub viewport is 1000 x 600: 600px of rows of 22px, a page is 600px. The middle columns are 12 of
 * 200px (2400px) in a view of 1000px: a page of columns is 5 of them.
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

const CENTER = Array.from({ length: 12 }, (_, i) => `c${i}`);

const rows = (count = 500): Record<string, any>[] =>
    Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `name${i}`,
        group: i < 10 ? 'a' : 'b',
        ...Object.fromEntries(CENTER.map((field) => [field, `r${i}${field}`]))
    }));

/** name pinned left, id pinned right, c0 ... c11 in the middle */
const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    layout: {
        left: [{ fields: ['name'], width: 100 }],
        center: CENTER.map((field) => ({ fields: [field], width: 200 })),
        right: [{ fields: ['id'], width: 80 }]
    },
    ...more
});

const options = () => ({ fields: { id: 'number' as const } });

const mount = (gridConfig: GridConfig = config(), data = rows()) => mountGrid(gridConfig, data, options());

/** a row element or column element on the way is hidden: what it shows is not on screen */
function shown(element: Element, grid: GridElement) {
    for (let e: Element | null = element; e && e !== grid; e = e.parentElement) {
        if ((e as HTMLElement).style.display === 'none') {
            return false;
        }
    }
    return true;
}

/** the input (or the host of a custom cell) of a field in a displayed row, on screen */
function inputAt(element: GridElement, row: number, field: string): HTMLElement {
    const found = Array.from(element.querySelectorAll<HTMLElement>(`[data-attribute="${field}"]`)).find(
        (input) => (input.closest('.simple-html-grid-col-cell') as HTMLCellElement | null)?.$row === row && shown(input, element)
    );
    if (!found) {
        throw new Error(`no cell on screen for row ${row}, ${field}`);
    }
    return found;
}

/** the row and field of the cell with the focus */
function focused() {
    const cell = document.activeElement?.closest('.simple-html-grid-col-cell') as HTMLCellElement | null;
    return cell ? { row: cell.$row, field: cell.$attribute } : null;
}

/** a keydown on an element, as the browser sends it: `code` is the key's for these keys */
function press(target: Element, key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

/** presses a key in the cell of a row and field, focused first */
function pressIn(element: GridElement, row: number, field: string, key: string, init: KeyboardEventInit = {}) {
    const input = inputAt(element, row, field);
    input.focus();
    return press(input, key, init);
}

const bodyScroller = (element: GridElement) => element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
const middleScroller = (element: GridElement) => element.querySelector('.simple-html-grid-middle-scroller') as HTMLElement;

const current = ({ datasource }: MountedGrid) => datasource.getRows().indexOf(datasource.currentEntity as any);

describe('jump keys - Ctrl+Home / Ctrl+End', () => {
    it('expect Ctrl+End to go to the last cell of the last row, off screen, and Ctrl+Home back to the first cell', async () => {
        const mounted = await mount();
        const { element } = mounted;

        const end = pressIn(element, 3, 'c4', 'End', { ctrlKey: true });

        expect(end.defaultPrevented).toBe(true);
        // the last cell: pinned right. The rows at the bottom, the middle columns at their end
        expect(focused()).toEqual({ row: 499, field: 'id' });
        expect(bodyScroller(element).scrollTop).toBe(500 * 22 - 600);
        expect(middleScroller(element).scrollLeft).toBe(2400 - 1000);
        expect(current(mounted)).toBe(499);

        const home = press(document.activeElement as Element, 'Home', { ctrlKey: true });

        expect(home.defaultPrevented).toBe(true);
        // the first cell: pinned left, the rows and the middle columns at their start
        expect(focused()).toEqual({ row: 0, field: 'name' });
        expect(bodyScroller(element).scrollTop).toBe(0);
        expect(middleScroller(element).scrollLeft).toBe(0);
        expect(current(mounted)).toBe(0);
    });

    it('expect Cmd+Home / Cmd+End to do the same, on a Mac', async () => {
        const { element } = await mount();

        pressIn(element, 3, 'c4', 'End', { metaKey: true });
        expect(focused()).toEqual({ row: 499, field: 'id' });
        press(document.activeElement as Element, 'Home', { metaKey: true });
        expect(focused()).toEqual({ row: 0, field: 'name' });
    });

    it('expect the first and last cell in the middle section when nothing is pinned, scrolled to', async () => {
        const center = config();
        center.layout.left = [];
        center.layout.right = [];
        const { element } = await mount(center);

        pressIn(element, 0, 'c0', 'End', { ctrlKey: true });
        expect(focused()).toEqual({ row: 499, field: 'c11' });
        expect(middleScroller(element).scrollLeft).toBe(1400);

        press(document.activeElement as Element, 'Home', { ctrlKey: true });
        expect(focused()).toEqual({ row: 0, field: 'c0' });
        expect(middleScroller(element).scrollLeft).toBe(0);
    });

    it('expect the group rows skipped: the first and the last data row', async () => {
        const { element, datasource } = await mount(config(), rows(30));
        datasource.group([{ attribute: 'group', title: 'Group' }]);
        datasource.expandGroup();
        // a, its 10 rows, b, its 20 rows
        expect(datasource.length()).toBe(32);

        pressIn(element, 1, 'c0', 'End', { ctrlKey: true });
        expect(focused()).toEqual({ row: 31, field: 'id' });
        press(document.activeElement as Element, 'Home', { ctrlKey: true });
        expect(focused()).toEqual({ row: 1, field: 'name' });
    });

    it('expect the cell of a column of two fields: the last field is the last cell', async () => {
        const stacked = config();
        stacked.layout.right = [{ fields: ['id', 'group'], width: 80 }];
        const { element } = await mount(stacked);

        pressIn(element, 0, 'c0', 'End', { ctrlKey: true });
        expect(focused()).toEqual({ row: 499, field: 'group' });
    });
});

describe('jump keys - Home / End', () => {
    it('expect Home and End to stay the caret in the input: not prevented, the focus stays', async () => {
        const { element } = await mount();
        const input = inputAt(element, 2, 'c1');
        input.focus();

        for (const init of [{}, { shiftKey: true }]) {
            expect(press(input, 'Home', init).defaultPrevented).toBe(false);
            expect(press(input, 'End', init).defaultPrevented).toBe(false);
        }
        // a word to the left and right with Ctrl: the input's too
        expect(press(input, 'ArrowLeft', { ctrlKey: true }).defaultPrevented).toBe(false);
        expect(press(input, 'ArrowRight', { ctrlKey: true }).defaultPrevented).toBe(false);
        await sleep(150);
        expect(document.activeElement).toBe(input);
    });

    it('expect Alt+Home / Alt+End to go to the first / last cell of the row', async () => {
        const mounted = await mount();
        const { element } = mounted;

        expect(pressIn(element, 4, 'c3', 'End', { altKey: true }).defaultPrevented).toBe(true);
        expect(focused()).toEqual({ row: 4, field: 'id' });
        expect(middleScroller(element).scrollLeft).toBe(1400);

        expect(press(document.activeElement as Element, 'Home', { altKey: true }).defaultPrevented).toBe(true);
        expect(focused()).toEqual({ row: 4, field: 'name' });
        expect(middleScroller(element).scrollLeft).toBe(0);
        expect(current(mounted)).toBe(4);
    });

    it('expect Ctrl+Alt+Home - AltGr on Windows - left alone', async () => {
        const { element } = await mount();
        expect(pressIn(element, 4, 'c3', 'Home', { altKey: true, ctrlKey: true }).defaultPrevented).toBe(false);
        expect(focused()).toEqual({ row: 4, field: 'c3' });
    });
});

describe('jump keys - PageUp / PageDown', () => {
    it('expect PageDown a page of rows down in the same column, the rows scrolled as far, and PageUp back', async () => {
        const mounted = await mount();
        const { element } = mounted;

        // row 2 starts at 44: a page further is 644, in row 29 (638 - 660)
        expect(pressIn(element, 2, 'c3', 'PageDown').defaultPrevented).toBe(true);

        expect(focused()).toEqual({ row: 29, field: 'c3' });
        // the cell where row 2 was on screen
        expect(bodyScroller(element).scrollTop).toBe(29 * 22 - 2 * 22);
        expect(current(mounted)).toBe(29);

        expect(press(document.activeElement as Element, 'PageUp').defaultPrevented).toBe(true);
        expect(focused()).toEqual({ row: 2, field: 'c3' });
        expect(bodyScroller(element).scrollTop).toBe(0);
    });

    it('expect PageDown to stop at the last row, PageUp at the first', async () => {
        const { element } = await mount();
        pressIn(element, 3, 'c4', 'End', { ctrlKey: true });
        press(document.activeElement as Element, 'Home', { altKey: true });
        expect(focused()).toEqual({ row: 499, field: 'name' });

        // up 27 rows and down again: the same row, the same scroll
        press(document.activeElement as Element, 'PageUp');
        expect(focused()).toEqual({ row: 472, field: 'name' });
        press(document.activeElement as Element, 'PageDown');
        press(document.activeElement as Element, 'PageDown');
        expect(focused()).toEqual({ row: 499, field: 'name' });
        expect(bodyScroller(element).scrollTop).toBe(500 * 22 - 600);

        for (let i = 0; i < 20; i++) {
            press(document.activeElement as Element, 'PageUp');
        }
        expect(focused()).toEqual({ row: 0, field: 'name' });
        expect(bodyScroller(element).scrollTop).toBe(0);
    });

    it('expect a group row where the page ends skipped: the data row after it, in the direction of the key', async () => {
        // a (row 0), its 30 rows (1 - 30), b (31), its 50 rows (32 - 81)
        const data = rows(80).map((row) => ({ ...row, group: row.id <= 30 ? 'a' : 'b' }));
        const mounted = await mount(config(), data);
        mounted.datasource.group([{ attribute: 'group', title: 'Group' }]);
        mounted.datasource.expandGroup();
        const ctx = gridOf(mounted.element);
        // a group row is as high as a row here
        expect(mounted.gridInterface.__getScrollState().scrollTops[31]).toBe(31 * 22);

        // row 4 + 27 is b: the row after it
        expect(pageRow(ctx, 4, 1)).toBe(32);
        // row 58 - 27 is b: the row before it
        expect(pageRow(ctx, 58, -1)).toBe(30);
        // up past the first row: a, a group row - the first data row
        expect(pageRow(ctx, 12, -1)).toBe(1);

        pressIn(mounted.element, 4, 'c0', 'PageDown');
        expect(focused()).toEqual({ row: 32, field: 'c0' });
        press(document.activeElement as Element, 'PageUp');
        expect(focused()).toEqual({ row: 5, field: 'c0' });
    });

    it('expect a page in the tops of the rows: the furthest within a page, down and up again the same, a tall row no wall', () => {
        const tops = [0, 22, 44, 66, 88, 110];
        expect(pageIndex(tops, 0, 1, 50)).toBe(2);
        expect(pageIndex(tops, 2, -1, 50)).toBe(0);
        // a row starting exactly a page further
        expect(pageIndex(tops, 0, 1, 44)).toBe(2);
        // the ends
        expect(pageIndex(tops, 4, 1, 50)).toBe(5);
        expect(pageIndex(tops, 5, 1, 50)).toBe(5);
        expect(pageIndex(tops, 1, -1, 50)).toBe(0);
        expect(pageIndex(tops, 0, -1, 50)).toBe(0);
        // row 1 is 880px high, more than a page of 600: the next row all the same
        const tall = [0, 22, 902, 924];
        expect(pageIndex(tall, 1, 1, 600)).toBe(2);
        expect(pageIndex(tall, 2, -1, 600)).toBe(1);
    });

    it('expect Shift+PageDown to extend the range a page, the focus to stay', async () => {
        const { element, gridInterface } = await mount();
        const input = inputAt(element, 2, 'c3');
        input.focus();

        expect(press(input, 'PageDown', { shiftKey: true }).defaultPrevented).toBe(true);

        expect(gridInterface.getRanges()).toEqual([{ fromRow: 2, fromField: 'c3', toRow: 29, toField: 'c3' }]);
        expect(document.activeElement).toBe(input);
        press(input, 'PageDown', { shiftKey: true });
        expect(gridInterface.getRanges()[0].toRow).toBe(56);
        press(input, 'PageUp', { shiftKey: true });
        expect(gridInterface.getRanges()[0].toRow).toBe(29);
    });

    it('expect Ctrl+PageUp / Ctrl+PageDown left to the browser - its tabs', async () => {
        const { element } = await mount();
        expect(pressIn(element, 2, 'c3', 'PageDown', { ctrlKey: true }).defaultPrevented).toBe(false);
        expect(pressIn(element, 2, 'c3', 'PageUp', { ctrlKey: true }).defaultPrevented).toBe(false);
        expect(focused()).toEqual({ row: 2, field: 'c3' });
    });
});

describe('jump keys - Alt+PageUp / Alt+PageDown, a page of columns', () => {
    it('expect Alt+PageDown a page of middle columns right, the columns scrolled as far, and Alt+PageUp back', async () => {
        const { element } = await mount();

        expect(pressIn(element, 1, 'c0', 'PageDown', { altKey: true }).defaultPrevented).toBe(true);
        // 1000px further: c5
        expect(focused()).toEqual({ row: 1, field: 'c5' });
        expect(middleScroller(element).scrollLeft).toBe(1000);

        press(document.activeElement as Element, 'PageDown', { altKey: true });
        expect(focused()).toEqual({ row: 1, field: 'c10' });
        // at the end: the last column
        press(document.activeElement as Element, 'PageDown', { altKey: true });
        expect(focused()).toEqual({ row: 1, field: 'c11' });
        expect(middleScroller(element).scrollLeft).toBe(1400);

        press(document.activeElement as Element, 'PageUp', { altKey: true });
        expect(focused()).toEqual({ row: 1, field: 'c6' });
        press(document.activeElement as Element, 'PageUp', { altKey: true });
        press(document.activeElement as Element, 'PageUp', { altKey: true });
        expect(focused()).toEqual({ row: 1, field: 'c0' });
        expect(middleScroller(element).scrollLeft).toBe(0);
    });

    it('expect Alt+PageDown in a pinned column to scroll the middle columns, the focus to stay', async () => {
        const { element } = await mount();

        pressIn(element, 1, 'name', 'PageDown', { altKey: true });

        expect(focused()).toEqual({ row: 1, field: 'name' });
        expect(middleScroller(element).scrollLeft).toBe(1000);
    });

    it('expect Alt+Shift+PageDown to do nothing: no range', async () => {
        const { element, gridInterface } = await mount();
        pressIn(element, 1, 'c0', 'PageDown', { altKey: true, shiftKey: true });
        expect(gridInterface.getRanges()).toEqual([]);
        expect(focused()).toEqual({ row: 1, field: 'c0' });
    });
});

describe('jump keys - Ctrl+ArrowUp / Ctrl+ArrowDown, the edge of the data', () => {
    // c1: values in 0 - 4, blank 5 - 9, values 10 - 14, blank to the end
    const sparse = () => rows(30).map((row, i) => ({ ...row, c1: i < 5 || (i >= 10 && i < 15) ? row.c1 : i === 7 ? '' : null }));

    it('expect the edges of the blocks of values, as in a spreadsheet', async () => {
        const { element } = await mount(config(), sparse());
        const ctx = gridOf(element);

        // in a block: its end; past it to the next value; at the last one: the last row
        expect(edgeRow(ctx, 0, 'c1', 1)).toBe(4);
        expect(edgeRow(ctx, 4, 'c1', 1)).toBe(10);
        expect(edgeRow(ctx, 10, 'c1', 1)).toBe(14);
        expect(edgeRow(ctx, 14, 'c1', 1)).toBe(29);
        // from a blank: the next value
        expect(edgeRow(ctx, 6, 'c1', 1)).toBe(10);
        // up
        expect(edgeRow(ctx, 29, 'c1', -1)).toBe(14);
        expect(edgeRow(ctx, 12, 'c1', -1)).toBe(10);
        expect(edgeRow(ctx, 10, 'c1', -1)).toBe(4);
        expect(edgeRow(ctx, 4, 'c1', -1)).toBe(0);
        // at the edge of the rows: stays
        expect(edgeRow(ctx, 0, 'c1', -1)).toBe(0);
        // a full column: the first and the last row
        expect(edgeRow(ctx, 3, 'c2', 1)).toBe(29);
        expect(edgeRow(ctx, 3, 'c2', -1)).toBe(0);
    });

    it('expect Ctrl+ArrowDown / Ctrl+ArrowUp in a cell to go there, Cmd too', async () => {
        const mounted = await mount(config(), sparse());
        const { element } = mounted;

        expect(pressIn(element, 0, 'c1', 'ArrowDown', { ctrlKey: true }).defaultPrevented).toBe(true);
        expect(focused()).toEqual({ row: 4, field: 'c1' });
        press(document.activeElement as Element, 'ArrowDown', { metaKey: true });
        expect(focused()).toEqual({ row: 10, field: 'c1' });
        expect(current(mounted)).toBe(10);
        press(document.activeElement as Element, 'ArrowUp', { ctrlKey: true });
        expect(focused()).toEqual({ row: 4, field: 'c1' });
    });

    it('expect 0 and false to be values, a group row no blank', async () => {
        const values = rows(6).map((row, i) => ({ ...row, c1: [0, false, 'x', null, 0, null][i] }));
        const { element, datasource } = await mount(config(), values);
        const ctx = gridOf(element);
        expect(edgeRow(ctx, 0, 'c1', 1)).toBe(2);

        // a (row 0), its 6 rows (1 - 6): the group row is skipped, it is no blank
        datasource.group([{ attribute: 'group', title: 'Group' }]);
        datasource.expandGroup();
        expect(edgeRow(ctx, 6, 'c1', -1)).toBe(5);
        expect(edgeRow(ctx, 5, 'c1', -1)).toBe(3);
        expect(edgeRow(ctx, 3, 'c1', -1)).toBe(1);
    });

    it('expect Ctrl+Shift+ArrowDown to extend the range to the edge', async () => {
        const { element, gridInterface } = await mount(config(), sparse());
        pressIn(element, 0, 'c1', 'ArrowDown', { ctrlKey: true, shiftKey: true });
        expect(gridInterface.getRanges()).toEqual([{ fromRow: 0, fromField: 'c1', toRow: 4, toField: 'c1' }]);
        press(document.activeElement as Element, 'ArrowDown', { ctrlKey: true, shiftKey: true });
        expect(gridInterface.getRanges()[0].toRow).toBe(10);
        expect(focused()).toEqual({ row: 0, field: 'c1' });
    });
});

describe('jump keys - with Shift, the ranges of cells', () => {
    it('expect Ctrl+Shift+End / Home and Alt+Shift+End / Home to move the end of the last range', async () => {
        const { element, gridInterface } = await mount();
        const input = inputAt(element, 3, 'c2');
        input.focus();

        expect(press(input, 'Home', { altKey: true, shiftKey: true }).defaultPrevented).toBe(true);
        expect(gridInterface.getRanges()).toEqual([{ fromRow: 3, fromField: 'c2', toRow: 3, toField: 'name' }]);
        // on screen: the focus stays in the active cell
        expect(document.activeElement).toBe(input);

        expect(press(input, 'End', { ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true);
        expect(gridInterface.getRanges()).toEqual([{ fromRow: 3, fromField: 'c2', toRow: 499, toField: 'id' }]);
        // the end scrolled into view, rendered now
        expect(bodyScroller(element).scrollTop).toBe(500 * 22 - 600);
        expect(inputAt(element, 499, 'id')).toBeTruthy();

        press(document.activeElement as Element, 'Home', { altKey: true, shiftKey: true });
        expect(gridInterface.getRanges()).toEqual([{ fromRow: 3, fromField: 'c2', toRow: 499, toField: 'name' }]);
        press(document.activeElement as Element, 'End', { altKey: true, shiftKey: true });
        expect(gridInterface.getRanges()[0].toField).toBe('id');
        press(document.activeElement as Element, 'Home', { ctrlKey: true, shiftKey: true });
        expect(gridInterface.getRanges()).toEqual([{ fromRow: 3, fromField: 'c2', toRow: 0, toField: 'name' }]);
        // back on screen: the focus in the active cell again
        expect(focused()).toEqual({ row: 3, field: 'c2' });
    });

    it('expect the focus to go to the end of the range when the active cell scrolls away, the ranges to stay', async () => {
        const { element, gridInterface } = await mount();
        const input = inputAt(element, 3, 'c2');
        input.focus();

        press(input, 'End', { ctrlKey: true, shiftKey: true });

        // the cell element of row 3 shows another row now, or is hidden: the keys go on from the end
        expect(focused()).toEqual({ row: 499, field: 'id' });
        expect(gridInterface.getRanges()).toEqual([{ fromRow: 3, fromField: 'c2', toRow: 499, toField: 'id' }]);
        // copy copies the range from there: the column headers, then 497 rows of c2 ... id
        const clipboardData = new DataTransfer();
        document.activeElement?.dispatchEvent(
            new ClipboardEvent('copy', { clipboardData, bubbles: true, cancelable: true, composed: true })
        );
        const lines = clipboardData.getData('text/plain').split(/\r?\n/).filter(Boolean);
        expect(lines.length).toBe(1 + 497);
        expect(lines[1].split('\t')).toEqual(['r3c2', ...CENTER.slice(3).map((field) => `r3${field}`), '4']);
        expect(lines[497].split('\t')[0]).toEqual('r499c2');
        press(document.activeElement as Element, 'PageUp', { shiftKey: true });
        expect(gridInterface.getRanges()[0].toRow).toBe(472);
        expect(focused()).toEqual({ row: 499, field: 'id' });
    });

    it('expect the last of several ranges to be the one extended', async () => {
        const { element, gridInterface } = await mount();
        const input = inputAt(element, 3, 'c2');
        input.focus();
        gridInterface.setRanges([
            { fromRow: 0, fromField: 'c0', toRow: 1, toField: 'c0' },
            { fromRow: 3, fromField: 'c2', toRow: 4, toField: 'c3' }
        ]);

        press(input, 'End', { altKey: true, shiftKey: true });

        expect(gridInterface.getRanges()).toEqual([
            { fromRow: 0, fromField: 'c0', toRow: 1, toField: 'c0' },
            { fromRow: 3, fromField: 'c2', toRow: 4, toField: 'id' }
        ]);
    });
});

describe('jump keys - other cells', () => {
    it('expect the keys in a checkbox cell', async () => {
        const data = rows(40).map((row, i) => ({ ...row, c0: i % 2 === 0 }));
        const { element } = await mountGrid(config(), data, { fields: { id: 'number', c0: 'boolean' } });

        pressIn(element, 1, 'c0', 'PageDown');
        expect(focused()).toEqual({ row: 28, field: 'c0' });
        press(document.activeElement as Element, 'End', { ctrlKey: true });
        expect(focused()).toEqual({ row: 39, field: 'id' });
    });

    it('expect the keys on the host of a custom cell, a control in it keeps its own PageDown', async () => {
        registerCellRenderer('jump-keys-test', (host) => {
            const select = document.createElement('select');
            select.className = 'jump-keys-control';
            host.appendChild(select);
            return { update: () => undefined };
        });
        const custom = config({ columns: { c0: { renderer: 'jump-keys-test' } } });
        const { element } = await mount(custom, rows(40));

        expect(pressIn(element, 1, 'c0', 'PageDown').defaultPrevented).toBe(true);
        expect(focused()).toEqual({ row: 28, field: 'c0' });

        const control = inputAt(element, 28, 'c0').querySelector('.jump-keys-control') as HTMLElement;
        control.focus();
        expect(press(control, 'PageDown').defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(control);
    });

    it('expect an Alt+arrow to move the focus at once: a jump key after it goes from there', async () => {
        const { element } = await mount();
        const input = inputAt(element, 1, 'c0');
        input.focus();
        press(input, 'ArrowDown', { altKey: true, code: 'ArrowDown' });
        expect(focused()).toEqual({ row: 2, field: 'c0' });

        expect(press(document.activeElement as Element, 'End', { ctrlKey: true }).defaultPrevented).toBe(true);
        expect(focused()).toEqual({ row: 499, field: 'id' });
    });
});

describe('jump keys - from the header and the group rows', () => {
    it('expect Ctrl+End / Ctrl+Home in a header filter to go to the cells', async () => {
        const { element } = await mount();
        const filter = headerFilterInput(element, 'c3');
        filter.focus();

        expect(press(filter, 'End', { ctrlKey: true }).defaultPrevented).toBe(true);
        expect(focused()).toEqual({ row: 499, field: 'id' });

        headerFilterInput(element, 'name').focus();
        press(document.activeElement as Element, 'Home', { ctrlKey: true });
        expect(focused()).toEqual({ row: 0, field: 'name' });
    });

    it('expect Alt+End / Alt+Home in a header filter to go to the last / first filter, Home and End to stay the caret', async () => {
        const { element } = await mount();
        const filter = headerFilterInput(element, 'c3');
        filter.focus();

        expect(press(filter, 'Home').defaultPrevented).toBe(false);
        expect(press(filter, 'End').defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(filter);

        expect(press(filter, 'End', { altKey: true }).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(headerFilterInput(element, 'id'));
        expect(middleScroller(element).scrollLeft).toBe(1400);

        press(document.activeElement as Element, 'Home', { altKey: true });
        expect(document.activeElement).toBe(headerFilterInput(element, 'name'));
        expect(middleScroller(element).scrollLeft).toBe(0);
    });

    it('expect PageDown in a header filter to go to the cell under it in the last row on screen', async () => {
        const { element } = await mount();
        const filter = headerFilterInput(element, 'c3');
        filter.focus();

        expect(press(filter, 'PageDown').defaultPrevented).toBe(true);

        // 600px: rows 0 - 26 whole, 27 partly
        expect(focused()).toEqual({ row: 26, field: 'c3' });
        expect(bodyScroller(element).scrollTop).toBe(0);
        // and on a page
        press(document.activeElement as Element, 'PageDown');
        expect(focused()).toEqual({ row: 53, field: 'c3' });
    });

    it('expect Ctrl+End / Ctrl+Home on a column header', async () => {
        const { element } = await mount();
        const label = labelCell(element, 'c2');
        label.focus();

        expect(press(label, 'End', { ctrlKey: true }).defaultPrevented).toBe(true);
        expect(focused()).toEqual({ row: 499, field: 'id' });
        labelCell(element, 'id').focus();
        press(labelCell(element, 'id'), 'Home', { ctrlKey: true });
        expect(focused()).toEqual({ row: 0, field: 'name' });
    });

    it('expect Ctrl+End / Ctrl+Home on the button of a group row', async () => {
        const { element, datasource } = await mount(config(), rows(30));
        datasource.group([{ attribute: 'group', title: 'Group' }]);
        const button = element.querySelector<HTMLElement>('.simple-html-grid-body-row-container-group [role="button"]');
        button?.focus();

        // collapsed: no data row is displayed, nothing to go to
        expect(press(button as HTMLElement, 'End', { ctrlKey: true }).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(button);

        datasource.expandGroup();
        const expanded = element.querySelector<HTMLElement>('.simple-html-grid-body-row-container-group [role="button"]');
        expanded?.focus();
        press(expanded as HTMLElement, 'End', { ctrlKey: true });
        expect(focused()).toEqual({ row: 31, field: 'id' });
    });
});
