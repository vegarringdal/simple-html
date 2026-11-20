import { isFilterGroup } from '../../datasource/filter';
import type { FilterArgument } from '../../datasource/filterArgument';
import { parseFilterText } from '../../datasource/formatter';
import type { Grid } from '../grid';
import type { Attribute } from '../gridConfig';

/**
 * a group filter, its filterArguments always set
 */
type FilterGroup = FilterArgument & { filterArguments: FilterArgument[] };

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
    filterArray?: any[] | null,
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

    const condition = (operator: FilterArgument['operator'], conditionValue: any): FilterArgument => ({
        type: 'CONDITION',
        logicalOperator: 'NONE',
        valueType: 'VALUE',
        attribute: col.attribute,
        // the datasource takes the type from its fields, this is for a filter saved and loaded elsewhere
        attributeType: type,
        operator,
        value: conditionValue
    });

    if (filterArrayAndValue) {
        // search text from the value list menu, always a contains
        filter.filterArguments.push(condition('CONTAINS', filterArrayAndValue));
    } else if (col.currentFilterValue !== null && col.currentFilterValue !== undefined && col.currentFilterValue !== '') {
        filter.filterArguments.push(condition(col.operator || datasource.getFilterFromType(type), col.currentFilterValue));
    }

    if (filterArray) {
        filter.filterArguments.push(condition(notinArray ? 'NOT_IN' : 'IN', filterArray));
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
 * conditions.
 * An OR root is kept whole inside a new AND group - AND(header condition, OR group) - so typing
 * in a header narrows a filter built in the filter editor instead of throwing it away.
 */
function filterWithoutColumn(oldFilter: FilterArgument | null, attribute: string): FilterGroup {
    // a group without logicalOperator is AND too (see Filter), only an OR root has to be kept whole
    if (oldFilter && isFilterGroup(oldFilter) && oldFilter.logicalOperator !== 'OR') {
        // copy, the old filter object is still the one the datasource holds
        return {
            ...oldFilter,
            logicalOperator: 'AND',
            filterArguments: (oldFilter.filterArguments || []).filter((arg: FilterArgument) => arg.attribute !== attribute)
        };
    }

    const filter: FilterGroup = {
        type: 'GROUP',
        logicalOperator: 'AND',
        filterArguments: []
    };

    // an OR root, or a single condition set from code on another column, is kept whole
    const keepWhole =
        oldFilter &&
        (isFilterGroup(oldFilter) ? (oldFilter.filterArguments?.length ?? 0) > 0 : oldFilter.attribute !== attribute);
    if (keepWhole) {
        filter.filterArguments.push(oldFilter);
    }

    return filter;
}
