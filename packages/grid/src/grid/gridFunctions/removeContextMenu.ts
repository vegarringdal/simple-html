import { Grid } from '../grid';

export function removeContextMenu(ctx: Grid) {
    if (ctx.contextMenu) {
        document.body.removeChild(ctx.contextMenu);
        ctx.contextMenu = null;
    }
}
