// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridConfig } from '../gridConfig';
import type { GridInterface } from '../gridInterface';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, pointerEvent, resizeHandle, stubScrollSize, touchAt } from './interactionTestHelpers';

/**
 * Resizing a column with the handle on the edge of its header. Pointer events: mouse, pen and touch.
 *
 * The handle captures the pointer, so a browser sends the pointermove and pointerup to the handle,
 * wherever the pointer is. The tests send them there too.
 */

const data = () => [
    { firstname: 'a', lastname: 'x', age: 1 },
    { firstname: 'b', lastname: 'y', age: 2 }
];

// a pinned left, two center and a pinned right column, all 100px
const config = (): GridConfig => ({
    layout: {
        left: [{ fields: ['firstname'], width: 100 }],
        center: [
            { fields: ['lastname'], width: 100 },
            { fields: ['age'], width: 100 }
        ],
        right: [{ fields: ['company'], width: 100 }]
    }
});

const widths = (gridInterface: GridInterface<unknown>) => {
    // getState() always has the three sections
    const { left = [], center, right = [] } = gridInterface.getState().layout;
    return {
        left: left.map((column) => column.width),
        center: center.map((column) => column.width),
        right: right.map((column) => column.width)
    };
};

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

describe('column resize', () => {
    it('expect the column to follow the pointer, and the grid to rebuild once, when it is let go', async () => {
        const { element, gridInterface } = await mountGrid(config(), data());
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');
        const handle = resizeHandle(element, 0);

        handle.dispatchEvent(pointerEvent('pointerdown', { clientX: 100 }));
        expect(handle.hasPointerCapture(1)).toBe(true);
        handle.dispatchEvent(pointerEvent('pointermove', { clientX: 120 }));
        handle.dispatchEvent(pointerEvent('pointermove', { clientX: 150 }));

        expect(widths(gridInterface).center).toEqual([150, 100]);
        expect(rebuild).not.toHaveBeenCalled();

        handle.dispatchEvent(pointerEvent('pointerup', { clientX: 150 }));
        expect(rebuild).toHaveBeenCalledTimes(1);

        // the gesture is over, moves after it change nothing
        handle.dispatchEvent(pointerEvent('pointermove', { clientX: 300 }));
        expect(widths(gridInterface).center).toEqual([150, 100]);
    });

    it('expect a column not to get narrower than 25px', async () => {
        const { element, gridInterface } = await mountGrid(config(), data());
        const handle = resizeHandle(element, 1);

        handle.dispatchEvent(pointerEvent('pointerdown', { clientX: 100 }));
        handle.dispatchEvent(pointerEvent('pointermove', { clientX: 0 }));
        handle.dispatchEvent(pointerEvent('pointerup', { clientX: 0 }));

        expect(widths(gridInterface).center).toEqual([100, 25]);
    });

    it('expect the pinned left column to get wider to the right, and the pinned right one to the left', async () => {
        const { element, gridInterface } = await mountGrid(config(), data());

        const left = resizeHandle(element, 0, 'left');
        left.dispatchEvent(pointerEvent('pointerdown', { clientX: 100 }));
        left.dispatchEvent(pointerEvent('pointermove', { clientX: 130 }));
        left.dispatchEvent(pointerEvent('pointerup', { clientX: 130 }));

        // the handle of a pinned right column is on its left edge
        const right = resizeHandle(element, 0, 'right');
        right.dispatchEvent(pointerEvent('pointerdown', { clientX: 900 }));
        right.dispatchEvent(pointerEvent('pointermove', { clientX: 860 }));
        right.dispatchEvent(pointerEvent('pointerup', { clientX: 860 }));

        expect(widths(gridInterface)).toEqual({ left: [130], center: [100, 100], right: [140] });
    });

    it('expect pointercancel to give the column its width back', async () => {
        const { element, gridInterface } = await mountGrid(config(), data());
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');
        const handle = resizeHandle(element, 0);

        handle.dispatchEvent(pointerEvent('pointerdown', { clientX: 100 }));
        handle.dispatchEvent(pointerEvent('pointermove', { clientX: 160 }));
        expect(widths(gridInterface).center).toEqual([160, 100]);
        handle.dispatchEvent(pointerEvent('pointercancel', { clientX: 160 }));

        expect(widths(gridInterface).center).toEqual([100, 100]);
        // the header was drawn at 160px
        expect(rebuild).toHaveBeenCalledTimes(1);
        const column = element.querySelector('.simple-html-grid-header-row-container-pinned-middle > .simple-html-grid-col');
        expect((column as HTMLElement).style.width).toBe('100px');
    });

    it('expect only the left button of the primary pointer to resize', async () => {
        const { element, gridInterface } = await mountGrid(config(), data());
        const handle = resizeHandle(element, 0);

        handle.dispatchEvent(pointerEvent('pointerdown', { button: 2, buttons: 2, clientX: 100 }));
        handle.dispatchEvent(pointerEvent('pointermove', { buttons: 2, clientX: 150 }));
        handle.dispatchEvent(pointerEvent('pointerup', { button: 2, clientX: 150 }));

        handle.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: false, clientX: 100 }));
        handle.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, pointerType: 'touch', isPrimary: false, clientX: 150 }));
        handle.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, pointerType: 'touch', isPrimary: false, clientX: 150 }));

        expect(widths(gridInterface).center).toEqual([100, 100]);
    });

    it('expect a finger on the handle to resize, not to scroll the grid', async () => {
        const { element, gridInterface } = await mountGrid(config(), data());
        const handle = resizeHandle(element, 0);
        // room to scroll: else the swipe would be the page's anyway
        const scroller = stubScrollSize(element).body;
        const touch = { pointerType: 'touch' };

        // the browser would scroll the page under the finger and cancel the pointer
        expect(handle.style.touchAction).toBe('none');

        handle.dispatchEvent(pointerEvent('pointerdown', { ...touch, clientX: 100, clientY: 100 }));
        handle.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touchAt(handle, 100, 100)] }));
        handle.dispatchEvent(pointerEvent('pointermove', { ...touch, clientX: 140, clientY: 60 }));
        // the grid scrolls on touchmove (touchScroll.ts): a swipe from the first move, 40px up after it
        // would scroll the rows 40px
        for (const y of [60, 20]) {
            handle.dispatchEvent(
                new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [touchAt(handle, 140, y)] })
            );
        }
        handle.dispatchEvent(pointerEvent('pointerup', { ...touch, clientX: 140, clientY: 60 }));

        expect(widths(gridInterface).center).toEqual([140, 100]);
        expect(scroller.scrollTop).toBe(0);
    });
});
