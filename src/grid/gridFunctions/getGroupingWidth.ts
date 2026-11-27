import type { Grid } from '../grid';
import type { ColType } from './colType';
import { LEFT_PINNED_COLTYPE } from './GROUP_COLTYPE';

/**
 * The width of a grouping level: the column left of the rows that a level of grouping adds, with its
 * line and the +/- box of its group rows (renderRowGroup.ts). grid.css draws the lines with it too
 * (`.simple-html-grid-grouping-row`, `.simple-html-grid-group-levels`): change both together
 */
export const GROUP_LEVEL_WIDTH = 15;

/**
 * The width of the grouping columns, a {@link GROUP_LEVEL_WIDTH} per grouped attribute: in front of
 * the left pinned columns, 0 in the other sections
 */
export function getGroupingWidth(ctx: Grid, coltype: ColType) {
    if (coltype !== LEFT_PINNED_COLTYPE) {
        return 0;
    }

    const grouping = ctx.gridInterface.getDatasource().getGrouping();
    return grouping?.length * GROUP_LEVEL_WIDTH || 0;
}
