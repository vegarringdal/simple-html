// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { FilterOperator } from '../../datasource/filterExpression';
import { objectFilter } from '../../datasource/objectFilter';
import { compileFormula, type FormulaType, readFormula } from '../../grid/formula';
import { type SqlColumn, toSqlWhere } from '../../sql';
import { formulaSql } from '../formulaSql';

/**
 * The formulas of the calculated columns as SQL (formulaSql.ts) give the values the grid gives: every
 * formula run by the grid (formula.ts) and by a real SQLite database (node:sqlite) on rows of every kind
 * of value - blanks, 0, negatives, halves, texts with spaces, tabs, quotes and case - the values compared
 * row by row. A list of formulas for each function and rule, then random ones of every type. Then filters
 * on calculated columns through toSqlWhere, compared with the grid's filter of the computed values.
 *
 * Left out, documented in the SQL guide: the order of texts (`<` on text: the browser's locale order,
 * the database's code points), numbers past 15 digits, case of letters that are not ASCII (SQLite's
 * LOWER and UPPER).
 */

const FIELDS: Record<string, FormulaType> = {
    price: 'number',
    qty: 'number',
    name: 'text',
    code: 'text',
    active: 'boolean'
};

interface Row {
    id: number;
    price: number | null;
    qty: number | null;
    name: string | null;
    code: string | null;
    active: boolean | null;
}

const PRICES = [null, 0, 2.5, -2.5, 0.5, 4, 1250, 0.125, -7, 1.5];
const QTYS = [null, 0, 1, 2, 4, -2, 8];
const NAMES = [null, '', 'Ann', 'ann', 'ANNA', ' ann ', 'tab\there', 'a_b', "o'brien", 'x\n', 'Zeta', '50%', '12', 'a🙂b'];
const CODES = [null, '', 'NO-123', 'se-9', 'ann', 'A', '  '];
const ACTIVES = [null, true, false];

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
            active: ACTIVES[(index * 11) % ACTIVES.length]
        });
    }
    return rows;
}

const ROWS = makeRows();
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE t (id INTEGER, price REAL, qty INTEGER, name TEXT, code TEXT, active INTEGER)');
{
    const insert = db.prepare('INSERT INTO t VALUES (?, ?, ?, ?, ?, ?)');
    for (const row of ROWS) {
        insert.run(row.id, row.price, row.qty, row.name, row.code, row.active === null ? null : row.active ? 1 : 0);
    }
}

const COLUMNS: Record<string, SqlColumn> = {
    price: { column: 'price', type: 'number' },
    qty: { column: 'qty', type: 'number' },
    name: { column: 'name', type: 'text' },
    code: { column: 'code', type: 'text' },
    active: { column: 'active', type: 'boolean', booleanValues: { true: 1, false: 0 } }
};

const typeOf = (field: string) => (Object.hasOwn(FIELDS, field) ? { type: FIELDS[field] } : undefined);

/** the grid's values of a formula, by row id: null where the cell is blank */
function gridValues(formula: string): Map<number, unknown> {
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
    const sql = formulaSql(read.node, read.type, 'sqlite', (field) => ({
        sql: `"${field}"`,
        type: FIELDS[field],
        booleanValues: { true: 1, false: 0 }
    }));
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
    '"back\\\\slash" & {code}'
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
function randomFormula(r: ReturnType<typeof random>, type: 'number' | 'text' | 'boolean', depth: number): string {
    const leaf = depth <= 0 || r.next() < 0.3;
    const sub = (t: 'number' | 'text' | 'boolean') => `(${randomFormula(r, t, depth - 1)})`;
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
            () => `LEN(${sub(r.pick(['text', 'number']))})`
        ])();
    }
    if (type === 'text') {
        if (leaf) {
            return r.pick(['{name}', '{code}', '"ab"', '""', '" x "']);
        }
        return r.pick([
            () => `${sub('text')} & ${sub(r.pick(['text', 'number', 'boolean']))}`,
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
        () => `${sub('boolean')} ${r.pick(['AND', 'OR'])} ${sub('boolean')}`,
        () => `NOT ${sub('boolean')}`,
        () => `CONTAINS(${sub('text')}, ${sub('text')})`,
        () => `ISBLANK(${sub(r.pick(['text', 'number']))})`,
        () => `COALESCE(${sub('boolean')}, ${sub('boolean')})`
    ])();
}

describe('formulaSql on SQLite: random formulas', () => {
    it('expect 2000 random formulas of every type to give the grid values', () => {
        const r = random(20261125);
        const found: string[] = [];
        for (let index = 0; index < 2000 && found.length < 5; index++) {
            const formula = randomFormula(r, r.pick(['number', 'text', 'boolean'] as const), 4);
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
        double: '{total} * 2'
    };
    const types: Record<string, 'number' | 'text' | 'boolean'> = {
        total: 'number',
        label: 'text',
        late: 'boolean',
        double: 'number'
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
        ['late', 'NOT_EQUAL_TO', true]
    ];
    for (const [field, operator, value] of cases) {
        it(`expect ${field} ${operator} ${JSON.stringify(value)}`, () => {
            const condition = { field, operator, value };
            const { sql, params } = toSqlWhere(condition, { dialect: 'sqlite', columns: COLUMNS, calculated });
            const selected = (
                db.prepare(`SELECT id FROM t WHERE ${sql} ORDER BY id`).all(...(params as never[])) as { id: number }[]
            ).map((row) => row.id);
            const entry = calculated[field as keyof typeof calculated];
            const formula = typeof entry === 'string' ? entry.replace('{total}', `(${calculated.total})`) : entry.formula;
            const values = gridValues(formula);
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
                    ? test(row, 'GREATER_THAN_OR_EQUAL_TO', (value as number[])[0]) &&
                      test(row, 'LESS_THAN_OR_EQUAL_TO', (value as number[])[1])
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
                { dialect: 'sqlite', columns: COLUMNS, calculated: calc as never }
            );
        expect(where({ x: '{price} *' })).toThrow(TypeError);
        expect(where({ x: '{nope} + 1' })).toThrow(/reads \{nope\}, which is not one of the columns/);
        expect(where({ x: { formula: '{price} + 1', type: 'text' } })).toThrow(/its formula gives a number/);
        expect(where({ x: '{y} + 1', y: '{x} + 1' })).toThrow(/reads itself/);
        expect(where({ x: 'YEAR(TODAY())' })).toThrow(/dates is not made SQL yet|not made SQL yet/);
        expect(where({ price: '1' })).toThrow(/a field of options.columns too/);
        expect(where({ x: 'ROUND({price}, {qty})' })).toThrow(/digits of ROUND/);
    });
});
