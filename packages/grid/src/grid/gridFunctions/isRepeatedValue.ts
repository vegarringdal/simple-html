import type { Entity } from '../../datasource/entity';
import type { Grid } from '../grid';

/**
 * True when this cell shows the same thing as the row directly above it, and should be
 * dimmed.
 *
 * The comparison is on the **displayed** value, not the raw one. This is a visual feature -
 * if a value formater makes two different source values render as the same text, they look
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
    if (!previous || previous.__group) {
        return false;
    }

    const current = datasource.getRow(row);
    if (!current || current.__group) {
        return false;
    }

    const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];
    const valueFormater = datasource.getValueFormater();

    /**
     * same type resolution the cell rendering uses, so a dynamic type column is honoured
     */
    const displayed = (entity: Entity) => {
        let type = cellConfig?.type || 'text';
        if (cellConfig?.dynamicCellTypeColumn) {
            type = entity[cellConfig.dynamicCellTypeColumn] || type;
        }
        return valueFormater.fromSource(entity[attribute], type, attribute, false);
    };

    const previousValue = displayed(previous);

    // a run of blanks is not something worth collapsing, it just looks broken
    if (previousValue === null || previousValue === undefined || previousValue === '') {
        return false;
    }

    return previousValue === displayed(current);
}
