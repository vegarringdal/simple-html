import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DateFormatterYYYYMMDD } from '../../datasource/DateFormatterYYYYMMDD';
import { Datasource } from '../../datasource/dataSource';
import { and, type FilterExpression, or, where } from '../../datasource/filterExpression';
import { type DateFormat, type FormatTexts, formatDateAs, formatTexts } from '../columnFormat';
import {
    asShownFormatter,
    canFilterAsShown,
    type DatePeriod,
    dateConditions,
    filtersAsShown,
    formatNumberTyped,
    isOutsidePeriod,
    NOT_FILTERED_AS_SHOWN,
    parseDateAs,
    parseNumberAs,
    periodOf,
    readDateAs
} from '../filterAsShown';

/**
 * Filter as shown (filterAsShown.ts): the text of every date format read back as the period it is - the
 * weeks around New Year, the US weeks inside the year, the days until today, the minutes and seconds -
 * the conditions each operator makes of a period, and the numbers typed with the separators of a number
 * format. The grid side - the header filter, the state, the dialog - is in filterAsShownGrid.test.ts.
 */

// local dates: a time zone with summer time. Node reads TZ again when it is set
const originalTimeZone = process.env.TZ;
beforeAll(() => {
    process.env.TZ = 'Europe/Oslo';
});
afterAll(() => {
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});
afterEach(() => {
    vi.useRealTimers();
});

const TEXTS: FormatTexts = formatTexts();
const NORWEGIAN: FormatTexts = {
    locale: 'nb-NO',
    weekIso: 'uke {week} {year}',
    weekUs: 'uke {week} {year}',
    quarter: '{quarter}. kvartal {year}'
};
/** Sunday 2026-11-22 13:45:12, local */
const TODAY = new Date(2026, 10, 22, 13, 45, 12);

/** a local date and time */
const at = (year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0) =>
    new Date(year, month - 1, day, hours, minutes, seconds);

/** a period as [start, next] in local text, for readable failures */
const shown = (period: DatePeriod | null) => {
    if (!period) {
        return null;
    }
    const text = (date: Date) => formatDateAs(date, 'isoSeconds', TEXTS, TODAY);
    return [text(period.start), text(period.next)];
};
const parse = (text: string, format: DateFormat, texts = TEXTS, today = TODAY) => shown(parseDateAs(text, format, texts, today));

describe('parseDateAs - a day', () => {
    it('expect iso, norwegian, us and uk to be the day, a leading 0 left out too', () => {
        const day = ['2026-11-22 00:00:00', '2026-11-23 00:00:00'];
        expect(parse('2026-11-22', 'iso')).toEqual(day);
        expect(parse(' 2026-11-22 ', 'iso')).toEqual(day);
        expect(parse('22.11.2026', 'norwegian')).toEqual(day);
        expect(parse('11/22/2026', 'us')).toEqual(day);
        expect(parse('22/11/2026', 'uk')).toEqual(day);
        expect(parse('2026-1-5', 'iso')).toEqual(['2026-01-05 00:00:00', '2026-01-06 00:00:00']);
        expect(parse('5.1.2026', 'norwegian')).toEqual(['2026-01-05 00:00:00', '2026-01-06 00:00:00']);
    });

    it('expect a year of two digits as Excel reads it: 00-29 2000-2029, 30-99 1930-1999', () => {
        expect(parse('22.11.26', 'norwegianShort')).toEqual(['2026-11-22 00:00:00', '2026-11-23 00:00:00']);
        expect(parse('01.01.29', 'norwegianShort')?.[0]).toEqual('2029-01-01 00:00:00');
        expect(parse('01.01.30', 'norwegianShort')?.[0]).toEqual('1930-01-01 00:00:00');
    });

    it('expect text that is no day of the format to be null', () => {
        expect(parse('2026-02-30', 'iso')).toBeNull();
        expect(parse('2026-13-01', 'iso')).toBeNull();
        expect(parse('22.11.2026', 'iso')).toBeNull();
        expect(parse('2026-11', 'iso')).toBeNull();
        // the US order: there is no month 22
        expect(parse('22/11/2026', 'us')).toBeNull();
        expect(parse('22.11.2026', 'norwegianShort')).toBeNull();
        expect(parse('', 'iso')).toBeNull();
        expect(parse('abc', 'norwegian')).toBeNull();
        // a day format takes no time
        expect(parse('2026-11-22 13:45', 'iso')).toBeNull();
    });

    it('expect the day across summer time to be the whole day: 23 and 25 hours', () => {
        const spring = parseDateAs('2026-03-29', 'iso', TEXTS, TODAY) as DatePeriod;
        expect((spring.next.getTime() - spring.start.getTime()) / 3_600_000).toBe(23);
        const autumn = parseDateAs('25.10.2026', 'norwegian', TEXTS, TODAY) as DatePeriod;
        expect((autumn.next.getTime() - autumn.start.getTime()) / 3_600_000).toBe(25);
    });
});

