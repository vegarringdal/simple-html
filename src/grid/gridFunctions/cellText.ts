import type { Entity } from '../../datasource/entity';
import type { FieldType } from '../../datasource/field';
import type { Grid } from '../grid';
import type { ColumnConfig } from '../gridConfig';
import { getCellType } from './getCellType';
import { isMultilineCell } from './multilineText';

/**
 * What a cell of a field shows for a row, see cellTextOf
 */
export interface CellText {
    /** the type the cell is shown as, see getCellType. A `boolean` cell is a checkbox, its text is not shown */
    type: FieldType;
    /** the text: the value formatted, with the column's `numberOverride` */
    text: string;
    /** a cell of several lines, see isMultilineCell: it shows its first line, more in a taller row */
    multiline: boolean;
}

/**
 * The text a cell of a number field shows: the formatter's text, with the column's `numberOverride` -
 * `'BLANK_TO_ZERO'` shows an empty value as `0`, `'ZERO_TO_BLANK'` a `0` as empty
 * @param text what the formatter gave
 */
export function overrideNumberText(text: string, numberOverride: ColumnConfig['numberOverride']): string {
    if (numberOverride === 'BLANK_TO_ZERO' && text === '') {
        return '0';
    }
    if (numberOverride === 'ZERO_TO_BLANK' && text === '0') {
        return '';
    }
    return text;
}

/**
 * A function that gives what a cell of the field shows for a row, as renderRowCell shows it: the type
 * of the cell (`dynamicCellTypeColumn` can change it per row), its text and whether it is multiline.
 * The field and its options are looked up once, for fitting the sizes to many rows.
 *
 * Reads the interface only, it works without a connected grid too.
 * @param ctx the grid, or an object with the grid's interface
 */
export function cellTextOf(ctx: Pick<Grid, 'gridInterface'>, field: string): (row: Entity) => CellText {
    const datasource = ctx.gridInterface.getDatasource();
    const fieldConfig = datasource.getField(field);
    const column = ctx.gridInterface.__getGridConfig().columns[field];
    const formatter = datasource.getFormatter(field);

    return (row) => {
        // getCellType reads the row only for a dynamicCellTypeColumn, the field's type otherwise
        const type = column?.dynamicCellTypeColumn ? getCellType(ctx, field, row) : fieldConfig.type;
        const formatted = (type === fieldConfig.type ? formatter : datasource.getFormatter(field, type)).format(row[field]);
        // as the cell: by the field's type, numberOverride is an option of a number column
        const text = fieldConfig.type === 'number' ? overrideNumberText(formatted, column?.numberOverride) : formatted;
        return { type, text, multiline: isMultilineCell(fieldConfig, type, text) };
    };
}
