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

const attributes = [{ attribute: 'a' }, { attribute: 'b' }, { attribute: 'c' }, { attribute: 'd' }];

/**
 * presses a key on the input with the given class, then waits for the handler's delayed focus
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
        columnsPinnedLeft: [
            { rows: ['a'], width: 100 },
            { rows: ['b'], width: 100 },
            { rows: ['d'], width: 100 }
        ],
        columnsCenter: [{ rows: ['c'], width: 100 }],
        attributes
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
        columnsPinnedLeft: [
            { rows: ['a'], width: 100 },
            { rows: ['b'], width: 100 }
        ],
        columnsCenter: [],
        attributes
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
        columnsPinnedLeft: [
            { rows: ['a'], width: 100 },
            { rows: ['b'], width: 100 }
        ],
        columnsCenter: [{ rows: ['c'], width: 100 }],
        attributes
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
});
