import type { FieldType } from '../datasource/field';
import { type FilterExpression, type FilterOperator, isFilterGroup, or, where } from '../datasource/filterExpression';
import type { Formatter } from '../datasource/formatter';
import {
    type ColumnFormat,
    type DateFormat,
    FALLBACK_LOCALE,
    type FormatTexts,
    formatDateAs,
    formatNumberAs,
    formatValueAs,
    isoWeek,
    type NumberFormat
} from './columnFormat';

/**
 * Filter as shown (`ColumnFormat.filterAsShown`, on by default): the header filter of a column with a
 * display format takes the text as the cells show it.
 *
 * - **A date format** is a period of time: `2026-W47` (weekIso) is the week from Monday 2026-11-16 to
 *   Sunday 2026-11-22, `2026-11` the month, `2026 Q4` the quarter, `2026` the year, `22.11.2026` the day,
 *   `5` (daysUntil) the day 5 days from today, `2026-11-22 13:45` (isoTime) the minute. The text typed is
 *   read back into that period (parseDateAs), and the operator makes ordinary date conditions of it
 *   (dateConditions): `= 2026-W47` is a BETWEEN of Monday and Sunday, `≥` from Monday, `>` after Sunday,
 *   `<` before Monday, `≤` to Sunday, `≠` outside the week (an OR group). No SQL date functions are
 *   needed: toSqlWhere writes a range of the column, an index on it works.
 * - **A number format** is read with its separators: `1 234,5` with `{ thousands: ' ', decimal: ',' }`
 *   is 1234.5, `50 %` with `percent` 0.5 (parseNumberAs).
 * - `'weekday'`, `'time'` and `'timeSeconds'` are no period of time (a Sunday of any week, 13:45 of any
 *   day): their header filter takes the text as the field's formatter reads it, as without a format.
 *
 * The header filter reads and writes its text with a formatter of its own, asShownFormatter: what the
 * state holds as the header filter's value (`GridState.headerFilters[field].value`) is what it held
 * before - a Date, a number, a BETWEEN's `[from, to]` - the date the start of the period typed (Monday
 * of `2026-W47`), and its cell shows it in the display format again: `2026-W47`.
 */

/**
 * The date formats a header filter does not take as shown: a day of the week and a time of day are no
 * period of time. Their header filter reads the field's format, as without a display format
 */
export const NOT_FILTERED_AS_SHOWN: readonly DateFormat[] = ['weekday', 'time', 'timeSeconds'];

/**
 * A period of time a date format shows: from `start` (included) to `next` (excluded) - the start of the
 * period after it. A day, a week, a month, a quarter, a year, a minute or a second, in local time
 */
export interface DatePeriod {
    /** the first moment of it: 00:00 of its first day, or the minute or second */
    start: Date;
    /** the first moment after it: 00:00 of the day after its last day, or the next minute or second */
    next: Date;
}

/**
 * true when the header filter of a column with this format can take the text as the cells show it: a
 * number format, or a date format that is a period of time - not `NOT_FILTERED_AS_SHOWN`. A date
 * format is tried on a date: its text read back must be that date's period - a week written by a
 * translation without `{year}`, a named date (medium, long, full) of a language whose names are not
 * read back, are not filtered as shown
 * @param texts how the dates are written: formatTexts()
 */
export function canFilterAsShown(format: ColumnFormat | undefined, texts: FormatTexts): boolean {
    if (format?.number) {
        return true;
    }
    const date = format?.date;
    if (!date || NOT_FILTERED_AS_SHOWN.includes(date)) {
        return false;
    }
    const sample = new Date(2026, 10, 22, 13, 45, 12);
    const period = parseDateAs(formatDateAs(sample, date, texts, sample), date, texts, sample);
    return period !== null && period.start <= sample && sample < period.next;
}

/**
 * true when the header filter of a column takes the text as the cells show it: it can
 * (canFilterAsShown), and the format does not turn it off (`filterAsShown: false`)
 */