describe('parseDateAs - the named dates, in the language of format.locale', () => {
    it('expect medium, long and full in English, as Intl writes them, any case', () => {
        const day = ['2026-11-22 00:00:00', '2026-11-23 00:00:00'];
        for (const format of ['medium', 'long', 'full'] as const) {
            expect(parse(formatDateAs(TODAY, format, TEXTS, TODAY), format)).toEqual(day);
        }
        expect(parse('Nov 22, 2026', 'medium')).toEqual(day);
        expect(parse('nov 22, 2026', 'medium')).toEqual(day);
        expect(parse('November 22, 2026', 'long')).toEqual(day);
        expect(parse('Sunday, November 22, 2026', 'full')).toEqual(day);
    });

    it('expect them in Norwegian: 22. nov. 2026, søndag 22. november 2026', () => {
        const day = ['2026-11-22 00:00:00', '2026-11-23 00:00:00'];
        expect(parse('22. nov. 2026', 'medium', NORWEGIAN)).toEqual(day);
        expect(parse('22. november 2026', 'long', NORWEGIAN)).toEqual(day);
        expect(parse('søndag 22. november 2026', 'full', NORWEGIAN)).toEqual(day);
        expect(parse(formatDateAs(at(2026, 5, 3), 'medium', NORWEGIAN, TODAY), 'medium', NORWEGIAN)?.[0]).toEqual(
            '2026-05-03 00:00:00'
        );
    });

    it('expect a month that is no month, a day that is not in it, numbers missing to be null', () => {
        expect(parse('Nob 22, 2026', 'medium')).toBeNull();
        expect(parse('Feb 30, 2026', 'medium')).toBeNull();
        expect(parse('Nov 2026', 'medium')).toBeNull();
        expect(parse('22 2026', 'long')).toBeNull();
    });
});

