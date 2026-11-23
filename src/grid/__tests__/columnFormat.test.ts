import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DateFormatterDDMMYYYY } from '../../datasource/DateFormatterDDMMYYYY';
import { DateFormatterYYYYMMDD } from '../../datasource/DateFormatterYYYYMMDD';
import type { Formatter } from '../../datasource/formatter';
import { NumberFormatterComma } from '../../datasource/numberFormatterComma';
import { NumberFormatterDot } from '../../datasource/numberFormatterDot';
import { setTexts } from '../../texts';
import {
    assertColumnFormat,
    type ColumnFormat,
    checkboxProblem,
    checkboxValueOf,
    checkboxValues,
    compactNumberFormat,
    DATE_FORMATS,
    DATETIME_FORMATS,
    type DateFormat,
    daysUntil,
    decimalMarkOf,
    displayFormatter,
    formatDateAs,
    formatNumberAs,
    formatTexts,
    formatValueAs,
    hasDisplayFormat,
    hasValueFormat,
    isCheckedValue,
    isoWeek,
    usWeek
} from '../columnFormat';

/**
 * The display formats of a column (columnFormat.ts): what each date and number format shows, the weeks
 * around New Year, the days until across midnight and summer time, the rounding and the separators, the
 * formatter the grid shows a cell with, and the check of a format from plain JavaScript or JSON. The grid
 * side - the menu, the state, the cells - is in columnFormatGrid.test.ts.
 */

// local dates: a time zone with summer time. Node reads TZ again when it is set
const originalTimeZone = process.env.TZ;
beforeAll(() => {
    process.env.TZ = 'Europe/Oslo';
});
afterAll(() => {
    // process.env holds text: undefined would be the TZ 'undefined'
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});
afterEach(() => {
    vi.useRealTimers();
});

// a Sunday, 13:45:12 local time
const SUNDAY = new Date(2026, 10, 22, 13, 45, 12);

// the texts of the date formats: the English defaults, and the names in Norwegian
const EN = formatTexts();
const NB = { ...EN, locale: 'nb-NO' };

describe('display formats - dates', () => {
    it('expect every date format of 2026-11-22 13:45:12, the names in English and Norwegian', () => {
        const shown = (locale: string) =>
            Object.fromEntries(
                [...DATE_FORMATS, ...DATETIME_FORMATS].map((format) => [
                    format,
                    formatDateAs(SUNDAY, format, { ...EN, locale }, SUNDAY)
                ])
            );

        expect(shown('en-US')).toEqual({
            iso: '2026-11-22',
            norwegian: '22.11.2026',
            norwegianShort: '22.11.26',
            us: '11/22/2026',
            uk: '22/11/2026',
            medium: 'Nov 22, 2026',
            long: 'November 22, 2026',
            full: 'Sunday, November 22, 2026',
            weekday: 'Sunday',
            weekIso: '2026-W47',
            weekUs: '2026-W48',
            month: '2026-11',
            quarter: '2026 Q4',
            year: '2026',
            daysUntil: '0',
            isoTime: '2026-11-22 13:45',
            isoSeconds: '2026-11-22 13:45:12',
            norwegianTime: '22.11.2026 13:45',
            norwegianSeconds: '22.11.2026 13:45:12',
            time: '13:45',
            timeSeconds: '13:45:12'
        });
        // only the names change with the language
        expect(shown('nb-NO')).toEqual({
            ...shown('en-US'),
            medium: '22. nov. 2026',
            long: '22. november 2026',
            full: 'søndag 22. november 2026',
            weekday: 'søndag'
        });
    });

    it('expect the Norwegian short month to have a dot only when it is cut: mai, nov.', () => {
        expect(formatDateAs(new Date(2026, 4, 3), 'medium', NB, SUNDAY)).toEqual('3. mai 2026');
        expect(formatDateAs(new Date(2026, 4, 3), 'full', NB, SUNDAY)).toEqual('søndag 3. mai 2026');
    });

    it('expect a locale Intl does not take to show the names in English', () => {
        // an underscore, an empty text: a RangeError in Intl
        for (const locale of ['nb_NO', '', '«format.locale»']) {
            expect(formatDateAs(SUNDAY, 'full', { ...EN, locale }, SUNDAY), locale).toEqual('Sunday, November 22, 2026');
            expect(formatDateAs(SUNDAY, 'weekday', { ...EN, locale }, SUNDAY), locale).toEqual('Sunday');
        }
    });

    it('expect the parts padded and the quarters by month', () => {
        const date = new Date(2026, 0, 5, 7, 3, 9);
        expect(formatDateAs(date, 'norwegian', EN, date)).toEqual('05.01.2026');
        expect(formatDateAs(date, 'us', EN, date)).toEqual('01/05/2026');
        expect(formatDateAs(date, 'timeSeconds', EN, date)).toEqual('07:03:09');
        expect(formatDateAs(new Date(2009, 6, 1), 'norwegianShort', EN, date)).toEqual('01.07.09');
        const quarters = Array.from({ length: 12 }, (_, month) => formatDateAs(new Date(2026, month, 1), 'quarter', EN, date));
        expect(quarters).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4].map((q) => `2026 Q${q}`));
    });

    it('expect the leap day', () => {
        const leap = new Date(2024, 1, 29, 12);
        expect(formatDateAs(leap, 'iso', EN, leap)).toEqual('2024-02-29');
        expect(formatDateAs(leap, 'weekday', NB, leap)).toEqual('torsdag');
        expect(formatDateAs(leap, 'weekIso', EN, leap)).toEqual('2024-W09');
        expect(formatDateAs(leap, 'weekUs', EN, leap)).toEqual('2024-W09');
        expect(daysUntil(new Date(2024, 2, 1), new Date(2024, 1, 28))).toEqual(2);
    });
});

