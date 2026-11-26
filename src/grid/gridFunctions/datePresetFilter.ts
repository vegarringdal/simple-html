import { where } from '../../datasource/filterExpression';
import type { TextId } from '../../texts';
import {
    type DatePreset,
    DEFAULT_DATE_PRESETS,
    datePresetRange,
    isDatePreset,
    takesDatePresets,
    weekStartOf
} from '../datePresets';
import type { Grid } from '../grid';
import { headerFilterType, headerOperators } from './columnFilterOptions';
import { withColumnConditions } from './filterCallback';
import { getHeaderFilterOperator } from './getHeaderFilterOperator';
import { gridText } from './gridText';
import { keepHeaderFilterFocus, operatorPicked } from './headerOperatorMenu';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';

/**
 * Quick date filters in the grid (datePresets.ts has the days): which a column offers, their names, a
 * column filtered on one, and the refresh when the day changed. The filter menu's buttons are in
 * datePresetBlock.ts.
 *
 * A quick date is the header filter's: `GridState.headerFilters[field]` keeps it (`datePreset`) with the
 * operator `BETWEEN` and the `[from, to]` it was computed to, and the cell shows its name. The filter
 * the datasource holds is a plain `BETWEEN` of the days - the footer's chip shows the name again
 * (rebuildFooter.ts), toSqlWhere never sees it.
 */

/** the text of each quick date: its name in the menu, the header filter cell and the footer's chip */
export const DATE_PRESET_TEXTS: Readonly<Record<DatePreset, TextId>> = {
    today: 'filter.dates.today',
    yesterday: 'filter.dates.yesterday',
    thisWeek: 'filter.dates.thisWeek',
    lastWeek: 'filter.dates.lastWeek',
    thisMonth: 'filter.dates.thisMonth',
    lastMonth: 'filter.dates.lastMonth',
    thisQuarter: 'filter.dates.thisQuarter',
    lastQuarter: 'filter.dates.lastQuarter',
    thisYear: 'filter.dates.thisYear',
    lastYear: 'filter.dates.lastYear',
    last7Days: 'filter.dates.last7Days',
    last30Days: 'filter.dates.last30Days',
    next7Days: 'filter.dates.next7Days',
    overdue: 'filter.dates.overdue'
};

/** the name of a quick date, as the grid's texts have it: `This month` */
export function datePresetName(ctx: Grid, preset: DatePreset): string {
    return gridText(ctx, DATE_PRESET_TEXTS[preset]);
}

/**
 * true when a column's header filter can be a quick date: a date or datetime field, not a lookup
 * column, whose header filter offers `BETWEEN` (takesDatePresets)
 */
export function canFilterOnDatePresets(ctx: Grid, field: string): boolean {
    const type = headerFilterType(ctx.gridInterface, field);
    // a date is never a LOB: no clobType
    return takesDatePresets(type, headerOperators(ctx.gridInterface.__getGridConfig().columns[field], type, false));
}

/**
 * The quick dates a column's filter menu offers, in its order: its `datePresets`, else every one but
 * Overdue (DEFAULT_DATE_PRESETS); none for `false` and for a column that can not take them
 */
export function offeredDatePresets(ctx: Grid, field: string): DatePreset[] {
    if (!canFilterOnDatePresets(ctx, field)) {
        return [];
    }
    const own = ctx.gridInterface.__getGridConfig().columns[field]?.datePresets;
    if (own === undefined) {
        return [...DEFAULT_DATE_PRESETS];
    }
    return Array.isArray(own) ? own.filter(isDatePreset) : [];
}

/** the quick date a column's header filter filters on now, undefined for none */
export function activeDatePreset(ctx: Grid, field: string): DatePreset | undefined {
    return ctx.gridInterface.__getHeaderFilter(field)?.datePreset;
}

/**
 * The `[from, to]` of a quick date on a column today: the days of its field's type - a `datetime`'s To
 * at 23:59:59, Overdue's start open (datePresetRange). The week starts on the date picker's `weekStart`
 */