describe('parseDateAs - weeks', () => {
    it('expect an ISO week to be Monday to Sunday, any case', () => {
        expect(parse('2026-W47', 'weekIso')).toEqual(['2026-11-16 00:00:00', '2026-11-23 00:00:00']);
        expect(parse('2026-w47', 'weekIso')).toEqual(['2026-11-16 00:00:00', '2026-11-23 00:00:00']);
        expect(parse('2026-W1', 'weekIso')).toEqual(['2025-12-29 00:00:00', '2026-01-05 00:00:00']);
    });

    it('expect the ISO weeks around New Year: 2027-01-01 is in 2026-W53, 2024-12-30 in 2025-W01', () => {
        expect(parse('2026-W53', 'weekIso')).toEqual(['2026-12-28 00:00:00', '2027-01-04 00:00:00']);
        expect(parse('2027-W01', 'weekIso')).toEqual(['2027-01-04 00:00:00', '2027-01-11 00:00:00']);
        expect(parse('2025-W01', 'weekIso')).toEqual(['2024-12-30 00:00:00', '2025-01-06 00:00:00']);
        expect(shown(periodOf(at(2027, 1, 1), 'weekIso', TEXTS, TODAY))).toEqual(['2026-12-28 00:00:00', '2027-01-04 00:00:00']);
    });

    it('expect a week the year does not have to be null: 53 of a year of 52, 0, 54', () => {
        expect(parse('2025-W53', 'weekIso')).toBeNull();
        expect(parse('2026-W00', 'weekIso')).toBeNull();
        expect(parse('2026-W54', 'weekIso')).toBeNull();
        expect(parse('2026-47', 'weekIso')).toBeNull();
        expect(parse('W47', 'weekIso')).toBeNull();
    });

    it('expect a US week to be Sunday to Saturday inside the year: 2026-W53 is 27 to 31 December, 2027-W01 1 and 2 January', () => {
        expect(parse('2026-W48', 'weekUs')).toEqual(['2026-11-22 00:00:00', '2026-11-29 00:00:00']);
        expect(parse('2026-W53', 'weekUs')).toEqual(['2026-12-27 00:00:00', '2027-01-01 00:00:00']);
        expect(parse('2027-W01', 'weekUs')).toEqual(['2027-01-01 00:00:00', '2027-01-03 00:00:00']);
        expect(parse('2026-W01', 'weekUs')).toEqual(['2026-01-01 00:00:00', '2026-01-04 00:00:00']);
        expect(parse('2026-W54', 'weekUs')).toBeNull();
        expect(parse('2026-W00', 'weekUs')).toBeNull();
        expect(shown(periodOf(at(2027, 1, 1), 'weekUs', TEXTS, TODAY))).toEqual(['2027-01-01 00:00:00', '2027-01-03 00:00:00']);
        expect(shown(periodOf(at(2026, 12, 31), 'weekUs', TEXTS, TODAY))).toEqual(['2026-12-27 00:00:00', '2027-01-01 00:00:00']);
    });

    it('expect a week written by a translation: uke 47 2026, the year after the week', () => {
        expect(parse('uke 47 2026', 'weekIso', NORWEGIAN)).toEqual(['2026-11-16 00:00:00', '2026-11-23 00:00:00']);
        expect(parse('Uke 47 2026', 'weekIso', NORWEGIAN)).toEqual(['2026-11-16 00:00:00', '2026-11-23 00:00:00']);
        expect(parse('2026-W47', 'weekIso', NORWEGIAN)).toBeNull();
    });

    it('expect a template without {year} to read nothing: the week could be of any year', () => {
        expect(parse('W47', 'weekIso', { ...TEXTS, weekIso: 'W{week}' })).toBeNull();
    });
});

describe('parseDateAs - month, quarter, year, days until', () => {
    it('expect a month, its days', () => {
        expect(parse('2026-11', 'month')).toEqual(['2026-11-01 00:00:00', '2026-12-01 00:00:00']);
        expect(parse('2026-12', 'month')).toEqual(['2026-12-01 00:00:00', '2027-01-01 00:00:00']);
        expect(parse('2026-2', 'month')).toEqual(['2026-02-01 00:00:00', '2026-03-01 00:00:00']);
        expect(parse('2026-13', 'month')).toBeNull();
        expect(parse('2026-00', 'month')).toBeNull();
    });

    it('expect a quarter as format.quarter writes it, a space or none, any case', () => {
        expect(parse('2026 Q4', 'quarter')).toEqual(['2026-10-01 00:00:00', '2027-01-01 00:00:00']);
        expect(parse('2026q1', 'quarter')).toEqual(['2026-01-01 00:00:00', '2026-04-01 00:00:00']);
        expect(parse('4. kvartal 2026', 'quarter', NORWEGIAN)).toEqual(['2026-10-01 00:00:00', '2027-01-01 00:00:00']);
        expect(parse('2026 Q5', 'quarter')).toBeNull();
        expect(parse('2026 Q0', 'quarter')).toBeNull();
    });

    it('expect a year', () => {
        expect(parse('2026', 'year')).toEqual(['2026-01-01 00:00:00', '2027-01-01 00:00:00']);
        expect(parse('26', 'year')).toBeNull();
    });

    it('expect days until to be the day so many days from today - more days is later', () => {
        expect(parse('0', 'daysUntil')).toEqual(['2026-11-22 00:00:00', '2026-11-23 00:00:00']);
        expect(parse('5', 'daysUntil')).toEqual(['2026-11-27 00:00:00', '2026-11-28 00:00:00']);
        expect(parse('+5', 'daysUntil')).toEqual(['2026-11-27 00:00:00', '2026-11-28 00:00:00']);
        expect(parse('-1', 'daysUntil')).toEqual(['2026-11-21 00:00:00', '2026-11-22 00:00:00']);
        // across New Year and the end of summer time
        expect(parse('40', 'daysUntil')).toEqual(['2027-01-01 00:00:00', '2027-01-02 00:00:00']);
        expect(parse('-28', 'daysUntil', TEXTS, at(2026, 11, 22, 0, 30))).toEqual(['2026-10-25 00:00:00', '2026-10-26 00:00:00']);
        expect(parse('5.5', 'daysUntil')).toBeNull();
        expect(parse('five', 'daysUntil')).toBeNull();
    });
});