describe('display formats - the texts of a week and a quarter', () => {
    it('expect the week and the quarter written as the texts say, {week} with two digits', () => {
        const norwegian = { ...NB, weekIso: 'uke {week} {year}', weekUs: 'U{week}', quarter: '{quarter}. kvartal {year}' };
        const january = new Date(2027, 0, 8);
        expect(formatDateAs(january, 'weekIso', norwegian, january)).toEqual('uke 01 2027');
        expect(formatDateAs(SUNDAY, 'weekIso', norwegian, SUNDAY)).toEqual('uke 47 2026');
        expect(formatDateAs(SUNDAY, 'weekUs', norwegian, SUNDAY)).toEqual('U48');
        expect(formatDateAs(SUNDAY, 'quarter', norwegian, SUNDAY)).toEqual('4. kvartal 2026');
    });

    it("expect the texts of a grid, then the page's, then the defaults", () => {
        expect(formatTexts()).toEqual({
            locale: 'en-US',
            weekIso: '{year}-W{week}',
            weekUs: '{year}-W{week}',
            quarter: '{year} Q{quarter}'
        });
        setTexts({ 'format.locale': 'nb-NO', 'format.quarter': 'K{quarter} {year}' });
        try {
            expect(formatTexts({ 'format.quarter': '{year}/{quarter}' })).toEqual({
                locale: 'nb-NO',
                weekIso: '{year}-W{week}',
                weekUs: '{year}-W{week}',
                quarter: '{year}/{quarter}'
            });
        } finally {
            setTexts({});
        }
    });
});

describe('display formats - weeks', () => {
    // [the local day, ISO week, US week]
    const weeks: [string, string, string][] = [
        // 2026 starts on a Thursday: week 1 of both, 53 ISO weeks
        ['2026-01-01', '2026-W01', '2026-W01'],
        ['2026-01-04', '2026-W01', '2026-W02'],
        ['2026-01-05', '2026-W02', '2026-W02'],
        ['2026-12-28', '2026-W53', '2026-W53'],
        ['2026-12-31', '2026-W53', '2026-W53'],
        // a Friday: still the ISO week of the year before; the US week 1 of the new year
        ['2027-01-01', '2026-W53', '2027-W01'],
        ['2027-01-03', '2026-W53', '2027-W02'],
        ['2027-01-04', '2027-W01', '2027-W02'],
        // 2020: a leap year from a Wednesday, 53 ISO weeks
        ['2020-12-31', '2020-W53', '2020-W53'],
        ['2021-01-03', '2020-W53', '2021-W02'],
        // the last days of December in week 1 of the next year
        ['2024-12-30', '2025-W01', '2024-W53'],
        ['2025-12-29', '2026-W01', '2025-W53'],
        // 52 weeks: 2025-12-28 is a Sunday in week 52
        ['2025-12-28', '2025-W52', '2025-W53'],
        // 2000: a leap year from a Saturday, its last day in US week 54 (Excel's WEEKNUM)
        ['2000-01-01', '1999-W52', '2000-W01'],
        ['2000-01-02', '1999-W52', '2000-W02'],
        ['2000-12-31', '2000-W52', '2000-W54']
    ];

    /** the local day of 'YYYY-MM-DD' at an hour, in the time zone of the moment */
    const localDay = (day: string, hour = 12) => {
        const [year, month, date] = day.split('-').map(Number);
        return new Date(year, month - 1, date, hour, 59);
    };

    it.each(weeks)('expect %s in ISO week %s and US week %s', (day, iso, us) => {
        expect(formatDateAs(localDay(day), 'weekIso', EN, SUNDAY)).toEqual(iso);
        expect(formatDateAs(localDay(day), 'weekUs', EN, SUNDAY)).toEqual(us);
    });

    it('expect the same week at any time of the day, and in other time zones', () => {
        for (const timeZone of ['Europe/Oslo', 'America/New_York', 'Pacific/Auckland', 'UTC']) {
            process.env.TZ = timeZone;
            for (const [day, iso, us] of weeks) {
                // the local day in this time zone, at the start and the end of it
                for (const hour of [0, 23]) {
                    expect(formatDateAs(localDay(day, hour), 'weekIso', EN, SUNDAY), `${timeZone} ${day}`).toEqual(iso);
                    expect(formatDateAs(localDay(day, hour), 'weekUs', EN, SUNDAY), `${timeZone} ${day}`).toEqual(us);
                }
            }
        }
        process.env.TZ = 'Europe/Oslo';
    });

    it('expect the week of every day of five years to step by one each Monday (ISO) and Sunday (US)', () => {
        let day = new Date(2024, 0, 1);
        let previous = isoWeek(day);
        let previousUs = usWeek(day);
        while (day.getFullYear() < 2029) {
            day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
            const week = isoWeek(day);
            const us = usWeek(day);
            if (day.getDay() === 1) {
                const next = previous.week >= 52 && week.week === 1 ? 1 : previous.week + 1;
                expect(week.week, day.toDateString()).toEqual(next);
            } else {
                expect(week, day.toDateString()).toEqual(previous);
            }
            if (day.getMonth() === 0 && day.getDate() === 1) {
                expect(us, day.toDateString()).toEqual(1);
            } else if (day.getDay() === 0) {
                expect(us, day.toDateString()).toEqual(previousUs + 1);
            } else {
                expect(us, day.toDateString()).toEqual(previousUs);
            }
            previous = week;
            previousUs = us;
        }
    });

    it('expect a year before 100 to be that year, not 1900 and after', () => {
        const date = new Date(2026, 0, 1);
        date.setFullYear(50);
        expect(isoWeek(date).year).toEqual(date.getDay() >= 1 && date.getDay() <= 4 ? 50 : 49);
        expect(formatDateAs(date, 'year', EN, date)).toEqual('50');
    });
});

