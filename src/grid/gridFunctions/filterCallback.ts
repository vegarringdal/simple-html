import {
    and,
    type FilterCondition,
    type FilterExpression,
    type FilterGroup,
    isFilterGroup,
    where
} from '../../datasource/filterExpression';
import { type Formatter, parseFilterText } from '../../datasource/formatter';
import { isBlank } from '../../datasource/isBlank';
import { dateConditions, isOutsidePeriod } from '../filterAsShown';
import type { Grid } from '../grid';
import { datePresetToRun, filterOnDatePreset } from './datePresetFilter';
import { getHeaderFilterOperator, isHeaderFilterCaseSensitive } from './getHeaderFilterOperator';
import { asShownDateFormat, headerFilterFormatter } from './headerFilterFormatter';
import { valuesWithLabel } from './lookupColumn';

/**
 * filters columns
 * used by header filters. Stores what the header filter cell shows (`GridState.headerFilters`) and
 * replaces the column's conditions in the datasource's filter. A header filter that matches case
 * (isHeaderFilterCaseSensitive) gives its conditions `caseSensitive: true`.
 *
 * A column that filters as shown (headerFilterFormatter.ts, filterAsShown.ts) reads the text as its cells
 * show it - `2026-W47`, `1 234,5` - and stores the value as before: a date the start of the period typed.
 * Its conditions are of the whole period (dateConditions): `= 2026-W47` is a BETWEEN of Monday and Sunday
 *
 * A quick date (datePresetFilter.ts) - the name of one typed or left in the cell (`This month`), or the
 * header filter's own value run again while it is one and the operator stays Between - filters on the
 * quick date again, its days from today (filterOnDatePreset). Any other value replaces the quick date
 * @param value what the user typed, or the column's current header filter value (a Date or number, the
 * `[from, to]` of a BETWEEN) when the filter is run again with another operator or "Match case" - that
 * is formatted first, the formatter parses text only
 * @param field the column's field
 * @param filterArray the values of the filter menu's value list (contextmenuFilter.ts): an `IN` of them,
 * or a `NOT_IN` with `notinArray`. The header filter cell is emptied then, a list is nothing it can show
 */
export function filterCallback(ctx: Grid, value: unknown, field: string, filterArray?: unknown[] | null, notinArray?: boolean) {
    const preset = datePresetToRun(ctx, field, value, !!filterArray);
    if (preset) {
        filterOnDatePreset(ctx, field, preset);
        return;
    }
    const datasource = ctx.gridInterface.getDatasource();
    const { type } = datasource.getField(field);
    // the field's formatter, or the one of the display format when the column filters as shown
    const formatter = headerFilterFormatter(ctx, field, ctx.gridInterface.__getColumnFormat(field));
    const operator = getHeaderFilterOperator(ctx, field);
    // the [from, to] of a BETWEEN run again with another operator: its first end
    const single = Array.isArray(value) && operator !== 'BETWEEN' ? (isBlank(value[0]) ? value[1] : value[0]) : value;
    // what was typed is parsed as it is, a value of the state is formatted first
    const text = typeof single === 'string' ? single : headerFilterText(single, formatter);
    // a lookup column (ColumnConfig.editor) shows labels: the text typed finds the lookup rows whose
    // label matches, the rows are filtered on their values - a text filter, also for a number field
    const lookupColumn = ctx.gridInterface.__getLookupColumn(field);

    let filterValue: unknown;
    switch (lookupColumn ? 'text' : type) {
        case 'date':
        case 'datetime':
        case 'number':
            if (operator === 'BETWEEN') {
                filterValue = parseRangeText(formatter, text);
            } else {
                filterValue = text === '' ? null : asFilterValue(parseFilterText(formatter, text));
            }

            break;
        case 'boolean':
            // the header checkbox: 'true', 'false' or '' for no filter. Not parsed, it is not typed text
            filterValue = text === 'true' ? true : text === 'false' ? false : null;

            break;
        default:
            filterValue = value;
    }

    /**
     * A header filter only owns the top level conditions on its own column. Those are replaced,
     * everything else in the filter - other columns, nested groups, ranges from the filter
     * editor - is left exactly as it was.
     */
    const filter = filterWithoutColumn(datasource.getFilter(), field);

    // the header's operators take a typed value (isHeaderOperator), a lookup column's text ones
    const byLabel = lookupColumn && typeof filterValue === 'string';
    // "Match case": the column's filterCaseSensitive or its menu's toggle, a text column only
    const caseSensitive = isHeaderFilterCaseSensitive(ctx, field);
    const options = { caseSensitive };

    // a date filtered as shown: the conditions of the whole period typed (not a lookup column, it is text)
    const asShownDate = lookupColumn ? null : asShownDateFormat(ctx, field);

    // no type on the condition, the datasource reads it from its fields
    if (filterValue !== null && filterValue !== undefined && filterValue !== '') {
        if (byLabel) {
            filter.children.push(
                where(field, 'IN', valuesWithLabel(lookupColumn, operator, String(filterValue), caseSensitive), options)
            );
        } else if (asShownDate) {
            filter.children.push(
                ...dateConditions(field, operator, filterValue, type, asShownDate.format, asShownDate.texts, new Date())
            );
        } else {
            filter.children.push(where(field, operator, filterValue, options));
        }
    }

    if (filterArray) {
        filter.children.push(where(field, notinArray ? 'NOT_IN' : 'IN', filterArray, options));
    }

    // a value list: the cell is cleared, the list is not something it can show
    ctx.gridInterface.__setHeaderFilterValue(field, filterArray ? null : filterValue);

    datasource.filter(filter);
}

