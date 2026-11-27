import type { Grid } from '../grid';
import { isInDetailForm } from './detailForm';
import { findBarHasFocus } from './findBar';
import { TOUCH_SLOP } from './longPress';

/**
 * The momentum after a swipe: the speed is multiplied by this every ms - the deceleration of a scroll
 * view on iOS (UIScrollView.DecelerationRate.normal, 0.998). A swipe of 1px/ms coasts about 500px
 */
export const MOMENTUM_DECAY = 0.998;

/**
 * The momentum stops below this speed, in px per ms (20px a second)
 */
export const MOMENTUM_MIN_SPEED = 0.02;

/**
 * The speed of the finger is measured over the last this many ms before it is let go. A finger that
 * stood still for that long before it was lifted has no speed: no momentum
 */
export const VELOCITY_WINDOW = 100;

/**
 * The longest frame the momentum moves for, in ms: a frame that came late (a busy page, a tab in the
 * background) does not jump
 */
const MAX_FRAME = 50;

/**
 * the axis a swipe scrolls: `y` the rows (the body scroller), `x` the middle columns (the middle
 * scroller)
 */
export type Axis = 'x' | 'y';

/**
 * The axis of a swipe that has moved `dx` / `dy` px from where the finger went down: the one it moved
 * the most on, once it has moved {@link TOUCH_SLOP} px. null before: it is still a press (a tap, a long
 * press). Straight down and up wins a tie: the rows are what is scrolled the most.
 *
 * Locked to one axis, a swipe that is mostly up or down does not drift sideways, nor one that is
 * mostly sideways up or down.
 */
export function lockAxis(dx: number, dy: number): Axis | null {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < TOUCH_SLOP) {
        return null;
    }
    return Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
}

/**
 * true when `scroller` can scroll by `delta` px on `axis`, at least one px: not at its top (left) for
 * a negative delta, not at its bottom (right) for a positive one. A scroll position can be a fraction
 * of a px (a high density screen): half a px from the end is at the end
 */
export function canScroll(scroller: HTMLElement, axis: Axis, delta: number): boolean {
    const position = axis === 'y' ? scroller.scrollTop : scroller.scrollLeft;
    const max = axis === 'y' ? scroller.scrollHeight - scroller.clientHeight : scroller.scrollWidth - scroller.clientWidth;
    if (delta > 0) {
        return max - position >= 1;
    }
    return delta < 0 && position >= 1;
}

/**
 * A point of the finger on the locked axis: `at` px (clientX or clientY), at `time` ms (the event's
 * timeStamp)
 */
export interface TouchSample {
    time: number;
    at: number;
}

/**
 * The speed of the finger when it is let go at `time`, in px per ms (negative: up or left): from the
 * first to the last sample of the last {@link VELOCITY_WINDOW} ms. 0 without two samples in it - the
 * finger stood still before it was lifted
 */
export function fingerVelocity(samples: TouchSample[], time: number): number {
    const recent = samples.filter((sample) => time - sample.time <= VELOCITY_WINDOW);
    if (recent.length < 2) {
        return 0;
    }
    const first = recent[0];
    const last = recent[recent.length - 1];
    const duration = last.time - first.time;
    return duration > 0 ? (last.at - first.at) / duration : 0;
}

/**
 * One frame of the momentum: `dt` ms at `velocity` px per ms. The distance it moves, and the speed
 * after: slowed by {@link MOMENTUM_DECAY} for each ms. Simple steps, not the exact curve - at 60 frames
 * a second the difference is a fraction of a px
 */
export function momentumStep(velocity: number, dt: number): { distance: number; velocity: number } {
    return { distance: velocity * dt, velocity: velocity * MOMENTUM_DECAY ** dt };
}

/**
 * One swipe, from the first finger down to the last one up
 */
