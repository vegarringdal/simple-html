import { formatDate, parseDate } from './dateFormatterParts';
import type { Formatter } from './formatter';

/**
 * Formatter for dates as `YYYY-MM-DD`, e.g. `2026-11-20`. The default for `date` fields.
 *
 * - `format` - a `Date` (or a date string/timestamp) as `2026-11-20`, `''` for a blank or invalid date
 * - `parse` - `'2026-11-20'` as a `Date`. A month or day left out is the current one
 *   (`'2026'` is today's month and day in 2026), and the time of day is the current time, so an
 *   edited date keeps a time. A `Date` passes through, null and undefined are returned as they are,
 *   `''` gives null and text that is no date gives `''`
 * - `parseFilter` - like `parse`, but at the start of the day (00:00:00.000). A `Date` is moved to the
 *   start of its day
 * - `placeholder` - `'YYYY-MM-DD'`
 *
 * @example
 * ```ts
 * DateFormatterYYYYMMDD.format(new Date(2026, 10, 20, 13, 45)); // '2026-11-20'
 * DateFormatterYYYYMMDD.parse('2026-11-20'); // Date 2026-11-20, current time of day
 * DateFormatterYYYYMMDD.parseFilter('2026-11-20'); // Date 2026-11-20 00:00:00
 *
 * // the default for date fields, set it on one field or as the default to be explicit
 * const datasource = new Datasource({
 *     fields: { born: { type: 'date', formatter: DateFormatterYYYYMMDD } },
 *     formatters: { date: DateFormatterYYYYMMDD }
 * });
 * ```
 */
export const DateFormatterYYYYMMDD = {
    format(value: unknown): string {
        return formatDate(value, 'YMD', false);
    },
    parse(text: unknown): Date | '' | null | undefined {
        return parseDate(text, 'YMD', false, false);
    },
    parseFilter(text: unknown): Date | '' | null | undefined {
        return parseDate(text, 'YMD', false, true);
    },
    placeholder: 'YYYY-MM-DD'
} satisfies Formatter;
