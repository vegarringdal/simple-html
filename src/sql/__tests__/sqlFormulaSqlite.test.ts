// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it } from 'vitest';
import type { FilterOperator } from '../../datasource/filterExpression';
import { objectFilter } from '../../datasource/objectFilter';
import { compileFormula, type FormulaType, readFormula } from '../../grid/formula';
import { type SqlColumn, toSqlWhere } from '../../sql';
import { dayOfColumn, formulaSql } from '../formulaSql';
import { isoText, timeZoneClock } from '../sqlDates';

/**
 * The formulas of the calculated columns as SQL (formulaSql.ts) give the values the grid gives: every
 * formula run by the grid (formula.ts) and by a real SQLite database (node:sqlite) on rows of every kind
 * of value - blanks, 0, negatives, halves, texts with spaces, tabs, quotes and case - the values compared
 * row by row. A list of formulas for each function and rule, then random ones of every type. Then filters
 * on calculated columns through toSqlWhere, compared with the grid's filter of the computed values.
 *
 * Dates are the day in the user's time zone, as the grid takes them: the process runs in Oslo, the
 * dates of the rows around midnight, the changes of the clock and today, stored as wall clocks (text
 * `YYYY-MM-DD` for a date, `YYYY-MM-DD HH:MM:SS` for a datetime).
 *
 * Left out, documented in the SQL guide: the order of texts (`<` on text: the browser's locale order,
 * the database's code points), numbers past 15 digits, case of letters that are not ASCII (SQLite's
 * LOWER and UPPER).
 */

const TIME_ZONE = 'Europe/Oslo';
const originalTimeZone = process.env.TZ;
// the grid reads the wall clock of the process, the SQL the one of the time zone: the same one. Set
// before the rows are made
process.env.TZ = TIME_ZONE;
afterAll(() => {
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});

const FIELDS: Record<string, FormulaType> = {
    price: 'number',
    qty: 'number',
    name: 'text',
    code: 'text',
    active: 'boolean',
    due: 'date',
    at: 'date'
};

interface Row {
    id: number;
    price: number | null;
    qty: number | null;
    name: string | null;
    code: string | null;
    active: boolean | null;
    due: Date | null;
    at: Date | null;
}

const PRICES = [null, 0, 2.5, -2.5, 0.5, 4, 1250, 0.125, -7, 1.5];
const QTYS = [null, 0, 1, 2, 4, -2, 8];
const NAMES = [null, '', 'Ann', 'ann', 'ANNA', ' ann ', 'tab\there', 'a_b', "o'brien", 'x\n', 'Zeta', '50%', '12', 'a🙂b'];
const CODES = [null, '', 'NO-123', 'se-9', 'ann', 'A', '  '];
const ACTIVES = [null, true, false];
const now = new Date();
/** a day from today, at a time of day */
const fromToday = (days: number, hours = 0, minutes = 0) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hours, minutes);
const DUES = [
    null,
    new Date(2026, 2, 29),
    new Date(2026, 9, 25),
    new Date(2026, 0, 1),
    new Date(2025, 11, 31),
    fromToday(0),
    fromToday(-1),
    fromToday(1),
    fromToday(-40),
    new Date(2024, 1, 29),
    new Date(1999, 11, 31)
];
const ATS = [
    null,
    new Date(2026, 2, 29, 1, 30),
    new Date(2026, 2, 29, 3, 30),
    new Date(2026, 9, 25, 2, 30),
    new Date(2026, 0, 1, 0, 0, 0),
    new Date(2025, 12 - 1, 31, 23, 59, 59),
    fromToday(0, 23, 59),
    fromToday(-1, 0, 1),
    fromToday(1, 12)
];

/** every combination would be many: a seeded walk through them */
function makeRows(): Row[] {
    const rows: Row[] = [];
    let id = 1;
    for (let index = 0; index < 160; index++) {
        rows.push({
            id: id++,
            price: PRICES[index % PRICES.length],
            qty: QTYS[(index * 3) % QTYS.length],
            name: NAMES[(index * 5) % NAMES.length],
            code: CODES[(index * 2 + 1) % CODES.length],
            active: ACTIVES[(index * 11) % ACTIVES.length],
            due: DUES[(index * 13) % DUES.length],
            at: ATS[(index * 5 + 2) % ATS.length]
        });
    }
    return rows;
}

