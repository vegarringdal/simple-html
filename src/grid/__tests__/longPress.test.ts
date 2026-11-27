// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOUCH_HOLD } from '../gridFunctions/dragEvent';
import { addLongPress, LONG_PRESS, TOUCH_SLOP } from '../gridFunctions/longPress';
import { mountGrid, simpleData, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { labelCell, openMenus, pointerEvent, touchAt } from './interactionTestHelpers';

/**
 * A long press of a finger opens the context menu (longPress.ts): a `contextmenu` event dispatched on
 * the element the finger is on after LONG_PRESS ms held still. The timing with fake timers; the pointer
 * and touch events sent as a browser sends them for a finger (Chromium: the pointer events of a touch,
 * then the touch event).
 */

const touch = { pointerType: 'touch' };

/** a finger on `target` at (x, y): its pointerdown and touchstart */
const fingerDown = (target: Element, x = 100, y = 100) => {
    target.dispatchEvent(pointerEvent('pointerdown', { ...touch, clientX: x, clientY: y }));
    target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touchAt(target, x, y)] }));
};

/** the finger moved to (x, y) */
const fingerMove = (target: Element, x: number, y: number) => {
    target.dispatchEvent(pointerEvent('pointermove', { ...touch, clientX: x, clientY: y }));
};

/** the finger lifted: its pointerup and touchend. Returns the touchend, canceled or not */
const fingerUp = (target: Element, x = 100, y = 100) => {
    target.dispatchEvent(pointerEvent('pointerup', { ...touch, clientX: x, clientY: y }));
    const end = new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [] });
    target.dispatchEvent(end);
    return end;
};

/** a contextmenu event as the browser sends one itself (Android's long press, Shift+F10) */
const browserMenu = (target: Element) => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 100, button: 2 });
    target.dispatchEvent(event);
    return event;
};

describe('the long press helper', () => {
    let root: HTMLElement;
    let target: HTMLElement;
    let abort: AbortController;
    let menus: MouseEvent[];

    beforeEach(() => {
        vi.useFakeTimers();
        root = document.createElement('div');
        target = document.createElement('span');
        root.appendChild(target);
        document.body.appendChild(root);
        abort = new AbortController();
        addLongPress(root, abort.signal);
        // the element's menu: it opens (cancels the event) as the grid's handlers do
        menus = [];
        target.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            menus.push(event);
        });
    });

    afterEach(() => {
        abort.abort();
        root.remove();
        vi.useRealTimers();
    });

    it('expect a finger held still for LONG_PRESS ms to send contextmenu at its point, not sooner', () => {
        fingerDown(target, 40, 60);
        vi.advanceTimersByTime(LONG_PRESS - 1);
        expect(menus).toHaveLength(0);
        vi.advanceTimersByTime(1);

        expect(menus).toHaveLength(1);
        const event = menus[0] as PointerEvent;
        expect(event.target).toBe(target);
        expect([event.clientX, event.clientY, event.button]).toEqual([40, 60, 2]);
        expect(event.pointerType).toBe('touch');
        expect(event.bubbles && event.cancelable).toBe(true);
    });

    it('expect a finger that moves less than TOUCH_SLOP to still be a long press, further not', () => {
        fingerDown(target, 100, 100);
        fingerMove(target, 100 + TOUCH_SLOP - 2, 100);
        vi.advanceTimersByTime(LONG_PRESS);
        expect(menus).toHaveLength(1);
        fingerUp(target);

        fingerDown(target, 100, 100);
        fingerMove(target, 100, 100 + TOUCH_SLOP + 1);
        vi.advanceTimersByTime(LONG_PRESS * 2);
        expect(menus).toHaveLength(1);
    });

    it('expect a finger let go, or taken by the browser (pointercancel), before LONG_PRESS to open nothing', () => {
        fingerDown(target);
        vi.advanceTimersByTime(LONG_PRESS - 100);
        fingerUp(target);
        vi.advanceTimersByTime(LONG_PRESS);
        expect(menus).toHaveLength(0);

        fingerDown(target);
        target.dispatchEvent(pointerEvent('pointercancel', touch));
        vi.advanceTimersByTime(LONG_PRESS);
        expect(menus).toHaveLength(0);
    });

    it('expect the mouse and the pen held down to open nothing', () => {
        for (const pointerType of ['mouse', 'pen']) {
            target.dispatchEvent(pointerEvent('pointerdown', { pointerType }));
            vi.advanceTimersByTime(LONG_PRESS * 2);
            target.dispatchEvent(pointerEvent('pointerup', { pointerType }));
        }
        expect(menus).toHaveLength(0);
    });

    it('expect a second finger (a pinch) to end the long press', () => {
        fingerDown(target);
        target.dispatchEvent(pointerEvent('pointerdown', { ...touch, pointerId: 2, isPrimary: false }));
        vi.advanceTimersByTime(LONG_PRESS * 2);
        expect(menus).toHaveLength(0);
    });

    it('expect the finger lifted after a menu opened to be no tap: its touchend is canceled (no mouse events, no click)', () => {
        fingerDown(target);
        vi.advanceTimersByTime(LONG_PRESS);
        expect(fingerUp(target).defaultPrevented).toBe(true);

        // the next press is a tap again
        fingerDown(target);
        expect(fingerUp(target).defaultPrevented).toBe(false);
    });

    it('expect a long press on an element without a menu to stay a tap: its touchend is not canceled', () => {
        const plain = document.createElement('b');
        root.appendChild(plain);
        let seen = 0;
        plain.addEventListener('contextmenu', () => seen++);

        fingerDown(plain);
        vi.advanceTimersByTime(LONG_PRESS);

        // dispatched, nothing canceled it: no menu opened
        expect(seen).toBe(1);
        expect(fingerUp(plain).defaultPrevented).toBe(false);
    });

    it("expect the browser's own contextmenu while the finger is held (Android) to be the only one", () => {
        fingerDown(target);
        vi.advanceTimersByTime(LONG_PRESS - 100);
        browserMenu(target);
        vi.advanceTimersByTime(LONG_PRESS);

        expect(menus).toHaveLength(1);
        expect(menus[0] instanceof PointerEvent && menus[0].pointerType === 'touch').toBe(false);
        // the menu is open: the lift is no tap either
        expect(fingerUp(target).defaultPrevented).toBe(true);
    });

    it("expect the browser's own contextmenu after ours, finger still down, to be canceled and stopped", () => {
        fingerDown(target);
        vi.advanceTimersByTime(LONG_PRESS);
        const late = browserMenu(target);

        expect(menus).toHaveLength(1);
        expect(late.defaultPrevented).toBe(true);

        // lifted: a contextmenu from the keyboard (Shift+F10) opens the menu again
        fingerUp(target);
        expect(browserMenu(target).defaultPrevented).toBe(true);
        expect(menus).toHaveLength(2);
    });

    it('expect a contextmenu a handler sends on during ours to reach its element (the label cell hands it to its label)', () => {
        const label = document.createElement('i');
        root.appendChild(label);
        let forwarded = 0;
        label.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            forwarded++;
        });
        target.addEventListener('contextmenu', () =>
            label.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
        );

        fingerDown(target);
        vi.advanceTimersByTime(LONG_PRESS);

        expect(forwarded).toBe(1);
    });

    it('expect an element taken out of the page before the time to get nothing', () => {
        fingerDown(target);
        target.remove();
        vi.advanceTimersByTime(LONG_PRESS);
        expect(menus).toHaveLength(0);
    });

    it('expect the signal to remove the listeners and stop the timer', () => {
        fingerDown(target);
        abort.abort();
        vi.advanceTimersByTime(LONG_PRESS);
        expect(menus).toHaveLength(0);

        fingerDown(target);
        vi.advanceTimersByTime(LONG_PRESS);
        expect(menus).toHaveLength(0);
    });
});

