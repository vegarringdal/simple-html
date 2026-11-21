import type { Grid } from '../grid';
import { getElementByClassName } from './getElementByClassName';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { verticalScrollHandler } from './verticalScrollHandler';

/**
 * Renders every row and column on screen again, with what the rows show now: `gridInterface.refresh()`,
 * and after the selection, the current row or the displayed rows changed. The cell the user is typing
 * in is left as it is, see renderRowColumns
 */
export function triggerScrollEvent(ctx: Grid) {
    // connectInterface can come before the element is in the dom, nothing to render yet
    if (!ctx.domCreated) {
        return;
    }

    const elBody = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');
    const elMiddle = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');

    function setScrollTop(element: HTMLElement, top: number) {
        element.scrollTop = top;
    }

    setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller'), elBody.scrollTop);
    setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-view-group'), elBody.scrollTop);
    setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-view-selector'), elBody.scrollTop);
    setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-left'), elBody.scrollTop);
    setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-middle'), elBody.scrollTop);
    setScrollTop(getElementByClassName(ctx.element, 'simple-html-grid-body-view-pinned-right'), elBody.scrollTop);
    horizontalScrollHandler(ctx, elMiddle.scrollLeft);

    // this is a request to render now. Without this a position far from the last one takes the
    // "large scroll" path, which only hides the rows - the scroll listener renders them after a
    // delay, but there is no scroll event here (position clamped after a filter, element moved)
    ctx.lastScrollTop = elMiddle.scrollTop;
    // every row on screen: what it shows can have changed without its row changing (the selection,
    // the hooks, what the user did not type)
    verticalScrollHandler(ctx, elMiddle.scrollTop, true);
}
