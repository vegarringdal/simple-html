import type { Entity } from '../../datasource/entity';
import type { FieldType } from '../../datasource/field';
import type { Formatter } from '../../datasource/formatter';
import { cellFieldText, fillTemplate } from '../cellTemplate';
import { type ColumnFormat, hasValueFormat } from '../columnFormat';
import type { Grid } from '../grid';
import type { ColumnConfig } from '../gridConfig';
import { getCellType } from './getCellType';
import { isMultilineCell } from './multilineText';

/**
 * What a cell of a field shows for a row, see cellTextOf
 */
export interface CellText {
    /**
     * the type the cell is shown as, see getCellType. A `boolean` cell is a checkbox, its text is not shown:
     * also the cell of a column with checkboxes (`ColumnFormat.checkbox`), its text is the value's
     */
    type: FieldType;
    /** the text: the value formatted - with the column's display format (`ColumnConfig.format`) - and the column's `numberOverride` (numberOverrideOf) */
    text: string;
    /** a cell of several lines, see isMultilineCell: it shows its first line, more in a taller row */
    multiline: boolean;
}

/**
 * The text a cell of a number field shows: the formatter's text, with the column's `numberOverride` -
 * `'BLANK_TO_ZERO'` shows an empty value as `0`, `'ZERO_TO_BLANK'` a `0` as empty
 * @param text what the formatter gave
 * @param zero the text of 0: `'0'`, as the built-in number formatters write it, `0,00` with a display
 * format (see zeroText)
 */
export function overrideNumberText(text: string, numberOverride: ColumnConfig['numberOverride'], zero = '0'): string {
    if (numberOverride === 'BLANK_TO_ZERO' && text === '') {
        return zero;
    }
    if (numberOverride === 'ZERO_TO_BLANK' && text === zero) {
        return '';
    }
    return text;
}

/**
 * What a number column shows for a blank and for 0: the user's choice from the column settings
 * (`ColumnFormat.numberOverride`, the state's formats) wins over the column's `numberOverride` - its
 * `'NONE'` turns the column's off. undefined: none, also for a column with checkboxes
 * (`ColumnFormat.checkbox`): they show no text, and the exports write the value
 */
export function numberOverrideOf(column: ColumnConfig | undefined): ColumnConfig['numberOverride'] {
    if (column?.format?.checkbox) {
        return undefined;
    }
    const override = column?.format?.numberOverride ?? column?.numberOverride;
    return override === 'NONE' ? undefined : override;
}

/**
 * The text of 0 in a number column, for numberOverride: the display format's (`0,00`) when the column
 * shows one (its own or its type's, GridInterface.__getColumnFormat), else `'0'` - the field formatter's
 * text is compared with `'0'`, as before the display formats
 * @param format the format the column shows, GridInterface.__getColumnFormat
 * @param formatter the formatter of the cell, GridInterface.__getCellFormatter
 */
export function zeroText(format: ColumnFormat | undefined, formatter: Formatter): string {
    return hasValueFormat(format) ? formatter.format(0) : '0';
}

/**
 * A function that gives what a cell of the field shows for a row, as renderRowCell shows it: the type
 * of the cell (`dynamicCellTypeColumn` can change it per row), its text and whether it is multiline. A
 * lookup column's text is the label of the value (lookupColumn.ts), a column with a display format
 * (`ColumnConfig.format`) the display format's text - a text column's template filled in for the row
 * (`ColumnFormat.text`, the text of its link too).
 * The field and its options are looked up once, for fitting the sizes to many rows.
 *
 * Reads the interface only, it works without a connected grid too.
 * @param ctx the grid, or an object with the grid's interface
 * @param options.template `false`: the cell's own text, not its column's template - for what is about
 * the value, the filter menu's value list (a template can show the same value two ways in two rows).
 * Default `true`
 */
export function cellTextOf(
    ctx: Pick<Grid, 'gridInterface'>,
    field: string,
    options: { template?: boolean } = {}
): (row: Entity) => CellText {
    // a lookup column (ColumnConfig.editor) shows the label of the value: text of one line
    const lookupFormatter = ctx.gridInterface.__getLookupColumn(field)?.formatter;
    if (lookupFormatter) {
        return (row) => ({ type: 'text', text: lookupFormatter.format(row[field]), multiline: false });
    }

    const datasource = ctx.gridInterface.getDatasource();
    const fieldConfig = datasource.getField(field);
    const column = ctx.gridInterface.__getGridConfig().columns[field];
    // with the column's display format: a cell of another type than the field's has none
    const formatter = ctx.gridInterface.__getCellFormatter(field);
    const zero = fieldConfig.type === 'number' ? zeroText(ctx.gridInterface.__getColumnFormat(field), formatter) : '0';
    // the template of a text column: filled in for each row, its placeholders are fields of the row
    const template = options.template !== false && fieldConfig.type === 'text' ? column?.format?.text : undefined;

    /** the text of a cell of the field's type */
    const textOf = (row: Entity) =>
        template === undefined
            ? formatter.format(row[field])
            : fillTemplate(template, cellFieldText(field, row[field], formatter, ctx.gridInterface.__fieldTextOf(row)));

    const numberOverride = numberOverrideOf(column);
    // the checkboxes of a text or number column (ColumnFormat.checkbox): a checkbox, its text the value's
    const checkbox = fieldConfig.type === 'text' || fieldConfig.type === 'number' ? column?.format?.checkbox : undefined;

    return (row) => {
        // getCellType reads the row only for a dynamicCellTypeColumn, the field's type otherwise
        const type = column?.dynamicCellTypeColumn ? getCellType(ctx, field, row) : fieldConfig.type;
        if (checkbox && type === fieldConfig.type) {
            return { type: 'boolean', text: formatter.format(row[field]), multiline: false };
        }
        const formatted = type === fieldConfig.type ? textOf(row) : datasource.getFormatter(field, type).format(row[field]);
        // as the cell: by the field's type, numberOverride is an option of a number column
        const text = fieldConfig.type === 'number' ? overrideNumberText(formatted, numberOverride, zero) : formatted;
        return { type, text, multiline: isMultilineCell(fieldConfig, type, text, column) };
    };
}