const ROWS = makeRows();
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE t (id INTEGER, price REAL, qty INTEGER, name TEXT, code TEXT, active INTEGER, due TEXT, at TEXT)');
/** a date as the wall clock of the process, the text a database of wall clocks holds */
const wall = (date: Date | null, withTime: boolean) => {
    if (date === null) {
        return null;
    }
    const text = isoText(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()),
        ' '
    );
    return withTime ? text : text.slice(0, 10);
};
{
    const insert = db.prepare('INSERT INTO t VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const row of ROWS) {
        const active = row.active === null ? null : row.active ? 1 : 0;
        insert.run(row.id, row.price, row.qty, row.name, row.code, active, wall(row.due, false), wall(row.at, true));
    }
}
/** TODAY() of the SQL: the day in the time zone now */
const today = () => isoText(timeZoneClock(TIME_ZONE).wallOf(Date.now()), ' ').slice(0, 10);

const COLUMNS: Record<string, SqlColumn> = {
    price: { column: 'price', type: 'number' },
    qty: { column: 'qty', type: 'number' },
    name: { column: 'name', type: 'text' },
    code: { column: 'code', type: 'text' },
    active: { column: 'active', type: 'boolean', booleanValues: { true: 1, false: 0 } },
    due: { column: 'due', type: 'date' },
    at: { column: 'at', type: 'datetime' }
};

const typeOf = (field: string) => (Object.hasOwn(FIELDS, field) ? { type: FIELDS[field] } : undefined);

/** the grid's values of a formula, by row id: null where the cell is blank, a date as its day (SQLite's text) */
function gridValues(formula: string): Map<number, unknown> {
    const values = gridRawValues(formula);
    for (const [id, value] of values) {
        if (value instanceof Date) {
            values.set(id, wall(value, false));
        }
    }
    return values;
}

/** the grid's values of a formula as it computes them, by row id: a date a Date */
function gridRawValues(formula: string): Map<number, unknown> {
    const compiled = compileFormula(formula, typeOf);
    if ('problem' in compiled) {
        throw new Error(`${formula}: ${JSON.stringify(compiled.problem)}`);
    }
    return new Map(
        ROWS.map((row) => {
            const result = compiled.formula.evaluate((field) => (row as unknown as Record<string, unknown>)[field]);
            return [row.id, 'value' in result ? result.value : null];
        })
    );
}

/** SQLite's values of a formula, by row id: a boolean as true / false */
function sqlValues(formula: string): Map<number, unknown> {
    const read = readFormula(formula, typeOf);
    if ('problem' in read) {
        throw new Error(`${formula}: ${JSON.stringify(read.problem)}`);
    }
    const sql = formulaSql(
        read.node,
        read.type,
        'sqlite',
        (field) => ({
            sql: FIELDS[field] === 'date' ? dayOfColumn('sqlite', `"${field}"`, 'local', TIME_ZONE) : `"${field}"`,
            type: FIELDS[field],
            booleanValues: { true: 1, false: 0 }
        }),
        today
    );
    const rows = db.prepare(`SELECT id, ${sql} AS v FROM t`).all() as { id: number; v: unknown }[];
    return new Map(rows.map(({ id, v }) => [id, read.type === 'boolean' && v !== null ? v === 1 : v]));
}

/** the rows where the grid and SQLite differ, as text: none when they agree */
function differences(formula: string): string[] {
    const grid = gridValues(formula);
    const sql = sqlValues(formula);
    const found: string[] = [];
    for (const row of ROWS) {
        const a = grid.get(row.id);
        const b = sql.get(row.id);
        const same =
            typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)) : a === b;
        if (!same) {
            found.push(`${formula} row ${JSON.stringify(row)}: grid ${JSON.stringify(a)}, sql ${JSON.stringify(b)}`);
        }
    }
    return found;
}

