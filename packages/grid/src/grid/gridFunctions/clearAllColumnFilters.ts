import { Grid } from '../grid';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';

export function clearAllColumnFilters(ctx: Grid) {
    const datasource = ctx.gridInterface.getDatasource();
    datasource.setFilter(null);
    const attributes = ctx.gridInterface.__getGridConfig().__attributes;
    const keys = Object.keys(attributes);
    keys.forEach((key) => {
        attributes[key].currentFilterValue = null;
    });
    rebuildHeaderColumns(ctx);
    datasource.filter();
}
