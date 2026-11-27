// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { FieldType } from '../../datasource/field';
import {
    and,
    FILTER_OPERATORS,
    type FilterCondition,
    type FilterExpression,
    type FilterOperator
} from '../../datasource/filterExpression';
import { type DateFormat, formatTexts } from '../../grid/columnFormat';
import { dateConditions, parseDateAs } from '../../grid/filterAsShown';
import { type SqlColumn, type SqlDateStorage, toSqlWhere } from '../../sql';

/**
 * The SQL selects the rows the grid's own filter selects: the same rows in the grid's Datasource and in a
 * real SQLite database (node:sqlite), every filter run through both, the row ids compared. And each
 * WHERE is two-valued: `NOT (sql)` selects exactly the other rows - no predicate is ever null.
 *
 * The data has every kind of value: blanks (null, '', 0), case, lines, the characters LIKE and GLOB
 * treat specially (matched as wildcards, and as characters by a `literal` condition), numbers around 0,
 * booleans with null, dates around midnight and both changes of the clock in Oslo, stored five ways
 * (SQLite text as a wall clock, as UTC, with Z; epoch milliseconds and seconds). The grid gets each date
 * as the app would read it from the database.
 *
 * Left out, documented in the SQL guide and tested on their own in toSqlWhere.test.ts: case of non-ASCII
 * letters (SQLite's LOWER and UPPER fold ASCII only, so the values that ignore case are ASCII), a
 * `datetime` stored as an instant in the hour the clocks go back (the grid compares the wall clock, which
 * shows that hour twice), a Date in an IN list (the grid compares the text the formatter shows, a Date
 * never matches), wildcards in the other column of a text valueField.
 */

const TIME_ZONE = 'Europe/Oslo';
const originalTimeZone = process.env.TZ;
beforeAll(() => {
    // the grid reads the wall clock of the process, the SQL the one of options.timeZone
    process.env.TZ = TIME_ZONE;
});
afterAll(() => {
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});

// ------------------------------------------------------------------ a seeded random

function random(seed: number) {
    let state = seed >>> 0;
    // mulberry32
    const next = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)];
    const some = <T>(list: readonly T[], max: number): T[] =>
        Array.from({ length: Math.floor(next() * (max + 1)) }, () => pick(list));
    return { next, pick, some };
}

// ------------------------------------------------------------------ the data

const TEXTS = [
    null,
    '',
    'Ann',
    'ANN',
    'ann',
    'Anna',
    'Joanna',
    'anne marie',
    'a\nb',
    'A\nB',
    'ann\nanna',
    '50%',
    '50',
    '5',
    'a_b',
    'axb',
    // one character for `_` (GLOB `?`), not two UTF-16 units
    'a🙂b',
    'a!b',
    'a!!b',
    'a[b]',
    '[x]',
    'a*b',
    'a?b',
    'null',
    'NULL',
    'Null',
    ' ann ',
    'Ann ',
    'æble',
    'Æble',
    'ØL',
    'zeta',
    'Zeta',
    '0',
    '%',
    '_',
    '!',
    '*',
    'ab%cd',
    'o"brien',
    "o'brien",
    'tab\there',
    // the escape of the grid, `\` - as a character of the row: before a wildcard, another letter, itself
    'a\\b',
    'a\\_b',
    'a\\\\b',
    '50\\%',
    'a\\*b',
    'C:\\temp',
    '\\',
    '\\a'
];
// the other text column: no wildcards, the grid would take them as a pattern of the valueField
const CODES = [null, '', 'ann', 'ANN', 'Anna', 'b', 'zeta', 'a-b', '0', 'null', ' ann '];
const NUMBERS = [null, 0, 1, -1, 2.5, 5, 10, 100, -0.5, 3, 1e6, 0.1];
const BOOLEANS = [null, true, false];