export function datePresetRangeOf(ctx: Grid, field: string, preset: DatePreset): [Date | null, Date] {
    const config = ctx.gridInterface.__getGridConfig();
    const type = ctx.gridInterface.getDatasource().getField(field).type;
    return datePresetRange(preset, type, new Date(), weekStartOf(config.datePickerConfig));
}

/**
 * The quick date whose name a text is - ignoring case and the spaces around it - of those the column
 * offers and the one it filters on: the cell shows the name, Enter on it (or the name typed, `today`)
 * is the quick date again. null for any other text
 */
export function datePresetOfText(ctx: Grid, field: string, text: string): DatePreset | null {
    const typed = text.trim().toLowerCase();
    if (typed === '' || !canFilterOnDatePresets(ctx, field)) {
        return null;
    }
    const active = activeDatePreset(ctx, field);
    const candidates = active ? [active, ...offeredDatePresets(ctx, field)] : offeredDatePresets(ctx, field);
    return candidates.find((preset) => datePresetName(ctx, preset).toLowerCase() === typed) ?? null;
}

/**
 * For filterCallback: the quick date to filter on instead of `value`, null for none -
 * - the name of a quick date typed or left in the cell (datePresetOfText)
 * - the header filter's own value run again - another operator picked, Match case, a display format
 *   changed - while it is a quick date and the operator stays `BETWEEN`: the quick date again, from today
 * @param value what filterCallback was given: text typed, or the state's value
 * @param fromList the filter menu's value list: never a quick date
 */
export function datePresetToRun(ctx: Grid, field: string, value: unknown, fromList: boolean): DatePreset | null {
    if (fromList) {
        return null;
    }
    if (typeof value === 'string') {
        return datePresetOfText(ctx, field, value);
    }
    const active = activeDatePreset(ctx, field);
    if (value !== null && value !== undefined && active && getHeaderFilterOperator(ctx, field) === 'BETWEEN') {
        return canFilterOnDatePresets(ctx, field) ? active : null;
    }
    return null;
}

/**
 * Filters a column on a quick date, from today: its `BETWEEN` of the days replaces the column's
 * conditions - as a value typed in the header filter does, the rest of the filter is kept - and the
 * header filter keeps the quick date (`datePreset`, the operator `BETWEEN`, the `[from, to]`). The header
 * is rendered again - the cell shows the name, the indicator Between - the header filter that had the
 * focus keeps it. When the operator was another one, the grid sends `filter-operator-change`, as the
 * range block's Apply does
 */
export function filterOnDatePreset(ctx: Grid, field: string, preset: DatePreset) {
    const datasource = ctx.gridInterface.getDatasource();
    const range = datePresetRangeOf(ctx, field, preset);
    const changed = getHeaderFilterOperator(ctx, field) !== 'BETWEEN';
    const refocus = keepHeaderFilterFocus(ctx);

    ctx.gridInterface.__setHeaderFilterDatePreset(field, preset, range);
    datasource.filter(withColumnConditions(datasource.getFilter(), field, [where(field, 'BETWEEN', range)]));
    rebuildHeaderColumns(ctx);
    if (changed) {
        operatorPicked(ctx, field, 'BETWEEN');
    }
    refocus();
}

/**
 * A day can end while the page is open: the quick dates are computed again
 * (`gridInterface.refreshDatePresets()`, it filters only when their days changed) when the window gets
 * the focus back and when the page is shown again - the user coming back to it the next morning. The
 * listeners are on the window and the document: removed with `ctx.datePresetListenersAbort` when the grid
 * leaves the page (disconnectElement), as the menus' are
 */
export function addDatePresetListeners(ctx: Grid) {
    // called again when the grid is put back in the dom, never add them twice
    ctx.datePresetListenersAbort?.abort();
    ctx.datePresetListenersAbort = new AbortController();
    const signal = ctx.datePresetListenersAbort.signal;
    const refresh = () => ctx.gridInterface?.refreshDatePresets();

    window.addEventListener('focus', refresh, { signal });
    document.addEventListener(
        'visibilitychange',
        () => {
            if (document.visibilityState === 'visible') {
                refresh();
            }
        },
        { signal }
    );
}
