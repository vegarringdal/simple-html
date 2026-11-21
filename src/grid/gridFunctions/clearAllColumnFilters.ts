import type { Grid } from '../grid';
import { clearFindFilterRows } from './findBar';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';

/**
 * Removes every filter: the filter (the header filters' conditions with it), what the header filters
 * show, "changed rows only" (datasource.filterChangedOnly()) and Find's "Filter rows" (its toggle is
 * turned off, the find bar stays open) - every row is shown. The footer's Clear and the filter menu's
 * Clear All Filters
 */
export function clearAllColumnFilters(ctx: Grid) {
    const datasource = ctx.gridInterface.getDatasource();
    datasource.setFilter(null);
    ctx.gridInterface.__clearHeaderFilterValues();
    rebuildHeaderColumns(ctx);
    // not filtered here: once, below
    clearFindFilterRows(ctx);
    if (datasource.isChangedOnly()) {
        // runs the filter
        datasource.filterChangedOnly(false);
    } else {
        datasource.filter();
    }
}