/** the instants of the rows, many near midnight and the clock changes in Oslo */
const INSTANTS = [
    '2026-11-21T22:59:59.999Z', // 21 Nov 23:59:59.999 in Oslo
    '2026-11-21T23:00:00.000Z', // 22 Nov 00:00 in Oslo
    '2026-11-21T23:00:00.500Z',
    '2026-11-21T23:00:01.000Z',
    '2026-11-22T11:30:00.000Z',
    '2026-11-22T22:59:59.000Z',
    '2026-11-22T23:00:00.000Z',
    '2026-11-21T12:00:00.000Z',
    '2026-03-29T00:59:59.000Z', // 01:59:59 CET, the clock goes to 03:00 CEST at 01:00Z
    '2026-03-29T01:00:00.000Z', // 03:00 CEST
    '2026-03-28T23:00:00.000Z', // 29 Mar 00:00 CET
    '2026-03-29T22:00:00.000Z', // 30 Mar 00:00 CEST
    '2026-10-24T22:00:00.000Z', // 25 Oct 00:00 CEST
    '2026-10-25T00:30:00.000Z', // 02:30 CEST, the first time
    '2026-10-25T01:30:00.000Z', // 02:30 CET, the second time
    '2026-10-25T02:00:00.000Z', // 03:00 CET
    '2026-10-25T23:00:00.000Z', // 26 Oct 00:00 CET
    '2000-01-01T00:00:00.000Z',
    '1999-12-31T23:00:00.000Z', // 1 Jan 2000 00:00 in Oslo
    '1969-12-31T23:59:59.000Z',
    '1970-01-01T00:00:00.000Z'
].map((text) => new Date(text).getTime());

/** the hour the clocks go back in Oslo, shown twice: 02:00-03:00 on 25 Oct 2026 */
const REPEATED_HOUR = [Date.parse('2026-10-25T00:00:00Z'), Date.parse('2026-10-25T02:00:00Z')];
const inRepeatedHour = (instant: number) => instant >= REPEATED_HOUR[0] && instant < REPEATED_HOUR[1];

const pad = (value: number, length = 2) => String(value).padStart(length, '0');
/** the wall clock of a Date in the process' time zone (Oslo), as text the database holds */
const localText = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
const utcText = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '');

/** how the date columns hold the dates, and how the app makes a Date of what the database gives */
const STORAGES: {
    storage: SqlDateStorage;
    column: string;
    write: (date: Date) => string | number;
    read: (value: any) => unknown;
}[] = [
    {
        storage: 'local',
        column: 'd_local',
        write: localText,
        read: (text) => {
            const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})$/.exec(text);
            if (!match) {
                return text === '' ? '' : new Date('invalid');
            }
            const [y, mo, d, h, mi, s, ms] = match.slice(1).map(Number);
            return new Date(y, mo - 1, d, h, mi, s, ms);
        }
    },
    {
        storage: 'utc',
        column: 'd_utc',
        write: utcText,
        read: (text) => (text === '' ? '' : new Date(`${text.replace(' ', 'T')}Z`))
    },
    {
        storage: 'zoned',
        column: 'd_zoned',
        write: (date) => date.toISOString(),
        read: (text) => (text === '' ? '' : new Date(text))
    },
    { storage: 'epochMillis', column: 'd_ms', write: (date) => date.getTime(), read: (ms) => new Date(ms) },
    {
        storage: 'epochSeconds',
        column: 'd_s',
        write: (date) => Math.floor(date.getTime() / 1000),
        read: (s) => new Date(s * 1000)
    }
];

interface Data {
    db: DatabaseSync;
    datasource: Datasource;
    rows: Record<string, unknown>[];
    ids: number[];
    /** the ids of the rows whose date (d1) is in the repeated hour */
    repeatedHourIds: Set<number>;
}

/** fields of the grid: the type, and the column with its storage */
const FIELDS: Record<string, { type: FieldType } & SqlColumn> = {
    name: { type: 'text', column: 'name' },
    code: { type: 'text', column: 'code' },
    n: { type: 'number', column: 'n' },
    m: { type: 'number', column: 'm' },
    b: { type: 'boolean', column: 'b' },
    b2: { type: 'boolean', column: 'b2' }
};
for (const { storage, column } of STORAGES) {
    FIELDS[`${storage}_date`] = { type: 'date', column, dateStorage: storage };
    FIELDS[`${storage}_time`] = { type: 'datetime', column, dateStorage: storage };
    FIELDS[`${storage}_date2`] = { type: 'date', column: `${column}2`, dateStorage: storage };
    FIELDS[`${storage}_time2`] = { type: 'datetime', column: `${column}2`, dateStorage: storage };
}
const fieldNames = Object.keys(FIELDS);
// the second date columns are for valueField and the random filters, every operator and value is tried
// on the first
const matrixFields = fieldNames.filter((field) => !field.endsWith('2'));
const isInstantTime = (field: string) => FIELDS[field].type === 'datetime' && FIELDS[field].dateStorage !== 'local';

