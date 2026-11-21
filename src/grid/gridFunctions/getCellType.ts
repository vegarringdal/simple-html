import type { Entity } from '../../datasource/entity';
import { type FieldType, isFieldType } from '../../datasource/field';
import type { Grid } from '../grid';

/**
 * The type a cell is shown and edited as: the type of the datasource field. A `text` column with
 * `dynamicCellTypeColumn` takes the type from that column of the row instead, when it holds one.
 * Format the cell with `datasource.getFormatter(attribute, type)`.
 *
 * Reads the interface only, so it works without a connected grid too: `getCsv()` passes
 * `{ gridInterface }`.
 * @param ctx the grid, or an object with the grid's interface
 */
export function getCellType(ctx: Pick<Grid, 'gridInterface'>, attribute: string, rowData: Entity | null | undefined): FieldType {
    const type = ctx.gridInterface.getDatasource().getField(attribute).type;
    const dynamicColumn = ctx.gridInterface.__getGridConfig().columns[attribute]?.dynamicCellTypeColumn;
    if (type !== 'text' || !dynamicColumn || !rowData) {
        return type;
    }
    const dynamicType = rowData[dynamicColumn];
    return isFieldType(dynamicType) ? dynamicType : type;
}
