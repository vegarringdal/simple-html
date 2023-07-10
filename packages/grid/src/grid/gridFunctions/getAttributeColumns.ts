import { Grid } from '../grid';

/**
 * gets all attributes displayed
 * @param filterSelectedColumns - by default filters out selected
 * @returns
 */
export function getAttributeColumns(ctx: Grid, filterSelectedColumns = true) {
    const colLeft = ctx.gridInterface.__getGridConfig().columnsPinnedLeft.map((e) => e.rows);
    const colCenter = ctx.gridInterface.__getGridConfig().columnsCenter.map((e) => e.rows);
    const colRight = ctx.gridInterface.__getGridConfig().columnsPinnedRight.map((e) => e.rows);
    const allAttributes = colLeft.concat(colCenter).concat(colRight);

    let attributes: string[] = [];

    if (filterSelectedColumns && ctx.gridInterface.__selectedColumns()) {
        allAttributes.forEach((names, i) => {
            if (ctx.gridInterface.__isColumnSelected(i + 1)) {
                if (Array.isArray(names)) {
                    names.forEach((n) => {
                        attributes.push(n);
                    });
                }
            }
        });
    } else {
        allAttributes.forEach((names) => {
            if (Array.isArray(names)) {
                names.forEach((n) => {
                    attributes.push(n);
                });
            }
        });
    }

    return attributes;
}