function makeData(): Data {
    const rnd = random(7);
    const db = new DatabaseSync(':memory:');
    const dateColumns = STORAGES.flatMap(({ column }) => [column, `${column}2`]);
    db.exec(
        `CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, code TEXT, n REAL, m REAL, b INTEGER, b2 INTEGER, ${dateColumns.join(', ')})`
    );
    const insert = db.prepare(
        `INSERT INTO t VALUES (${['id', 'name', 'code', 'n', 'm', 'b', 'b2', ...dateColumns].map(() => '?').join(', ')})`
    );

    // a date: an instant, or a blank - null everywhere, '' and an unreadable text where it is text
    const dateValues: (number | null | '' | 'garbage')[] = [...INSTANTS, ...INSTANTS, null, null, '', 'garbage'];
    const rows: Record<string, unknown>[] = [];
    const repeatedHourIds = new Set<number>();
    const count = 400;
    for (let id = 1; id <= count; id++) {
        // every text and every date at least once, the rest at random
        const name = id <= TEXTS.length ? TEXTS[id - 1] : rnd.pick(TEXTS);
        const d1 = id <= dateValues.length ? dateValues[id - 1] : rnd.pick(dateValues);
        const d2 = rnd.pick(dateValues);
        const code = rnd.pick(CODES);
        const n = rnd.pick(NUMBERS);
        const m = rnd.pick(NUMBERS);
        const b = rnd.pick(BOOLEANS);
        const b2 = rnd.pick(BOOLEANS);
        if ((typeof d1 === 'number' && inRepeatedHour(d1)) || (typeof d2 === 'number' && inRepeatedHour(d2))) {
            repeatedHourIds.add(id);
        }

        const row: Record<string, unknown> = { id, name, code, n, m, b, b2 };
        const dbDates: (string | number | null)[] = [];
        for (const { storage, write, read } of STORAGES) {
            const isText = storage !== 'epochMillis' && storage !== 'epochSeconds';
            for (const [date, suffix] of [
                [d1, ''],
                [d2, '2']
            ] as const) {
                // a blank text date is null in a number column
                const stored = typeof date === 'number' ? write(new Date(date)) : isText ? date : null;
                dbDates.push(stored);
                const value = stored === null ? null : read(stored);
                row[`${storage}_date${suffix}`] = value;
                row[`${storage}_time${suffix}`] = value;
            }
        }
        insert.run(id, name, code, n, m, b === null ? null : Number(b), b2 === null ? null : Number(b2), ...dbDates);
        rows.push(row);
    }

    const fields: Record<string, FieldType> = {};
    for (const [field, { type }] of Object.entries(FIELDS)) {
        fields[field] = type;
    }
    const datasource = new Datasource({ key: 'id', fields });
    datasource.setData(rows);
    return { db, datasource, rows, ids: rows.map((row) => row.id as number), repeatedHourIds };
}

const COLUMNS: Record<string, SqlColumn> = Object.fromEntries(
    Object.entries(FIELDS).map(([field, { type, column, dateStorage }]) => [
        field,
        { type, column, ...(dateStorage ? { dateStorage } : {}) }
    ])
);

// ------------------------------------------------------------------ running a filter both ways

interface Mismatch {
    filter: string;
    sql: string;
    params: unknown[];
    gridOnly: number[];
    sqlOnly: number[];
}

/** the conditions of a filter */
function conditionsOf(filter: FilterExpression): FilterCondition[] {
    return 'children' in filter ? filter.children.flatMap(conditionsOf) : [filter];
}

