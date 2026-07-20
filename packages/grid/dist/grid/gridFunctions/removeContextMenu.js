export function removeContextMenu(ctx) {
    if (ctx.contextMenu) {
        if (ctx.contextMenu.parentElement) {
            ctx.contextMenu.parentElement.removeChild(ctx.contextMenu);
        }
        ctx.contextMenu = null;
    }
}
//# sourceMappingURL=removeContextMenu.js.map