describe('display formats - days until', () => {
    it('expect whole days from today: tomorrow 1, yesterday -1, the time of day left out', () => {
        const today = new Date(2026, 10, 22, 23, 59);
        expect(daysUntil(new Date(2026, 10, 22, 0, 0), today)).toEqual(0);
        expect(daysUntil(new Date(2026, 10, 23, 0, 1), today)).toEqual(1);
        expect(daysUntil(new Date(2026, 10, 21, 23, 59), today)).toEqual(-1);
        expect(daysUntil(new Date(2027, 10, 22), today)).toEqual(365);
        expect(daysUntil(new Date(2025, 10, 22), today)).toEqual(-365);
    });

    it('expect the days across summer time, both ways', () => {
        // Europe/Oslo: 2026-03-29 has 23 hours, 2026-10-25 has 25
        expect(daysUntil(new Date(2026, 2, 30, 0, 30), new Date(2026, 2, 28, 23, 30))).toEqual(2);
        expect(daysUntil(new Date(2026, 9, 26, 0, 0), new Date(2026, 9, 24, 23, 59))).toEqual(2);
        expect(daysUntil(new Date(2026, 2, 28), new Date(2026, 2, 30))).toEqual(-2);
    });

    it('expect today to be the day the value is shown: one day less after midnight', () => {
        vi.useFakeTimers();
        const due = new Date(2026, 10, 25, 12);
        vi.setSystemTime(new Date(2026, 10, 22, 23, 59, 59));
        expect(formatValueAs(due, { date: 'daysUntil' }, EN)).toEqual('3');
        vi.setSystemTime(new Date(2026, 10, 23, 0, 0, 1));
        expect(formatValueAs(due, { date: 'daysUntil' }, EN)).toEqual('2');
        vi.setSystemTime(new Date(2026, 10, 26, 0, 0, 0));
        expect(formatValueAs(due, { date: 'daysUntil' }, EN)).toEqual('-1');
    });
});