interface Gesture {
    /** where the finger went down, then where the swipe was locked to its axis */
    x: number;
    y: number;
    /** null until the finger has moved {@link TOUCH_SLOP} px, see lockAxis */
    axis: Axis | null;
    /** the grid scrolls (true), or the page under it (false): decided when the axis is locked */
    grid: boolean;
    /** the scroller's position when the axis was locked */
    start: number;
    /** the finger on the axis, for the speed it is let go at */
    samples: TouchSample[];
    /** the finger went down on a grid that was still coasting: it stopped the momentum, see touchend */
    stoppedMomentum: boolean;
}

/**
 * Touch scrolling. The rows and the header are not scroll containers the browser can pan (the views
 * are overflow hidden, kept in sync with the two scrollers, see addScrollEventListeners), so the grid
 * moves its scrollers by the finger itself: `bodyScroller` for the rows, `middleScroller` for the
 * middle columns. It reads from and writes to them; their scroll events update the views and the
 * virtual rows, as for the wheel and the scrollbars.
 *
 * - **A press or a swipe**: until the finger has moved {@link TOUCH_SLOP} px it is a press (a tap, a
 *   long press: longPress.ts), nothing scrolls. Then the swipe is locked to the axis it moved the most
 *   on ({@link lockAxis}), and the content follows the finger from there on - from where the swipe
 *   was told from a press, as a browser starts its own scroll, no jump.
 * - **The grid or the page**: when the axis is locked, the grid takes the swipe when it can scroll that
 *   way, and keeps it to the end of the swipe - its touchmove events are canceled, the page does not
 *   scroll along. A grid at its edge (its first row, swiped down) leaves the swipe to the page: nothing
 *   is canceled, the page scrolls - as a scroll box of the browser hands a swipe on to the page at its
 *   edge (`overscroll-behavior: auto`). Decided once, as a browser latches a swipe to one scroller: the
 *   page does not take over when the rows reach their end halfway. The moves before the lock are
 *   canceled (the page must not start scrolling before it is decided); a canceled touchmove does not
 *   keep the browser from scrolling the page on the moves after it, checked in Chromium.
 * - **Momentum**: let go while it moves, the grid coasts on at the finger's speed ({@link
 *   fingerVelocity}), slowed by {@link MOMENTUM_DECAY} every ms, one step a frame
 *   (requestAnimationFrame, {@link momentumStep}). It stops below {@link MOMENTUM_MIN_SPEED}, at the end
 *   of the rows (columns), on the next touch, and when the grid leaves the page. A tap that stops it is
 *   no tap: its touchend is canceled, no click edits the cell under it - as on a phone's own lists.
 * - **The cell**: the focus leaves the cell when the grid starts to scroll - once a swipe, not on every
 *   move: the cell would scroll away under it (its element is reused for another row). Not the find bar
 *   (findBar.ts).
 * - **Two fingers** or more: left to the browser (a pinch zooms the page), the swipe ends. A swipe goes
 *   on only when every finger was lifted and one went down again.
 *
 * Touch events, not pointer events: pointer events would need `touch-action: none` on the whole grid
 * (or the browser cancels the pointer once it pans the page), and the page could never scroll from a
 * swipe on the grid.
 *
 * A finger that drags a column or resizes one (dragEvent.ts, rebuildHeaderColumns.ts) or the fill
 * handle (fillDown.ts) keeps its touchmove events from these listeners, see followPointer.ts.
 * @param signal removes the listeners and stops the momentum
 */
