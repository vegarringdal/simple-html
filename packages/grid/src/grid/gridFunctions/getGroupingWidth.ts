import { Grid } from '../grid';
import { ColType } from './colTypes';
import { LEFT_PINNED_COLTYPE } from './GROUP_COLTYPE';

export function getGroupingWidth(ctx: Grid, coltype: ColType) {
    if (coltype !== LEFT_PINNED_COLTYPE) {
        return 0;
    }

    const grouping = ctx.gridInterface.getDatasource().getGrouping();
    const groupingWidth = grouping?.length * 15 || 0;

    return groupingWidth;
}
