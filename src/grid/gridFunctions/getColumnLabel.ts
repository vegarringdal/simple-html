import type { Grid } from '../grid';
import { prettyPrintString } from './prettyPrintString';

/**
 * The label of a column, the same wherever the grid shows it (header, column chooser, group chip,
 * drag ghost, filter text, filter editor, copied table): the column's own `label`, else the label of
 * the datasource field (`FieldConfig.label`), else the field name prettified (`first_name` ->
 * `First Name`).
 *
 * Reads the interface only, so it works without a connected grid too: `getCsv()` passes
 * `{ gridInterface }`.
 * @param ctx the grid, or an object with the grid's interface
 */
export function getColumnLabel(ctx: Pick<Grid, 'gridInterface'>, attribute: string): string {
    // an attribute does not have to be in the grid config, a filter can use any field
    const columnLabel = ctx.gridInterface.__getGridConfig().columns[attribute]?.label;
    const fieldLabel = ctx.gridInterface.getDatasource().__getFieldConfig(attribute)?.label;
    return columnLabel || fieldLabel || prettyPrintString(attribute);
}
