import type { IDateConfig } from '../interfaces';

/**
 * true for a range picker: `rangepicker` on a date picker (`datepicker: true`), see
 * IDateConfig.rangepicker. A calendar ignores `rangepicker`
 */
export function isRangePicker(config: IDateConfig): boolean {
    return config.datepicker && config.rangepicker === true;
}

/**
 * px of the window a range picker leaves free beside its two months: a menu of the grid keeps 4px to
 * each edge of the window, and has a frame
 */
const RANGE_WINDOW_ROOM = 10;

/**
 * How many months a range picker shows: 2 side by side, 1 when the window is too narrow for two (a
 * phone, 390px wide, has room for one month of the default 230px and its margins)
 */
export function rangeMonths(config: IDateConfig): number {
    const twoMonths = 2 * (config.monthWidth + 2 * config.monthMargin);
    return window.innerWidth >= twoMonths + RANGE_WINDOW_ROOM ? 2 : 1;
}

/**
 * the day of `date` at 00:00, a new date. null for null, undefined and an invalid date
 */
export function startOfDay(date: Date | null | undefined): Date | null {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return null;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * The range a range picker opens on: `datepickerRange` as days at 00:00 (new dates), From before To -
 * swapped when given the other way round. An end that is no date is null
 */
export function rangeDays(range: IDateConfig['datepickerRange']): [Date | null, Date | null] {
    const from = startOfDay(range?.[0]);
    const to = startOfDay(range?.[1]);
    return from && to && from > to ? [to, from] : [from, to];
}

/**
 * A day clicked in a range picker: the range it gives. The first day is From, the next one To - From
 * and To swapped when it is before From, the same day twice is a range of that day - and a day clicked
 * when both are picked starts again: a new From, no To
 * @param range the range picked so far
 * @param day the day clicked, at 00:00
 */
export function nextRange(range: IDateConfig['datepickerRange'], day: Date): [Date | null, Date | null] {
    const [from, to] = rangeDays(range);
    if (!from || to) {
        return [day, null];
    }
    return day < from ? [day, from] : [from, day];
}

/**
 * true when `day` (at 00:00) is between From and To, not one of them: a day of the range picked
 */
export function isInRange(range: IDateConfig['datepickerRange'], day: Date): boolean {
    const [from, to] = rangeDays(range);
    return !!from && !!to && day > from && day < to;
}
