import { Grid } from '../grid';

/**
 * sets all rows to display 'none
 * @param ctx
 */

export function hideAllRows(ctx: Grid) {
    ctx.containerGroupRowCache.forEach((e) => {
        const el = ctx.rows.get(e.id);
        if (el) {
            el.style.display = 'none';
        }
    });

    ctx.containerSelectorRowCache.forEach((e) => {
        const el = ctx.rows.get(e.id);
        if (el) {
            el.style.display = 'none';
        }
    });

    ctx.containerLeftRowCache.forEach((e) => {
        const el = ctx.rows.get(e.id);
        if (el) {
            el.style.display = 'none';
        }
    });

    ctx.containerMiddleRowCache.forEach((e) => {
        const el = ctx.rows.get(e.id);
        if (el) {
            el.style.display = 'none';
        }
    });

    ctx.containerRightRowCache.forEach((e) => {
        const el = ctx.rows.get(e.id);
        if (el) {
            el.style.display = 'none';
        }
    });
}
