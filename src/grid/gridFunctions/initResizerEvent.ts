import type { Grid } from '../grid';

/**
 * rebuilds the grid when the element gets a new size
 *
 * There is no "skip the first callback" here. A grid created while it is not rendered (inside a
 * display:none tab) gets no callback until it is shown, and that callback must rebuild - the dom
 * was built for a 0x0 element. The size check already ignores the first callback of a grid that
 * was visible from the start, since its size is the one createDom saved in oldHeight/oldWidth.
 */
export function initResizerEvent(ctx: Grid) {
    if (ctx.skipInitResizeEvent) {
        return;
    }

    // called again when the grid is re-attached, one observer per grid
    ctx.resizeObserver?.disconnect();

    ctx.resizeObserver = new ResizeObserver(() => {
        if (ctx.oldHeight !== ctx.element.clientHeight || ctx.oldWidth !== ctx.element.clientWidth) {
            if (ctx.oldHeight < ctx.element.clientHeight || ctx.oldWidth !== ctx.element.clientWidth) {
                ctx.oldHeight = ctx.element.clientHeight;
                ctx.oldWidth = ctx.element.clientWidth;
                if (ctx.resizeTimer) clearTimeout(ctx.resizeTimer);
                ctx.resizeTimer = setTimeout(() => {
                    ctx.resizeTimer = null;
                    ctx.rebuild();
                }, 100);
            }
        }
    });
    ctx.resizeObserver.observe(ctx.element);
}