describe('display formats - numbers', () => {
    const value = 1234567.891;

    it('expect the separators and the decimals', () => {
        expect(formatNumberAs(value, {})).toEqual('1234567.891');
        expect(formatNumberAs(value, { thousands: ' ', decimal: ',' })).toEqual('1 234 567,891');
        expect(formatNumberAs(value, { thousands: ',' })).toEqual('1,234,567.891');
        expect(formatNumberAs(value, { thousands: '.', decimal: ',' })).toEqual('1.234.567,891');
        expect(formatNumberAs(value, { thousands: "'" })).toEqual("1'234'567.891");
        expect(formatNumberAs(value, { decimal: ',' })).toEqual('1234567,891');
        expect(formatNumberAs(value, { decimals: 0 })).toEqual('1234568');
        expect(formatNumberAs(value, { decimals: 1 })).toEqual('1234567.9');
        expect(formatNumberAs(value, { decimals: 2, thousands: ' ', decimal: ',' })).toEqual('1 234 567,89');
        expect(formatNumberAs(value, { decimals: 4, thousands: ',' })).toEqual('1,234,567.8910');
    });

    it('expect the space to be a plain space: Find finds a space typed', () => {
        expect(formatNumberAs(1234, { thousands: ' ' })).toEqual('1 234');
    });

    it('expect negatives, 0 and small numbers: the separators only between the digits', () => {
        expect(formatNumberAs(-1234567.891, { decimals: 2, thousands: ' ', decimal: ',' })).toEqual('-1 234 567,89');
        expect(formatNumberAs(-123, { thousands: ' ' })).toEqual('-123');
        expect(formatNumberAs(-123456, { thousands: ',' })).toEqual('-123,456');
        expect(formatNumberAs(0, { decimals: 2, decimal: ',' })).toEqual('0,00');
        expect(formatNumberAs(0, {})).toEqual('0');
        expect(formatNumberAs(-0, {})).toEqual('0');
        expect(formatNumberAs(0.5, { thousands: ' ' })).toEqual('0.5');
        expect(formatNumberAs(999, { thousands: ' ' })).toEqual('999');
        expect(formatNumberAs(1000, { thousands: ' ' })).toEqual('1 000');
    });

    it('expect no minus for a negative number rounded to 0', () => {
        expect(formatNumberAs(-0.001, { decimals: 2 })).toEqual('0.00');
        expect(formatNumberAs(-0.4, { decimals: 0 })).toEqual('0');
        expect(formatNumberAs(-0.5, { decimals: 0 })).toEqual('-1');
    });

    it('expect half rounded away from zero, of the number as it is written', () => {
        expect(formatNumberAs(2.5, { decimals: 0 })).toEqual('3');
        expect(formatNumberAs(-2.5, { decimals: 0 })).toEqual('-3');
        expect(formatNumberAs(0.125, { decimals: 2 })).toEqual('0.13');
        // 1.005 is 1.00499999999999989... in binary: toFixed(2) gives 1.00
        expect(formatNumberAs(1.005, { decimals: 2 })).toEqual('1.01');
        expect(formatNumberAs(1.45, { decimals: 1 })).toEqual('1.5');
        expect(formatNumberAs(9.995, { decimals: 2, thousands: ' ' })).toEqual('10.00');
        expect(formatNumberAs(999999.5, { decimals: 0, thousands: ' ' })).toEqual('1 000 000');
    });

    it('expect the decimals as is to be the number as the field formatter writes it', () => {
        for (const number of [0.1 + 0.2, 123456789.12345679, 1e-7, 0.000001, 42, -3.5]) {
            expect(formatNumberAs(number, {}), String(number)).toEqual(
                String(number).includes('e') ? formatNumberAs(number, {}) : NumberFormatterDot.format(number)
            );
        }
        // no exponent: String() writes these as 1e-7 and 1e+21
        expect(formatNumberAs(1e-7, {})).toEqual('0.0000001');
        expect(formatNumberAs(1e21, { thousands: ',' })).toEqual('1,000,000,000,000,000,000,000');
    });

    it('expect percent: times 100 with " %", without the binary tail of the multiplication', () => {
        expect(formatNumberAs(0.256, { percent: true })).toEqual('25.6 %');
        expect(formatNumberAs(0.256, { percent: true, decimal: ',' })).toEqual('25,6 %');
        expect(formatNumberAs(0.07, { percent: true })).toEqual('7 %');
        expect(formatNumberAs(0.07, { percent: true, decimals: 2 })).toEqual('7.00 %');
        expect(formatNumberAs(-12.5, { percent: true, thousands: ' ' })).toEqual('-1 250 %');
        expect(formatNumberAs(1, { percent: true })).toEqual('100 %');
    });
});

describe('display formats - the value of a cell', () => {
    it('expect a blank, and what the format can not show, to be null: the field formatter shows them', () => {
        const date: ColumnFormat = { date: 'iso' };
        const number: ColumnFormat = { number: { decimals: 2 } };
        for (const value of [null, undefined, '', 'abc', Number.NaN, new Date(Number.NaN), true, {}]) {
            expect(formatValueAs(value, date, EN), String(value)).toBeNull();
        }
        for (const value of [null, undefined, '', '12.5', Number.NaN, Number.POSITIVE_INFINITY, true, new Date()]) {
            expect(formatValueAs(value, number, EN), String(value)).toBeNull();
        }
        expect(formatValueAs(SUNDAY, {}, EN)).toBeNull();
    });

    it('expect a date as text or a timestamp read as the date formatters read them', () => {
        expect(formatValueAs('2026-11-22T13:45:12', { date: 'norwegianSeconds' }, EN)).toEqual('22.11.2026 13:45:12');
        expect(formatValueAs(SUNDAY.getTime(), { date: 'weekIso' }, EN)).toEqual('2026-W47');
    });

    it('expect hasDisplayFormat only for a format with a part', () => {
        expect(hasDisplayFormat(undefined)).toBe(false);
        expect(hasDisplayFormat({})).toBe(false);
        expect(hasDisplayFormat({ date: 'iso' })).toBe(true);
        expect(hasDisplayFormat({ number: {} })).toBe(true);
        expect(hasDisplayFormat({ text: '{value} kg' })).toBe(true);
        expect(hasDisplayFormat({ link: { url: '{website}' } })).toBe(true);
        // the rest of the column settings: a format of its own too
        expect(hasDisplayFormat({ label: 'Who' })).toBe(true);
        expect(hasDisplayFormat({ placeholderRow: 'Required' })).toBe(true);
        expect(hasDisplayFormat({ placeholderRowLabel: false })).toBe(true);
        expect(hasDisplayFormat({ numberOverride: 'NONE' })).toBe(true);
        expect(hasDisplayFormat({ checkbox: {} })).toBe(true);
    });

    it('expect hasValueFormat only for a date or number format: a template needs the row', () => {
        expect(hasValueFormat(undefined)).toBe(false);
        expect(hasValueFormat({ date: 'iso' })).toBe(true);
        expect(hasValueFormat({ number: {} })).toBe(true);
        expect(hasValueFormat({ text: '{value} kg' })).toBe(false);
        expect(hasValueFormat({ link: { url: '{website}' } })).toBe(false);
    });
});