describe('the long press in the grid', () => {
    beforeAll(() => {
        stubCanvas();
        stubElementSizes();
    });

    beforeEach(() => {
        // the grids and menus of the tests before
        document.body.innerHTML = '';
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('expect a long press on a cell to open the row menu, and the cell not to take the focus on the lift', async () => {
        const { element } = await mountGrid(undefined, simpleData());
        const input = element.querySelector('.simple-html-grid-body input[data-attribute="firstname"]') as HTMLInputElement;

        fingerDown(input);
        vi.advanceTimersByTime(LONG_PRESS);

        expect(openMenus()).toHaveLength(1);
        expect(openMenus()[0].querySelector('[data-menu-id="row.copy"]')).not.toBeNull();
        expect(fingerUp(input).defaultPrevented).toBe(true);
    });

    it('expect a long press on a header filter and on a column number to open their menus', async () => {
        const { element } = await mountGrid(undefined, simpleData());
        const filter = element.querySelector('.simple-html-grid-cell-filter-input') as HTMLElement;
        fingerDown(filter);
        vi.advanceTimersByTime(LONG_PRESS);
        expect(openMenus()[0].querySelector('[data-menu-id^="filter."]')).not.toBeNull();
        fingerUp(filter);

        const number = element.querySelector('.simple-html-grid-header [type="selector"]') as HTMLElement;
        fingerDown(number);
        vi.advanceTimersByTime(LONG_PRESS);
        expect(openMenus()[0].querySelector('[data-menu-id^="column."]')).not.toBeNull();
        fingerUp(number);
    });

    it('expect a long press on a label to open the header menu and end the drag its hold started: no drop, no sort', async () => {
        const { element, datasource, gridInterface } = await mountGrid(undefined, simpleData());
        const label = labelCell(element, 'firstname');
        const text = label.querySelector('[data-attribute-header]') as HTMLElement;
        const layout = JSON.stringify(gridInterface.__getGridConfig().layout);

        fingerDown(text, 10, 10);
        vi.advanceTimersByTime(TOUCH_HOLD);
        expect(document.querySelector('.simple-html-draggable-element')).not.toBeNull();
        vi.advanceTimersByTime(LONG_PRESS - TOUCH_HOLD);

        expect(openMenus()[0].querySelector('[data-menu-id="header.column.chooser"]')).not.toBeNull();
        expect(document.querySelector('.simple-html-draggable-element')).toBeNull();
        // captured during the drag: the pointerup goes to the label cell
        label.dispatchEvent(pointerEvent('pointerup', { ...touch, clientX: 10, clientY: 10 }));
        expect(datasource.getLastSorting()).toEqual([]);
        expect(JSON.stringify(gridInterface.__getGridConfig().layout)).toBe(layout);
    });
});
