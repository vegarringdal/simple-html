import type { Entity } from '../../datasource/entity';
import type { FieldType } from '../../datasource/field';
import type { FilterCondition, FilterExpression } from '../../datasource/filterExpression';
import { TextFormatter } from '../../datasource/textFormatter';
import type { Grid } from '../grid';
import { cellTextOf } from './cellText';
import type { LookupColumn } from './lookupColumn';

/**
 * Find's "Filter rows" as a filter, for a backend: `gridInterface.getFindFilter()` gives it, and
 * `toSqlWhere()` turns it into SQL like any other filter. No dom - it reads the interface and the
 * datasource only.
 *
 * Find marks the cells by the text they show (findMatches.ts). A database has the values, not the
 * texts, so the filter has a condition only for a field whose cells it can match the way the grid does:
 *
 * - **a text field** that shows its value as it is - the built-in text formatter, no template, no type
 *   of its own per row: `CONTAINS` the text, `literal` (Find takes `*`, `%` and `_` as they are) and
 *   `caseSensitive` with Match case. The same rows as Find, every line of a multiline text too
 * - **a lookup column** (it shows the label of its value): `IN` the values of the lookup whose label holds
 *   the text - as the cells show it, `caseSensitive` for a text field: the values themselves
 * - **a number field**: `EQUAL` the number the text reads as (the field's formatter), when the cell of
 *   that number shows the text - `30` is 30. Find also marks `130` and `30.5`, the filter not
 * - **a date or datetime field**: `EQUAL` the day (the second) the text reads as, when the cell of that
 *   day (second) shows the text, all of it - `2026-03-14`. Not a part of a date: `2026-03` is no day
 *
 * A row the filter selects is a row Find marks a cell of - never more. The filter can select fewer: a
 * number or date only by a part of its text, a text field with a formatter or a template of its own, a
 * column whose type changes per row (`dynamicCellTypeColumn`), a value a lookup has no row for. A
 * boolean and a column of checkboxes are not searched by Find either.
 */

/**
 * The filter of Find's "Filter rows", see the top of the file: an OR group of a condition per field,
 * in the order of the fields. When no field gives one, a condition that selects no row - `IN []` on
 * `noRowField` - as the SQL can not find a row then.
 * @param ctx the grid, or an object with the grid's interface
 * @param text the text Find looks for, not empty
 * @param caseSensitive Match case
 * @param fields the fields to make conditions for: of the layout, in its order (getLayoutFields())
 * @param noRowField the field of the condition of no row: the first of `fields` by default
 * @returns null only without a field to name - there is no condition of no row then
 */
export function findFilter(
    ctx: Pick<Grid, 'gridInterface'>,
    text: string,
    caseSensitive: boolean,
    fields: readonly string[],
    noRowField: string | undefined = fields[0]
): FilterExpression | null {
    const children: FilterCondition[] = [];
    for (const field of fields) {
        const condition = fieldCondition(ctx, field, text, caseSensitive);
        if (condition) {
            children.push(condition);
        }
    }
    if (children.length) {
        return { group: 'OR', children };
    }
    return noRowField === undefined ? null : { field: noRowField, operator: 'IN', value: [] };
}

/**
 * A text as Find compares it: as it is with Match case, else in lower case (findMatches.ts)
 */
function findCase(text: string, caseSensitive: boolean): string {
    return caseSensitive ? text : text.toLowerCase();
}

/**
 * The condition of one field, see the top of the file. null: none - the SQL can not match its cells as
 * the grid shows them, or no value of it shows the text
 */
function fieldCondition(
    ctx: Pick<Grid, 'gridInterface'>,
    field: string,
    text: string,
    caseSensitive: boolean
): FilterCondition | null {
    const { gridInterface } = ctx;
    const type = gridInterface.getDatasource().getField(field).type;
    const needle = findCase(text, caseSensitive);
    /** a cell's text holds the text, as Find marks it */
    const holds = (cellText: string) => findCase(cellText, caseSensitive).includes(needle);

    const lookup = gridInterface.__getLookupColumn(field);
    if (lookup) {
        return lookupCondition(lookup, type, holds);
    }
    const column = gridInterface.__getGridConfig().columns[field];
    if (column?.dynamicCellTypeColumn) {
        // the type of a cell is another field's value: each row can show another text
        return null;
    }
    // what a cell shows for a value, its type too: a column of checkboxes is a `boolean`, no text
    const textOf = cellTextOf(ctx, field);
    const cellOf = (value: unknown) => textOf({ [field]: value } as Entity);
    switch (type) {
        case 'text': {
            // the value as it is: the built-in formatter, no template - a checkbox column is no text
            const asIs =
                gridInterface.__getCellFormatter(field) === TextFormatter &&
                column?.format?.text === undefined &&
                cellOf('').type === 'text';
            if (!asIs) {
                return null;
            }
            const condition: FilterCondition = { field, operator: 'CONTAINS', value: text };
            if (caseSensitive) {
                condition.caseSensitive = true;
            }
            condition.literal = true;
            return condition;
        }
        case 'number':
            return numberCondition(ctx, field, text, cellOf, holds);
        case 'date':
        case 'datetime':
            return dateCondition(ctx, field, type, text, caseSensitive, cellOf);
        default:
            // a boolean is a checkbox: Find does not search it
            return null;
    }
}