describe('parseDateAs - date and time', () => {
    it('expect a format to the minute to be the minute, a leading 0 of the hour left out too', () => {
        expect(parse('2026-11-22 13:45', 'isoTime')).toEqual(['2026-11-22 13:45:00', '2026-11-22 13:46:00']);
        expect(parse('22.11.2026 13:45', 'norwegianTime')).toEqual(['2026-11-22 13:45:00', '2026-11-22 13:46:00']);
        expect(parse('2026-11-22 8:05', 'isoTime')).toEqual(['2026-11-22 08:05:00', '2026-11-22 08:06:00']);
        // the whole text as shown: the stored start would come back as a minute
        expect(parse('2026-11-22', 'isoTime')).toBeNull();
        expect(parse('2026-11-22 13:45:12', 'isoTime')).toBeNull();
    });

    it('expect a format to the second to be the second', () => {
        expect(parse('2026-11-22 13:45:12', 'isoSeconds')).toEqual(['2026-11-22 13:45:12', '2026-11-22 13:45:13']);
        expect(parse('22.11.2026 13:45:12', 'norwegianSeconds')).toEqual(['2026-11-22 13:45:12', '2026-11-22 13:45:13']);
        expect(parse('2026-11-22 13:45', 'isoSeconds')).toBeNull();
        expect(parse('22.11.2026', 'norwegianSeconds')).toBeNull();
    });

    it('expect a time that is no time of the day to be null: 25:00, a minute 60, the hour skipped in spring', () => {
        expect(parse('2026-11-22 25:00', 'isoTime')).toBeNull();
        expect(parse('2026-11-22 13:60', 'isoTime')).toBeNull();
        expect(parse('2026-03-29 02:30', 'isoTime')).toBeNull();
        expect(parse('2026-11-22 13:45:60', 'isoSeconds')).toBeNull();
    });

    it('expect the day of the week and a time of day to be no period: null', () => {
        expect(NOT_FILTERED_AS_SHOWN).toEqual(['weekday', 'time', 'timeSeconds']);
        expect(parse('Sunday', 'weekday')).toBeNull();
        expect(parse('13:45', 'time')).toBeNull();
        expect(parse('13:45:12', 'timeSeconds')).toBeNull();
    });
});

describe('periodOf and readDateAs', () => {
    it('expect the period of every format that is one to hold the date it is of', () => {
        const formats: DateFormat[] = [
            'iso',
            'norwegian',
            'norwegianShort',
            'us',
            'uk',
            'medium',
            'long',
            'full',
            'weekIso',
            'weekUs',
            'month',
            'quarter',
            'year',
            'daysUntil',
            'isoTime',
            'isoSeconds',
            'norwegianTime',
            'norwegianSeconds'
        ];
        for (const date of [
            TODAY,
            at(2027, 1, 1, 0, 0, 1),
            at(2026, 3, 29, 3, 0),
            at(2026, 10, 25, 2, 30),
            at(2024, 2, 29, 23, 59, 59)
        ]) {
            for (const format of formats) {
                const period = periodOf(date, format, TEXTS, TODAY) as DatePeriod;
                expect(period, `${format} ${date.toString()}`).not.toBeNull();
                expect(period.start <= date && date < period.next, `${format} ${date.toString()}`).toBe(true);
            }
        }
    });

    it('expect an ISO date read in any format as the period it is in: typed, and a Date as JSON writes it', () => {
        expect(shown(readDateAs('2026-11-18', 'weekIso', TEXTS, TODAY))).toEqual(['2026-11-16 00:00:00', '2026-11-23 00:00:00']);
        // Monday 2026-11-16 00:00 in Oslo, as JSON writes it
        const json = JSON.parse(JSON.stringify(at(2026, 11, 16)));
        expect(json).toBe('2026-11-15T23:00:00.000Z');
        expect(shown(readDateAs(json, 'weekIso', TEXTS, TODAY))).toEqual(['2026-11-16 00:00:00', '2026-11-23 00:00:00']);
        expect(shown(readDateAs(json, 'month', TEXTS, TODAY))).toEqual(['2026-11-01 00:00:00', '2026-12-01 00:00:00']);
        expect(shown(readDateAs('2026-W47', 'weekIso', TEXTS, TODAY))).toEqual(['2026-11-16 00:00:00', '2026-11-23 00:00:00']);
        expect(readDateAs('16/11', 'weekIso', TEXTS, TODAY)).toBeNull();
        expect(readDateAs('2026-02-30', 'weekIso', TEXTS, TODAY)).toBeNull();
    });
});