export function filtersAsShown(format: ColumnFormat | undefined, texts: FormatTexts): boolean {
    return format?.filterAsShown !== false && canFilterAsShown(format, texts);
}

/** `days` days after a date (before it, negative): the same time of day, across summer time */
function addDays(date: Date, days: number): Date {
    const moved = new Date(date.getTime());
    moved.setDate(date.getDate() + days);
    return moved;
}

/** `months` months after the first day of a month */
function addMonths(first: Date, months: number): Date {
    const moved = new Date(first.getTime());
    moved.setMonth(first.getMonth() + months);
    return moved;
}

/**
 * 00:00 of a local day, null when the parts are no day (2026-02-30, month 13). setFullYear: `new
 * Date(26, ...)` would be 1926
 * @param month 0 is January
 */
function localDay(year: number, month: number, day: number): Date | null {
    const date = new Date(2000, 0, 1);
    date.setFullYear(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

/**
 * a local time of a day, null when it is no time of that day: 25:00, a minute 60, the hour skipped
 * when the clocks go forward
 */
function localTime(day: Date | null, hours: number, minutes: number, seconds: number): Date | null {
    if (!day) {
        return null;
    }
    const time = new Date(day.getTime());
    time.setHours(hours, minutes, seconds, 0);
    const same =
        time.getDate() === day.getDate() &&
        time.getHours() === hours &&
        time.getMinutes() === minutes &&
        time.getSeconds() === seconds;
    return same ? time : null;
}

/** the day a date is on, from 00:00 to 00:00 of the next day */
function dayPeriod(day: Date | null): DatePeriod | null {
    return day ? { start: day, next: addDays(day, 1) } : null;
}

/** a period of a time: a minute or a second (`length` ms) from `start` */
function timePeriod(start: Date | null, length: number): DatePeriod | null {
    return start ? { start, next: new Date(start.getTime() + length) } : null;
}

/**
 * A year written with two digits (`norwegianShort`, `22.11.26`) as Excel reads it: 00 to 29 are 2000 to
 * 2029, 30 to 99 are 1930 to 1999. A year of more digits is the year
 */
function fullYear(year: string): number {
    const value = Number(year);
    if (year.length > 2) {
        return value;
    }
    return value < 30 ? 2000 + value : 1900 + value;
}

/** text in a regular expression as it is */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** what each placeholder of a week or quarter template takes */
const TEMPLATE_PARTS: Record<string, string> = { year: '(\\d{4})', week: '(\\d{1,2})', quarter: '([1-4])' };

/**
 * The numbers of text written with a template of the texts (`'{year}-W{week}'`, `'uke {week} {year}'`,
 * `'{year} Q{quarter}'`): each placeholder of `names` once, in the template's order. Upper and lower case
 * are the same, a space of the template is any spaces or none (`2026Q4`, `2026 q4`). null when the text
 * is not written so, or the template does not have each of `names` - its year left out by a translation
 */
function readTemplate(text: string, template: string, names: readonly string[]): Record<string, number> | null {
    const order: string[] = [];
    let pattern = '';
    for (const piece of template.split(/(\{\w+\})/)) {
        const name = /^\{(\w+)\}$/.exec(piece)?.[1];
        if (name && names.includes(name) && !order.includes(name)) {
            order.push(name);
            pattern += TEMPLATE_PARTS[name];
        } else {
            pattern += escapeRegExp(piece).replace(/\s+/g, '\\s*');
        }
    }
    const match = order.length === names.length ? new RegExp(`^${pattern}$`, 'i').exec(text) : null;
    return match ? Object.fromEntries(order.map((name, index) => [name, Number(match[index + 1])])) : null;
}

/**
 * The ISO 8601 week `week` of `year` (weekIso): Monday to Sunday. Week 1 is the week of January 4 - it
 * has the year's first Thursday. null for a week the year does not have (53 of a year of 52 weeks)
 */
function isoWeekPeriod(year: number, week: number): DatePeriod | null {
    const january4 = localDay(year, 0, 4);
    if (!january4) {
        return null;
    }
    const monday = addDays(january4, -((january4.getDay() + 6) % 7));
    const start = addDays(monday, (week - 1) * 7);
    const shown = isoWeek(start);
    return shown.year === year && shown.week === week ? { start, next: addDays(start, 7) } : null;
}

/**
 * The US week `week` of `year` (weekUs, Excel's `WEEKNUM`): Sunday to Saturday, in the year - week 1 is
 * January 1 to the first Saturday, the last week ends on December 31 (2026-W53 is 27 to 31 December,
 * 2027-W01 1 and 2 January 2027). null for a week the year does not have
 */
function usWeekPeriod(year: number, week: number): DatePeriod | null {
    const newYear = localDay(year, 0, 1);
    const nextYear = localDay(year + 1, 0, 1);
    if (!newYear || !nextYear || week < 1) {
        return null;
    }
    const sunday = addDays(newYear, -newYear.getDay());
    const start = week === 1 ? newYear : addDays(sunday, (week - 1) * 7);
    const end = addDays(sunday, week * 7);
    return start < nextYear ? { start, next: end < nextYear ? end : nextYear } : null;
}

/**
 * the Intl formatters of the named dates, by locale and style: made once each. A locale Intl does not
 * take is English, as the cells show it (columnFormat.ts, intlDate)
 */
const namedFormats = new Map<string, Intl.DateTimeFormat>();

function namedFormat(locale: string, style: 'medium' | 'long' | 'full'): Intl.DateTimeFormat {
    const key = `${locale}|${style}`;
    let format = namedFormats.get(key);
    if (!format) {
        try {
            format = new Intl.DateTimeFormat(locale, { dateStyle: style });
        } catch (error) {
            if (!(error instanceof RangeError)) {
                throw error;
            }
            format = new Intl.DateTimeFormat(FALLBACK_LOCALE, { dateStyle: style });
        }
        namedFormats.set(key, format);
    }
    return format;
}

/**
 * A date written with names (medium, long, full - `Nov 22, 2026`, `22. november 2026`, `Sunday, November
 * 22, 2026`), read as Intl writes it in the language of `format.locale`: the order of the day, the month
 * and the year from Intl, the month by its name (or its number, where the language writes one) - upper
 * and lower case, the dots of an abbreviation and the name of the day do not count. null when it is not
 * written so
 */
function parseNamedDate(text: string, style: 'medium' | 'long' | 'full', locale: string): Date | null {
    const format = namedFormat(locale, style);
    const language = format.resolvedOptions().locale;
    const lower = (value: string) => value.toLocaleLowerCase(language).replace(/\./g, '');
    const partsOf = (date: Date) => format.formatToParts(date);
    const order: string[] = partsOf(new Date(2026, 10, 22))
        .map((part): string => part.type)
        .filter((type) => type === 'day' || type === 'month' || type === 'year');
    const monthNames = Array.from({ length: 12 }, (_, month) =>
        lower(partsOf(new Date(2026, month, 15)).find((part) => part.type === 'month')?.value ?? '')
    );
    // a month written as a word, `nov`, not a number (`11`, `11月`)
    const named = monthNames.every((name) => /^\p{L}+$/u.test(name));
    const tokens: string[] = lower(text).match(/\p{L}+|\d+/gu) ?? [];
    const numbers = tokens.filter((token) => /^\d+$/.test(token));
    const numbered = named ? order.filter((type) => type !== 'month') : order;
    const month = named ? monthNames.findIndex((name) => tokens.includes(name)) : -1;
    if (order.length !== 3 || numbers.length !== numbered.length || (named && month === -1)) {
        return null;
    }
    const part = (type: string) => numbers[numbered.indexOf(type)];
    return localDay(fullYear(part('year')), named ? month : Number(part('month')) - 1, Number(part('day')));
}

/**
 * Text as a date format shows it, as the period of time it is - see the top of the file. Spaces around
 * it do not count, nor a leading 0 of a day, a month or an hour (`22.1.2026`). The whole text: a date and
 * time format takes the date with its time - the header filter stores the start of the period and reads
 * the period of the format from it again, a day typed in a column of minutes would come back as its
 * first minute (an ISO date typed is that, see readDateAs).
 *
 * | format | text | the period |
 * | --- | --- | --- |
 * | `iso`, `norwegian`, `norwegianShort`, `us`, `uk` | `2026-11-22`, `22.11.2026`, `22.11.26`, `11/22/2026`, `22/11/2026` | the day; `26` is 2026 (00-29 2000-2029, 30-99 1930-1999) |
 * | `medium`, `long`, `full` | `Nov 22, 2026` - in the language of `format.locale` | the day |
 * | `weekIso`, `weekUs` | `2026-W47` - written as `format.weekIso`, `format.weekUs` | the week: Monday to Sunday; Sunday to Saturday within the year |
 * | `month`, `quarter`, `year` | `2026-11`, `2026 Q4` (`format.quarter`), `2026` | the month, the quarter, the year |
 * | `daysUntil` | `5`, `-1`, `0` | the day so many days from today: `5` is in 5 days, `-1` yesterday |
 * | `isoTime`, `norwegianTime` | `2026-11-22 13:45`, `22.11.2026 13:45` | the minute |
 * | `isoSeconds`, `norwegianSeconds` | `2026-11-22 13:45:12` | the second |
 *
 * null for text that is no such date (`2026-W54`, `2026-13`, `abc`), and for the formats that are no
 * period: `weekday`, `time`, `timeSeconds`.
 * @param texts how a week and a quarter are written, the language of the names: formatTexts()
 * @param today now, for `daysUntil`
 */
export function parseDateAs(text: string, format: DateFormat, texts: FormatTexts, today: Date): DatePeriod | null {
    const typed = text.trim();
    const match = (pattern: RegExp) => pattern.exec(typed)?.slice(1) ?? null;
    // a date, and the time of a date and time format: to the minute, to the second
    const dateTime = (date: RegExp, order: 'ymd' | 'dmy', shows: 'day' | 'minute' | 'second') => {
        const TIMES = {
            day: '',
            minute: '\\s+(\\d{1,2}):(\\d{2})',
            second: '\\s+(\\d{1,2}):(\\d{2}):(\\d{2})'
        };
        const parts = match(new RegExp(`^${date.source}${TIMES[shows]}$`));
        if (!parts) {
            return null;
        }
        const [a, b, c, hours, minutes, second] = parts;
        const day =
            order === 'ymd' ? localDay(Number(a), Number(b) - 1, Number(c)) : localDay(Number(c), Number(b) - 1, Number(a));
        if (hours === undefined) {
            return dayPeriod(day);
        }
        if (second === undefined) {
            return timePeriod(localTime(day, Number(hours), Number(minutes), 0), 60_000);
        }
        return timePeriod(localTime(day, Number(hours), Number(minutes), Number(second)), 1000);
    };
    const ISO = /(\d{4})-(\d{1,2})-(\d{1,2})/;
    const NORWEGIAN = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;

    switch (format) {
        case 'iso':
            return dateTime(ISO, 'ymd', 'day');
        case 'isoTime':
            return dateTime(ISO, 'ymd', 'minute');
        case 'isoSeconds':
            return dateTime(ISO, 'ymd', 'second');
        case 'norwegian':
            return dateTime(NORWEGIAN, 'dmy', 'day');
        case 'norwegianTime':
            return dateTime(NORWEGIAN, 'dmy', 'minute');
        case 'norwegianSeconds':
            return dateTime(NORWEGIAN, 'dmy', 'second');
        case 'norwegianShort': {
            const parts = match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
            return parts ? dayPeriod(localDay(fullYear(parts[2]), Number(parts[1]) - 1, Number(parts[0]))) : null;
        }
        case 'us':
        case 'uk': {
            const parts = match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (!parts) {
                return null;
            }
            const [first, second, year] = parts.map(Number);
            return dayPeriod(format === 'us' ? localDay(year, first - 1, second) : localDay(year, second - 1, first));
        }
        case 'medium':
        case 'long':
        case 'full':
            return dayPeriod(parseNamedDate(typed, format, texts.locale));
        case 'weekIso':
        case 'weekUs': {
            const parts = readTemplate(typed, format === 'weekIso' ? texts.weekIso : texts.weekUs, ['year', 'week']);
            if (!parts) {
                return null;
            }
            return format === 'weekIso' ? isoWeekPeriod(parts.year, parts.week) : usWeekPeriod(parts.year, parts.week);
        }
        case 'month': {
            const parts = match(/^(\d{4})-(\d{1,2})$/);
            const start = parts ? localDay(Number(parts[0]), Number(parts[1]) - 1, 1) : null;
            return start ? { start, next: addMonths(start, 1) } : null;
        }
        case 'quarter': {
            const parts = readTemplate(typed, texts.quarter, ['year', 'quarter']);
            const start = parts ? localDay(parts.year, (parts.quarter - 1) * 3, 1) : null;
            return start ? { start, next: addMonths(start, 3) } : null;
        }
        case 'year': {
            const parts = match(/^(\d{4})$/);
            const start = parts ? localDay(Number(parts[0]), 0, 1) : null;
            return start ? { start, next: addMonths(start, 12) } : null;
        }
        case 'daysUntil': {
            const parts = match(/^([+-]?\d{1,6})$/);
            if (!parts) {
                return null;
            }
            const midnight = new Date(today.getTime());
            midnight.setHours(0, 0, 0, 0);
            return dayPeriod(addDays(midnight, Number(parts[0])));
        }
        default:
            // weekday, time, timeSeconds: no period of time
            return null;
    }
}

/**
 * The period of a date format a date is in: the week of `weekIso`, the month of `month` ... - the date
 * written in the format and read back. null for a format that is no period (`weekday`, `time`)
 * @param today now, for `daysUntil`
 */
export function periodOf(date: Date, format: DateFormat, texts: FormatTexts, today: Date): DatePeriod | null {
    return parseDateAs(formatDateAs(date, format, texts, today), format, texts, today);
}

/** an ISO 8601 date (`2026-11-16`), or a date and time - the text a Date is in JSON */
const ISO_TEXT = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Text of a header filter as the period of a date format: as the format shows it (parseDateAs), else
 * an ISO 8601 date the period is the one of - `2026-11-16` typed in a week column is that week, and so
 * is the text JSON makes of a Date (`2026-11-15T23:00:00.000Z`), a state's after a reload. A date only
 * is a local day. null for anything else
 * @param today now, for `daysUntil`
 */
export function readDateAs(text: string, format: DateFormat, texts: FormatTexts, today: Date): DatePeriod | null {
    const shown = parseDateAs(text, format, texts, today);
    if (shown) {
        return shown;
    }
    const iso = ISO_TEXT.exec(text.trim());
    if (!iso) {
        return null;
    }
    const date = iso[4] ? new Date(text.trim()) : localDay(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return date && !Number.isNaN(date.getTime()) ? periodOf(date, format, texts, today) : null;
}

/**
 * Text typed as a number format shows it, as the number: without its thousands separator - and any
 * space - with its decimal mark: `1 234,5` with `{ thousands: ' ', decimal: ',' }` is 1234.5,
 * `1,234.5` with `{ thousands: ',' }` too. A dot is a decimal mark too when it is no thousands separator
 * (`12.5` with `decimal: ','`). With `percent` the number shown is a hundred times the value: `50 %`
 * and `50` are 0.5. null for text that is no number (`''`, `abc`, `1,2,3` with `decimal: '.'`)
 */
export function parseNumberAs(text: string, format: NumberFormat): number | null {
    let typed = text.trim();
    if (format.percent) {
        typed = typed.replace(/%$/, '');
    }
    // any space: a thousands separator, the space before %, a no-break space pasted
    typed = typed.replace(/\s/g, '');
    if (format.thousands && format.thousands !== ' ') {
        typed = typed.split(format.thousands).join('');
    }
    if (format.decimal === ',') {
        typed = typed.replace(',', '.');
    }
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(typed)) {
        return null;
    }
    const value = Number(typed);
    // divided by 100 can add a binary tail: 15 digits drop it
    return format.percent ? Number((value / 100).toPrecision(15)) : value;
}

/**
 * A number as a header filter shows it: in the number format, its separators and percent, with the
 * decimals the number has - not rounded to the format's, the filter is on the value typed (`12.34` in a
 * column of 1 decimal shows `12.34`, not `12.3`)
 */
export function formatNumberTyped(value: number, format: NumberFormat): string {
    return formatNumberAs(value, { ...format, decimals: undefined });
}

/**
 * The formatter a header filter that filters as shown reads and writes its text with - the cell, the
 * range block of the filter menu, the date pickers (renderHeaderFilter.ts, contextmenuFilter.ts): the
 * field's formatter with
 * - `format`: the value in the display format - a Date (or the ISO text of one) as the cells show it,
 *   a number with the format's separators (formatNumberTyped). What it can not show, the field's
 * - `parseFilter`: the text as the cells show it - a date the start of its period (readDateAs: Monday
 *   of `2026-W47`), a number read with the separators (parseNumberAs). null for text that is neither: no
 *   filter
 * - `placeholder`: an example, today in the format (`2026-W47`), 1234.5 (0.5 with percent) in the
 *   number format: what to type. None for `daysUntil` (the grid gives it a text)
 *
 * The conditions of a date are made of the period, not of the start: dateConditions.
 * @param format a format that filters as shown (filtersAsShown)
 * @param now today, for `daysUntil` and the placeholder: `() => new Date()`
 */
export function asShownFormatter(
    fieldFormatter: Formatter,
    format: ColumnFormat,
    texts: FormatTexts,
    now: () => Date
): Formatter {
    const number = format.number;
    if (number) {
        return {
            ...fieldFormatter,
            format: (value) =>
                typeof value === 'number' && Number.isFinite(value)
                    ? formatNumberTyped(value, number)
                    : fieldFormatter.format(value),
            parseFilter: (text) => parseNumberAs(text, number),
            placeholder: formatNumberTyped(number.percent ? 0.5 : 1234.5, number)
        };
    }
    const date = format.date ?? 'iso';
    return {
        ...fieldFormatter,
        format: (value) => formatValueAs(value, { date }, texts) ?? fieldFormatter.format(value),
        parseFilter: (text) => readDateAs(text, date, texts, now())?.start ?? null,
        placeholder: date === 'daysUntil' ? undefined : formatDateAs(now(), date, texts, now())
    };
}

/**
 * The last moment of a period as a condition compares it: its last day for a `date` field (a date
 * compares the day), its last second for a `datetime` field (it compares the second)
 */
function lastOf(period: DatePeriod, type: FieldType): Date {
    return type === 'datetime' ? new Date(period.next.getTime() - 1000) : addDays(period.next, -1);
}

/**
 * The conditions of a header filter that filters a date as shown: its operator on the period the value
 * is in (periodOf) - the value is what asShownFormatter's parseFilter gave, the start of the period
 * typed, or `[from, to]` of them for `BETWEEN`.
 *
 * | operator | `2026-W47`: the week from Monday 16 to Sunday 22 November |
 * | --- | --- |
 * | `EQUAL` | `BETWEEN` Monday and Sunday |
 * | `NOT_EQUAL_TO` | an OR group: `LESS_THAN` Monday, `GREATER_THAN` Sunday, `IS_BLANK` - as `NOT_EQUAL_TO` a day, a blank date is not in it |
 * | `LESS_THAN` | before Monday |
 * | `LESS_THAN_OR_EQUAL_TO` | to Sunday |
 * | `GREATER_THAN` | after Sunday |
 * | `GREATER_THAN_OR_EQUAL_TO` | from Monday |
 * | `BETWEEN` `[from, to]` | from the start of `from`'s period to the end of `to`'s: `2026-W40..2026-W47` is Monday of week 40 to Sunday of week 47. An end left out is open |
 *
 * Sunday is the day for a `date` field, 23:59:59 of it for a `datetime` field (lastOf). A period of one
 * day on a `date` field - a day format - and of one second on a `datetime` field is the condition as
 * without the format: `EQUAL` the day.
 * @param type the field's type: `date` or `datetime`
 * @param today now, for `daysUntil`
 * @returns the conditions for the top of the filter, [] for no value
 */
export function dateConditions(
    field: string,
    operator: FilterOperator,
    value: unknown,
    type: FieldType,
    format: DateFormat,
    texts: FormatTexts,
    today: Date
): FilterExpression[] {
    const period = (end: unknown) => (end instanceof Date ? periodOf(end, format, texts, today) : null);
    if (operator === 'BETWEEN') {
        const [from, to] = Array.isArray(value) ? value.map(period) : [period(value), period(value)];
        return periodConditions(field, operator, from, to, type);
    }
    const shown = period(value);
    return periodConditions(field, operator, shown, shown, type);
}

/**
 * A period of days whose first day may be open: Overdue - every day before today - has none. As
 * DatePeriod, from `start` (included, null: open) to `next` (excluded)
 */
export interface OpenDatePeriod {
    start: Date | null;
    next: Date;
}

/**
 * The conditions of an operator on a period - the table of dateConditions. `from` is the period of the
 * value, `to` too but for `BETWEEN` (the period of its To). A period with an open start (OpenDatePeriod):
 * `EQUAL` is to its end, `NOT_EQUAL_TO` after it or blank, `LESS_THAN` and `GREATER_THAN_OR_EQUAL_TO`
 * nothing to compare with - [] - and the others as with a start
 * @param type the field's type: `date` or `datetime` - the last moment of the period, see lastOf
 * @returns the conditions for the top of a filter, [] for none: no period, or nothing to compare with
 */
export function periodConditions(
    field: string,
    operator: FilterOperator,
    from: OpenDatePeriod | null,
    to: OpenDatePeriod | null,
    type: FieldType
): FilterExpression[] {
    const lastOfOpen = (period: OpenDatePeriod) => lastOf(period as DatePeriod, type);
    if (operator === 'BETWEEN') {
        return from || to ? [where(field, 'BETWEEN', [from?.start ?? null, to ? lastOfOpen(to) : null])] : [];
    }
    if (!from) {
        return [];
    }
    const { start } = from;
    const last = lastOfOpen(from);
    if (start && last.getTime() === start.getTime()) {
        return [where(field, operator, start)];
    }
    switch (operator) {
        case 'EQUAL':
            return [where(field, 'BETWEEN', [start, last])];
        case 'NOT_EQUAL_TO':
            return start
                ? [or(where(field, 'LESS_THAN', start), where(field, 'GREATER_THAN', last), where(field, 'IS_BLANK'))]
                : [or(where(field, 'GREATER_THAN', last), where(field, 'IS_BLANK'))];
        case 'LESS_THAN_OR_EQUAL_TO':
        case 'GREATER_THAN':
            return [where(field, operator, last)];
        default:
            // LESS_THAN, GREATER_THAN_OR_EQUAL_TO: from the start, none when it is open
            return start ? [where(field, operator, start)] : [];
    }
}

/**
 * true for the OR group dateConditions makes of `NOT_EQUAL_TO` a period, on `field`: `LESS_THAN`,
 * `GREATER_THAN`, `IS_BLANK`, in that order. The header filter of the column owns it as it owns its
 * conditions - typing again replaces it (filterCallback.ts)
 */
export function isOutsidePeriod(expression: FilterExpression, field: string): boolean {
    if (!isFilterGroup(expression) || expression.group !== 'OR' || expression.children.length !== 3) {
        return false;
    }
    const operators = expression.children.map((child) => (isFilterGroup(child) || child.field !== field ? null : child.operator));
    return operators[0] === 'LESS_THAN' && operators[1] === 'GREATER_THAN' && operators[2] === 'IS_BLANK';
}