/**
 * The rows a filter is not compared on, the documented differences: a datetime stored as an instant in
 * the hour the clocks go back, and a datetime valueField of two dates in the same second (the grid
 * leaves out the milliseconds, the SQL compares the columns as they are)
 */
function skipped(data: Data, filter: FilterExpression): Set<number> {
    const skip = new Set<number>();
    for (const condition of conditionsOf(filter)) {
        if (isInstantTime(condition.field) || (condition.valueField && isInstantTime(condition.valueField))) {
            for (const id of data.repeatedHourIds) {
                skip.add(id);
            }
        }
        const other = condition.valueField;
        if (other && FIELDS[condition.field].type === 'datetime') {
            for (const row of data.rows) {
                const [a, b] = [row[condition.field], row[other]];
                if (a instanceof Date && b instanceof Date && a.getTime() !== b.getTime()) {
                    if (Math.floor(a.getTime() / 1000) === Math.floor(b.getTime() / 1000)) {
                        skip.add(row.id as number);
                    }
                }
            }
        }
    }
    return skip;
}

/** how many filters were run, and how many of them selected some rows but not all: the test is not empty */
const stats = { filters: 0, some: 0 };

function check(data: Data, filter: FilterExpression, mismatches: Mismatch[]) {
    data.datasource.filter(filter);
    const skip = skipped(data, filter);
    const keep = (ids: number[]) => ids.filter((id) => !skip.has(id)).sort((a, b) => a - b);

    const gridIds = keep(data.datasource.getRows().map((row) => row.id as number));
    const { sql, params } = toSqlWhere(filter, { dialect: 'sqlite', columns: COLUMNS, timeZone: TIME_ZONE });
    const query = (where: string) =>
        data.db
            .prepare(`SELECT id FROM t WHERE ${where} ORDER BY id`)
            .all(...(params as (string | number)[]))
            .map((row) => row.id as number);
    const sqlIds = keep(query(sql));
    const notIds = keep(query(`NOT (${sql})`));

    const gridOnly = gridIds.filter((id) => !sqlIds.includes(id));
    const sqlOnly = sqlIds.filter((id) => !gridIds.includes(id));
    // two-valued: NOT selects every other row, none twice
    const all = keep([...data.ids]);
    const both = sqlIds.filter((id) => notIds.includes(id));
    const neither = all.filter((id) => !sqlIds.includes(id) && !notIds.includes(id));
    stats.filters++;
    if (gridIds.length > 0 && gridIds.length < all.length) {
        stats.some++;
    }
    if (gridOnly.length || sqlOnly.length || both.length || neither.length) {
        mismatches.push({
            filter: JSON.stringify(filter),
            sql,
            params,
            gridOnly,
            sqlOnly: [...sqlOnly, ...both.map((id) => -id), ...neither.map((id) => -id)]
        });
    }
}

// ------------------------------------------------------------------ the values of the filters

const ASCII_TEXTS = [
    'ann',
    'Ann',
    'ANN',
    'an*',
    'AN%',
    '*nn*',
    '*nn',
    '%',
    '*',
    '**',
    'a_b',
    // `_` is one character
    '_nn',
    'AN_',
    '___',
    '*_b',
    'a_\nb',
    'a!b',
    'a!!b',
    'a[b]',
    '[x]',
    '50%',
    '50',
    '5',
    'null',
    'NULL',
    'a*b',
    'a?b',
    'a%b',
    ' ann ',
    'ann ',
    'zeta',
    'z',
    'a\nb',
    'A*B',
    '0',
    '_',
    '!',
    'o"brien',
    "o'brien",
    'tab\there',
    'b',
    // the escape of the grid, `\`: as a character of the row, before a wildcard and before another letter
    'a\\b',
    'a\\_b',
    'a\\\\b',
    '50\\%',
    'C:\\temp',
    '\\'
];
const TEXT_VALUES = [...ASCII_TEXTS, 'æble', 'Æble', 'ØL', 'æ*'];
const NUMBER_VALUES = [0, 1, -1, 2.5, 5, 10, 3, 100, -0.5, '5', '2.5', ' 5 ', '0', 1e6];