describe('canFilterAsShown and filtersAsShown', () => {
    it('expect a number format and a date format that is a period to be filtered as shown, on by default', () => {
        expect(canFilterAsShown({ number: {} }, TEXTS)).toBe(true);
        expect(canFilterAsShown({ date: 'weekIso' }, TEXTS)).toBe(true);
        expect(canFilterAsShown({ date: 'full' }, NORWEGIAN)).toBe(true);
        expect(filtersAsShown({ date: 'weekIso' }, TEXTS)).toBe(true);
        expect(filtersAsShown({ date: 'weekIso', filterAsShown: true }, TEXTS)).toBe(true);
    });

    it('expect false to turn it off, and no format, a text format, the day of the week and a time of day never to be', () => {
        expect(filtersAsShown({ date: 'weekIso', filterAsShown: false }, TEXTS)).toBe(false);
        expect(filtersAsShown({ number: { decimals: 2 }, filterAsShown: false }, TEXTS)).toBe(false);
        for (const format of NOT_FILTERED_AS_SHOWN) {
            expect(canFilterAsShown({ date: format }, TEXTS)).toBe(false);
        }
        expect(canFilterAsShown(undefined, TEXTS)).toBe(false);
        expect(canFilterAsShown({}, TEXTS)).toBe(false);
        expect(canFilterAsShown({ label: 'x' }, TEXTS)).toBe(false);
        expect(canFilterAsShown({ text: '{a}' }, TEXTS)).toBe(false);
    });

    it('expect a week of a translation without {year} not to be: it could not be read back', () => {
        expect(canFilterAsShown({ date: 'weekIso' }, { ...TEXTS, weekIso: 'W{week}' })).toBe(false);
        expect(canFilterAsShown({ date: 'quarter' }, { ...TEXTS, quarter: 'Q{quarter}' })).toBe(false);
    });
});