const FORMULAS = [
    // numbers, blanks out, a division by 0 blanks the whole value
    '{price} * {qty}',
    '{price} + {qty} - 1',
    '-{price}',
    '{price} / {qty}',
    '{qty} / 2',
    '7 / 2',
    'COALESCE({price} / {qty}, 99)',
    'IF({qty} = 0, 0, {price} / {qty})',
    'IF({qty} = 0, {price} / {qty}, 1)',
    'COALESCE({price}, {qty} / 0, 5)',
    'COALESCE({qty} / {qty}, {price})',
    '{qty} > 0 AND {price} / {qty} > 1',
    '{qty} = 0 OR {price} / {qty} > 1',
    'ROUND({price})',
    'ROUND({price}, 1)',
    'ROUND({price} / 4, 2)',
    'ROUND({price}, -2)',
    'ROUND(-{price})',
    'ABS({price})',
    'MIN({price}, {qty})',
    'MAX({price}, {qty}, 1)',
    'MIN({price})',
    'COALESCE({price}, {qty}, 0)',
    // comparisons: a blank is false, two blanks are equal
    '{price} = {qty}',
    '{price} <> {qty}',
    '{price} != {qty}',
    '{price} == 2.5',
    '{price} < {qty}',
    '{price} >= 0',
    '{name} = {code}',
    '{name} != {code}',
    '{name} = "ann"',
    '{name} = ""',
    '{name} <> ""',
    '{active} = TRUE',
    '{active} != FALSE',
    'NOT {active}',
    '{active} AND {price} > 0',
    '{active} OR ISBLANK({name})',
    'IF({active}, "yes", "no")',
    'COALESCE({active}, FALSE)',
    'ISBLANK({qty})',
    'ISBLANK({name})',
    // text
    '{name} & "-" & {qty}',
    'CONCAT({name}, {price}, {active})',
    '{price} & ""',
    '{price} * 1000 & ""',
    '{price} / 8 & ""',
    'LEFT({name}, 2)',
    'LEFT({name}, {qty})',
    'LEFT({name}, 0)',
    'LEFT({name}, 1.9)',
    'RIGHT({name}, 2)',
    'RIGHT({name}, {qty})',
    'RIGHT({name}, 20)',
    'MID({name}, 2, 3)',
    'MID({name}, {qty}, 2)',
    'SUBSTRING({code}, 4, 10)',
    'MID({name}, 0, 2)',
    'LEFT({price}, 2)',
    'LEN({name})',
    'LEN({code})',
    'LEN({price})',
    'UPPER({name})',
    'LOWER({code})',
    'TRIM({name})',
    'TRIM({code})',
    'CONTAINS({name}, "an")',
    'CONTAINS({name}, {code})',
    'CONTAINS({code}, "")',
    'CONTAINS({price}, ".5")',
    'IF(LEFT({code}, 2) != "NO", "other", "norway")',
    'UPPER(LEFT({name}, 1)) & LOWER(MID({name}, 2, 100))',
    '"it\'\'s " & {name}',
    '"back\\\\slash" & {code}',
    // dates: the day in the time zone
    'DAYS({due}, TODAY())',
    'DAYS({at}, {due})',
    'DAYS(TODAY(), {at}) > 0',
    'YEAR({due})',
    'MONTH({at})',
    'YEAR({due}) * 100 + MONTH({due})',
    'MONTH(TODAY())',
    '{due} = {at}',
    '{due} != {at}',
    '{due} < TODAY()',
    '{at} >= TODAY()',
    '{due} <= {at}',
    'MIN({due}, {at})',
    'MAX({due}, {at}, TODAY())',
    'COALESCE({due}, {at}, TODAY())',
    'IF({due} < TODAY(), "late", "ok")',
    'IF(ISBLANK({due}), {at}, {due})',
    '{due} & ""',
    'CONCAT("at ", {at})',
    'LEFT({at}, 4)',
    'ISBLANK({due})',
    'TODAY()',
    'DAYS({due}, {at}) / {qty}'
];

describe('formulaSql on SQLite gives the values of the grid', () => {
    for (const formula of FORMULAS) {
        it(`expect ${formula}`, () => {
            expect(differences(formula)).toEqual([]);
        });
    }
});

// ------------------------------------------------------------------ random formulas

function random(seed: number) {
    let state = seed >>> 0;
    const next = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)];
    return { next, pick };
}

