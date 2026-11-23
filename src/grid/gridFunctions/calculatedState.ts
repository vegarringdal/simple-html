import { type FilterExpression, isFilterGroup } from '../../datasource/filterExpression';
import type { GridLayout } from '../gridConfig';

/**
 * A calculated column that leaves the state (GridState.calculatedColumns) is no field of the rows
 * anymore: a condition on it would filter on blanks, a column of it show empty cells. The grid takes it
 * out of the filter and the layout with these (GridInterface.applyState) - and out of the sort, the
 * grouping, the header filters and the detail form there.
 */

/**
 * The filter without the conditions on these fields (a `field` or a `valueField` of them), and without
 * the groups that are empty then. null when nothing is left. The same filter when it has none
 * @param fields the fields of the calculated columns that are gone
 */
export function filterWithout(filter: FilterExpression | null, fields: ReadonlySet<string>): FilterExpression | null {
    if (!filter || !fields.size) {
        return filter;
    }
    if (isFilterGroup(filter)) {
        const children = filter.children
            .map((child) => filterWithout(child, fields))
            .filter((child): child is FilterExpression => child !== null);
        if (!children.length) {
            return null;
        }
        return children.length === filter.children.length && children.every((child, i) => child === filter.children[i])
            ? filter
            : { ...filter, children };
    }
    const uses = fields.has(filter.field) || (filter.valueField !== undefined && fields.has(filter.valueField));
    return uses ? null : filter;
}

/**
 * The layout without these fields: a column of them alone goes, a column of stacked fields keeps the
 * others. A copy
 * @param fields the fields of the calculated columns that are gone
 */
export function layoutWithout(layout: Required<GridLayout>, fields: ReadonlySet<string>): Required<GridLayout> {
    const section = (columns: GridLayout['center']) =>
        columns
            .map((column) => ({ ...column, fields: column.fields.filter((field) => !fields.has(field)) }))
            .filter((column) => column.fields.length);
    return { left: section(layout.left), center: section(layout.center), right: section(layout.right) };
}