describe('parseNumberAs and formatNumberTyped', () => {
    it('expect the separators of the format', () => {
        expect(parseNumberAs('1 234,5', { thousands: ' ', decimal: ',' })).toBe(1234.5);
        expect(parseNumberAs('1 234 567,891', { thousands: ' ', decimal: ',' })).toBe(1234567.891);
        // a no-break space, pasted from Intl
        expect(parseNumberAs('1 234,5', { thousands: ' ', decimal: ',' })).toBe(1234.5);
        expect(parseNumberAs('1,234.5', { thousands: ',' })).toBe(1234.5);
        expect(parseNumberAs("1'234.5", { thousands: "'" })).toBe(1234.5);
        expect(parseNumberAs('1.234,5', { thousands: '.', decimal: ',' })).toBe(1234.5);
        expect(parseNumberAs('-1 234,5', { thousands: ' ', decimal: ',' })).toBe(-1234.5);
        expect(parseNumberAs('1234', {})).toBe(1234);
        // a dot is a decimal mark too when it is no thousands separator
        expect(parseNumberAs('12.5', { decimal: ',' })).toBe(12.5);
        // the thousands separator of the format is no decimal mark
        expect(parseNumberAs('12,5', { thousands: ',' })).toBe(125);
    });

    it('expect percent to be a hundredth of the number typed, with or without %', () => {
        expect(parseNumberAs('50 %', { percent: true })).toBe(0.5);
        expect(parseNumberAs('50%', { percent: true })).toBe(0.5);
        expect(parseNumberAs('50', { percent: true })).toBe(0.5);
        expect(parseNumberAs('7', { percent: true })).toBe(0.07);
        expect(parseNumberAs('12,5 %', { decimal: ',', percent: true })).toBe(0.125);
    });

    it('expect text that is no number to be null', () => {
        expect(parseNumberAs('', {})).toBeNull();
        expect(parseNumberAs('abc', {})).toBeNull();
        expect(parseNumberAs('-', {})).toBeNull();
        expect(parseNumberAs('1,2,3', {})).toBeNull();
        expect(parseNumberAs('1.2.3', { decimal: ',' })).toBeNull();
        expect(parseNumberAs('50 %', {})).toBeNull();
    });

    it('expect a number shown with the separators of the format and the decimals it has', () => {
        expect(formatNumberTyped(1234.5, { decimals: 2, thousands: ' ', decimal: ',' })).toBe('1 234,5');
        expect(formatNumberTyped(12.34, { decimals: 1 })).toBe('12.34');
        expect(formatNumberTyped(0.5, { percent: true })).toBe('50 %');
        expect(formatNumberTyped(0.125, { decimal: ',', percent: true })).toBe('12,5 %');
    });
});

describe('asShownFormatter', () => {
    it('expect a date written and read in the display format, the start of its period', () => {
        const formatter = asShownFormatter(DateFormatterYYYYMMDD, { date: 'weekIso' }, TEXTS, () => TODAY);
        expect(formatter.format(at(2026, 11, 18))).toBe('2026-W47');
        // the ISO text of a Date, as a state from JSON has it
        expect(formatter.format('2026-11-15T23:00:00.000Z')).toBe('2026-W47');
        expect(formatter.format(null)).toBe('');
        expect(formatter.parseFilter?.('2026-W47')).toEqual(at(2026, 11, 16));
        expect(formatter.parseFilter?.('2026-W4')).toEqual(at(2026, 1, 19));
        expect(formatter.parseFilter?.('2026-W')).toBeNull();
        expect(formatter.placeholder).toBe('2026-W47');
        // editing a cell is the field's
        expect(formatter.parse).toBe(DateFormatterYYYYMMDD.parse);
    });

    it('expect the days until: the date so many days from now, no placeholder (the grid has a text)', () => {
        const formatter = asShownFormatter(DateFormatterYYYYMMDD, { date: 'daysUntil' }, TEXTS, () => TODAY);
        expect(formatter.parseFilter?.('5')).toEqual(at(2026, 11, 27));
        expect(formatter.placeholder).toBeUndefined();
    });

    it('expect a number written with the separators and read with them, an example as the placeholder', () => {
        const number = { decimals: 2, thousands: ' ', decimal: ',' } as const;
        const formatter = asShownFormatter(DateFormatterYYYYMMDD, { number }, TEXTS, () => TODAY);
        expect(formatter.format(1234.5)).toBe('1 234,5');
        expect(formatter.parseFilter?.('1 234,5')).toBe(1234.5);
        expect(formatter.parseFilter?.('x')).toBeNull();
        expect(formatter.placeholder).toBe('1 234,5');
        expect(asShownFormatter(DateFormatterYYYYMMDD, { number: { percent: true } }, TEXTS, () => TODAY).placeholder).toBe(
            '50 %'
        );
    });
});