/**
 * The text of a header filter's value, as its input shows it: the formatter's text, the two ends of a
 * BETWEEN's `[from, to]` with `..` between them (an open end is no text: `10..`)
 */
export function headerFilterText(value: unknown, formatter: Formatter): string {
    if (Array.isArray(value)) {
        return value.map((end) => (isBlank(end) ? '' : formatter.format(end))).join('..');
    }
    return formatter.format(value);
}

/**
 * The `[from, to]` of a BETWEEN typed in a header filter: `from..to`, each end parsed with the
 * formatter (parseFilter, as a single value is). An end left out is open, null: `10..` is 10 or more,
 * `..20` 20 or less. A text without `..` is both ends: `10` is 10 to 10, a date the whole day. null when
 * neither end is a value: no condition
 */
export function parseRangeText(formatter: Formatter, text: string): [unknown, unknown] | null {
    const at = text.indexOf('..');
    const ends = at === -1 ? [text, text] : [text.slice(0, at), text.slice(at + 2)];
    const [from, to] = ends.map((end) => (end.trim() === '' ? null : asFilterValue(parseFilterText(formatter, end.trim()))));
    return isBlank(from) && isBlank(to) ? null : [from, to];
}

/**
 * what a formatter gave, as a value the header filter can hold - anything else is no filter
 */
function asFilterValue(value: unknown): string | number | boolean | Date | null {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
        return value;
    }
    return null;
}

/**
 * The conditions a column's header filter owns in a filter: the top level conditions on the column - of
 * an AND group, or the filter itself when it is one condition on the column (see filterWithoutColumn) -
 * and those of the OR group of a `≠` filtered as shown (isOutsidePeriod). [] for none, and for an OR
 * root: a header filter never writes into one
 */
export function columnConditions(filter: FilterExpression | null, field: string): FilterCondition[] {
    if (!filter) {
        return [];
    }
    if (isFilterGroup(filter)) {
        if (filter.group === 'OR') {
            return isOutsidePeriod(filter, field) ? (filter.children as FilterCondition[]) : [];
        }
        return filter.children.flatMap((child): FilterCondition[] => {
            if (isFilterGroup(child)) {
                return isOutsidePeriod(child, field) ? (child.children as FilterCondition[]) : [];
            }
            return child.field === field ? [child] : [];
        });
    }
    return filter.field === field ? [filter] : [];
}

/**
 * true when two lists of conditions are the same: the fields, operators, `valueField`s, values - a
 * date by its time, a list value by its items - and `caseSensitive`
 */
export function sameConditions(a: FilterCondition[], b: FilterCondition[]): boolean {
    const sameValue = (x: unknown, y: unknown): boolean => {
        if (x instanceof Date && y instanceof Date) {
            return x.getTime() === y.getTime();
        }
        if (Array.isArray(x) && Array.isArray(y)) {
            return x.length === y.length && x.every((item, i) => sameValue(item, y[i]));
        }
        return x === y;
    };
    return (
        a.length === b.length &&
        a.every(
            (condition, i) =>
                condition.field === b[i].field &&
                condition.operator === b[i].operator &&
                condition.valueField === b[i].valueField &&
                (condition.caseSensitive === true) === (b[i].caseSensitive === true) &&
                sameValue(condition.value, b[i].value)
        )
    );
}

/**
 * A copy of the filter with `conditions` as the column's own, as a header filter makes them: the
 * column's top level conditions replaced (filterWithoutColumn), the rest kept. For a quick date
 * (datePresetFilter.ts) and a state that has one (GridInterface)
 */
export function withColumnConditions(filter: FilterExpression | null, field: string, conditions: FilterCondition[]): FilterGroup {
    const group = filterWithoutColumn(filter, field);
    group.children.push(...conditions);
    return group;
}

/**
 * The filter a header condition is added to: an AND group without the column's own top level
 * conditions, a copy - the old filter is still the one the datasource holds.
 * An OR root is kept whole inside a new AND group - AND(OR group, header condition) - so typing
 * in a header narrows a filter built in the filter editor instead of throwing it away. So is a
 * single condition at the root, unless it is on this column: then it is the column's own. The OR
 * group of a `≠` filtered as shown (isOutsidePeriod) is the column's own too.
 */
function filterWithoutColumn(oldFilter: FilterExpression | null, attribute: string): FilterGroup {
    if (!oldFilter) {
        return and();
    }

    if (isFilterGroup(oldFilter)) {
        if (isOutsidePeriod(oldFilter, attribute)) {
            return and();
        }
        // anything but OR is AND, as the filter runs it
        if (oldFilter.group !== 'OR') {
            return and(
                ...oldFilter.children.filter((child) =>
                    isFilterGroup(child) ? !isOutsidePeriod(child, attribute) : child.field !== attribute
                )
            );
        }
        // an empty OR group filters nothing, there is nothing to keep
        return oldFilter.children.length ? and(oldFilter) : and();
    }

    return oldFilter.field === attribute ? and() : and(oldFilter);
}
