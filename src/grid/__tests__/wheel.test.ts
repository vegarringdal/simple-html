// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from 'vitest';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The wheel over the grid scrolls the grid and not the page under it (addScrollEventListeners.ts):
 * the event is cancelled, the grid moves its scrollers itself - with the standard deltaX / deltaY.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

const rows = () => Array.from({ length: 200 }, (_, i) => ({ name: `row ${i}`, age: i }));

const scrollers = (element: HTMLElement) => ({
    body: element.querySelector('.simple-html-grid-body-scroller') as HTMLElement,
    middle: element.querySelector('.simple-html-grid-middle-scroller') as HTMLElement
});

const wheel = (element: HTMLElement, init: WheelEventInit) => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
    // happy-dom's WheelEvent is a UIEvent, without the modifier keys a browser's (a MouseEvent) has
    for (const key of ['ctrlKey', 'shiftKey'] as const) {
        Object.defineProperty(event, key, { value: init[key] ?? false });
    }
    element.querySelector('.simple-html-grid-body')?.dispatchEvent(event);
    return event;
};

describe('the wheel over the grid', () => {
    it('expect it to scroll the rows and not the page: the event is cancelled', async () => {
        const { element } = await mountGrid(undefined, rows());
        const { body } = scrollers(element);
        body.scrollTop = 0;

        const event = wheel(element, { deltaY: 66 });

        expect(event.defaultPrevented).toBe(true);
        expect(body.scrollTop).toBe(66);
    });

    it('expect the page not to scroll at the first row either', async () => {
        const { element } = await mountGrid(undefined, rows());
        scrollers(element).body.scrollTop = 0;

        // up, the grid is at its top already: the page under it must not take the wheel
        expect(wheel(element, { deltaY: -100 }).defaultPrevented).toBe(true);
    });

    it('expect left and right to scroll the middle columns', async () => {
        const { element } = await mountGrid(undefined, rows());
        const { middle, body } = scrollers(element);
        middle.scrollLeft = 0;
        body.scrollTop = 0;

        const event = wheel(element, { deltaX: 30 });

        expect(event.defaultPrevented).toBe(true);
        expect(middle.scrollLeft).toBe(30);
        expect(body.scrollTop).toBe(0);
    });

    it('expect Ctrl+Shift+wheel to scroll the columns, as it did', async () => {
        const { element } = await mountGrid(undefined, rows());
        const { middle, body } = scrollers(element);
        middle.scrollLeft = 0;
        body.scrollTop = 0;

        wheel(element, { deltaY: 40, ctrlKey: true, shiftKey: true });

        expect(middle.scrollLeft).toBe(40);
        expect(body.scrollTop).toBe(0);
    });

    it("expect Ctrl+wheel to be left to the browser: it zooms (and a trackpad's pinch is one)", async () => {
        const { element } = await mountGrid(undefined, rows());
        const { body } = scrollers(element);
        body.scrollTop = 0;

        const event = wheel(element, { deltaY: 40, ctrlKey: true });

        expect(event.defaultPrevented).toBe(false);
        expect(body.scrollTop).toBe(0);
    });

    it('expect a wheel that counts lines (Firefox) or pages to move as many px', async () => {
        const { element, gridInterface } = await mountGrid(undefined, rows());
        const { body } = scrollers(element);
        const cellHeight = gridInterface.__getGridConfig().cellHeight;

        body.scrollTop = 0;
        wheel(element, { deltaY: 3, deltaMode: 1 });
        expect(body.scrollTop).toBe(3 * cellHeight);

        body.scrollTop = 0;
        wheel(element, { deltaY: 1, deltaMode: 2 });
        expect(body.scrollTop).toBe(body.clientHeight);
    });
});
