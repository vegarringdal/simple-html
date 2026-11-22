// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TOUCH_SLOP } from '../gridFunctions/longPress';
import {
    canScroll,
    fingerVelocity,
    lockAxis,
    MOMENTUM_DECAY,
    MOMENTUM_MIN_SPEED,
    momentumStep,
    VELOCITY_WINDOW
} from '../gridFunctions/touchScroll';
import { mountGrid, simpleData, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { stubScrollSize, touchAt } from './interactionTestHelpers';

/**
 * Touch scrolling (touchScroll.ts): the helpers - the axis lock, the edges, the speed of the finger, the
 * momentum's steps - and a swipe on a mounted grid, as a browser sends it (touch events with the time
 * they were made: `timeStamp`).
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('lockAxis', () => {
    it('expect no axis until the finger has moved TOUCH_SLOP px: it is still a press', () => {
        expect(lockAxis(0, 0)).toBeNull();
        expect(lockAxis(TOUCH_SLOP - 1, -(TOUCH_SLOP - 1))).toBeNull();
    });

    it('expect the axis the finger moved the most on, up and down winning a tie', () => {
        expect(lockAxis(3, TOUCH_SLOP)).toBe('y');
        expect(lockAxis(-TOUCH_SLOP, 4)).toBe('x');
        expect(lockAxis(-30, -29)).toBe('x');
        expect(lockAxis(20, -20)).toBe('y');
    });
});

describe('canScroll', () => {
    /** a scroller at `position` of `max` */
    const scroller = (position: number, max: number) =>
        ({
            scrollTop: position,
            scrollLeft: position,
            scrollHeight: max + 100,
            clientHeight: 100,
            scrollWidth: max + 100,
            clientWidth: 100
        }) as HTMLElement;

    it('expect it to scroll down from the top, not up', () => {
        expect(canScroll(scroller(0, 500), 'y', 10)).toBe(true);
        expect(canScroll(scroller(0, 500), 'y', -10)).toBe(false);
    });

    it('expect it to scroll up from the bottom, not down - half a px from the end is the end', () => {
        expect(canScroll(scroller(500, 500), 'y', -10)).toBe(true);
        expect(canScroll(scroller(500, 500), 'y', 10)).toBe(false);
        expect(canScroll(scroller(499.5, 500), 'y', 10)).toBe(false);
        expect(canScroll(scroller(0.5, 500), 'y', -10)).toBe(false);
    });

    it('expect sideways the same, and nothing that does not overflow to scroll', () => {
        expect(canScroll(scroller(0, 500), 'x', 10)).toBe(true);
        expect(canScroll(scroller(0, 0), 'x', 10)).toBe(false);
        expect(canScroll(scroller(0, 0), 'y', -10)).toBe(false);
        expect(canScroll(scroller(10, 500), 'y', 0)).toBe(false);
    });
});

describe('fingerVelocity', () => {
    it('expect the speed over the last VELOCITY_WINDOW ms, in px per ms', () => {
        const samples = [
            { time: 0, at: 500 },
            { time: 100, at: 400 },
            { time: 150, at: 300 },
            { time: 200, at: 200 }
        ];
        // from 100 to 200: 200px up in 100ms
        expect(fingerVelocity(samples, 200)).toBe(-2);
        expect(fingerVelocity(samples, 200 + VELOCITY_WINDOW - 100)).toBe(-2);
    });

    it('expect no speed for a finger that stood still before it was lifted, or a single move', () => {
        const samples = [
            { time: 0, at: 500 },
            { time: 16, at: 400 }
        ];
        expect(fingerVelocity(samples, 16 + VELOCITY_WINDOW + 1)).toBe(0);
        expect(fingerVelocity([{ time: 0, at: 1 }], 0)).toBe(0);
        expect(fingerVelocity([], 0)).toBe(0);
    });
});

describe('momentumStep', () => {
    it('expect a frame to move speed x time and slow the speed by MOMENTUM_DECAY each ms', () => {
        const step = momentumStep(1, 16);
        expect(step.distance).toBe(16);
        expect(step.velocity).toBeCloseTo(MOMENTUM_DECAY ** 16, 12);
        // backwards the same
        expect(momentumStep(-2, 10)).toEqual({ distance: -20, velocity: -2 * MOMENTUM_DECAY ** 10 });
    });

    it('expect a swipe of 1px/ms to coast about 500px and stop in about 2 seconds, frames of 16ms', () => {
        let velocity = 1;
        let distance = 0;
        let time = 0;
        while (velocity >= MOMENTUM_MIN_SPEED) {
            const step = momentumStep(velocity, 16);
            distance += step.distance;
            velocity = step.velocity;
            time += 16;
        }
        // the exact curve: v / -ln(decay) = 499.75px, ln(50) / -ln(decay) = 1954ms
        expect(distance).toBeGreaterThan(480);
        expect(distance).toBeLessThan(500);
        expect(time).toBeGreaterThan(1900);
        expect(time).toBeLessThan(2000);
    });
});