/** a random formula of a type, at most `depth` deep */
function randomFormula(r: ReturnType<typeof random>, type: 'number' | 'text' | 'boolean' | 'date', depth: number): string {
    const leaf = depth <= 0 || r.next() < 0.3;
    const sub = (t: 'number' | 'text' | 'boolean' | 'date') => `(${randomFormula(r, t, depth - 1)})`;
    if (type === 'date') {
        if (leaf) {
            return r.pick(['{due}', '{at}', 'TODAY()']);
        }
        return r.pick([
            () => `${r.pick(['MIN', 'MAX'])}(${sub('date')}, ${sub('date')})`,
            () => `COALESCE(${sub('date')}, ${sub('date')})`,
            () => `IF(${sub('boolean')}, ${sub('date')}, ${sub('date')})`
        ])();
    }
    if (type === 'number') {
        if (leaf) {
            return r.pick(['{price}', '{qty}', '2', '0.5', '0', '4']);
        }
        return r.pick([
            () => `${sub('number')} ${r.pick(['+', '-', '*'])} ${sub('number')}`,
            () => `${sub('number')} / ${r.pick(['{qty}', '2', '4'])}`,
            () => `-(${sub('number')})`,
            () => `ROUND(${sub('number')}, ${r.pick(['0', '1', '-1'])})`,
            () => `ABS(${sub('number')})`,
            () => `${r.pick(['MIN', 'MAX'])}(${sub('number')}, ${sub('number')})`,
            () => `COALESCE(${sub('number')}, ${sub('number')})`,
            () => `IF(${sub('boolean')}, ${sub('number')}, ${sub('number')})`,
            () => `LEN(${sub(r.pick(['text', 'number']))})`,
            () => `DAYS(${sub('date')}, ${sub('date')})`,
            () => `${r.pick(['YEAR', 'MONTH'])}(${sub('date')})`
        ])();
    }
    if (type === 'text') {
        if (leaf) {
            return r.pick(['{name}', '{code}', '"ab"', '""', '" x "']);
        }
        return r.pick([
            () => `${sub('text')} & ${sub(r.pick(['text', 'number', 'boolean', 'date']))}`,
            () => `LEFT(${sub('text')}, ${sub('number')})`,
            () => `RIGHT(${sub('text')}, ${r.pick(['{qty}', '2', '0'])})`,
            () => `MID(${sub('text')}, ${r.pick(['{qty}', '2', '0'])}, ${r.pick(['{qty}', '3'])})`,
            () => `${r.pick(['UPPER', 'LOWER', 'TRIM'])}(${sub('text')})`,
            () => `COALESCE(${sub('text')}, ${sub('text')})`,
            () => `IF(${sub('boolean')}, ${sub('text')}, ${sub('text')})`
        ])();
    }
    if (leaf) {
        return r.pick(['{active}', 'TRUE', 'FALSE', 'ISBLANK({name})']);
    }
    return r.pick([
        () => `${sub('number')} ${r.pick(['=', '<>', '!=', '<', '<=', '>', '>='])} ${sub('number')}`,
        () => `${sub('text')} ${r.pick(['=', '<>', '!='])} ${sub('text')}`,
        () => `${sub('date')} ${r.pick(['=', '<>', '!=', '<', '<=', '>', '>='])} ${sub('date')}`,
        () => `${sub('boolean')} ${r.pick(['AND', 'OR'])} ${sub('boolean')}`,
        () => `NOT ${sub('boolean')}`,
        () => `CONTAINS(${sub('text')}, ${sub('text')})`,
        () => `ISBLANK(${sub(r.pick(['text', 'number', 'date']))})`,
        () => `COALESCE(${sub('boolean')}, ${sub('boolean')})`
    ])();
}

describe('formulaSql on SQLite: random formulas', () => {
    it('expect 2000 random formulas of every type to give the grid values', () => {
        const r = random(20261125);
        const found: string[] = [];
        for (let index = 0; index < 2000 && found.length < 5; index++) {
            const formula = randomFormula(r, r.pick(['number', 'text', 'boolean', 'date'] as const), 4);
            found.push(...differences(formula).slice(0, 1));
        }
        expect(found).toEqual([]);
    });
});

// ------------------------------------------------------------------ filters through toSqlWhere

