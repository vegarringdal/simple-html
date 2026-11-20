import type { Entity } from '../../datasource/entity';
import { type FieldType, isFieldType } from '../../datasource/field';
import type { Grid } from '../grid';

/**
 * The type a cell is shown and edited as: the type of the datasource field. A `text` column with
 * `dynamicCellTypeColumn` takes the type from that column of the row instead, when it holds one.
 * Format the cell with `datasource.getFormatter(attribute, type)`.
 */
export function getCellType(ctx: Grid, attribute: string, rowData: Entity | null | undefined): FieldType {
    const type = ctx.gridInterface.getDatasource().getField(attribute).type;
    const dynamicColumn = ctx.gridInterface.__getGridConfig().columns[attribute]?.dynamicCellTypeColumn;
    if (type !== 'text' || !dynamicColumn || !rowData) {
        return type;
    }
    const dynamicType = rowData[dynamicColumn];
    return isFieldType(dynamicType) ? dynamicType : type;
}
