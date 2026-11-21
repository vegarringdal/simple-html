import { and, type FilterExpression, type FilterGroup, isFilterGroup, where } from '../../datasource/filterExpression';
import { parseFilterText } from '../../datasource/formatter';
import type { Grid } from '../grid';
import { getHeaderFilterOperator } from './getHeaderFilterOperator';
import { valuesWithLabel } from './lookupColumn';

/**
 * filters columns
 * used by header filters. Stores what the header filter cell shows (`GridState.headerFilters`) and
 * replaces the column's conditions in the datasource's filter
 * @param value what the user typed, or the column's current header filter value (a Date or number) when
 * the filter is run again with another operator - that is formatted first, the formatter parses text only
 * @param field the column's field
 */
export function filterCallback(
    ctx: Grid,
    value: unknown,
    field: string,
    filterArray?: unknown[] | null,
    filterArrayAndValue?: string | null,
    notinArray?: boolean
) {
    const datasource = ctx.gridInterface.getDatasource();
    const { type, formatter } = datasource.getField(field);
    const text = typeof value === 'string' ? value : formatter.format(value);
    // a lookup column (ColumnConfig.editor) shows labels: the text typed finds the lookup rows whose
    // label matches, the rows are filtered on their values - a text filter, also for a number field
    const lookupColumn = ctx.gridInterface.__getLookupColumn(field);

    let filterValue: unknown;
    switch (lookupColumn ? 'text' : type) {
        case 'date':
        case 'datetime':
        case 'number':
            filterValue = text === '' ? null : asFilterValue(parseFilterText(formatter, text));

            break;
        case 'boolean':
            // the header checkbox: 'true', 'false' or '' for no filter. Not parsed, it is not typed text
            filterValue = text === 'true' ? true : text === 'false' ? false : null;

            break;
        default:
            filterValue = filterArrayAndValue ? filterArrayAndValue : value;
    }

    /**
     * A header filter only owns the top level conditions on its own column. Those are replaced,
     * everything else in the filter - other columns, nested groups, ranges from the filter
     * editor - is left exactly as it was.
     */
    const filter = filterWithoutColumn(datasource.getFilter(), field);

    const operator = getHeaderFilterOperator(ctx, field);
    // blank or not blank is the cell's own value, not a label
    const byLabel = lookupColumn && typeof filterValue === 'string' && operator !== 'IS_BLANK' && operator !== 'IS_NOT_BLANK';

    // no type on the condition, the datasource reads it from its fields
    if (filterArrayAndValue) {
        // search text from the value list menu, always a contains
        filter.children.push(where(field, 'CONTAINS', filterArrayAndValue));
    } else if (filterValue !== null && filterValue !== undefined && filterValue !== '') {
        filter.children.push(
            byLabel ? where(field, 'IN', valuesWithLabel(lookupColumn, operator, String(filterValue))) : where(field, operator, filterValue)
        );
    }

    if (filterArray) {
        filter.children.push(where(field, notinArray ? 'NOT_IN' : 'IN', filterArray));
    }

    // a value list without search text: the cell is cleared, the list is not something it can show
    ctx.gridInterface.__setHeaderFilterValue(field, filterArray && !filterArrayAndValue ? null : filterValue);

    datasource.filter(filter);
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
 * The filter a header condition is added to: an AND group without the column's own top level
 * conditions, a copy - the old filter is still the one the datasource holds.
 * An OR root is kept whole inside a new AND group - AND(OR group, header condition) - so typing
 * in a header narrows a filter built in the filter editor instead of throwing it away. So is a
 * single condition at the root, unless it is on this column: then it is the column's own.
 */
function filterWithoutColumn(oldFilter: FilterExpression | null, attribute: string): FilterGroup {
    if (!oldFilter) {
        return and();
    }

    if (isFilterGroup(oldFilter)) {
        // anything but OR is AND, as the filter runs it
        if (oldFilter.group !== 'OR') {
            return and(...oldFilter.children.filter((child) => isFilterGroup(child) || child.field !== attribute));
        }
        // an empty OR group filters nothing, there is nothing to keep
        return oldFilter.children.length ? and(oldFilter) : and();
    }

    return oldFilter.field === attribute ? and() : and(oldFilter);
}
