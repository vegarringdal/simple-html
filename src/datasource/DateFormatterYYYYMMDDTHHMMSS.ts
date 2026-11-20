import { formatDate, parseDate } from './dateFormatterParts';
import type { Formatter } from './formatter';

/**
 * Formatter for a date with time as `YYYY-MM-DDTHH:MM:SS`, e.g. `2026-11-20T13:45:12`. The default
 * for `datetime` fields. Registered as `'datetimeYYYYMMDD'`, the options name it by that id (see
 * {@link registerFormatter}).
 *
 * - `format` - a `Date` (or a date string/timestamp) as `2026-11-20T13:45:12`, `''` for a blank or
 *   invalid date
 * - `parse` - `'2026-11-20T13:45:12'` as a `Date`. A month or day left out is the current one, and so
 *   are the hours, minutes and seconds left out (`'2026-11-20T13'` is 13 o'clock and the current
 *   minutes and seconds). A `Date` passes through, null and undefined are returned as they are,
 *   `''` gives null and text that is no date gives `''`
 * - `parseFilter` - like `parse`, but the time parts left out are 0, and so are the milliseconds:
 *   `'2026-11-20'` is 2026-11-20 00:00:00.000. A `Date` passes through
 * - `placeholder` - `'YYYY-MM-DDTHH:MM:SS'`
 *
 * @sample formatters
 * @example
 * ```ts
 * import { Datasource, DateFormatterYYYYMMDDTHHMMSS } from '@simple-html/grid';
 *
 * DateFormatterYYYYMMDDTHHMMSS.format(new Date(2026, 10, 20, 13, 45, 12)); // '2026-11-20T13:45:12'
 * DateFormatterYYYYMMDDTHHMMSS.parseFilter('2026-11-20T13'); // Date 2026-11-20 13:00:00
 *
 * // the default for datetime fields
 * const datasource = new Datasource({
 *     fields: { lastLogin: 'datetime' }
 * });
 * ```
 */
export const DateFormatterYYYYMMDDTHHMMSS = {
    /** a `Date` as text, `''` for a blank or invalid date */
    format(value: unknown): string {
        return formatDate(value, 'YMD', true);
    },
    /** typed text as a `Date`, the time parts left out are the current time; a `Date` passes through */
    parse(text: unknown): Date | '' | null | undefined {
        return parseDate(text, 'YMD', true, false);
    },
    /** typed filter text as a `Date`, the time parts left out are 0 */
    parseFilter(text: unknown): Date | '' | null | undefined {
        return parseDate(text, 'YMD', true, true);
    },
    /** shown in an empty header filter */
    placeholder: 'YYYY-MM-DDTHH:MM:SS'
} satisfies Formatter;
