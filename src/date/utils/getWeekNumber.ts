import { isoWeek, usWeek } from '../../grid/columnFormat';

/**
 * The week number the date picker shows in front of a week, the same numbers as a date column's week
 * formats and the header filter's `2026-W47` (columnFormat.ts):
 * - ISO (`isoWeek: true`): the ISO 8601 week of the date - weeks start on Monday, week 1 has the year's
 *   first Thursday, so 2027-01-01 is week 53 (of 2026)
 * - US: Excel's `WEEKNUM` of the Saturday of the date's week (weeks start on Sunday). A week across
 *   New Year is week 1: its days in January are week 1, and so is the row of the picker
 * @param date any day of the week
 */
export function getWeekNumbers(date: Date, iso: boolean): number {
    if (iso) {
        return isoWeek(date).week;
    }
    const saturday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 6 - date.getDay());
    return usWeek(saturday);
}
