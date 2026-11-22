import type { Entity } from './entity';
import type { FieldType } from './field';
import type { FilterOperator } from './filterExpression';
import { isBlank } from './isBlank';

/**
 * @internal
 * one complete condition as objectFilter tests it: the value to compare with is resolved already
 * (a `valueField` read from the row), and `type` is the field's type from the datasource. Not `IN` /
 * `NOT_IN` and `BETWEEN`, the filter tests those itself (filter.ts)
 */
export interface ResolvedCondition {
    field: string;
    operator: FilterOperator;
    value: unknown;
    type: FieldType;
    /** `true`: a text is compared as it is, see FilterCondition.caseSensitive. Used by text only */
    caseSensitive?: boolean;
}

/**
 * @internal
 * tests one row against one condition.
 * `filter.type` is the field type: a `date` compares on the day (the time is ignored on both the row
 * value and the filter value), a `datetime` on the full timestamp (milliseconds ignored). A number
 * value compares as a number and a Date as a date, whatever the type. The rules are in the filtering
 * guide, "Operators"
 */
export function objectFilter(rowData: Entity, filter: ResolvedCondition) {
    let result = true;

    // vars
    let rowValue: any;
    let filterValue: any;
    let filterOperator: FilterOperator = filter.operator;
    let type: FieldType = filter.type;

    if (filter.value instanceof Date && type !== 'datetime') {
        // little chance someone sends in date if they do not want to query for it
        type = 'date';
    }

    if (Number(filter.value) === filter.value) {
        type = 'number';
    }

    const isDate = type === 'date' || type === 'datetime';

    rowValue = rowData[filter.field];

    // if is blank or is not blank then just check right away
    if ('IS_BLANK' === filterOperator) {
        if (isDate) {
            if (rowValue && typeof rowValue === 'object' && rowValue.toString && rowValue.toString() === 'Invalid Date') {
                return true;
            }
        }

        if (rowValue === '' || rowValue === 0 || rowValue === null || rowValue === undefined) {
            return true;
        } else {
            return false;
        }
    }

    if ('IS_NOT_BLANK' === filterOperator) {
        if (isDate) {
            if (rowValue && typeof rowValue === 'object' && rowValue.toString && rowValue.toString() === 'Invalid Date') {
                return false;
            }
        }
        if (rowValue === '' || rowValue === 0 || rowValue === null || rowValue === undefined) {
            return false;
        } else {
            return true;
        }
    }

    // lets set some defaults/corrections if its all wrong
    switch (type) {
        case 'date':
        case 'datetime':
            rowValue = toFilterTime(rowValue, type === 'date');
            filterValue = toFilterTime(filter.value, type === 'date');
            filterOperator = rangeOperator(filterOperator);

            // a blank row date is not on, before or after any date, it only matches NOT_EQUAL_TO.
            // Checked after the remapping above, so END_WITH, DOES_NOT_CONTAIN etc. follow the same rule
            if (Number.isNaN(rowValue)) {
                return filterOperator === 'NOT_EQUAL_TO';
            }

            break;
        case 'number':
            filterValue = Number(filter.value);
            if (!filterValue) {
                // needs to be 0
                filterValue = 0;
            }
            try {
                rowValue = Number.isNaN(Number(rowValue)) ? 0 : Number(rowValue);
            } catch {
                // conversion failed, keep rowValue as it was
            }
            filterOperator = rangeOperator(filterOperator);
            break;
        case 'text':
            return compareText(rowValue, filter.value, filterOperator, filter.caseSensitive === true);
        case 'boolean':
            // a blank is false (see "0 is blank" on FilterOperator): the cell shows it unchecked
            rowValue = rowValue === '' || rowValue === 0 || rowValue === null || rowValue === undefined ? false : rowValue;
            filterValue = filter.value;
            // a boolean has EQUAL and NOT_EQUAL_TO, anything else compares as EQUAL (as v5 did)
            filterOperator = filterOperator === 'NOT_EQUAL_TO' ? 'NOT_EQUAL_TO' : 'EQUAL';
            break;
    }

    // filter from what operator used
    switch (filterOperator) {
        case 'EQUAL':
            if (rowValue !== filterValue) {
                result = false;
            }
            break;
        case 'LESS_THAN_OR_EQUAL_TO':
            if (!(rowValue <= filterValue)) {
                result = false;
            }
            break;
        case 'GREATER_THAN_OR_EQUAL_TO':
            if (!(rowValue >= filterValue)) {
                result = false;
            }
            break;
        case 'LESS_THAN':
            if (!(rowValue < filterValue)) {
                result = false;
            }
            break;
        case 'GREATER_THAN':
            if (!(rowValue > filterValue)) {
                result = false;
            }
            break;
        case 'NOT_EQUAL_TO':
            if (rowValue === filterValue) {
                result = false;
            }
            break;
        default:
            if (rowValue !== filterValue) {
                result = false;
            }
    }

    return result;
}