/**
 * A lookup column: `IN` the values of its lookup whose cell text - the label, lookupColumn.ts - holds
 * the text. A text field's values are matched as they are (`caseSensitive`): the cell of another case is
 * the label of another value, or of none. Not a blank value: a blank cell is no value to pick, and
 * `'NULL'` in a list is the blank cells. Only values of the field's type, which a backend's column takes
 */
function lookupCondition(column: LookupColumn, type: FieldType, holds: (cellText: string) => boolean): FilterCondition | null {
    const values = new Set<unknown>();
    const { lookup } = column;
    for (const row of lookup.datasource.getAllData()) {
        const value = row[lookup.valueField];
        const ofType =
            type === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === 'string' && value !== '';
        if (ofType && value !== 'NULL' && !values.has(value) && holds(column.formatter.format(value))) {
            values.add(value);
        }
    }
    if (!values.size) {
        return null;
    }
    const condition: FilterCondition = { field: column.field, operator: 'IN', value: Array.from(values) };
    if (type === 'text') {
        condition.caseSensitive = true;
    }
    return condition;
}

/**
 * A number field: `EQUAL` the number the text reads as - the cell's formatter's parseFilter (else
 * parse) - when the cell of that number shows the text. `EQUAL 0` also selects the blank rows (a blank
 * number is 0): only when a blank cell shows the text too (`numberOverride: 'BLANK_TO_ZERO'`)
 * @param cellOf what a cell shows for a value
 * @param holds a cell's text holds the text
 */
function numberCondition(
    ctx: Pick<Grid, 'gridInterface'>,
    field: string,
    text: string,
    cellOf: (value: unknown) => { type: FieldType; text: string },
    holds: (cellText: string) => boolean
): FilterCondition | null {
    const formatter = ctx.gridInterface.__getCellFormatter(field);
    const value = formatter.parseFilter ? formatter.parseFilter(text) : formatter.parse(text);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    const shows = (of: unknown) => {
        const cell = cellOf(of);
        return cell.type === 'number' && holds(String(cell.text ?? ''));
    };
    if (!shows(value) || (value === 0 && !shows(null))) {
        return null;
    }
    return { field, operator: 'EQUAL', value };
}

/**
 * A date or datetime field: `EQUAL` the day (`date`) or second (`datetime`) the text reads as - the
 * cell's formatter's parseFilter (else parse) - when its cell shows all of the text, from the start of
 * the day (second) to its end: every row the condition selects shows that text. Not when the text is a
 * part of what a cell shows: the formatter makes a day of `2026-03` too, the current one
 * @param cellOf what a cell shows for a value
 */
function dateCondition(
    ctx: Pick<Grid, 'gridInterface'>,
    field: string,
    type: 'date' | 'datetime',
    text: string,
    caseSensitive: boolean,
    cellOf: (value: unknown) => { type: FieldType; text: string }
): FilterCondition | null {
    const formatter = ctx.gridInterface.__getCellFormatter(field);
    const parsed = formatter.parseFilter ? formatter.parseFilter(text) : formatter.parse(text);
    if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
        return null;
    }
    const start =
        type === 'date'
            ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
            : new Date(Math.floor(parsed.getTime() / 1000) * 1000);
    const end =
        type === 'date'
            ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59, 999)
            : new Date(start.getTime() + 999);
    const shows = (of: Date) => {
        const cell = cellOf(of);
        return cell.type === type && findCase(String(cell.text ?? ''), caseSensitive) === findCase(text, caseSensitive);
    };
    if (!shows(start) || !shows(end)) {
        return null;
    }
    return { field, operator: 'EQUAL', value: start };
}