describe('display formats - the formatter of the cells', () => {
    it('expect format() to be the display format, the field formatter for a blank and what is no date', () => {
        const formatter = displayFormatter(DateFormatterDDMMYYYY, { date: 'weekIso' }, EN);
        expect(formatter.format(SUNDAY)).toEqual('2026-W47');
        expect(formatter.format(null)).toEqual('');
        expect(formatter.format('abc')).toEqual('');
    });

    it('expect editing to keep to the field formatter: formatForEdit, parse, parseFilter, placeholder', () => {
        const formatter = displayFormatter(DateFormatterDDMMYYYY, { date: 'weekIso' }, EN);
        // DateFormatterDDMMYYYY has no formatForEdit: its format
        expect(formatter.formatForEdit?.(SUNDAY)).toEqual('22.11.2026');
        expect(formatter.parse('22.11.2026')).toBeInstanceOf(Date);
        expect(formatter.parseFilter?.('22.11.2026')).toEqual(new Date(2026, 10, 22));
        expect(formatter.placeholder).toEqual('DD.MM.YYYY');
    });

    it("expect the field formatter's own formatForEdit, called on it (this)", () => {
        const money: Formatter = {
            ...NumberFormatterDot,
            prefix: 'kr ',
            format(this: { prefix: string }, value: unknown) {
                return `${this.prefix}${NumberFormatterDot.format(value)}`;
            },
            formatForEdit(this: { prefix: string }, value: unknown) {
                return `${this.prefix.trim()}${NumberFormatterDot.format(value)}`;
            }
        } as Formatter;
        const formatter = displayFormatter(money, { number: { decimals: 2, thousands: ' ' } }, EN);
        expect(formatter.format(1234.5)).toEqual('1 234.50');
        expect(formatter.formatForEdit?.(1234.5)).toEqual('kr1234.5');
        // what the format can not show: the field formatter, called on it
        expect(formatter.format('x')).toEqual('kr ');
    });

    it('expect the date formatter of the field kept for the editor, whichever date format is shown', () => {
        for (const format of DATE_FORMATS) {
            const formatter = displayFormatter(DateFormatterYYYYMMDD, { date: format }, NB);
            expect(formatter.formatForEdit?.(SUNDAY), format).toEqual('2026-11-22');
        }
    });
});

