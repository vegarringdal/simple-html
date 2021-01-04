// simple helper to delay re-render
export function requestRender(ctx: any) {
    if (ctx.isConnected) {
        if (ctx.__wait) {
        } else {
            ctx.__wait = true;
            requestAnimationFrame(async () => {
                await Promise.resolve(true);
                ctx.render.call(ctx);
                ctx.__wait = false;
            });
        }
    }
}
