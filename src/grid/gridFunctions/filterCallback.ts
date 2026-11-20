import { and, type FilterExpression, type FilterGroup, isFilterGroup, where } from '../../datasource/filterExpression';
import { parseFilterText } from '../../datasource/formatter';
import type { Grid } from '../grid';
import type { Attribute } from '../gridConfig';

/**
 * filters columns
 * used by header filters
 * @param value what the user typed, or the column's current filter value (a Date or number) when the
 * filter is run again with another operator - that is formatted first, the formatter parses text only
 */
export function filterCallback(
    ctx: Grid,
    value: string | number | Date | boolean | null | undefined,
    col: Attribute,
    filterArray?: unknown[] | null,
    filterArrayAndValue?: string | null,
    notinArray?: boolean
) {
    const datasource = ctx.gridInterface.getDatasource();
    const { type, formatter } = datasource.getField(col.attribute);
    const text = typeof value === 'string' ? value : formatter.format(value);

    switch (type) {
        case 'date':
        case 'datetime':
        case 'number':
            col.currentFilterValue = text === '' ? null : asFilterValue(parseFilterText(formatter, text));

            break;
        case 'boolean':
            // the header checkbox: 'true', 'false' or '' for no filter. Not parsed, it is not typed text
            col.currentFilterValue = text === 'true' ? true : text === 'false' ? false : null;

            break;
        default:
            col.currentFilterValue = filterArrayAndValue ? filterArrayAndValue : value;
    }

    /**
     * A header filter only owns the top level conditions on its own column. Those are replaced,
     * everything else in the filter - other columns, nested groups, ranges from the filter
     * editor - is left exactly as it was.
     */
    const filter = filterWithoutColumn(datasource.getFilter(), col.attribute);

    // no type on the condition, the datasource reads it from its fields
    if (filterArrayAndValue) {
        // search text from the value list menu, always a contains
        filter.children.push(where(col.attribute, 'CONTAINS', filterArrayAndValue));
    } else if (col.currentFilterValue !== null && col.currentFilterValue !== undefined && col.currentFilterValue !== '') {
        filter.children.push(where(col.attribute, col.operator || datasource.getFilterFromType(type), col.currentFilterValue));
    }

    if (filterArray) {
        filter.children.push(where(col.attribute, notinArray ? 'NOT_IN' : 'IN', filterArray));
    }

    if (filterArray && !filterArrayAndValue) {
        // we need to clear the value so it does not show
        col.currentFilterValue = '';
    }

    datasource.filter(filter);
}

/**
 * what a formatter gave, as a value the column can hold as its filter value - anything else is no filter
 */
function asFilterValue(value: unknown): Attribute['currentFilterValue'] {
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
