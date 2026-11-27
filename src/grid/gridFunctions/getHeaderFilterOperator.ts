import type { FilterOperator } from '../../datasource/filterExpression';
import type { Grid } from '../grid';
import {
    defaultHeaderOperator,
    headerFilterType,
    headerOperators,
    isAlwaysCaseSensitive,
    isClobField
} from './columnFilterOptions';

/**
 * The operator a column's header filter uses: the one the user picked in the header filter's menu
 * (state) when the column offers it - a saved state can have one the config no longer offers - else
 * the column's `operator` (config), else the default for the field's type (defaultHeaderOperator). A
 * text's for a lookup column, it filters on its labels (filterCallback).
 */
export function getHeaderFilterOperator(ctx: Grid, field: string): FilterOperator {
    const type = headerFilterType(ctx.gridInterface, field);
    const column = ctx.gridInterface.__getGridConfig().columns[field];
    const picked = ctx.gridInterface.__getHeaderFilter(field)?.operator;
    // a field with clobType: no operator SQL can not write with LIKE
    const clob = isClobField(ctx.gridInterface, field);
    return picked && headerOperators(column, type, clob).includes(picked) ? picked : defaultHeaderOperator(column, type, clob);
}

/**
 * true when a column's header filter matches case: a text column (a lookup column too) whose
 * `filterCaseSensitive` is set, or whose field's case is locked (FieldConfig.caseSensitive), or whose "Match case" is on in its menu (state,
 * `GridState.headerFilters[field].caseSensitive`). Its conditions - the value typed, the value list -
 * get `caseSensitive: true`
 */
export function isHeaderFilterCaseSensitive(ctx: Grid, field: string): boolean {
    const type = headerFilterType(ctx.gridInterface, field);
    const column = ctx.gridInterface.__getGridConfig().columns[field];
    return (
        isAlwaysCaseSensitive(column, type, ctx.gridInterface.getDatasource().getField(field).caseSensitive) ||
        (type === 'text' && ctx.gridInterface.__getHeaderFilter(field)?.caseSensitive === true)
    );
}