/** dates of the filters: Dates, ISO text with Z and with an offset, local text, date-only text */
function dateValues(): (Date | string)[] {
    const values: (Date | string)[] = [];
    INSTANTS.forEach((instant, index) => {
        values.push(new Date(instant));
        // a millisecond before or after, and as JSON gives it
        values.push(
            index % 3 === 0 ? new Date(instant + 999) : index % 3 === 1 ? new Date(instant - 1) : new Date(instant).toISOString()
        );
    });
    values.push(
        '2026-11-22',
        '2026-11-21',
        '2026-03-29',
        '2026-10-25',
        '2000-01-01',
        '2026-11-22T00:00',
        '2026-11-22T00:00:00',
        '2026-11-21T23:59:59',
        '2026-11-22T12:30:00.000',
        '2026-03-29T02:30:00', // not on the clock in Oslo: it goes from 02:00 to 03:00
        '2026-03-29T03:00:00',
        '2026-11-22T00:00:00+01:00',
        '2026-11-21T23:00:00+00:00',
        '2026-11-22T05:00:00-05:00'
    );
    return values;
}

/** the IN values of a date column as the grid shows them: 'YYYY-MM-DD', or with the time */
function shownDates(withTime: boolean): string[] {
    return INSTANTS.map((instant) => {
        const date = new Date(instant);
        const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        return withTime ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` : day;
    });
}

/** a value a filter in the repeated hour has, for an instant datetime: left out */
function inRepeatedHourValue(value: unknown): boolean {
    if (value instanceof Date) {
        return inRepeatedHour(value.getTime());
    }
    if (typeof value === 'string') {
        if (value.startsWith('2026-10-25T02')) {
            return true;
        }
        const instant = Date.parse(value);
        return /[Z+-]\d*:?\d*$/.test(value) && value.length > 10 && inRepeatedHour(instant);
    }
    return Array.isArray(value) && value.some(inRepeatedHourValue);
}

function valuesOf(field: string, caseSensitive: boolean): unknown[] {
    switch (FIELDS[field].type) {
        case 'text':
            return caseSensitive ? TEXT_VALUES : ASCII_TEXTS;
        case 'number':
            return NUMBER_VALUES;
        case 'boolean':
            return [true, false];
        default:
            return dateValues();
    }
}

function listOf(field: string, rnd: ReturnType<typeof random>, caseSensitive: boolean): unknown {
    const type = FIELDS[field].type;
    const blanks = ['NULL', 'null', null, ''];
    let pool: unknown[];
    switch (type) {
        case 'text':
            pool = [...(caseSensitive ? TEXT_VALUES : ASCII_TEXTS), 5, true];
            break;
        case 'number':
            pool = [0, 1, -1, 2.5, 5, 10, 3, '5', '2.5'];
            break;
        case 'boolean':
            pool = [true, false, 'TRUE', 'false', 'True'];
            break;
        default:
            pool = shownDates(type === 'datetime');
    }
    const list = rnd.some([...pool, ...pool, ...blanks], 6);
    // one value per line, as the grid takes a text too
    if (type === 'text' && rnd.next() < 0.15 && list.every((item) => typeof item === 'string')) {
        return list.join('\n');
    }
    return list;
}

const OPERATORS = [...FILTER_OPERATORS] as FilterOperator[];

function leaf(rnd: ReturnType<typeof random>): FilterExpression {
    const field = rnd.pick(fieldNames);
    const operator = rnd.pick(OPERATORS);
    const caseSensitive = FIELDS[field].type === 'text' && rnd.next() < 0.4;
    const extra = caseSensitive ? { caseSensitive: true } : {};
    if (operator === 'IN' || operator === 'NOT_IN') {
        return { field, operator, value: listOf(field, rnd, caseSensitive), ...extra };
    }
    if (operator === 'IS_BLANK' || operator === 'IS_NOT_BLANK') {
        return { field, operator };
    }
    const values = valuesOf(field, caseSensitive);
    const pickValue = () => {
        // a blank end is open, a blank value ignored
        const value = rnd.next() < 0.1 ? rnd.pick([null, '', undefined]) : rnd.pick(values);
        return isInstantTime(field) && inRepeatedHourValue(value)
            ? rnd.pick(values.filter((v) => !inRepeatedHourValue(v)))
            : value;
    };
    if (operator === 'BETWEEN') {
        return { field, operator, value: [pickValue(), pickValue()], ...extra };
    }
    const others = valueFields(field);
    if (others.length && rnd.next() < 0.25 && valueFieldWorks(field, operator)) {
        return { field, operator, valueField: rnd.pick(others), ...extra };
    }
    return { field, operator, value: pickValue(), ...extra };
}

/** the other columns a valueField can compare with: the same type (date and datetime go together) and storage */
function valueFields(field: string): string[] {
    const { type, dateStorage } = FIELDS[field];
    if (type === 'date' && dateStorage !== 'local') {
        return [];
    }
    const isDate = (other: string) => FIELDS[other].type === 'date' || FIELDS[other].type === 'datetime';
    return fieldNames.filter(
        (other) =>
            other !== field &&
            (FIELDS[other].type === type || (isDate(field) && isDate(other))) &&
            FIELDS[other].dateStorage === dateStorage &&
            // the grid takes the wildcards of the other text as a pattern
            !(type === 'text' && other === 'name')
    );
}

function valueFieldWorks(field: string, operator: FilterOperator): boolean {
    if (FIELDS[field].type !== 'text') {
        return true;
    }
    return ['EQUAL', 'NOT_EQUAL_TO', 'LESS_THAN', 'LESS_THAN_OR_EQUAL_TO', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL_TO'].includes(
        operator
    );
}

function tree(rnd: ReturnType<typeof random>, depth: number): FilterExpression {
    if (depth > 2 || rnd.next() < 0.45) {
        return leaf(rnd);
    }
    const children = Array.from({ length: Math.floor(rnd.next() * 4) }, () => tree(rnd, depth + 1));
    return { group: rnd.next() < 0.5 ? 'AND' : 'OR', children };
}

// ------------------------------------------------------------------ the tests

describe('toSqlWhere on SQLite selects the rows the grid selects', () => {
    let data: Data;
    beforeAll(() => {
        data = makeData();
    });

    it('expect the time zone of the test to be Oslo', () => {
        expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-60);
        expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120);
    });

    it('expect every field, operator, value and case to select the same rows', () => {
        const mismatches: Mismatch[] = [];
        let count = 0;
        for (const field of matrixFields) {
            for (const operator of OPERATORS) {
                for (const caseSensitive of FIELDS[field].type === 'text' ? [false, true] : [false]) {
                    const extra = caseSensitive ? { caseSensitive: true } : {};
                    if (operator === 'IS_BLANK' || operator === 'IS_NOT_BLANK') {
                        check(data, { field, operator, ...extra }, mismatches);
                        count++;
                        continue;
                    }
                    if (operator === 'IN' || operator === 'NOT_IN' || operator === 'BETWEEN') {
                        continue; // below
                    }
                    for (const value of valuesOf(field, caseSensitive)) {
                        if (isInstantTime(field) && inRepeatedHourValue(value)) {
                            continue;
                        }
                        check(data, { field, operator, value, ...extra }, mismatches);
                        count++;
                    }
                }
            }
        }
        expect(mismatches.slice(0, 5)).toEqual([]);
        expect(count).toBeGreaterThan(5000);
    });

    it('expect a literal condition - the wildcards of the grid as characters - to select the same rows', () => {
        const mismatches: Mismatch[] = [];
        let count = 0;
        const operators = ['EQUAL', 'NOT_EQUAL_TO', 'CONTAINS', 'DOES_NOT_CONTAIN', 'BEGIN_WITH', 'END_WITH'] as const;
        for (const field of ['name', 'code']) {
            for (const operator of operators) {
                for (const caseSensitive of [false, true]) {
                    for (const value of ASCII_TEXTS) {
                        const extra = caseSensitive ? { caseSensitive: true } : {};
                        check(data, { field, operator, value, literal: true, ...extra }, mismatches);
                        count++;
                    }
                }
            }
        }
        expect(mismatches.slice(0, 5)).toEqual([]);
        expect(count).toBeGreaterThan(900);
    });

    it('expect a value with the escape `\\` - `\\_`, `\\%`, `\\*`, `\\\\` - to select the same rows', () => {
        const mismatches: Mismatch[] = [];
        let count = 0;
        const operators = ['EQUAL', 'NOT_EQUAL_TO', 'CONTAINS', 'DOES_NOT_CONTAIN', 'BEGIN_WITH', 'END_WITH'] as const;
        const values = [
            'a\\_b',
            'a_b',
            '50\\%',
            '50\\%*',
            '\\%',
            '\\_',
            '\\*',
            'a\\*b',
            'a\\\\b',
            'a\\\\_b',
            'a\\b',
            'C:\\temp',
            '\\',
            '\\\\',
            'a\\\\*',
            '\\a'
        ];
        for (const operator of operators) {
            for (const caseSensitive of [false, true]) {
                for (const value of values) {
                    const extra = caseSensitive ? { caseSensitive: true } : {};
                    check(data, { field: 'name', operator, value, ...extra }, mismatches);
                    check(data, { field: 'name', operator, value, literal: true, ...extra }, mismatches);
                    count += 2;
                }
            }
        }
        expect(mismatches.slice(0, 5)).toEqual([]);
        expect(count).toBeGreaterThan(300);
    });

    it('expect BETWEEN, IN and NOT_IN to select the same rows, also with blanks and open ends', () => {
        const rnd = random(11);
        const mismatches: Mismatch[] = [];
        for (const field of matrixFields) {
            for (let index = 0; index < 60; index++) {
                const caseSensitive = FIELDS[field].type === 'text' && index % 2 === 1;
                const extra = caseSensitive ? { caseSensitive: true } : {};
                const list = listOf(field, rnd, caseSensitive);
                check(data, { field, operator: 'IN', value: list, ...extra }, mismatches);
                check(data, { field, operator: 'NOT_IN', value: list, ...extra }, mismatches);
                const values = valuesOf(field, caseSensitive).filter(
                    (value) => !(isInstantTime(field) && inRepeatedHourValue(value))
                );
                const end = () => (rnd.next() < 0.2 ? null : rnd.pick(values));
                check(data, { field, operator: 'BETWEEN', value: [end(), end()], ...extra }, mismatches);
            }
            for (const value of [[], null, undefined, 'NULL']) {
                check(data, { field, operator: 'IN', value }, mismatches);
                check(data, { field, operator: 'NOT_IN', value }, mismatches);
            }
        }
        expect(mismatches.slice(0, 5)).toEqual([]);
    });

    it('expect a valueField to select the same rows', () => {
        const mismatches: Mismatch[] = [];
        let count = 0;
        for (const field of fieldNames) {
            for (const other of valueFields(field)) {
                for (const operator of OPERATORS) {
                    if (
                        ['IN', 'NOT_IN', 'BETWEEN', 'IS_BLANK', 'IS_NOT_BLANK'].includes(operator) ||
                        !valueFieldWorks(field, operator)
                    ) {
                        continue;
                    }
                    for (const caseSensitive of FIELDS[field].type === 'text' ? [false, true] : [false]) {
                        check(
                            data,
                            { field, operator, valueField: other, ...(caseSensitive ? { caseSensitive } : {}) },
                            mismatches
                        );
                        count++;
                    }
                }
            }
        }
        expect(mismatches.slice(0, 5)).toEqual([]);
        expect(count).toBeGreaterThan(200);
    });

    it('expect 3000 random filters of nested AND / OR groups to select the same rows', () => {
        const rnd = random(2026);
        const mismatches: Mismatch[] = [];
        for (let index = 0; index < 3000; index++) {
            check(data, tree(rnd, 0), mismatches);
        }
        expect(mismatches.slice(0, 5)).toEqual([]);
    });

    it('expect the conditions of a header filter as shown - weeks, months, minutes - to select the same rows', () => {
        // what the grid makes of the text typed in a column with a display format (filterAsShown.ts): the
        // period of the text, each operator on it - around the clock changes in Oslo too
        const texts = formatTexts();
        const today = new Date(2026, 10, 22, 10);
        const typed: [DateFormat, string][] = [
            ['weekIso', '2026-W47'],
            ['weekIso', '2026-W43'],
            ['weekIso', '2026-W13'],
            ['weekUs', '2026-W48'],
            ['month', '2026-11'],
            ['month', '2026-03'],
            ['quarter', '2026 Q4'],
            ['year', '2026'],
            ['year', '2000'],
            ['norwegian', '22.11.2026'],
            ['daysUntil', '-1'],
            ['isoTime', '2026-11-22 00:00'],
            ['isoTime', '2026-03-29 03:00'],
            ['norwegianSeconds', '22.11.2026 12:30:00']
        ];
        const operators: FilterOperator[] = [
            'EQUAL',
            'NOT_EQUAL_TO',
            'LESS_THAN',
            'LESS_THAN_OR_EQUAL_TO',
            'GREATER_THAN',
            'GREATER_THAN_OR_EQUAL_TO'
        ];
        const mismatches: Mismatch[] = [];
        let count = 0;
        for (const field of matrixFields) {
            const type = FIELDS[field].type;
            if (type !== 'date' && type !== 'datetime') {
                continue;
            }
            for (const [format, text] of typed) {
                // a format of the time of day is for a datetime column only
                if (type === 'date' && (format === 'isoTime' || format === 'norwegianSeconds')) {
                    continue;
                }
                const start = parseDateAs(text, format, texts, today)?.start;
                expect(start, `${format} ${text}`).toBeInstanceOf(Date);
                for (const operator of operators) {
                    check(data, and(...dateConditions(field, operator, start, type, format, texts, today)), mismatches);
                    count++;
                }
                // a BETWEEN from this period to the year's end, and one open at its start
                const end = new Date(2026, 11, 31);
                check(data, and(...dateConditions(field, 'BETWEEN', [start, end], type, format, texts, today)), mismatches);
                check(data, and(...dateConditions(field, 'BETWEEN', [null, start], type, format, texts, today)), mismatches);
                count += 2;
            }
        }
        expect(mismatches.slice(0, 5)).toEqual([]);
        expect(count).toBeGreaterThan(800);
    });

    it('expect most of the filters to select some rows but not all - the comparison is not empty', () => {
        // 13526 filters, 11305 of them select some rows but not all
        expect(stats.filters).toBeGreaterThan(13000);
        expect(stats.some / stats.filters).toBeGreaterThan(0.75);
    });
});

describe('toSqlWhere on SQLite: texts that JavaScript and SQLite fold differently', () => {
    // a value of ASCII only is folded before it is bound, another by SQLite as its column is: JavaScript
    // folds ß to SS and Æ to æ, SQLite's UPPER() / LOWER() fold the ASCII letters only
    const names = ['Ærø', 'ærø', 'Straße', 'STRASSE', 'Oslo', 'OSLO', null, ''];
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
    for (const [index, name] of names.entries()) {
        db.prepare('INSERT INTO t VALUES (?, ?)').run(index + 1, name);
    }
    const select = (filter: FilterExpression) => {
        const { sql, params } = toSqlWhere(filter, { dialect: 'sqlite', columns: { name: 'name' } });
        return db
            .prepare(`SELECT name FROM t WHERE ${sql} ORDER BY id`)
            .all(...(params as string[]))
            .map((row) => row.name);
    };

    it('expect a text to match the same text, and an ASCII value every case of it', () => {
        expect(select({ field: 'name', operator: 'IN', value: ['Ærø', 'oslo'] })).toEqual(['Ærø', 'Oslo', 'OSLO']);
        expect(select({ field: 'name', operator: 'IN', value: ['Straße'] })).toEqual(['Straße']);
        expect(select({ field: 'name', operator: 'EQUAL', value: 'straße' })).toEqual(['Straße']);
        expect(select({ field: 'name', operator: 'CONTAINS', value: 'Rø' })).toEqual(['Ærø', 'ærø']);
        // SQLite folds no letter that is not ASCII (guide 22): Ø is not ø there, the grid finds both
        expect(select({ field: 'name', operator: 'CONTAINS', value: 'RØ' })).toEqual([]);
        expect(select({ field: 'name', operator: 'BEGIN_WITH', value: 'os' })).toEqual(['Oslo', 'OSLO']);
    });
});
