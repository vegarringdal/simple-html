import type { Grid } from '../grid';
import { prettyPrintString } from './prettyPrintString';

/**
 * The label of a column: the column's own `label`, else the label of the datasource field
 * (`FieldConfig.label`), else the attribute name.
 * @param pretty show the attribute name prettified (`first_name` -> `First Name`), like the header does
 */
export function getColumnLabel(ctx: Grid, attribute: string, pretty = false): string {
    // an attribute does not have to be in the grid config, a filter can use any field
    const columnLabel = ctx.gridInterface.__getGridConfig().__attributes[attribute]?.label;
    const fieldLabel = ctx.gridInterface.getDatasource().__getFieldConfig(attribute)?.label;
    return columnLabel || fieldLabel || (pretty ? prettyPrintString(attribute) : attribute);
}
