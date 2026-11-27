import type { Grid } from '../grid';

/**
 * Hides the row elements of every section, for a large scroll jump: see verticalScrollHandler. Which
 * row each one shows is kept, the next render shows them again
 */
export function hideAllRows(ctx: Grid) {
    const rowCaches = [
        ctx.containerGroupRowCache,
        ctx.containerSelectorRowCache,
        ctx.containerLeftRowCache,
        ctx.containerMiddleRowCache,
        ctx.containerRightRowCache
    ];
    for (const rowCache of rowCaches) {
        for (const entry of rowCache) {
            const rowElement = ctx.rows.get(entry.id);
            if (rowElement) {
                rowElement.style.display = 'none';
            }
        }
    }
}