/**
 * @internal
 * The operator a number or a date compares with: the text operators a number or date field does not
 * offer are taken as before (v5) - `CONTAINS` and `BEGIN_WITH` (and any other) as
 * `GREATER_THAN_OR_EQUAL_TO`, `END_WITH` as `LESS_THAN_OR_EQUAL_TO`, `DOES_NOT_CONTAIN` as `LESS_THAN`.
 * toSqlWhere (src/sql) uses it too, so the SQL takes them the same way
 */
export function rangeOperator(operator: FilterOperator): FilterOperator {
    switch (operator) {
        case 'EQUAL':
        case 'NOT_EQUAL_TO':
        case 'LESS_THAN':
        case 'LESS_THAN_OR_EQUAL_TO':
        case 'GREATER_THAN':
        case 'GREATER_THAN_OR_EQUAL_TO':
            return operator;
        case 'END_WITH':
            return 'LESS_THAN_OR_EQUAL_TO';
        case 'DOES_NOT_CONTAIN':
            return 'LESS_THAN';
        default:
            return 'GREATER_THAN_OR_EQUAL_TO';
    }
}

/**
 * A text condition. The row value as text - a blank (null, undefined) is `''`, anything else
 * `String(value)` - and the value as text, both in lower case unless `caseSensitive`. `*` and `%` in
 * the value are wildcards: any text, none too, line breaks too. `_` is one character, any - as in SQL
 * `LIKE`. The rest of the value is taken as it is, there is no escape. The text `LESS_THAN` ... (a
 * text field does not offer them) compare the two texts as JavaScript does, code unit by code unit,
 * without wildcards
 */
function compareText(rowValue: unknown, value: unknown, operator: FilterOperator, caseSensitive: boolean): boolean {
    const asText = (from: unknown) => {
        const text = from === null || from === undefined ? '' : String(from);
        return caseSensitive ? text : text.toLowerCase();
    };
    const row = asText(rowValue);
    const text = asText(value);

    switch (operator) {
        case 'NOT_EQUAL_TO':
            return !matchesText(row, text, true, true);
        case 'CONTAINS':
            return matchesText(row, text, false, false);
        case 'DOES_NOT_CONTAIN':
            return !matchesText(row, text, false, false);
        case 'BEGIN_WITH':
            return matchesText(row, text, true, false);
        case 'END_WITH':
            return matchesText(row, text, false, true);
        case 'LESS_THAN':
            return row < text;
        case 'LESS_THAN_OR_EQUAL_TO':
            return row <= text;
        case 'GREATER_THAN':
            return row > text;
        case 'GREATER_THAN_OR_EQUAL_TO':
            return row >= text;
        default:
            // EQUAL, and an operator of plain js that is none
            return matchesText(row, text, true, true);
    }
}

/**
 * true when `row` has `text` in it, `*` and `%` in `text` standing for any text, `_` for one character
 * (`s`: line breaks too; `u`: a letter past U+FFFF - an emoji - is one character, as in SQL).
 * `fromStart`: at the start of `row`, `toEnd`: at its end - both: the whole of `row`
 */
function matchesText(row: string, text: string, fromStart: boolean, toEnd: boolean): boolean {
    const pattern = text
        .replace(/[.^$+?()[\]{}\\|]/g, '\\$&')
        .replace(/[*%]/g, '.*')
        .replace(/_/g, '.');
    return new RegExp(`${fromStart ? '^' : ''}${pattern}${toEnd ? '$' : ''}`, 'su').test(row);
}

/**
 * the timestamp a date condition compares, milliseconds always dropped and the time too if dateOnly.
 * NaN for a blank (null, undefined, '', invalid Date) or anything else that is not a date.
 */
function toFilterTime(value: any, dateOnly: boolean): number {
    // checked first, new Date(null) would be the epoch
    if (isBlank(value)) {
        return Number.NaN;
    }
    const date = new Date(value);
    // an unreadable value gives an invalid date, and every part of it below is NaN
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        dateOnly ? 0 : date.getHours(),
        dateOnly ? 0 : date.getMinutes(),
        dateOnly ? 0 : date.getSeconds(),
        0
    ).getTime();
}
