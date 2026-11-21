import { getText, type TextId } from '../../texts';
import type { Grid } from '../grid';

/**
 * A text of the grid: from the grid's `texts` (GridConfig), else from setTexts(), else the default
 * (TEXTS). `{name}` in it is filled in from `values`: `gridText(ctx, 'footer.summary.count', { count: 3 })`
 */
export function gridText(ctx: Grid, id: TextId, values?: Readonly<Record<string, unknown>>): string {
    return getText(id, ctx.gridInterface.__getGridConfig().texts, values);
}
