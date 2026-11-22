import type { FieldType } from '../../datasource/field';
import type { FilterOperator } from '../../datasource/filterExpression';
import { type Formatter, parseFilterText } from '../../datasource/formatter';
import type { Grid } from '../grid';
import type { MenuItem } from '../gridMenus';
import { headerFilterType } from './columnFilterOptions';
import { gridText } from './gridText';

/**
 * Filter as you type: a header filter that filters while the user types, after a short pause
 * (FILTER_ON_TYPE_DELAY) - no Enter needed. Per column: the user turns it on and off in the operator
 * choice of the header filter (filterOperatorIndicator.ts), in the filter menu's Filter › (beside Match
 * case) and in the grid config dialog, next to the operator. It is state, as Match case is:
 * `GridState.headerFilters[field].filterOnType`. Left out, the column's `ColumnConfig.filterOnType`,
 * else the grid's `GridConfig.filterOnType`, else off.
 *
 * Not for a boolean column: its checkbox filters on a click. A number or date column filters only on
 * text that is a number or a date (filterTextParses): a date half typed does not filter, empty text
 * removes the filter. Enter and leaving the cell filter as before, the pause is canceled then - the text
 * is filtered on once. The rows are rendered again, the header filter keeps the focus and its caret.
 */

/** ms: the pause in typing after which the header filter filters on the text */
export const FILTER_ON_TYPE_DELAY = 300;

/**
 * The filter as you type of a column without one of the user's: the column's `filterOnType`, else the
 * grid's, else false
 */
export function defaultFilterOnType(ctx: Grid, field: string): boolean {
    const config = ctx.gridInterface.__getGridConfig();
    return config.columns[field]?.filterOnType ?? config.filterOnType ?? false;
}

/**
 * true when a column's header filter filters as you type: the user's (state,
 * `GridState.headerFilters[field].filterOnType`), else defaultFilterOnType. Never a boolean column, its
 * header filter is a checkbox
 */
export function isFilterOnType(ctx: Grid, field: string): boolean {
    if (headerFilterType(ctx.gridInterface, field) === 'boolean') {
        return false;
    }
    return ctx.gridInterface.__getHeaderFilter(field)?.filterOnType ?? defaultFilterOnType(ctx, field);
}

/**
 * Turns a column's filter as you type on or off: state, `GridState.headerFilters[field].filterOnType` -
 * left out when it is the column's default (defaultFilterOnType), so the state lists what the user
 * changed
 */
export function setFilterOnType(ctx: Grid, field: string, on: boolean) {
    ctx.gridInterface.__setHeaderFilterOnType(field, on === defaultFilterOnType(ctx, field) ? undefined : on);
}

/**
 * The toggle of filter as you type, `filter.filterOnType`: a ✓ while it is on. In the operator choice
 * (filterOperatorIndicator.ts, at its bottom) and in the filter menu's Filter ›, beside Match case. Not
 * on a boolean column
 */
export function filterOnTypeItem(ctx: Grid, field: string): MenuItem {
    const on = isFilterOnType(ctx, field);
    return {
        id: 'filter.filterOnType',
        label: gridText(ctx, 'filter.filterOnType'),
        visible: () => headerFilterType(ctx.gridInterface, field) !== 'boolean',
        selected: () => on,
        action: () => setFilterOnType(ctx, field, !on)
    };
}

/**
 * the pause running for a grid, one at a time: the header filter typed in last. A new key starts it
 * again, Enter and leaving the cell cancel it
 */
const pauses = new WeakMap<Grid, ReturnType<typeof setTimeout>>();

/**
 * Runs `filter` after a pause in typing (FILTER_ON_TYPE_DELAY): the pause typed in before is canceled
 */
export function filterAfterPause(ctx: Grid, filter: () => void) {
    cancelFilterOnType(ctx);
    pauses.set(
        ctx,
        setTimeout(() => {
            pauses.delete(ctx);
            filter();
        }, FILTER_ON_TYPE_DELAY)
    );
}

/** cancels the pause of the grid, when one is running: Enter and leaving the cell filter at once */
export function cancelFilterOnType(ctx: Grid) {
    clearTimeout(pauses.get(ctx));
    pauses.delete(ctx);
}

/**
 * true when text typed in a header filter is one to filter on while typing: empty text (no filter), any
 * text of a text column - a number column's a number (a digit in it, the formatter gives a finite
 * number), a date column's a date (the formatter gives a valid date from the year 1000 to 9999): `2026-1`
 * half typed is no date of a column filtered as shown, `202` none of the field's YYYY-MM-DD. A BETWEEN's
 * `from..to` each end that is not empty
 * @param formatter the header filter's (headerFilterFormatter)
 * @param type the type it filters as (headerFilterType)
 */
export function filterTextParses(formatter: Formatter, type: FieldType, operator: FilterOperator, text: string): boolean {
    if (type !== 'number' && type !== 'date' && type !== 'datetime') {
        return true;
    }
    const at = operator === 'BETWEEN' ? text.indexOf('..') : -1;
    const ends = at === -1 ? [text] : [text.slice(0, at), text.slice(at + 2)];
    return ends.every((end) => {
        const typed = end.trim();
        if (typed === '') {
            return true;
        }
        const value = parseFilterText(formatter, typed);
        if (type === 'number') {
            return /\d/.test(typed) && typeof value === 'number' && Number.isFinite(value);
        }
        return value instanceof Date && value.getFullYear() >= 1000 && value.getFullYear() <= 9999;
    });
}