describe('toSqlWhere with calculated columns on SQLite selects the rows the grid selects', () => {
    const calculated = {
        total: '{price} * {qty}',
        label: { formula: 'UPPER(LEFT({name}, 1)) & "-" & {qty}', label: 'Label', type: 'text' as const },
        late: '{active} AND {qty} > 1',
        // a calculated column reading another
        double: '{total} * 2',
        first: 'MIN({due}, {at})',
        daysLate: 'DAYS({due}, TODAY())'
    };
    const types: Record<string, 'number' | 'text' | 'boolean' | 'date'> = {
        total: 'number',
        label: 'text',
        late: 'boolean',
        double: 'number',
        first: 'date',
        daysLate: 'number'
    };
    const cases: [string, FilterOperator, unknown][] = [
        ['total', 'GREATER_THAN', 5],
        ['total', 'EQUAL', 0],
        ['total', 'IS_BLANK', undefined],
        ['total', 'BETWEEN', [1, 10]],
        ['double', 'LESS_THAN', 0],
        ['label', 'BEGIN_WITH', 'a'],
        ['label', 'EQUAL', 'A-4'],
        ['label', 'CONTAINS', '-'],
        ['label', 'IS_NOT_BLANK', undefined],
        ['late', 'EQUAL', true],
        ['late', 'EQUAL', false],
        ['late', 'NOT_EQUAL_TO', true],
        ['first', 'EQUAL', '2026-03-29'],
        ['first', 'LESS_THAN', '2026-01-01'],
        ['first', 'GREATER_THAN_OR_EQUAL_TO', today()],
        ['first', 'NOT_EQUAL_TO', '2025-12-31'],
        ['first', 'IS_BLANK', undefined],
        ['first', 'BETWEEN', ['2025-12-31', '2026-03-29']],
        ['daysLate', 'GREATER_THAN', 0],
        ['daysLate', 'EQUAL', 0]
    ];
    for (const [field, operator, value] of cases) {
        it(`expect ${field} ${operator} ${JSON.stringify(value)}`, () => {
            const condition = { field, operator, value };
            const { sql, params } = toSqlWhere(condition, {
                dialect: 'sqlite',
                columns: COLUMNS,
                calculated,
                timeZone: TIME_ZONE
            });
            const selected = (
                db.prepare(`SELECT id FROM t WHERE ${sql} ORDER BY id`).all(...(params as never[])) as { id: number }[]
            ).map((row) => row.id);
            const entry = calculated[field as keyof typeof calculated];
            const formula = typeof entry === 'string' ? entry.replace('{total}', `(${calculated.total})`) : entry.formula;
            const values = gridRawValues(formula);
            const test = (row: Row, op: FilterOperator, with_: unknown) =>
                objectFilter({ value: values.get(row.id) }, {
                    field: 'value',
                    operator: op,
                    value: with_,
                    type: types[field]
                } as never);
            // BETWEEN is tested by the datasource's filter as from <= value <= to (filter.ts)
            const wanted = ROWS.filter((row) =>
                operator === 'BETWEEN'
                    ? test(row, 'GREATER_THAN_OR_EQUAL_TO', (value as unknown[])[0]) &&
                      test(row, 'LESS_THAN_OR_EQUAL_TO', (value as unknown[])[1])
                    : test(row, operator, value)
            ).map((row) => row.id);
            expect(selected).toEqual(wanted);
            expect(wanted.length).toBeGreaterThan(0);
        });
    }

    it('expect a formula with a problem, a type that is not its formula type, a cycle and dates to throw a TypeError', () => {
        const where = (calc: Record<string, unknown>) => () =>
            toSqlWhere(
                { field: 'x', operator: 'EQUAL', value: 1 },
                { dialect: 'sqlite', columns: COLUMNS, calculated: calc as never, timeZone: TIME_ZONE }
            );
        expect(where({ x: '{price} *' })).toThrow(TypeError);
        expect(where({ x: '{nope} + 1' })).toThrow(/reads \{nope\}, which is not one of the columns/);
        expect(where({ x: { formula: '{price} + 1', type: 'text' } })).toThrow(/its formula gives a number/);
        expect(where({ x: '{y} + 1', y: '{x} + 1' })).toThrow(/reads itself/);
        expect(() =>
            toSqlWhere(
                { field: 'x', operator: 'EQUAL', value: 1 },
                { dialect: 'sqlite', columns: { qty: 'qty' }, calculated: { x: 'YEAR(TODAY())' } }
            )
        ).toThrow(/options.timeZone is needed/);
        expect(where({ price: '1' })).toThrow(/a field of options.columns too/);
        expect(where({ x: 'ROUND({price}, {qty})' })).toThrow(/digits of ROUND/);
    });
});
