import { formatDate, parseDate } from './dateFormatterParts';
import type { Formatter } from './formatter';

/**
 * Formatter for a date with time as `YYYY-MM-DDTHH:MM:SS`, e.g. `2026-11-20T13:45:12`. The default
 * for `datetime` fields.
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
 * @example
 * ```ts
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
    format(value: unknown): string {
        return formatDate(value, 'YMD', true);
    },
    parse(text: unknown): Date | '' | null | undefined {
        return parseDate(text, 'YMD', true, false);
    },
    parseFilter(text: unknown): Date | '' | null | undefined {
        return parseDate(text, 'YMD', true, true);
    },
    placeholder: 'YYYY-MM-DDTHH:MM:SS'
} satisfies Formatter;
