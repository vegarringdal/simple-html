import type { Grid } from '../grid';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';

export function clearAllColumnFilters(ctx: Grid) {
    const datasource = ctx.gridInterface.getDatasource();
    datasource.setFilter(null);
    ctx.gridInterface.__clearHeaderFilterValues();
    rebuildHeaderColumns(ctx);
    datasource.filter();
}
