import { formatDate, parseDate } from './dateFormatterParts';
import type { Formatter } from './formatter';

/**
 * Formatter for dates as `DD.MM.YYYY`, e.g. `20.11.2026`. Registered as `'dateDDMMYYYY'`, the options
 * name it by that id (see {@link registerFormatter}).
 *
 * - `format` - a `Date` (or a date string/timestamp) as `20.11.2026`, `''` for a blank or invalid date
 * - `parse` - `'20.11.2026'` as a `Date`. A month or year left out is the current one (`'20'` is the
 *   20th of this month), and the time of day is the current time, so an edited date keeps a time.
 *   A `Date` passes through, null and undefined are returned as they are, `''` gives null and text
 *   that is no date gives `''`
 * - `parseFilter` - like `parse`, but at the start of the day (00:00:00.000). A `Date` is moved to the
 *   start of its day
 * - `placeholder` - `'DD.MM.YYYY'`
 *
 * @sample formatters
 * @example
 * ```ts
 * import { Datasource, DateFormatterDDMMYYYY } from '@simple-html/grid';
 *
 * DateFormatterDDMMYYYY.format(new Date(2026, 10, 20)); // '20.11.2026'
 * DateFormatterDDMMYYYY.parseFilter('20.11.2026'); // Date 2026-11-20 00:00:00
 *
 * // one field, by its id
 * const datasource = new Datasource({
 *     fields: { born: { type: 'date', formatter: 'dateDDMMYYYY' } }
 * });
 *
 * // or every date field
 * const datasource2 = new Datasource({
 *     fields: { born: 'date', hired: 'date' },
 *     formatters: { date: 'dateDDMMYYYY' }
 * });
 * ```
 */
export const DateFormatterDDMMYYYY = {
    /** a `Date` as text, `''` for a blank or invalid date */
    format(value: unknown): string {
        return formatDate(value, 'DMY', false);
    },
    /** typed text as a `Date`, at the current time of day; a `Date` passes through */
    parse(text: unknown): Date | '' | null | undefined {
        return parseDate(text, 'DMY', false, false);
    },
    /** typed filter text as a `Date` at 00:00:00 */
    parseFilter(text: unknown): Date | '' | null | undefined {
        return parseDate(text, 'DMY', false, true);
    },
    /** shown in an empty header filter */
    placeholder: 'DD.MM.YYYY'
} satisfies Formatter;
