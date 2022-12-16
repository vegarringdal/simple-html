import { getElementByClassName } from './getElementByClassName';
import { Grid } from './grid';
import { horizontalScrollHandler } from './horizontalScrollHandler';
import { verticalScrollHandler } from './verticalScrollHandler';

/**
 * ctx just rerenders row values, usefull for selection etc
 */
export function triggerScrollEvent(ctx: Grid) {
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
    verticalScrollHandler(ctx, elMiddle.scrollTop);
}
