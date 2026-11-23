import type { FieldType } from '../datasource/field';
import type { FilterOperator } from '../datasource/filterExpression';

/**
 * Quick date filters - Today, This week, Last month ... - the pure part: which there are and the days
 * each one is on a given day. No grid here: the filter menu's block (gridFunctions/datePresetBlock.ts),
 * the header filter (filterCallback.ts) and the state (gridInterface.ts) use these.
 *
 * A quick date filter is **relative**: it is stored as itself (`GridState.headerFilters[field].datePreset`)
 * and its days are computed from today each time it filters - when it is picked, when a state is set,
 * when the grid refreshes it. The filter the datasource holds is plain: a `BETWEEN` of the days.
 */

/**
 * A quick date filter of a date or datetime column: one click in the column's filter menu, *Quick
 * dates*. Each is a range of whole days, computed from today when it filters:
 *
 * | id | the days |
 * | --- | --- |
 * | `'today'` | today |
 * | `'yesterday'` | yesterday |
 * | `'thisWeek'` | the week of today, from its first day (`datePickerConfig.weekStart`, Monday by default) for 7 days |
 * | `'lastWeek'` | the 7 days before that |
 * | `'thisMonth'` | the 1st to the last day of this month |
 * | `'lastMonth'` | the month before |
 * | `'thisQuarter'` | the quarter of today: January-March, April-June, July-September or October-December |
 * | `'lastQuarter'` | the quarter before |
 * | `'thisYear'` | 1 January to 31 December |
 * | `'lastYear'` | last year |
 * | `'last7Days'` | today and the 6 days before |
 * | `'last30Days'` | today and the 29 days before |
 * | `'next7Days'` | today and the 6 days after |
 * | `'overdue'` | every day before today (an open start) - not offered unless a column lists it, see `ColumnConfig.datePresets` |
 *
 * @sample filtering
 * @example
 * ```ts
 * import type { DatePreset, GridState } from '@simple-html/grid';
 *
 * const preset: DatePreset = 'thisMonth';
 * // a saved state with it filters on the month it is set in, not the month it was saved in
 * const headerFilters: GridState['headerFilters'] = { orderDate: { value: null, datePreset: preset } };
 * gridInterface.setState({ headerFilters });
 * ```
 */
export type DatePreset =
    | 'today'
    | 'yesterday'
    | 'thisWeek'
    | 'lastWeek'
    | 'thisMonth'
    | 'lastMonth'
    | 'thisQuarter'
    | 'lastQuarter'
    | 'thisYear'
    | 'lastYear'
    | 'last7Days'
    | 'last30Days'
    | 'next7Days'
    | 'overdue';

/**
 * Every quick date filter, in the order of the filter menu: in pairs, this one and the one before -
 * the menu shows them in two columns. See {@link DatePreset}.
 *
 * @example
 * ```ts
 * import { DATE_PRESETS, type GridConfig } from '@simple-html/grid';
 *
 * // every quick date filter on the due date, Overdue too
 * const config: GridConfig = {
 *     columns: { dueDate: { datePresets: [...DATE_PRESETS] } },
 *     layout: { center: [{ fields: ['dueDate'], width: 110 }] }
 * };
 * ```
 */
export const DATE_PRESETS: readonly DatePreset[] = Object.freeze([
    'today',
    'yesterday',
    'thisWeek',
    'lastWeek',
    'thisMonth',
    'lastMonth',
    'thisQuarter',
    'lastQuarter',
    'thisYear',
    'lastYear',
    'last7Days',
    'last30Days',
    'next7Days',
    'overdue'
] as const);

/**
 * @internal
 * The quick date filters a date column offers when its `datePresets` is left out: all of them but
 * Overdue - "before today" only means something on a due date
 */
export const DEFAULT_DATE_PRESETS: readonly DatePreset[] = Object.freeze(DATE_PRESETS.filter((id) => id !== 'overdue'));

/**
 * @internal
 * true for the id of a quick date filter: a state from JSON can hold anything
 */