describe('a swipe on the grid', () => {
    /** a touch event on `target` at (x, y), made at `time` ms (its timeStamp) */
    const touchEvent = (type: string, target: Element, points: [number, number][], time = 0) => {
        const event = new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: points.map(([x, y], i) => new Touch({ identifier: i + 1, target, clientX: x, clientY: y }))
        });
        Object.defineProperty(event, 'timeStamp', { value: time });
        target.dispatchEvent(event);
        return event;
    };

    const mount = async () => {
        const { element } = await mountGrid(undefined, simpleData());
        const scrollers = stubScrollSize(element);
        const cell = element.querySelector('.simple-html-grid-body input[data-attribute="firstname"]') as HTMLInputElement;
        return { element, cell, ...scrollers };
    };

    it('expect the first move to tell a swipe from a press, the rows to follow the finger from there', async () => {
        const { cell, body } = await mount();

        touchEvent('touchstart', cell, [[50, 300]]);
        const press = touchEvent('touchmove', cell, [[50, 300 - (TOUCH_SLOP - 1)]]);
        // still a press: nothing scrolls, the page does not take it either
        expect(body.scrollTop).toBe(0);
        expect(press.defaultPrevented).toBe(true);

        const lock = touchEvent('touchmove', cell, [[50, 250]]);
        expect(body.scrollTop).toBe(0);
        const move = touchEvent('touchmove', cell, [[50, 200]]);

        expect(body.scrollTop).toBe(50);
        expect(lock.defaultPrevented && move.defaultPrevented).toBe(true);
    });

    it('expect a swipe mostly up not to drift sideways, and one mostly sideways to scroll the columns only', async () => {
        const { cell, body, middle } = await mount();

        touchEvent('touchstart', cell, [[200, 300]]);
        touchEvent('touchmove', cell, [[195, 280]]);
        touchEvent('touchmove', cell, [[170, 200]]);
        expect([body.scrollTop, middle.scrollLeft]).toEqual([80, 0]);
        touchEvent('touchend', cell, []);

        body.scrollTop = 0;
        touchEvent('touchstart', cell, [[200, 300]]);
        touchEvent('touchmove', cell, [[180, 296]]);
        touchEvent('touchmove', cell, [[100, 260]]);
        expect([body.scrollTop, middle.scrollLeft]).toEqual([0, 80]);
    });

    it("expect the swipe to be the page's when the grid is at its edge that way: nothing canceled, nothing scrolled", async () => {
        const { cell, body } = await mount();

        // at the first row, the finger down: the rows would go up
        touchEvent('touchstart', cell, [[50, 200]]);
        touchEvent('touchmove', cell, [[50, 230]]);
        const move = touchEvent('touchmove', cell, [[50, 300]]);

        expect(move.defaultPrevented).toBe(false);
        expect(body.scrollTop).toBe(0);
    });

    it('expect the grid to keep a swipe it took when the rows reach their end halfway: the page does not take over', async () => {
        const { element, cell, body } = await mount();
        stubScrollSize(element, 700);
        body.scrollTop = 50;

        touchEvent('touchstart', cell, [[50, 200]]);
        touchEvent('touchmove', cell, [[50, 220]]);
        // 100px down: past the top
        const move = touchEvent('touchmove', cell, [[50, 320]]);

        expect(move.defaultPrevented).toBe(true);
    });

    it("expect two fingers to be the browser's: nothing canceled, nothing scrolled, also after one is lifted", async () => {
        const { cell, body } = await mount();

        touchEvent('touchstart', cell, [[50, 300]]);
        touchEvent('touchstart', cell, [
            [50, 300],
            [150, 300]
        ]);
        const pinch = touchEvent('touchmove', cell, [
            [40, 250],
            [160, 250]
        ]);
        touchEvent('touchend', cell, [[40, 250]]);
        const one = touchEvent('touchmove', cell, [[40, 150]]);

        expect(pinch.defaultPrevented || one.defaultPrevented).toBe(false);
        expect(body.scrollTop).toBe(0);
    });

    it('expect the focus to leave the cell once, when the swipe starts: blurred, no input of the grid focused', async () => {
        const { element, cell } = await mount();
        cell.focus();
        let focusIn = 0;
        let focusOut = 0;
        element.addEventListener('focusin', () => focusIn++);
        element.addEventListener('focusout', () => focusOut++);

        touchEvent('touchstart', cell, [[50, 300]]);
        for (let y = 280; y > 100; y -= 20) {
            touchEvent('touchmove', cell, [[50, y]]);
        }

        expect(document.activeElement).not.toBe(cell);
        expect([focusIn, focusOut]).toEqual([0, 1]);
    });

    it('expect the rows to coast on after a fast swipe, slower each frame, and stop', async () => {
        vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
        const { cell, body } = await mount();

        touchEvent('touchstart', cell, [[50, 400]], 0);
        touchEvent('touchmove', cell, [[50, 380]], 16);
        touchEvent('touchmove', cell, [[50, 340]], 32);
        touchEvent('touchmove', cell, [[50, 300]], 48);
        touchEvent('touchend', cell, [], 50);
        // the finger 2.5px per ms up, the rows follow it: 80px
        expect(body.scrollTop).toBe(80);

        // the first frame starts the clock, the next ones move
        vi.advanceTimersToNextFrame();
        vi.advanceTimersToNextFrame();
        const first = body.scrollTop - 80;
        vi.advanceTimersToNextFrame();
        const second = body.scrollTop - 80 - first;
        expect(first).toBeCloseTo(2.5 * 16, 5);
        expect(second).toBeLessThan(first);

        vi.advanceTimersByTime(5000);
        const stopped = body.scrollTop;
        vi.advanceTimersByTime(1000);
        // about 2.5 / -ln(decay) = 1250px in all
        expect(stopped).toBeGreaterThan(80 + 1100);
        expect(stopped).toBeLessThan(80 + 1260);
        expect(body.scrollTop).toBe(stopped);
    });

    it('expect the momentum to stop at the end of the rows', async () => {
        vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
        const { element, cell, body } = await mount();
        // 300px to scroll (clientHeight 600)
        stubScrollSize(element, 900);
        // happy-dom does not stop scrollTop at the end, a browser does
        let top = 0;
        Object.defineProperty(body, 'scrollTop', {
            configurable: true,
            get: () => top,
            set: (value: number) => {
                top = Math.min(Math.max(value, 0), 300);
            }
        });

        touchEvent('touchstart', cell, [[50, 400]], 0);
        touchEvent('touchmove', cell, [[50, 380]], 16);
        touchEvent('touchmove', cell, [[50, 300]], 48);
        touchEvent('touchend', cell, [], 50);
        vi.advanceTimersByTime(500);

        expect(body.scrollTop).toBe(300);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('expect no momentum after a finger that stood still before it lifted', async () => {
        vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
        const { cell, body } = await mount();

        touchEvent('touchstart', cell, [[50, 400]], 0);
        touchEvent('touchmove', cell, [[50, 380]], 16);
        touchEvent('touchmove', cell, [[50, 300]], 48);
        touchEvent('touchend', cell, [], 48 + VELOCITY_WINDOW + 50);
        vi.advanceTimersByTime(1000);

        expect(body.scrollTop).toBe(80);
    });

    it('expect a touch to stop the momentum, and the tap that stopped it to be no tap (its touchend canceled)', async () => {
        vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
        const { cell, body } = await mount();

        touchEvent('touchstart', cell, [[50, 400]], 0);
        touchEvent('touchmove', cell, [[50, 380]], 16);
        touchEvent('touchmove', cell, [[50, 300]], 48);
        touchEvent('touchend', cell, [], 50);
        vi.advanceTimersByTime(100);
        const coasting = body.scrollTop;
        expect(coasting).toBeGreaterThan(80);

        touchEvent('touchstart', cell, [[50, 300]], 200);
        const tap = touchEvent('touchend', cell, [], 260);
        vi.advanceTimersByTime(1000);

        expect(body.scrollTop).toBe(coasting);
        expect(tap.defaultPrevented).toBe(true);

        // the next tap is a tap
        touchEvent('touchstart', cell, [[50, 300]], 2000);
        expect(touchEvent('touchend', cell, [], 2050).defaultPrevented).toBe(false);
    });

    it('expect the grid leaving the page (destroy) to stop the momentum', async () => {
        vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
        const { cell, body, element } = await mount();

        touchEvent('touchstart', cell, [[50, 400]], 0);
        touchEvent('touchmove', cell, [[50, 380]], 16);
        touchEvent('touchmove', cell, [[50, 300]], 48);
        touchEvent('touchend', cell, [], 50);
        (element as any).grid.gridInterface.destroy();

        expect(vi.getTimerCount()).toBe(0);
        expect(body.scrollTop).toBe(80);
    });

    // the whole grid takes a swipe: the header, the footer, the panel too (touchAt: a Touch on its target)
    it('expect a touch on the header to scroll the rows as well', async () => {
        const { element, body } = await mount();
        const header = element.querySelector('.simple-html-grid-header') as HTMLElement;
        header.dispatchEvent(
            new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touchAt(header, 50, 300)] })
        );
        header.dispatchEvent(
            new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [touchAt(header, 50, 280)] })
        );
        header.dispatchEvent(
            new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [touchAt(header, 50, 240)] })
        );
        expect(body.scrollTop).toBe(40);
    });
});
