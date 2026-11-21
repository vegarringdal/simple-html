import type { Grid } from '../grid';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';

/**
 * Removes every filter: the filter (the header filters' conditions with it), what the header filters
 * show, and "changed rows only" (datasource.filterChangedOnly()) - every row is shown. The footer's
 * Clear and the filter menu's Clear All Filters
 */
export function clearAllColumnFilters(ctx: Grid) {
    const datasource = ctx.gridInterface.getDatasource();
    datasource.setFilter(null);
    ctx.gridInterface.__clearHeaderFilterValues();
    rebuildHeaderColumns(ctx);
    if (datasource.isChangedOnly()) {
        // runs the filter
        datasource.filterChangedOnly(false);
    } else {
        datasource.filter();
    }
}