export function isDatePreset(value: unknown): value is DatePreset {
    return typeof value === 'string' && (DATE_PRESETS as readonly string[]).includes(value);
}

/**
 * @internal
 * true when a column can filter on quick dates: a date or datetime field - not a lookup column, it
 * filters as text (pass its header type) - whose header filter offers `BETWEEN`, the operator a quick
 * date is
 * @param type the type the header filter filters as (headerFilterType)
 * @param operators the column's operators of the header filter (headerOperators)
 */
export function takesDatePresets(type: FieldType, operators: readonly FilterOperator[]): boolean {
    return (type === 'date' || type === 'datetime') && operators.includes('BETWEEN');
}

/**
 * @internal
 * The first day of the week, 0 Sunday ... 6 Saturday: the date picker's `weekStart` (as
 * contextmenuDate.ts reads it, Monday by default), so "This week" is the week the picker shows
 */
export function weekStartOf(datePickerConfig: { weekStart?: number } | undefined): number {
    const start = datePickerConfig?.weekStart;
    return typeof start === 'number' && Number.isInteger(start) ? ((start % 7) + 7) % 7 : 1;
}

/**
 * @internal
 * The days of a quick date filter on the day `now` is in: the first and the last, at 00:00 in the
 * browser's time zone (new Dates). The first is null for an open start: Overdue is every day before
 * today. Days are made from their year, month and day - `new Date(y, m, d)` - so a change of summer
 * time is no hour off, and a day past the end of a month is the next month's
 * @param weekStart the first day of the week, see weekStartOf
 */
export function datePresetDays(preset: DatePreset, now: Date, weekStart: number): [Date | null, Date] {
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();
    const day = (offset: number) => new Date(year, month, date + offset);
    // the days of today's week before today: 0 on its first day
    const intoWeek = (now.getDay() - weekStart + 7) % 7;
    // the first month of today's quarter: 0, 3, 6 or 9
    const quarter = month - (month % 3);

    switch (preset) {
        case 'today':
            return [day(0), day(0)];
        case 'yesterday':
            return [day(-1), day(-1)];
        case 'thisWeek':
            return [day(-intoWeek), day(6 - intoWeek)];
        case 'lastWeek':
            return [day(-intoWeek - 7), day(-intoWeek - 1)];
        case 'thisMonth':
            // day 0 of the next month is the last of this one
            return [new Date(year, month, 1), new Date(year, month + 1, 0)];
        case 'lastMonth':
            return [new Date(year, month - 1, 1), new Date(year, month, 0)];
        case 'thisQuarter':
            return [new Date(year, quarter, 1), new Date(year, quarter + 3, 0)];
        case 'lastQuarter':
            return [new Date(year, quarter - 3, 1), new Date(year, quarter, 0)];
        case 'thisYear':
            return [new Date(year, 0, 1), new Date(year, 11, 31)];
        case 'lastYear':
            return [new Date(year - 1, 0, 1), new Date(year - 1, 11, 31)];
        case 'last7Days':
            return [day(-6), day(0)];
        case 'last30Days':
            return [day(-29), day(0)];
        case 'next7Days':
            return [day(0), day(6)];
        case 'overdue':
            return [null, day(-1)];
    }
}

/**
 * @internal
 * The `[from, to]` a quick date filter filters a field on, on the day `now` is in: the value of its
 * `BETWEEN` and of the header filter. A `date` field the days at 00:00 (it compares the day); a
 * `datetime` field from 00:00:00 of the first day to 23:59:59 of the last - its filter compares to the
 * second, as the range picker's To (rangeEndTexts in contextmenuDate.ts)
 * @param type the field's type: `datetime`, else the days as they are
 */
export function datePresetRange(preset: DatePreset, type: FieldType, now: Date, weekStart: number): [Date | null, Date] {
    const [from, to] = datePresetDays(preset, now, weekStart);
    if (type !== 'datetime') {
        return [from, to];
    }
    return [from, new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59)];
}