export function addTouchScroll(ctx: Grid, bodyScroller: HTMLElement, middleScroller: HTMLElement, signal: AbortSignal) {
    let gesture: Gesture | null = null;
    // the momentum's animation frame, while it coasts
    let frame: number | undefined;

    const scrollerOf = (axis: Axis) => (axis === 'y' ? bodyScroller : middleScroller);
    const positionOf = (axis: Axis) => (axis === 'y' ? bodyScroller.scrollTop : middleScroller.scrollLeft);
    const scrollTo = (axis: Axis, position: number) => {
        if (axis === 'y') {
            bodyScroller.scrollTop = position;
        } else {
            middleScroller.scrollLeft = position;
        }
    };

    /** stops the momentum, true when it was coasting */
    const stopMomentum = () => {
        if (frame === undefined) {
            return false;
        }
        cancelAnimationFrame(frame);
        frame = undefined;
        return true;
    };
    signal.addEventListener('abort', stopMomentum);

    /** the momentum on `axis`, at `velocity` px per ms of the scroll position (not of the finger) */
    const coast = (axis: Axis, velocity: number) => {
        let last: number | undefined;
        const step = (time: number) => {
            frame = undefined;
            if (last !== undefined) {
                const next = momentumStep(velocity, Math.min(time - last, MAX_FRAME));
                velocity = next.velocity;
                scrollTo(axis, positionOf(axis) + next.distance);
            }
            last = time;
            const scroller = scrollerOf(axis);
            if (Math.abs(velocity) >= MOMENTUM_MIN_SPEED && scroller.isConnected && canScroll(scroller, axis, velocity)) {
                frame = requestAnimationFrame(step);
            }
        };
        frame = requestAnimationFrame(step);
    };

    /** the focus out of the cell, see the top */
    const leaveCell = () => {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && ctx.element.contains(focused) && !findBarHasFocus(ctx)) {
            focused.blur();
        }
    };

    ctx.element.addEventListener(
        'touchstart',
        (event) => {
            const stoppedMomentum = stopMomentum();
            // a second finger: the browser's. A finger on the detail form scrolls the form, the browser's too
            if (event.touches.length !== 1 || isInDetailForm(ctx, event.target)) {
                gesture = null;
                return;
            }
            const touch = event.touches[0];
            gesture = {
                x: touch.clientX,
                y: touch.clientY,
                axis: null,
                grid: false,
                start: 0,
                samples: [],
                stoppedMomentum
            };
        },
        { passive: false, signal }
    );

    ctx.element.addEventListener(
        'touchmove',
        (event) => {
            if (!gesture || event.touches.length !== 1) {
                return;
            }
            const touch = event.touches[0];
            if (!gesture.axis) {
                const dx = touch.clientX - gesture.x;
                const dy = touch.clientY - gesture.y;
                const axis = lockAxis(dx, dy);
                if (!axis) {
                    // still a press: not the page's either, see the top
                    event.preventDefault();
                    return;
                }
                gesture.axis = axis;
                // the finger up (a negative dy) scrolls the rows down
                gesture.grid = canScroll(scrollerOf(axis), axis, axis === 'y' ? -dy : -dx);
                if (!gesture.grid) {
                    return;
                }
                gesture.x = touch.clientX;
                gesture.y = touch.clientY;
                gesture.start = positionOf(axis);
                leaveCell();
            }
            if (!gesture.grid) {
                return;
            }
            event.preventDefault();
            const at = gesture.axis === 'y' ? touch.clientY : touch.clientX;
            const from = gesture.axis === 'y' ? gesture.y : gesture.x;
            scrollTo(gesture.axis, gesture.start - (at - from));
            gesture.samples.push({ time: event.timeStamp, at });
        },
        { passive: false, signal }
    );

    ctx.element.addEventListener(
        'touchend',
        (event) => {
            if (!gesture || event.touches.length !== 0) {
                return;
            }
            if (gesture.grid && gesture.axis) {
                // the scroll position moves against the finger
                const velocity = -fingerVelocity(gesture.samples, event.timeStamp);
                if (Math.abs(velocity) >= MOMENTUM_MIN_SPEED) {
                    coast(gesture.axis, velocity);
                }
            } else if (!gesture.axis && gesture.stoppedMomentum) {
                // the tap that stopped the momentum: no click
                event.preventDefault();
            }
            gesture = null;
        },
        { passive: false, signal }
    );

    ctx.element.addEventListener(
        'touchcancel',
        () => {
            gesture = null;
        },
        { signal }
    );
}
