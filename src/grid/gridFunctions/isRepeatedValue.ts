import { isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import { cellTextOf } from './cellText';

/**
 * True when this cell shows the same thing as the row directly above it, and should be
 * dimmed.
 *
 * The comparison is on the **displayed** value, not the raw one. This is a visual feature -
 * if the field's formatter makes two different source values render as the same text, they look
 * repeated to the user and should dim. Comparing the raw values would leave a column of
 * identical looking text undimmed.
 *
 * The row above is looked up in the displayed collection, which is what makes grouping work
 * for free: a group header sits between two groups, so the first data row of every group
 * always reads at full strength again.
 *
 * Row indexes are absolute in the displayed collection, not in the recycled dom rows, so
 * this stays correct while scrolling.
 */
export function isRepeatedValue(ctx: Grid, row: number, attribute: string): boolean {
    if (!ctx.gridInterface.__getGridConfig().dimRepeatedValues || row < 1) {
        return false;
    }

    const datasource = ctx.gridInterface.getDatasource();

    const previous = datasource.getRow(row - 1);
    // start of a group, or nothing above - show it
    if (!previous || isGroupRow(previous)) {
        return false;
    }

    const current = datasource.getRow(row);
    if (!current || isGroupRow(current)) {
        return false;
    }

    // the text the cell shows, as renderRowCell shows it: the type of a dynamic type column, the
    // column's numberOverride, a lookup column's label (the formatter's text alone missed the last two)
    const displayed = cellTextOf(ctx, attribute);

    const previousValue = displayed(previous).text;

    // a run of blanks is not something worth collapsing, it just looks broken
    if (previousValue === '') {
        return false;
    }

    return previousValue === displayed(current).text;
}
