import { formatDate, parseDate } from './dateFormatterParts';
import type { Formatter } from './formatter';

/**
 * Formatter for a date with time as `DD.MM.YYYYTHH:MM:SS`, e.g. `20.11.2026T13:45:12`.
 *
 * - `format` - a `Date` (or a date string/timestamp) as `20.11.2026T13:45:12`, `''` for a blank or
 *   invalid date
 * - `parse` - `'20.11.2026T13:45:12'` as a `Date`. A month or year left out is the current one, and so
 *   are the hours, minutes and seconds left out. A `Date` passes through, null and undefined are
 *   returned as they are, `''` gives null and text that is no date gives `''`
 * - `parseFilter` - like `parse`, but the time parts left out are 0, and so are the milliseconds:
 *   `'20.11.2026'` is 2026-11-20 00:00:00.000. A `Date` passes through
 * - `placeholder` - `'DD.MM.YYYYTHH:MM:SS'`
 *
 * @example
 * ```ts
 * DateFormatterDDMMYYYYTHHMMSS.format(new Date(2026, 10, 20, 13, 45, 12)); // '20.11.2026T13:45:12'
 *
 * const datasource = new Datasource({
 *     fields: { lastLogin: { type: 'datetime', formatter: DateFormatterDDMMYYYYTHHMMSS } }
 * });
 * ```
 */
export const DateFormatterDDMMYYYYTHHMMSS = {
    format(value: unknown): string {
        return formatDate(value, 'DMY', true);
    },
    parse(text: unknown): Date | '' | null | undefined {
        return parseDate(text, 'DMY', true, false);
    },
    parseFilter(text: unknown): Date | '' | null | undefined {
        return parseDate(text, 'DMY', true, true);
    },
    placeholder: 'DD.MM.YYYYTHH:MM:SS'
} satisfies Formatter;
