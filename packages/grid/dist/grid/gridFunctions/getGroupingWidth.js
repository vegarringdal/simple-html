import { LEFT_PINNED_COLTYPE } from './GROUP_COLTYPE';
export function getGroupingWidth(ctx, coltype) {
    if (coltype !== LEFT_PINNED_COLTYPE) {
        return 0;
    }
    const grouping = ctx.gridInterface.getDatasource().getGrouping();
    const groupingWidth = grouping?.length * 15 || 0;
    return groupingWidth;
}
//# sourceMappingURL=getGroupingWidth.js.map