describe('display formats - the check of a format', () => {
    const check =
        (format: unknown, type: 'date' | 'datetime' | 'number' | 'text' | 'boolean', lookup = false) =>
        () =>
            assertColumnFormat(format, 'field', type, lookup, 'GridConfig: columns.field.format');

    it('expect every date format on a date field, the time formats on a datetime field only', () => {
        for (const format of DATE_FORMATS) {
            expect(check({ date: format }, 'date')).not.toThrow();
            expect(check({ date: format }, 'datetime')).not.toThrow();
        }
        for (const format of DATETIME_FORMATS) {
            expect(check({ date: format }, 'datetime')).not.toThrow();
            expect(check({ date: format }, 'date')).toThrow(
                new TypeError(
                    `GridConfig: columns.field.format.date is "${format}", it shows the time of day: for a datetime field, 'field' is date. A date field takes ${DATE_FORMATS.map((id) => `'${id}'`).join(', ')}`
                )
            );
        }
    });

    it('expect undefined and {} to be no format', () => {
        expect(check(undefined, 'text')).not.toThrow();
        expect(check({}, 'text')).not.toThrow();
        expect(check({}, 'date')).not.toThrow();
    });

    it('expect a TypeError for an unknown date format, and a part for another type', () => {
        expect(check({ date: 'week' }, 'date')).toThrow(TypeError);
        expect(check({ date: 'week' }, 'date')).toThrow(/format.date is "week", a date field takes 'iso', 'norwegian'/);
        expect(check({ date: 'weekIso' }, 'number')).toThrow(
            new TypeError("GridConfig: columns.field.format.date is for a date or datetime field, 'field' is number")
        );
        expect(check({ number: {} }, 'date')).toThrow(
            new TypeError("GridConfig: columns.field.format.number is for a number field, 'field' is date")
        );
        expect(check({ date: 'iso' }, 'text')).toThrow(TypeError);
        expect(check({ number: {} }, 'boolean')).toThrow(TypeError);
    });

    it('expect a TypeError for what is no format object, and a part it does not know', () => {
        expect(check('weekIso', 'date')).toThrow(/is "weekIso", it is an object: \{ date: 'norwegian' \}/);
        expect(check(null, 'date')).toThrow(TypeError);
        expect(check([], 'date')).toThrow(TypeError);
        expect(check({ color: 'red' }, 'text')).toThrow(
            new TypeError(
                "GridConfig: columns.field.format has 'color', a format has date, number, text, link, label, placeholderRow, placeholderRowLabel, numberOverride, checkbox, filterAsShown, multiline, readonly, rules"
            )
        );
    });

    it('expect a TypeError for a format on a lookup column', () => {
        expect(check({ number: { decimals: 2 } }, 'number', true)).toThrow(/a lookup column \(editor\) shows the label/);
        expect(check({}, 'number', true)).not.toThrow();
    });

    it('expect the parts of a number format checked', () => {
        expect(check({ number: { decimals: 2, thousands: ' ', decimal: ',', percent: true } }, 'number')).not.toThrow();
        expect(check({ number: 2 }, 'number')).toThrow(/format.number is 2, it is an object/);
        expect(check({ number: { decimal: ',', digits: 2 } }, 'number')).toThrow(
            new TypeError(
                "GridConfig: columns.field.format.number has 'digits', a number format has decimals, thousands, decimal, percent"
            )
        );
        for (const decimals of [5, -1, 1.5, '2', null]) {
            expect(check({ number: { decimals } }, 'number'), String(decimals)).toThrow(/decimals is .*, it is 0, 1, 2, 3 or 4/);
        }
        for (const thousands of ['', '_', 'space', ' ']) {
            expect(check({ number: { thousands } }, 'number'), thousands).toThrow(/thousands is .*, it is ' ', ','/);
        }
        expect(check({ number: { decimal: ' ' } }, 'number')).toThrow(/decimal is " ", it is '.' or ','/);
        expect(check({ number: { percent: 'yes' } }, 'number')).toThrow(/percent is "yes", it is true or false/);
    });

    it('expect a TypeError when one character would be both separators', () => {
        expect(check({ number: { thousands: ',', decimal: ',' } }, 'number')).toThrow(
            new TypeError(
                "GridConfig: columns.field.format.number has ',' as the thousands separator and the decimal mark: give them different characters"
            )
        );
        expect(check({ number: { thousands: '.' } }, 'number')).toThrow(/left out, the decimal mark is '\.'/);
        expect(check({ number: { thousands: '.', decimal: ',' } }, 'number')).not.toThrow();
        expect(check({ number: { thousands: ',', decimal: '.' } }, 'number')).not.toThrow();
    });

    it('expect a template and a link on a text field, and on no other type', () => {
        expect(check({ text: '{name} ({id})' }, 'text')).not.toThrow();
        expect(check({ link: { url: 'https://x.com/{id}', newTab: true } }, 'text')).not.toThrow();
        expect(check({ text: '{company}', link: { url: 'mailto:{email}' } }, 'text')).not.toThrow();
        expect(check({ text: '{value} kg' }, 'number')).toThrow(
            new TypeError("GridConfig: columns.field.format.text is for a text field, 'field' is number")
        );
        expect(check({ link: { url: '{website}' } }, 'date')).toThrow(
            new TypeError("GridConfig: columns.field.format.link is for a text field, 'field' is date")
        );
        expect(check({ link: { url: '{website}' } }, 'boolean')).toThrow(TypeError);
        // a date part on a text field still says what it says
        expect(check({ date: 'iso' }, 'text')).toThrow(/format.date is for a date or datetime field/);
    });

    it('expect no template and no link on a lookup column: its cells show a label', () => {
        expect(check({ text: '{value}' }, 'text', true)).toThrow(/a lookup column \(editor\) shows the label/);
        expect(check({ link: { url: '{website}' } }, 'text', true)).toThrow(/a lookup column \(editor\) shows the label/);
    });

    it("expect a template to be text that is not empty, without a placeholder of the grid's own", () => {
        expect(check({ text: '' }, 'text')).toThrow(/format.text is "", it is a template/);
        expect(check({ text: 12 }, 'text')).toThrow(/format.text is 12, it is a template/);
        expect(check({ text: null }, 'text')).toThrow(TypeError);
        expect(check({ text: '{__rowState}' }, 'text')).toThrow(
            new TypeError(
                "GridConfig: columns.field.format.text has {__rowState}: a name that starts with __ is the grid's own, not a field"
            )
        );
    });

    it('expect a link to be an object with its address, and newTab true or false', () => {
        expect(check({ link: 'https://x.com' }, 'text')).toThrow(/format.link is "https:\/\/x.com", it is an object/);
        expect(check({ link: {} }, 'text')).toThrow(/format.link.url is undefined, it is the address/);
        expect(check({ link: { url: '' } }, 'text')).toThrow(/format.link.url is "", it is the address/);
        expect(check({ link: { url: 'https://x.com', label: '{name}' } }, 'text')).toThrow(
            new TypeError("GridConfig: columns.field.format.link has 'label', a link has url, newTab")
        );
        expect(check({ link: { url: 'https://x.com', newTab: 'yes' } }, 'text')).toThrow(
            /format.link.newTab is "yes", it is true or false/
        );
        expect(check({ link: { url: 'https://x.com', newTab: false } }, 'text')).not.toThrow();
    });

    it('expect the address of a link to start with https, http, mailto or tel, or to be one placeholder', () => {
        for (const url of ['https://x.com/{id}', 'http://x.com', 'mailto:{email}', 'tel:{phone}', '{website}', 'HTTPS://X.COM']) {
            expect(check({ link: { url } }, 'text'), url).not.toThrow();
        }
        expect(check({ link: { url: 'javascript:alert({id})' } }, 'text')).toThrow(
            new TypeError(
                'GridConfig: columns.field.format.link.url is "javascript:alert({id})": a link to javascript: is not allowed, only https:, http:, mailto:, tel:'
            )
        );
        expect(check({ link: { url: 'data:text/html,{x}' } }, 'text')).toThrow(/a link to data: is not allowed/);
        expect(check({ link: { url: '/customer/{id}' } }, 'text')).toThrow(
            /format.link.url is "\/customer\/\{id\}": it starts with https:\/\/, http:\/\/, mailto: or tel:, or is one \{field\}/
        );
        expect(check({ link: { url: '{base}/customer/{id}' } }, 'text')).toThrow(/it starts with https:\/\//);
        expect(check({ link: { url: 'https://x.com/{__controller}' } }, 'text')).toThrow(/has \{__controller\}/);
    });

    it('expect a label and a placeholder on any column, text not empty; no placeholder on a checkbox column', () => {
        for (const type of ['text', 'number', 'date', 'datetime', 'boolean'] as const) {
            expect(check({ label: 'Who' }, type), type).not.toThrow();
        }
        expect(check({ placeholderRow: 'Required', placeholderRowLabel: false }, 'number')).not.toThrow();
        expect(check({ placeholderRowLabel: true }, 'date')).not.toThrow();
        // a lookup column takes them: they are no format of its cells
        expect(check({ label: 'Code', placeholderRow: 'A code', numberOverride: undefined }, 'number', true)).not.toThrow();
        expect(check({ label: '' }, 'text')).toThrow(/format.label is "", it is the column's label: text, not ''/);
        expect(check({ label: '  ' }, 'text')).toThrow(TypeError);
        expect(check({ label: 12 }, 'text')).toThrow(/format.label is 12/);
        expect(check({ placeholderRow: '' }, 'text')).toThrow(
            /format.placeholderRow is "", it is the placeholder of the empty cells/
        );
        expect(check({ placeholderRowLabel: 'yes' }, 'text')).toThrow(/format.placeholderRowLabel is "yes", it is true or false/);
        expect(check({ placeholderRow: 'Search', placeholderRowLabel: true }, 'text')).toThrow(
            /has placeholderRow and placeholderRowLabel: true - the placeholder is the text or the label, not both/
        );
        expect(check({ placeholderRow: 'Yes' }, 'boolean')).toThrow(
            /format.placeholderRow is for a cell that is typed in, 'field' is boolean: its cells are checkboxes/
        );
        expect(check({ placeholderRowLabel: true }, 'boolean')).toThrow(/format.placeholderRowLabel is for a cell/);
        // a lookup column on a boolean field shows its labels, typed
        expect(check({ placeholderRowLabel: true }, 'boolean', true)).not.toThrow();
    });

    it('expect numberOverride on a number field, of the three values; not on a lookup column', () => {
        for (const numberOverride of ['BLANK_TO_ZERO', 'ZERO_TO_BLANK', 'NONE']) {
            expect(check({ numberOverride, number: { decimals: 2 } }, 'number'), numberOverride).not.toThrow();
        }
        expect(check({ numberOverride: 'ZERO' }, 'number')).toThrow(
            /format.numberOverride is "ZERO", it is 'BLANK_TO_ZERO', 'ZERO_TO_BLANK', 'NONE'/
        );
        expect(check({ numberOverride: 'NONE' }, 'text')).toThrow(/format.numberOverride is for a number field, 'field' is text/);
        expect(check({ numberOverride: 'NONE' }, 'number', true)).toThrow(/a lookup column \(editor\) shows the label/);
    });

    it('expect checkboxes on a text or number field, values that are text, numbers for a number field', () => {
        expect(check({ checkbox: {} }, 'text')).not.toThrow();
        expect(check({ checkbox: {} }, 'number')).not.toThrow();
        expect(check({ checkbox: { checked: 'Y', unchecked: 'N' }, label: 'Flag' }, 'text')).not.toThrow();
        expect(check({ checkbox: { checked: '1', unchecked: '' } }, 'number')).not.toThrow();
        expect(check({ checkbox: { checked: '-1', unchecked: '0.5' } }, 'number')).not.toThrow();

        expect(check({ checkbox: {} }, 'date')).toThrow(/format.checkbox is for a text or number field, 'field' is date/);
        expect(check({ checkbox: {} }, 'boolean')).toThrow(TypeError);
        expect(check({ checkbox: {} }, 'text', true)).toThrow(/a lookup column \(editor\) shows the label/);
        expect(check({ checkbox: true }, 'text')).toThrow(
            /format.checkbox is true, it is an object: \{ checked\?: '1', unchecked\?: '0' \}/
        );
        expect(check({ checkbox: { on: '1' } }, 'text')).toThrow(/format.checkbox has 'on', a checkbox has checked, unchecked/);
        expect(check({ checkbox: { checked: 1 } }, 'number')).toThrow(/format.checkbox.checked is 1, it is text/);
        expect(check({ checkbox: { checked: '' } }, 'text')).toThrow(
            /format.checkbox.checked is "", it is the value of a checked cell/
        );
        expect(check({ checkbox: { checked: 'yes' } }, 'number')).toThrow(
            /format.checkbox.checked is "yes": 'field' is a number field, it takes a number/
        );
        expect(check({ checkbox: { unchecked: 'no' } }, 'number')).toThrow(
            /format.checkbox.unchecked is "no": 'field' is a number field/
        );
        expect(check({ checkbox: { checked: '0' } }, 'text')).toThrow(
            /format.checkbox has "0" as the checked and the unchecked value: a click could not uncheck a cell/
        );
        // the same number written two ways
        expect(check({ checkbox: { checked: '1', unchecked: '1.0' } }, 'number')).toThrow(
            /as the checked and the unchecked value/
        );
    });

    it('expect checkboxes not with a template, a link, a number format or blank / 0: a checkbox shows no text', () => {
        expect(check({ checkbox: {}, text: '{value}' }, 'text')).toThrow(
            /format has checkbox and text: a checkbox shows no text, it is the one or the other/
        );
        expect(check({ checkbox: {}, link: { url: '{site}' } }, 'text')).toThrow(/has checkbox and link/);
        expect(check({ checkbox: {}, number: {} }, 'number')).toThrow(/has checkbox and number/);
        expect(check({ checkbox: {}, numberOverride: 'NONE' }, 'number')).toThrow(/has checkbox and numberOverride/);
    });
});

describe('display formats - the checkboxes of a text or number column', () => {
    it('expect the values with the defaults 1 and 0', () => {
        expect(checkboxValues({})).toEqual({ checked: '1', unchecked: '0' });
        expect(checkboxValues({ checked: 'Y' })).toEqual({ checked: 'Y', unchecked: '0' });
        expect(checkboxValues({ checked: 'Y', unchecked: '' })).toEqual({ checked: 'Y', unchecked: '' });
    });

    it('expect a cell checked when its value is the checked value: its text trimmed, a number equal to it', () => {
        const ones = {};
        expect(
            [' 1 ', '1', 1, 1.0, '0', 0, '', null, undefined, '01', 'true', true].map((value) => isCheckedValue(value, ones))
        ).toEqual([true, true, true, true, false, false, false, false, false, false, false, false]);
        expect(isCheckedValue(1, { checked: '1.0' })).toBe(true);
        expect(isCheckedValue('Y', { checked: 'Y' })).toBe(true);
        expect(isCheckedValue('y', { checked: 'Y' })).toBe(false);
        // a number is never the checked value of text
        expect(isCheckedValue(0, { checked: 'Y' })).toBe(false);
    });

    it('expect the value written: a number for a number field, the text for the rest, null for an empty value', () => {
        expect(checkboxValueOf(true, {}, 'text')).toBe('1');
        expect(checkboxValueOf(false, {}, 'text')).toBe('0');
        expect(checkboxValueOf(true, {}, 'number')).toBe(1);
        expect(checkboxValueOf(false, {}, 'number')).toBe(0);
        expect(checkboxValueOf(true, { checked: 'Y', unchecked: 'N' }, 'text')).toBe('Y');
        expect(checkboxValueOf(false, { checked: 'Y', unchecked: '' }, 'text')).toBeNull();
        expect(checkboxValueOf(false, { unchecked: ' ' }, 'number')).toBeNull();
    });

    it('expect the problems of the values: none, the checked one empty, no number, the same two', () => {
        expect(checkboxProblem({}, 'text')).toBeNull();
        expect(checkboxProblem({ unchecked: '' }, 'number')).toBeNull();
        expect(checkboxProblem({ checked: ' ' }, 'text')).toBe('checkedEmpty');
        expect(checkboxProblem({ checked: 'x' }, 'number')).toBe('checkedNumber');
        expect(checkboxProblem({ unchecked: 'x' }, 'number')).toBe('uncheckedNumber');
        expect(checkboxProblem({ checked: 'x' }, 'text')).toBeNull();
        expect(checkboxProblem({ checked: 'Y', unchecked: ' Y ' }, 'text')).toBe('same');
        expect(checkboxProblem({ checked: '1', unchecked: '1.0' }, 'number')).toBe('same');
        expect(checkboxProblem({ checked: '1', unchecked: '1.0' }, 'text')).toBeNull();
    });
});

describe('display formats - helpers of the menu', () => {
    it("expect the decimal mark of the field's formatter", () => {
        expect(decimalMarkOf(NumberFormatterDot)).toEqual('.');
        expect(decimalMarkOf(NumberFormatterComma)).toEqual(',');
    });

    it('expect a number format without the parts that are the default', () => {
        expect(compactNumberFormat({ decimals: undefined, thousands: undefined, decimal: '.', percent: false })).toEqual({});
        expect(compactNumberFormat({ decimals: 0, thousands: ' ', decimal: ',', percent: true })).toEqual({
            decimals: 0,
            thousands: ' ',
            decimal: ',',
            percent: true
        });
    });

    it('expect every DateFormat in the lists of the menu once: a date format, or a datetime format', () => {
        // a Record of every DateFormat: the compiler names one left out
        const every: Record<DateFormat, true> = {
            iso: true,
            norwegian: true,
            norwegianShort: true,
            us: true,
            uk: true,
            medium: true,
            long: true,
            full: true,
            weekday: true,
            weekIso: true,
            weekUs: true,
            month: true,
            quarter: true,
            year: true,
            daysUntil: true,
            isoTime: true,
            isoSeconds: true,
            norwegianTime: true,
            norwegianSeconds: true,
            time: true,
            timeSeconds: true
        };
        const all = [...DATE_FORMATS, ...DATETIME_FORMATS];
        expect([...all].sort()).toEqual(Object.keys(every).sort());
    });
});
