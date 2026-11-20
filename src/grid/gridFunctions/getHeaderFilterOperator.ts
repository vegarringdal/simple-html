import type { FilterOperator } from '../../datasource/filterExpression';
import type { Grid } from '../grid';

/**
 * The operator a column's header filter uses: the one the user picked in the header filter's menu
 * (state), else the column's `operator` (config), else the default for the field's type.
 */
export function getHeaderFilterOperator(ctx: Grid, field: string): FilterOperator {
    const datasource = ctx.gridInterface.getDatasource();
    return (
        ctx.gridInterface.__getHeaderFilter(field)?.operator ||
        ctx.gridInterface.__getGridConfig().columns[field]?.operator ||
        datasource.getFilterFromType(datasource.getField(field).type)
    );
}
