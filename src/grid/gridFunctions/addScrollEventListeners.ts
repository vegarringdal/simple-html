import type { Grid } from '../grid';
import { findBarHasFocus } from './findBar';
import { getElementByClassName } from './getElementByClassName';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { addTouchScroll } from './touchScroll';
import { verticalScrollHandler } from './verticalScrollHandler';

/** WheelEvent.deltaMode: the deltas are lines, or pages (UI Events) - 0 is px */
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

export function addScrollEventListeners(ctx: Grid) {
    /**
     * The scrollbars are two elements of their own: the body scroller (on the right) scrolls the rows,
     * the middle scroller (at the bottom) the middle columns - and the rows too, it is as high as the
     * rows. The views of the sections are overflow hidden and follow them. All made once by createDom
     * and kept, so looked up once here: looked up on every scroll event, the lookups took a measurable
     * part of it (getElementsByClassName, after the rows changed the dom)
     */
    const bodyScroller = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');
    const middleScroller = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
    const bodyViewMiddle = getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-middle');
    const headerViewMiddle = getElementByClassName(ctx.element, 'simple-html-grid-header-view-pinned-middle');
    // what follows the scroll position of the rows
    const rowViews = [
        middleScroller,
        getElementByClassName(ctx.element, 'simple-html-grid-body-view-group'),
        getElementByClassName(ctx.element, 'simple-html-grid-body-view-selector'),
        getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-left'),
        bodyViewMiddle,
        getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-right')
    ];

    /**
     * the wheel/touch listeners sit on the grid element itself, Grid.destroy() removes them with this
     * signal. The listeners of an earlier call are dropped first, or every wheel tick would scroll twice
     */
    ctx.scrollListenersAbort?.abort();
    ctx.scrollListenersAbort = new AbortController();
    const signal = ctx.scrollListenersAbort.signal;

    /**
     * the views to the scroll position of the rows, and the rows rendered for it. False when it was a
     * large jump, the rows are hidden then: see verticalScrollHandler
     */
    const scrollRows = () => {
        for (const view of rowViews) {
            view.scrollTop = bodyScroller.scrollTop;
        }
        return verticalScrollHandler(ctx, bodyScroller.scrollTop);
    };

    /**
     * renders the rows once there has been no scroll event for 150ms, after a large jump. Every scroll
     * event until then starts the wait again: a scrollbar drag renders once, when it stops
     */
    const scrollRowsWhenStopped = () => {
        clearTimeout(ctx.largeScrollTopTimer ?? undefined);
        ctx.largeScrollTopTimer = setTimeout(() => {
            ctx.largeScrollTopTimer = null;
            // render now, also when it is far from the position of the large jump
            ctx.lastScrollTop = bodyScroller.scrollTop;
            scrollRows();
        }, 150);
    };

    /**
     * right scrollbar
     */
    bodyScroller.addEventListener(
        'scroll',
        () => {
            if (ctx.largeScrollTopTimer) {
                // still scrolling after a large jump
                scrollRowsWhenStopped();
            } else if (!scrollRows()) {
                scrollRowsWhenStopped();
            }
        },
        { passive: false, signal }
    );

    /**
     * middle scrollbar
     */
    middleScroller.addEventListener(
        'scroll',
        () => {
            bodyViewMiddle.scrollLeft = middleScroller.scrollLeft;
            headerViewMiddle.scrollLeft = middleScroller.scrollLeft;
            if (ctx.lastScrollLeft !== middleScroller.scrollLeft) {
                horizontalScrollHandler(ctx, middleScroller.scrollLeft);
            }

            bodyScroller.scrollTop = middleScroller.scrollTop;
        },
        { passive: false, signal }
    );

    /**
     * The wheel over the grid scrolls the grid, and only the grid: the page under it does not move (the
     * event is cancelled - the rows' views do not scroll themselves, so without it the browser scrolls
     * the page, also at the grid's first and last row).
     * - up/down scrolls the rows, left/right (a trackpad, Shift+wheel) the middle columns; Ctrl+Shift+wheel
     *   scrolls the columns too, as it did
     * - Ctrl+wheel without Shift is the browser's zoom (and a trackpad's pinch): left alone
     * - the focus leaves the cell: the cell would scroll away under it. Not the find bar (findBar.ts)
     * The standard `deltaX` / `deltaY` (Firefox has no `wheelDeltaY`), lines and pages turned into px
     */
    ctx.element.addEventListener(
        'wheel',
        (event: WheelEvent) => {
            if (event.ctrlKey && !event.shiftKey) {
                return;
            }
            event.preventDefault();
            const toPx = (delta: number, page: number) => {
                if (event.deltaMode === DOM_DELTA_LINE) {
                    return delta * ctx.gridInterface.__getGridConfig().cellHeight;
                }
                return event.deltaMode === DOM_DELTA_PAGE ? delta * page : delta;
            };
            const deltaX = toPx(event.deltaX, middleScroller.clientWidth);
            const deltaY = toPx(event.deltaY, bodyScroller.clientHeight);

            if (event.ctrlKey && event.shiftKey) {
                middleScroller.scrollLeft = middleScroller.scrollLeft + (deltaY || deltaX);
                return;
            }
            // no cell is edited while the find bar has the focus: it keeps it, Enter goes on finding
            if (!findBarHasFocus(ctx)) {
                ctx.focusElement.focus();
                ctx.focusElement.blur();
            }
            if (deltaY) {
                bodyScroller.scrollTop = bodyScroller.scrollTop + deltaY;
            }
            if (deltaX) {
                middleScroller.scrollLeft = middleScroller.scrollLeft + deltaX;
            }
        },
        { passive: false, signal }
    );

    // a swipe scrolls the rows and the middle columns, with momentum: see touchScroll.ts
    addTouchScroll(ctx, bodyScroller, middleScroller, signal);
}
