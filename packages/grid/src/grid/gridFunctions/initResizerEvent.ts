import { Grid } from '../grid';

export function initResizerEvent(ctx: Grid) {
    if (ctx.skipInitResizeEvent) {
        return;
    }
    new ResizeObserver(() => {
        if (ctx.resizeInit) {
            if (ctx.oldHeight !== ctx.element.clientHeight || ctx.oldWidth !== ctx.element.clientWidth) {
                if (ctx.oldHeight < ctx.element.clientHeight || ctx.oldWidth !== ctx.element.clientWidth) {
                    ctx.oldHeight = ctx.element.clientHeight;
                    ctx.oldWidth = ctx.element.clientWidth;
                    if (ctx.resizeTimer) clearTimeout(ctx.resizeTimer);
                    ctx.resizeTimer = setTimeout(() => {
                        ctx.rebuild();
                    }, 100);
                }
            }
        } else {
            ctx.resizeInit = true;
        }
    }).observe(ctx.element);
}
