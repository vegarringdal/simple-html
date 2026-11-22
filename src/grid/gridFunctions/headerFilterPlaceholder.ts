import type { FieldType } from '../../datasource/field';
import type { FilterOperator } from '../../datasource/filterExpression';
import type { Formatter } from '../../datasource/formatter';
import { TextFormatter } from '../../datasource/textFormatter';
import type { ColumnFormat } from '../columnFormat';
import type { Grid } from '../grid';
import { getConfigColumnLabel } from './getColumnLabel';
import { gridText } from './gridText';
import { headerFilterFormatter } from './headerFilterFormatter';

/**
 * The placeholder of a column's empty header filter, what it says to type: the user's from the column
 * settings - the column's label (`ColumnFormat.placeholderLabel`) or a text (`ColumnFormat.placeholder`)
 * - else the one the column has without them (defaultFilterPlaceholder).
 * @param format the column's format: `ColumnConfig.format` for the header, the draft of the column
 * settings dialog for its own preview of it
 * @param operator the operator of the header filter, getHeaderFilterOperator
 */
export function headerFilterPlaceholder(
    ctx: Grid,
    attribute: string,
    format: ColumnFormat | undefined,
    operator: FilterOperator
): string {
    if (format?.placeholderLabel) {
        // the label of the same format: the dialog's draft label before it is applied
        return format.label || getConfigColumnLabel(ctx, attribute);
    }
    return format?.placeholder || defaultFilterPlaceholder(ctx, attribute, operator, format ?? {});
}

/**
 * The placeholder of a column's empty header filter without one of the user's: the column's own
 * (`ColumnConfig.placeholderFilter`), else a BETWEEN's "from..to", else the formatter's (a date's format,
 * YYYY-MM-DD) - of a column that filters as shown an example of its display format (`2026-W47`,
 * `1 234,5`, headerFilterFormatter) - else the field's type: "Text", "Number" (texts
 * `filter.placeholder.*`). A lookup column (`ColumnConfig.editor`) filters on its labels, as text
 * @param operator the operator of the header filter, getHeaderFilterOperator
 * @param format the column's format: the grid config dialog's draft for its own preview. Left out, the
 * column's (`ColumnConfig.format`); `{}` is none
 */
export function defaultFilterPlaceholder(
    ctx: Grid,
    attribute: string,
    operator: FilterOperator,
    format: ColumnFormat | undefined = ctx.gridInterface.__getGridConfig().columns[attribute]?.format
): string {
    const column = ctx.gridInterface.__getGridConfig().columns[attribute];
    const lookup = !!ctx.gridInterface.__getLookupColumn(attribute);
    const field = ctx.gridInterface.getDatasource().getField(attribute);
    const type = lookup ? 'text' : field.type;
    const formatter: Formatter = lookup ? TextFormatter : headerFilterFormatter(ctx, attribute, format);
    return (
        column?.placeholderFilter ||
        (operator === 'BETWEEN'
            ? gridText(ctx, 'filter.placeholder.between')
            : formatter.placeholder || typePlaceholder(ctx, type))
    );
}

/**
 * the placeholder of an empty header filter of a field without one of its own: its type, "Text" or
 * "Number" - nothing for the other types, a date's formatter has its format as the placeholder
 */
function typePlaceholder(ctx: Grid, type: FieldType): string {
    if (type === 'text') {
        return gridText(ctx, 'filter.placeholder.text');
    }
    if (type === 'number') {
        return gridText(ctx, 'filter.placeholder.number');
    }
    return '';
}
