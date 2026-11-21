import type { FilterOperator } from '../../datasource/filterExpression';
import type { Grid } from '../grid';

/**
 * The operator a column's header filter uses: the one the user picked in the header filter's menu
 * (state), else the column's `operator` (config), else the default for the field's type - a text's for
 * a lookup column, it filters on its labels (filterCallback).
 */
export function getHeaderFilterOperator(ctx: Grid, field: string): FilterOperator {
    const datasource = ctx.gridInterface.getDatasource();
    const type = ctx.gridInterface.__getLookupColumn(field) ? 'text' : datasource.getField(field).type;
    return (
        ctx.gridInterface.__getHeaderFilter(field)?.operator ||
        ctx.gridInterface.__getGridConfig().columns[field]?.operator ||
        datasource.getFilterFromType(type)
    );
}
