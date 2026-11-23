// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GridConfig } from '../gridConfig';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { sleep } from './interactionTestHelpers';

/**
 * Keyboard navigation (alt+arrows, tab, shift+tab) across the pinned/center sections, in the
 * body rows and in the header filter row.
 */

const data = () => [
    { a: 'a1', b: 'b1', c: 'c1', d: 'd1' },
    { a: 'a2', b: 'b2', c: 'c2', d: 'd2' }
];

const columns = { a: {}, b: {}, c: {}, d: {} };

/**
 * presses a key on the input with the given class. The focus moves in the keydown; the wait is for
 * what follows it (a render, an event)
 */
async function press(element: HTMLElement, cellClass: string, code: string, modifiers: { altKey?: boolean; shiftKey?: boolean }) {
    const input = element.querySelector(`.${cellClass}`) as HTMLElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, ...modifiers }));
    await sleep(150);
}

/**
 * class of the cell input that has focus, the cellpos-* part only
 */
function focusedCell() {
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

describe('key navigation - left pinned columns', () => {
    // more left pinned columns than center ones: a lookup in the wrong array went out of range
    const config = (): GridConfig => ({
        columns,
        layout: {
            left: [
                { fields: ['a'], width: 100 },
                { fields: ['b'], width: 100 },
                { fields: ['d'], width: 100 }
            ],
            center: [{ fields: ['c'], width: 100 }]
        }
    });

    it('expect alt+left to move to the previous left pinned column', async () => {
        const { element } = await mountGrid(config(), data());

        await press(element, 'cellpos-left-pinned-0-2-0', 'ArrowLeft', { altKey: true });

        expect(focusedCell()).toEqual('cellpos-left-pinned-0-1-0');
    });

    it('expect shift+tab to move to the previous left pinned column', async () => {
        const { element } = await mountGrid(config(), data());

        await press(element, 'cellpos-left-pinned-0-2-0', 'Tab', { shiftKey: true });

        expect(focusedCell()).toEqual('cellpos-left-pinned-0-1-0');
    });
});

describe('key navigation - every column pinned', () => {
    const config = (): GridConfig => ({
        columns,
        layout: {
            left: [
                { fields: ['a'], width: 100 },
                { fields: ['b'], width: 100 }
            ],
            center: []
        }
    });

    it('expect alt+right on the last column to wrap to the next row', async () => {
        const { element } = await mountGrid(config(), data());

        await press(element, 'cellpos-left-pinned-0-1-0', 'ArrowRight', { altKey: true });

        expect(focusedCell()).toEqual('cellpos-left-pinned-1-0-0');
    });

    it('expect shift+tab on the first column to wrap to the previous row', async () => {
        const { element } = await mountGrid(config(), data());

        await press(element, 'cellpos-left-pinned-1-0-0', 'Tab', { shiftKey: true });

        expect(focusedCell()).toEqual('cellpos-left-pinned-0-1-0');
    });
});

describe('key navigation - header filter row', () => {
    const config = (): GridConfig => ({
        columns,
        layout: {
            left: [
                { fields: ['a'], width: 100 },
                { fields: ['b'], width: 100 }
            ],
            center: [{ fields: ['c'], width: 100 }]
        }
    });

    it('expect shift+tab to move to the previous left pinned filter', async () => {
        const { element } = await mountGrid(config(), data());

        await press(element, 'filter-cellpos-left-pinned-0-1-0', 'Tab', { shiftKey: true });

        expect(focusedCell()).toEqual('filter-cellpos-left-pinned-0-0-0');
    });

    it('expect shift+tab on the first center filter to move into the left pinned filters', async () => {
        const { element } = await mountGrid(config(), data());

        await press(element, 'filter-cellpos-middle-pinned-0-0-0', 'Tab', { shiftKey: true });

        expect(focusedCell()).toEqual('filter-cellpos-left-pinned-0-1-0');
    });

    it('expect alt+left on the first center filter to move into the left pinned filters', async () => {
        const { element } = await mountGrid(config(), data());

        await press(element, 'filter-cellpos-middle-pinned-0-0-0', 'ArrowLeft', { altKey: true });

        expect(focusedCell()).toEqual('filter-cellpos-left-pinned-0-1-0');
    });
    it('expect alt+down from a header filter into the first row to make it the current row', async () => {
        const { element, datasource } = await mountGrid(config(), data());
        datasource.setRowAsCurrentEntity(1);

        await press(element, 'filter-cellpos-middle-pinned-0-0-0', 'ArrowDown', { altKey: true });

        expect(focusedCell()).toEqual('cellpos-middle-pinned-0-0-0');
        expect(datasource.currentEntity).toBe(datasource.getRow(0));
    });

    it('expect alt+up from the first row into a header filter to keep the current row', async () => {
        const { element, datasource } = await mountGrid(config(), data());
        datasource.setRowAsCurrentEntity(0);

        await press(element, 'cellpos-middle-pinned-0-0-0', 'ArrowUp', { altKey: true });

        expect(focusedCell()).toEqual('filter-cellpos-middle-pinned-0-0-0');
        expect(datasource.currentEntity).toBe(datasource.getRow(0));
    });
});

describe('key navigation - the focus moves at once', () => {
    // Tab, Enter and Alt+arrows render the rows and focus the cell in the keydown, as the jump keys do.
    // It was 100ms later, and the keys meanwhile were canceled
    const config = (): GridConfig => ({
        readonly: false,
        columns,
        layout: {
            center: [
                { fields: ['a'], width: 100 },
                { fields: ['b'], width: 100 }
            ]
        }
    });
    const rows = () => [...data(), { a: 'a3', b: 'b3', c: 'c3', d: 'd3' }];

    /** a keydown on the input with the class, the event back */
    const keydown = (element: HTMLElement, cellClass: string, init: KeyboardEventInit) => {
        const input = element.querySelector(`.${cellClass}`) as HTMLElement;
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
        input.dispatchEvent(event);
        return event;
    };
    const altDown = { key: 'ArrowDown', code: 'ArrowDown', altKey: true };

    it('expect the focus in the next cell in the keydown: a held key goes on from there, a row each', async () => {
        const { element, datasource } = await mountGrid(config(), rows());

        expect(keydown(element, 'cellpos-middle-pinned-0-0-0', altDown).defaultPrevented).toBe(true);
        expect(focusedCell()).toEqual('cellpos-middle-pinned-1-0-0');
        expect(datasource.currentEntity).toBe(datasource.getRow(1));
        // the repeats of a held key come from the cell the focus is in
        keydown(element, 'cellpos-middle-pinned-1-0-0', altDown);
        keydown(element, 'cellpos-middle-pinned-2-0-0', { key: 'Tab', code: 'Tab' });
        expect(focusedCell()).toEqual('cellpos-middle-pinned-2-1-0');
    });

    it('expect the other keys left alone meanwhile: Esc, Ctrl+C, Home, Shift', async () => {
        const { element } = await mountGrid(config(), rows());
        const from = 'cellpos-middle-pinned-0-0-0';
        keydown(element, from, altDown);

        expect(keydown(element, from, { key: 'Escape', code: 'Escape' }).defaultPrevented).toBe(false);
        expect(keydown(element, from, { key: 'c', code: 'KeyC', ctrlKey: true }).defaultPrevented).toBe(false);
        expect(keydown(element, from, { key: 'Home', code: 'Home' }).defaultPrevented).toBe(false);
        expect(keydown(element, from, { key: 'Shift', code: 'ShiftLeft', shiftKey: true }).defaultPrevented).toBe(false);
        await sleep(150);
        expect(focusedCell()).toEqual('cellpos-middle-pinned-1-0-0');
    });

    it('expect Esc meanwhile to close a menu opened with the mouse', async () => {
        const { element } = await mountGrid(config(), rows());
        const input = element.querySelector('.cellpos-middle-pinned-0-0-0') as HTMLElement;
        input.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        expect(document.querySelector('.simple-html-grid-menu')).not.toBeNull();

        keydown(element, 'cellpos-middle-pinned-0-0-0', altDown);
        keydown(element, 'cellpos-middle-pinned-0-0-0', { key: 'Escape', code: 'Escape' });

        expect(document.querySelector('.simple-html-grid-menu')).toBeNull();
        await sleep(150);
    });

    it('expect a move in one grid to leave the keys of another grid alone', async () => {
        const first = await mountGrid(config(), rows());
        const second = await mountGrid(config(), rows());
        const cellOf = (grid: HTMLElement) => grid.querySelector('.cellpos-middle-pinned-0-0-0') as HTMLElement;

        keydown(first.element, 'cellpos-middle-pinned-0-0-0', altDown);

        // typing in the other grid is typing, its own move moves
        const typed = new KeyboardEvent('keydown', { key: 'x', code: 'KeyX', bubbles: true, cancelable: true });
        cellOf(second.element).dispatchEvent(typed);
        expect(typed.defaultPrevented).toBe(false);
        const move = new KeyboardEvent('keydown', { ...altDown, bubbles: true, cancelable: true });
        cellOf(second.element).dispatchEvent(move);
        expect(move.defaultPrevented).toBe(true);
        await sleep(150);

        expect(second.element.contains(document.activeElement)).toBe(true);
        expect(focusedCell()).toEqual('cellpos-middle-pinned-1-0-0');
    });

    it('expect a character and a key in the cell the focus moved to to be its own', async () => {
        const { element } = await mountGrid(config(), rows());
        keydown(element, 'cellpos-middle-pinned-0-0-0', altDown);
        await sleep(150);

        expect(keydown(element, 'cellpos-middle-pinned-1-0-0', { key: 'x', code: 'KeyX' }).defaultPrevented).toBe(false);
        expect(keydown(element, 'cellpos-middle-pinned-1-0-0', altDown).defaultPrevented).toBe(true);
        await sleep(150);
        expect(focusedCell()).toEqual('cellpos-middle-pinned-2-0-0');
    });

    it('expect two Tabs from a header filter to go to the next filter, the filter row in its own grid only', async () => {
        const { element } = await mountGrid(config(), rows());
        const filter = 'filter-cellpos-middle-pinned-0-0-0';

        expect(keydown(element, filter, { key: 'Tab', code: 'Tab' }).defaultPrevented).toBe(true);
        expect(keydown(element, filter, { key: 'Tab', code: 'Tab' }).defaultPrevented).toBe(true);
        expect(keydown(element, filter, { key: 'Escape', code: 'Escape' }).defaultPrevented).toBe(false);
        await sleep(150);

        expect(focusedCell()).toEqual('filter-cellpos-middle-pinned-0-1-0');
    });
});
