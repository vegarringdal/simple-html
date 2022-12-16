import { Grid } from './grid';

/**
 * gets all attributes displayed
 * @param filterSelectedColumns - by default filters out selected
 * @returns
 */
export function getAttributeColumns(ctx: Grid, filterSelectedColumns = true) {
    const colLeft = ctx.gridInterface.__getGridConfig().columnsPinnedLeft.flatMap((e) => e.rows.map((e) => e));
    const colCenter = ctx.gridInterface.__getGridConfig().columnsCenter.flatMap((e) => e.rows.map((e) => e));
    const colRight = ctx.gridInterface.__getGridConfig().columnsPinnedRight.flatMap((e) => e.rows.map((e) => e));
    const allAttributes = colLeft.concat(colCenter).concat(colRight);

    let attributes: string[] = [];
    if (filterSelectedColumns && ctx.gridInterface.__selectedColumns()) {
        allAttributes.forEach((name, i) => {
            if (ctx.gridInterface.__isColumnSelected(i + 1)) {
                attributes.push(name);
            }
        });
    } else {
        attributes = allAttributes;
    }

    return attributes;
}
