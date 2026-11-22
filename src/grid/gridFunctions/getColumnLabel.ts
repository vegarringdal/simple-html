import type { Grid } from '../grid';
import { prettyPrintString } from './prettyPrintString';

/**
 * The label of a column, the same wherever the grid shows it (header, column chooser, group chip,
 * drag ghost, filter text, filter editor, copied table, the headers of the CSV and Excel exports): the
 * label the user gave it in the column settings (`ColumnFormat.label`, the state's formats), else its
 * label without one (getConfigColumnLabel).
 *
 * Reads the interface only, so it works without a connected grid too: `getCsv()` passes
 * `{ gridInterface }`.
 * @param ctx the grid, or an object with the grid's interface
 */
export function getColumnLabel(ctx: Pick<Grid, 'gridInterface'>, attribute: string): string {
    return ctx.gridInterface.__getGridConfig().columns[attribute]?.format?.label || getConfigColumnLabel(ctx, attribute);
}

/**
 * The label of a column without a label of the user's (`ColumnFormat.label`) - what an empty label in
 * the grid config dialog goes back to: the column's own `label`, else the label of the datasource
 * field (`FieldConfig.label`), else the field name prettified (`first_name` -> `First Name`).
 * @param ctx the grid, or an object with the grid's interface
 */
export function getConfigColumnLabel(ctx: Pick<Grid, 'gridInterface'>, attribute: string): string {
    // an attribute does not have to be in the grid config, a filter can use any field
    const columnLabel = ctx.gridInterface.__getGridConfig().columns[attribute]?.label;
    const fieldLabel = ctx.gridInterface.getDatasource().__getFieldConfig(attribute)?.label;
    return columnLabel || fieldLabel || prettyPrintString(attribute);
}
