import { Grid } from '../grid';

export function removeContextMenu(ctx: Grid) {
    if (ctx.contextMenu) {
        if (ctx.contextMenu.parentElement) {
            ctx.contextMenu.parentElement.removeChild(ctx.contextMenu);
        }

        ctx.contextMenu = null;
    }
}
