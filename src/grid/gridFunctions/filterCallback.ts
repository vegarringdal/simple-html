import { isFilterGroup } from '../../datasource/filter';
import type { FilterArgument } from '../../datasource/filterArgument';
import type { Grid } from '../grid';
import type { Attribute } from '../gridConfig';

/**
 * a group filter, its filterArguments always set
 */
type FilterGroup = FilterArgument & { filterArguments: FilterArgument[] };

/**
 * filters columns
 * used by header filters
 */
export function filterCallback(
    ctx: Grid,
    value: string | number | null | undefined,
    col: Attribute,
    filterArray?: any[] | null,
    filterArrayAndValue?: string | null,
    notinArray?: boolean
) {
    const valueConverter = ctx.gridInterface.getDatasource().getValueFormatter();

    switch (col.type) {
        case 'date':
            col.currentFilterValue = ctx.gridInterface
                .getDatasource()
                .getValueFormatter()
                .toFilter(value, col.type, col.attribute, true);

            break;
        case 'number':
            col.currentFilterValue = value === '' ? null : valueConverter.toFilter(value, col.type, col.attribute, true);

            break;
        case 'boolean':
            if (value === '') {
                col.currentFilterValue = null;
            }
            if (value === 'false') {
                col.currentFilterValue = valueConverter.toFilter(false, col.type, col.attribute, true);
            }
            if (value === 'true') {
                col.currentFilterValue = valueConverter.toFilter(true, col.type, col.attribute, true);
            }

            break;
        default:
            col.currentFilterValue = filterArrayAndValue ? filterArrayAndValue : value;
    }

    const datasource = ctx.gridInterface.getDatasource();

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
        attributeType: (col.type as any) || 'text',
        operator,
        value: conditionValue
    });

    if (filterArrayAndValue) {
        // search text from the value list menu, always a contains
        filter.filterArguments.push(condition('CONTAINS', filterArrayAndValue));
    } else if (col.currentFilterValue !== null && col.currentFilterValue !== undefined && col.currentFilterValue !== '') {
        // getFilterFromType gives the same for a missing type as for 'text'
        filter.filterArguments.push(
            condition(col.operator || datasource.getFilterFromType(col.type ?? 'text'), col.currentFilterValue)
        );
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