describe('dateConditions - each operator on a period', () => {
    const MONDAY = at(2026, 11, 16);
    const SUNDAY = at(2026, 11, 22);
    const SUNDAY_END = at(2026, 11, 22, 23, 59, 59);
    const conditions = (
        operator: Parameters<typeof dateConditions>[1],
        value: unknown,
        type: 'date' | 'datetime' = 'date',
        format: DateFormat = 'weekIso'
    ) => dateConditions('due', operator, value, type, format, TEXTS, TODAY);

    it('expect a week on a date field: = a BETWEEN of Monday and Sunday, ≥ from Monday, > after Sunday, < before Monday, ≤ to Sunday', () => {
        // any day of the week is its week: the value is the start the header filter read
        expect(conditions('EQUAL', at(2026, 11, 18))).toEqual([where('due', 'BETWEEN', [MONDAY, SUNDAY])]);
        expect(conditions('GREATER_THAN_OR_EQUAL_TO', MONDAY)).toEqual([where('due', 'GREATER_THAN_OR_EQUAL_TO', MONDAY)]);
        expect(conditions('GREATER_THAN', MONDAY)).toEqual([where('due', 'GREATER_THAN', SUNDAY)]);
        expect(conditions('LESS_THAN', MONDAY)).toEqual([where('due', 'LESS_THAN', MONDAY)]);
        expect(conditions('LESS_THAN_OR_EQUAL_TO', MONDAY)).toEqual([where('due', 'LESS_THAN_OR_EQUAL_TO', SUNDAY)]);
    });

    it('expect ≠ a week to be an OR group: before Monday, after Sunday or blank - as ≠ a day', () => {
        const [group] = conditions('NOT_EQUAL_TO', MONDAY);
        expect(group).toEqual(
            or(where('due', 'LESS_THAN', MONDAY), where('due', 'GREATER_THAN', SUNDAY), where('due', 'IS_BLANK'))
        );
        expect(isOutsidePeriod(group, 'due')).toBe(true);
        expect(isOutsidePeriod(group, 'other')).toBe(false);
        expect(isOutsidePeriod(or(where('due', 'LESS_THAN', MONDAY), where('due', 'GREATER_THAN', SUNDAY)), 'due')).toBe(false);
        expect(
            isOutsidePeriod(
                and(where('due', 'LESS_THAN', MONDAY), where('due', 'GREATER_THAN', SUNDAY), where('due', 'IS_BLANK')),
                'due'
            )
        ).toBe(false);
        expect(isOutsidePeriod(where('due', 'LESS_THAN', MONDAY), 'due')).toBe(false);
    });

    it('expect a datetime field to end at 23:59:59 of Sunday: it compares the second', () => {
        expect(conditions('EQUAL', MONDAY, 'datetime')).toEqual([where('due', 'BETWEEN', [MONDAY, SUNDAY_END])]);
        expect(conditions('GREATER_THAN', MONDAY, 'datetime')).toEqual([where('due', 'GREATER_THAN', SUNDAY_END)]);
        expect(conditions('LESS_THAN_OR_EQUAL_TO', MONDAY, 'datetime')).toEqual([
            where('due', 'LESS_THAN_OR_EQUAL_TO', SUNDAY_END)
        ]);
        // across the end of summer time: the week of 25 October
        expect(conditions('EQUAL', at(2026, 10, 19), 'datetime')).toEqual([
            where('due', 'BETWEEN', [at(2026, 10, 19), at(2026, 10, 25, 23, 59, 59)])
        ]);
    });

    it('expect BETWEEN from the start of the first period to the end of the last, an open end null', () => {
        expect(conditions('BETWEEN', [at(2026, 9, 28), MONDAY])).toEqual([where('due', 'BETWEEN', [at(2026, 9, 28), SUNDAY])]);
        expect(conditions('BETWEEN', [MONDAY, null])).toEqual([where('due', 'BETWEEN', [MONDAY, null])]);
        expect(conditions('BETWEEN', [null, MONDAY], 'datetime')).toEqual([where('due', 'BETWEEN', [null, SUNDAY_END])]);
        expect(conditions('BETWEEN', [null, null])).toEqual([]);
        expect(conditions('BETWEEN', [at(2026, 11, 1), at(2026, 12, 1)], 'date', 'month')).toEqual([
            where('due', 'BETWEEN', [at(2026, 11, 1), at(2026, 12, 31)])
        ]);
    });

    it('expect a period of one day on a date field, one second on a datetime field, to be the condition as without a format', () => {
        expect(conditions('EQUAL', SUNDAY, 'date', 'norwegian')).toEqual([where('due', 'EQUAL', SUNDAY)]);
        expect(conditions('NOT_EQUAL_TO', SUNDAY, 'date', 'daysUntil')).toEqual([where('due', 'NOT_EQUAL_TO', SUNDAY)]);
        const second = at(2026, 11, 22, 13, 45, 12);
        expect(conditions('EQUAL', second, 'datetime', 'isoSeconds')).toEqual([where('due', 'EQUAL', second)]);
        // a day on a datetime field is not one second
        expect(conditions('EQUAL', SUNDAY, 'datetime', 'norwegian')).toEqual([where('due', 'BETWEEN', [SUNDAY, SUNDAY_END])]);
        // the minute
        expect(conditions('EQUAL', at(2026, 11, 22, 13, 45), 'datetime', 'isoTime')).toEqual([
            where('due', 'BETWEEN', [at(2026, 11, 22, 13, 45), at(2026, 11, 22, 13, 45, 59)])
        ]);
    });

    it('expect month, quarter, year and days until: ≤ 5 days is up to the day in 5 days', () => {
        expect(conditions('EQUAL', at(2026, 10, 1), 'date', 'quarter')).toEqual([
            where('due', 'BETWEEN', [at(2026, 10, 1), at(2026, 12, 31)])
        ]);
        expect(conditions('GREATER_THAN', at(2026, 1, 1), 'date', 'year')).toEqual([
            where('due', 'GREATER_THAN', at(2026, 12, 31))
        ]);
        expect(conditions('LESS_THAN_OR_EQUAL_TO', at(2026, 11, 27), 'date', 'daysUntil')).toEqual([
            where('due', 'LESS_THAN_OR_EQUAL_TO', at(2026, 11, 27))
        ]);
    });

    it('expect no value, or one that is no Date, to be no condition', () => {
        expect(conditions('EQUAL', null)).toEqual([]);
        expect(conditions('EQUAL', '2026-W47')).toEqual([]);
    });

    it('expect the datasource to filter the rows of the week with them, and ≠ the others and the blanks', () => {
        const days = [
            at(2026, 11, 15, 23, 59, 59),
            at(2026, 11, 16),
            at(2026, 11, 19, 12),
            at(2026, 11, 22, 23, 59, 59),
            at(2026, 11, 23),
            null
        ];
        const datasource = new Datasource({ key: 'id', fields: { due: 'datetime' } });
        datasource.setData(days.map((due, id) => ({ id, due })));
        const ids = (filter: FilterExpression[]) => {
            datasource.filter(and(...filter));
            return datasource.getRows().map((row) => row.id);
        };
        expect(ids(conditions('EQUAL', MONDAY, 'datetime'))).toEqual([1, 2, 3]);
        expect(ids(conditions('NOT_EQUAL_TO', MONDAY, 'datetime'))).toEqual([0, 4, 5]);
        expect(ids(conditions('GREATER_THAN', MONDAY, 'datetime'))).toEqual([4]);
        expect(ids(conditions('GREATER_THAN_OR_EQUAL_TO', MONDAY, 'datetime'))).toEqual([1, 2, 3, 4]);
        expect(ids(conditions('LESS_THAN', MONDAY, 'datetime'))).toEqual([0]);
        expect(ids(conditions('LESS_THAN_OR_EQUAL_TO', MONDAY, 'datetime'))).toEqual([0, 1, 2, 3]);
    });
});

describe('the clock of daysUntil', () => {
    it('expect the formatter to read today when it is called: a fake clock', () => {
        vi.useFakeTimers();
        vi.setSystemTime(at(2026, 11, 22, 9));
        const formatter = asShownFormatter(DateFormatterYYYYMMDD, { date: 'daysUntil' }, TEXTS, () => new Date());
        expect(formatter.parseFilter?.('1')).toEqual(at(2026, 11, 23));
        vi.setSystemTime(at(2026, 11, 23, 9));
        expect(formatter.parseFilter?.('1')).toEqual(at(2026, 11, 24));
        expect(formatter.format(at(2026, 11, 24, 18))).toBe('1');
    });
});
