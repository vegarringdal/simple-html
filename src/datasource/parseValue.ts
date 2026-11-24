import type { FieldType } from './field';

/**
 * A value as it comes in JSON - from a backend, a stream - as the value of a field of its type: what
 * `datasource.parseRow()` and `setData(rows, { parse: true })` do to each listed field. A value that can
 * not be read as the type is left as it is (the cell shows it as text), so nothing is lost.
 *
 * | type | becomes |
 * | --- | --- |
 * | `date`, `datetime` | a `Date`: from ISO text - `'2026-11-22'` the start of that day in local time (not UTC, as `new Date()` reads it), `'2026-11-22T08:30:00'` and `'2026-11-22 08:30:00'` local time, with `Z` or an offset that instant - and from a number, the milliseconds since 1970 |
 * | `number` | a number from text that is one: `'12.5'`, `'-3'`, `'1e3'` - not `'12,5'`, not `'0x10'` |
 * | `boolean` | `true` / `false` from `'true'` / `'false'` (any case), `1` / `0`, `'1'` / `'0'` |
 * | `text` | as it is |
 *
 * `null` and `undefined` stay; `''` is `null` for a date, a number and a boolean.
 */
export function parseFieldValue(value: unknown, type: FieldType): unknown {
    if (value === null || value === undefined || type === 'text') {
        return value;
    }
    if (value === '') {
        return null;
    }
    switch (type) {
        case 'date':
        case 'datetime':
            return parseDateValue(value);
        case 'number':
            return typeof value === 'string' && NUMBER_TEXT.test(value.trim()) ? Number(value) : value;
        default:
            return parseBooleanValue(value);
    }
}

/** a number as JSON and JavaScript write it, without hex, octal or a comma */
const NUMBER_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
/** an ISO date, `YYYY-MM-DD` */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** an ISO date with a time - `T` or a space between - its seconds and fraction, a `Z` or an offset optional */
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

function parseDateValue(value: unknown): unknown {
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? new Date(value) : value;
    }
    if (typeof value !== 'string') {
        return value;
    }
    const text = value.trim();
    const day = DATE_ONLY.exec(text);
    if (day) {
        // the start of the day in local time: new Date('2026-11-22') is midnight UTC, the day before west of it
        const date = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
        return date.getMonth() === Number(day[2]) - 1 ? date : value;
    }
    if (DATE_TIME.test(text)) {
        // without a zone the ISO form is local time
        const date = new Date(text.replace(' ', 'T'));
        return Number.isNaN(date.getTime()) ? value : date;
    }
    return value;
}

function parseBooleanValue(value: unknown): unknown {
    if (typeof value === 'boolean') {
        return value;
    }
    if (value === 1 || value === 0) {
        return value === 1;
    }
    if (typeof value === 'string') {
        const text = value.trim().toLowerCase();
        if (text === 'true' || text === '1') {
            return true;
        }
        if (text === 'false' || text === '0') {
            return false;
        }
    }
    return value;
}
