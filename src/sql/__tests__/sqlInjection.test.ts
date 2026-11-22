// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { FILTER_OPERATORS } from '../../datasource/filterExpression';
import { type SqlDialect, type SqlOptions, toSqlWhere } from '../../sql';

/**
 * The filter comes from a browser: it is hostile JSON. No value ever gets into the SQL text, only the
 * names of the columns of the options do, a field that is not one of them throws, so does anything that
 * is no filter, and a filter can not grow without limit.
 *
 * The SQL of every filter here is checked against a grammar of what toSqlWhere writes: keywords and
 * functions, the quoted columns of the options, placeholders, operators, brackets and a few fixed
 * texts. Anything else in it fails the test.
 */

const DIALECTS: SqlDialect[] = ['postgres', 'oracle', 'sqlite', 'mssql'];

const COLUMNS: SqlOptions['columns'] = {
    name: 'name',
    code: 'code',
    age: { column: 'age', type: 'number' },
    weight: { column: 'weight', type: 'number' },
    active: { column: 'active', type: 'boolean' },
    paid: { column: 'paid', type: 'boolean' },
    born: { column: 'born', type: 'date' },
    seen: { column: 'seen', type: 'datetime', dateStorage: 'zoned' },
    left: { column: 'left', type: 'datetime' }
};
const COLUMN_NAMES = ['name', 'code', 'age', 'weight', 'active', 'paid', 'born', 'seen', 'left'];
const FIELDS = Object.keys(COLUMNS);

const run = (filter: unknown, dialect: SqlDialect = 'postgres', more: Partial<SqlOptions> = {}) =>
    toSqlWhere(filter, { dialect, columns: COLUMNS, timeZone: 'Europe/Oslo', ...more });

// ------------------------------------------------------------------ the grammar

const KEYWORDS = [
    'AND',
    'OR',
    'NOT',
    'IS',
    'NULL',
    'LIKE',
    'GLOB',
    'ESCAPE',
    'IN',
    'CAST',
    'AS',
    'COLLATE',
    'LOWER',
    'UPPER',
    'COALESCE',
    'julianday',
    'date',
    'TRUNC',
    'TO_DATE',
    'TO_TIMESTAMP_TZ',
    'DATALENGTH',
    'timestamp',
    'timestamptz',
    'numeric',
    'datetime2',
    'datetimeoffset',
    'Latin1_General_100_BIN2',
    'BINARY'
];
// the only texts in the SQL: the escape of LIKE, the empty text, the formats of Oracle
const TEXTS = ["''", "'!'", "'YYYY-MM-DD HH24:MI:SS'", "'YYYY-MM-DD HH24:MI:SS TZH:TZM'"];

function placeholder(dialect: SqlDialect): string {
    return { postgres: '\\$\\d+', oracle: ':\\d+', sqlite: '\\?', mssql: '@p\\d+' }[dialect];
}

function quoted(dialect: SqlDialect, name: string): string {
    return dialect === 'mssql' ? `[${name}]` : `"${name}"`;
}

/**
 * The tokens of `sql` - throws on anything that is not one of the grammar. The names are the columns of
 * the options (and "C", PostgreSQL's collation), quoted for the dialect
 */
function tokens(sql: string, dialect: SqlDialect): string[] {
    const token = grammar(dialect);
    const found: string[] = [];
    let at = 0;
    while (at < sql.length) {
        token.lastIndex = at;
        const match = token.exec(sql);
        if (!match) {
            throw new Error(`not in the grammar at ${at}: ${JSON.stringify(sql.slice(at, at + 40))} of ${sql}`);
        }
        found.push(match[1]);
        at = token.lastIndex;
    }
    return found;
}

const grammars = new Map<SqlDialect, RegExp>();

/** one token of the grammar of a dialect, sticky */
function grammar(dialect: SqlDialect): RegExp {
    const made = grammars.get(dialect);
    if (made) {
        return made;
    }
    const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const names = [...COLUMN_NAMES.map((name) => quoted(dialect, name)), ...(dialect === 'postgres' ? ['"C"'] : [])];
    const alternatives = [
        ...TEXTS.map(literal),
        ...names.map(literal),
        placeholder(dialect),
        `(?:${KEYWORDS.join('|')})\\b`,
        '<>|<=|>=|=|<|>',
        '[(),]',
        // 1=1, 1=0, 0 and datetime2(0)
        '[01]\\b'
    ];
    const token = new RegExp(`\\s*(${alternatives.join('|')})`, 'y');
    grammars.set(dialect, token);
    return token;
}

/** the SQL is in the grammar, its brackets match, it has a placeholder for each param, and the params are plain */
function expectSafe(result: { sql: string; params: unknown[] }, dialect: SqlDialect) {
    // plain checks, not expect(): this runs a hundred thousand times
    const fail = (why: string) => {
        throw new Error(`${why}: ${result.sql}`);
    };
    const list = tokens(result.sql, dialect);
    let depth = 0;
    for (const token of list) {
        depth += token === '(' ? 1 : token === ')' ? -1 : 0;
        if (depth < 0) {
            fail('a ) without its (');
        }
    }
    if (depth !== 0) {
        fail('a ( without its )');
    }
    const isPlaceholder = new RegExp(`^${placeholder(dialect)}$`);
    if (list.filter((token) => isPlaceholder.test(token)).length !== result.params.length) {
        fail(`not one placeholder for each of the ${result.params.length} params`);
    }
    if (!result.params.every((param) => ['string', 'number', 'boolean'].includes(typeof param))) {
        fail(`a param that is no text, number or boolean: ${JSON.stringify(result.params)}`);
    }
}

// ------------------------------------------------------------------ hostile values

const HOSTILE = [
    "'; DROP TABLE t; --",
    "' OR '1'='1",
    '" OR 1=1 --',
    '") OR 1=1 --',
    '] OR 1=1 --',
    "\\'; DROP TABLE t; --",
    '\\',
    '\\\\',
    '%',
    '_',
    '[',
    ']',
    '[%]',
    '!',
    '!%',
    '*',
    '?',
    '$1',
    ':1',
    '@p1',
    '/* comment */',
    '-- comment',
    '’; DROP TABLE t; --', // a curly quote
    '＇ OR 1=1', // a full width apostrophe
    'ʼ',
    'a\nb\r\nc',
    '\t',
    'NULL',
    'null',
    "'",
    "''",
    '"',
    'x'.repeat(1000),
    'ʼ OR ʼ1ʼ=ʼ1',
    '🙂; DROP TABLE t'
];

describe('hostile values are parameters, never SQL', () => {
    const textOperators = [
        'EQUAL',
        'NOT_EQUAL_TO',
        'CONTAINS',
        'DOES_NOT_CONTAIN',
        'BEGIN_WITH',
        'END_WITH',
        'LESS_THAN',
        'GREATER_THAN'
    ];

    for (const dialect of DIALECTS) {
        it(`expect no hostile text to be in the SQL of ${dialect}`, () => {
            for (const value of HOSTILE) {
                for (const operator of textOperators) {
                    for (const caseSensitive of [false, true]) {
                        const result = run({ field: 'name', operator, value, caseSensitive }, dialect);
                        expectSafe(result, dialect);
                        expect(result.params).toHaveLength(1);
                    }
                }
                for (const operator of ['IN', 'NOT_IN']) {
                    const result = run({ field: 'name', operator, value: [value, 'other'] }, dialect);
                    expectSafe(result, dialect);
                }
                expectSafe(run({ field: 'name', operator: 'BETWEEN', value: [value, value] }, dialect), dialect);
            }
        });
    }

    it('expect a hostile value to be data in a real database: it finds its row, the table stays', () => {
        const db = new DatabaseSync(':memory:');
        db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
        const insert = db.prepare('INSERT INTO t (id, name) VALUES (?, ?)');
        HOSTILE.forEach((value, index) => {
            insert.run(index + 1, value);
        });
        insert.run(1000, 'innocent');
        HOSTILE.forEach((value, index) => {
            // the wildcards of the grid are wildcards: those values find more than themselves
            if (/[*%]/.test(value)) {
                return;
            }
            const { sql, params } = run({ field: 'name', operator: 'EQUAL', value, caseSensitive: true }, 'sqlite');
            const ids = db
                .prepare(`SELECT id FROM t WHERE ${sql}`)
                .all(...(params as string[]))
                .map((row) => row.id);
            expect(ids, value).toEqual([index + 1]);
        });
        expect(db.prepare('SELECT COUNT(*) AS n FROM t').get()?.n).toBe(HOSTILE.length + 1);
    });

    it('expect dates and numbers of hostile text to throw', () => {
        for (const value of HOSTILE) {
            // a text of white space is 0 for Number(), and for the grid
            if (value.trim() !== '') {
                expect(() => run({ field: 'age', operator: 'EQUAL', value })).toThrow(TypeError);
            }
            expect(() => run({ field: 'born', operator: 'EQUAL', value })).toThrow(TypeError);
            expect(() => run({ field: 'active', operator: 'EQUAL', value })).toThrow(TypeError);
        }
    });

    it('expect NUL and lone surrogates to throw: no database text holds them', () => {
        expect(() => run({ field: 'name', operator: 'EQUAL', value: 'a\0b' })).toThrow(/NUL character/);
        expect(() => run({ field: 'name', operator: 'EQUAL', value: 'a\uD800b' })).toThrow(/lone surrogate/);
        expect(() => run({ field: 'name', operator: 'EQUAL', value: '\uDC00' })).toThrow(/lone surrogate/);
        expect(() => run({ field: 'name', operator: 'IN', value: ['ok', 'a\0'] })).toThrow(/NUL character/);
        expect(run({ field: 'name', operator: 'EQUAL', value: '🙂' }).params).toEqual(['🙂']);
    });
});

// ------------------------------------------------------------------ hostile names

describe('only the columns of the options get into the SQL', () => {
    const hostileFields = [
        'secret',
        'name; DROP TABLE t',
        'name"',
        '"name"',
        'NAME',
        'name ',
        ' name',
        'name--',
        'name)',
        '1=1',
        '*',
        '__proto__',
        'constructor',
        'toString',
        'hasOwnProperty',
        'valueOf',
        'prototype',
        '__defineGetter__'
    ];

    it('expect a field or a valueField that is not a column to throw, also in a condition the grid ignores', () => {
        for (const field of hostileFields) {
            expect(() => run({ field, operator: 'EQUAL', value: 'x' }), field).toThrow(/is not one of the columns/);
            expect(() => run({ field, operator: 'IS_BLANK' }), field).toThrow(/is not one of the columns/);
            expect(() => run({ field, operator: 'EQUAL', value: '' }), field).toThrow(/is not one of the columns/);
            expect(() => run({ field }), field).toThrow(/is not one of the columns/);
            expect(() => run({ field: 'age', operator: 'EQUAL', valueField: field }), field).toThrow(/is not one of the columns/);
            expect(() => run({ field: 'age', operator: 'IS_BLANK', valueField: field }), field).toThrow(
                /is not one of the columns/
            );
        }
    });

    it('expect a field that is not a text to throw', () => {
        for (const field of [5, true, {}, ['name'], { toString: () => 'name' }]) {
            expect(() => run({ field, operator: 'EQUAL', value: 'x' }), JSON.stringify(field)).toThrow(/is the name of a field/);
        }
    });

    it('expect a column that is not a plain name to throw when the options are read', () => {
        for (const column of [
            'name; DROP TABLE t',
            'na"me',
            'na]me',
            'na[me',
            "na'me",
            'name ',
            '1name',
            'a.b.c.d',
            '.name',
            'name.',
            'a..b',
            'schema.*',
            'nâme',
            'name\u0000',
            'x'.repeat(129),
            '',
            'LOWER(name)'
        ]) {
            for (const dialect of DIALECTS) {
                expect(() => toSqlWhere(null, { dialect, columns: { a: column } }), column).toThrow(/letters, digits and _/);
            }
        }
        expect(
            toSqlWhere({ field: 'a', operator: 'IS_BLANK' }, { dialect: 'oracle', columns: { a: 'x'.repeat(128) } }).sql
        ).toContain('x'.repeat(128));
    });

    it('expect the columns to be own properties: a polluted prototype adds none', () => {
        const prototype = Object.prototype as Record<string, unknown>;
        prototype.polluted = 'name';
        try {
            expect(() => run({ field: 'polluted', operator: 'EQUAL', value: 'x' })).toThrow(/is not one of the columns/);
            // and the filter's own properties only: an inherited field is no field
            const condition = Object.create({ field: 'name', operator: 'EQUAL', value: 'x' });
            expect(() => run(condition)).toThrow(TypeError);
        } finally {
            delete prototype.polluted;
        }
    });

    it('expect a field named __proto__ to work when the options list it as an own property', () => {
        const columns = JSON.parse('{"__proto__": "proto_col", "constructor": "ctor"}');
        expect(toSqlWhere(JSON.parse('{"field": "__proto__", "operator": "IS_BLANK"}'), { dialect: 'sqlite', columns }).sql).toBe(
            `("proto_col" IS NULL OR "proto_col" = '')`
        );
        expect(toSqlWhere({ field: 'constructor', operator: 'IS_BLANK' }, { dialect: 'sqlite', columns }).sql).toContain(
            '"ctor"'
        );
    });
});

// ------------------------------------------------------------------ hostile shapes

describe('anything that is no filter throws a TypeError', () => {
    const shapes: unknown[] = [
        'name = 1',
        5,
        true,
        [],
        [{ field: 'name', operator: 'EQUAL', value: 'x' }],
        new Date(),
        new Map(),
        () => 1,
        { group: 'XOR', children: [] },
        { group: 'or', children: [] },
        { group: 'AND' },
        { group: 'AND', children: {} },
        { group: 'AND', children: 'x' },
        { group: 'AND', children: [5] },
        { group: 'AND', children: [null] },
        { group: 'AND', children: [[]] },
        { group: 'AND', children: [], field: 'name' },
        { children: [], operator: 'EQUAL' },
        { field: 'name', operator: 'EQUALS', value: 'x' },
        { field: 'name', operator: 'equal', value: 'x' },
        { field: 'name', operator: 5, value: 'x' },
        { field: 'name', operator: ['EQUAL'], value: 'x' },
        { field: 'name', operator: 'EQUAL', value: 'x', caseSensitive: 'yes' },
        { field: 'name', operator: 'EQUAL', value: 'x', caseSensitive: 1 },
        { field: 'name', operator: 'EQUAL', value: 'x', extra: 1 },
        { field: 'name', operator: 'EQUAL', value: 'x', caseSensitiv: true },
        { field: 'name', operator: 'EQUAL', value: { $ne: 1 } },
        { field: 'name', operator: 'EQUAL', value: ['x'] },
        { field: 'name', operator: 'EQUAL', value: 5 },
        { field: 'name', operator: 'IN', value: [{}] },
        { field: 'name', operator: 'IN', value: [['x']] },
        { field: 'name', operator: 'IN', value: { 0: 'x', length: 1 } },
        { field: 'name', operator: 'IN', value: [undefined] },
        { field: 'age', operator: 'IN', value: [1, [2]] },
        { field: 'age', operator: 'BETWEEN', value: [1] },
        { field: 'age', operator: 'BETWEEN', value: [1, 2, 3] },
        { field: 'age', operator: 'BETWEEN', value: 5 },
        { field: 'age', operator: 'BETWEEN', value: { from: 1, to: 2 } },
        { field: 'age', operator: 'BETWEEN', value: [[1], 2] },
        { field: 'age', operator: 'EQUAL', value: Number.NaN },
        { field: 'age', operator: 'EQUAL', value: 10n },
        { field: 'born', operator: 'EQUAL', value: { toISOString: () => '2026-01-01' } },
        { field: 'born', operator: 'EQUAL', value: 1795302000000 },
        { field: 'active', operator: 'EQUAL', value: 'true' },
        { field: 'name', operator: 'EQUAL', valueField: 5 },
        new (class Condition {
            field = 'name';
            operator = 'EQUAL';
            value = 'x';
        })()
    ];

    for (const dialect of DIALECTS) {
        it(`expect each wrong shape to throw a TypeError on ${dialect}`, () => {
            shapes.forEach((shape, index) => {
                expect(() => run(shape, dialect), `shape ${index}`).toThrow(TypeError);
            });
        });
    }

    it('expect a getter to be read once: the value checked is the value in the SQL', () => {
        let reads = 0;
        const condition = {
            field: 'name',
            operator: 'EQUAL',
            get value() {
                reads++;
                return reads === 1 ? 'safe' : { evil: true };
            }
        };
        expect(run(condition).params).toEqual(['safe']);
        expect(reads).toBe(1);
    });

    it('expect the messages to say where, and cut what they show of the filter', () => {
        const long = 'x'.repeat(10_000);
        const messages: string[] = [];
        for (const filter of [
            { field: long, operator: 'EQUAL', value: 'x' },
            { field: 'name', operator: long, value: 'x' },
            { field: 'age', operator: 'EQUAL', value: long },
            { group: 'AND', children: [{ field: 'name', operator: 'EQUAL', value: { [long]: long } }] },
            { group: long, children: [] }
        ]) {
            try {
                run(filter);
            } catch (error) {
                messages.push((error as Error).message);
            }
        }
        expect(messages).toHaveLength(5);
        for (const message of messages) {
            expect(message.length).toBeLessThan(400);
            expect(message).not.toContain('x'.repeat(41));
        }
        expect(messages[3]).toContain('filter.children[0].value');
    });
});

// ------------------------------------------------------------------ limits

describe('the limits', () => {
    const deep = (levels: number): unknown =>
        levels === 0 ? { field: 'age', operator: 'EQUAL', value: 1 } : { group: 'AND', children: [deep(levels - 1)] };

    it('expect groups nested deeper than limits.depth to throw a RangeError', () => {
        expect(() => run(deep(10))).not.toThrow();
        expect(() => run(deep(11))).toThrow(RangeError);
        expect(() => run(deep(3), 'postgres', { limits: { depth: 2 } })).toThrow(/nest more than 2 deep/);
        // far too deep: the limit stops it before the stack does
        expect(() => run(deep(100_000))).toThrow(RangeError);
    });

    it('expect more conditions and groups than limits.conditions to throw a RangeError', () => {
        const many = (count: number) => ({
            group: 'OR',
            children: Array.from({ length: count }, () => ({ field: 'age', operator: 'EQUAL', value: 1 }))
        });
        expect(() => run(many(99))).not.toThrow();
        expect(() => run(many(100))).toThrow(RangeError);
        // empty groups count too
        expect(() => run({ group: 'OR', children: Array.from({ length: 1_000_000 }, () => ({ children: [] })) })).toThrow(
            RangeError
        );
        // ignored conditions too
        expect(() => run({ group: 'OR', children: Array.from({ length: 200 }, () => ({})) })).toThrow(RangeError);
    });

    it('expect a list longer than limits.listLength to throw a RangeError', () => {
        const list = (count: number) => Array.from({ length: count }, (_, index) => index);
        expect(() => run({ field: 'age', operator: 'IN', value: list(1000) })).not.toThrow();
        expect(() => run({ field: 'age', operator: 'IN', value: list(1001) })).toThrow(RangeError);
        expect(() => run({ field: 'name', operator: 'IN', value: 'a\n'.repeat(1000) })).toThrow(RangeError);
        expect(() => run({ field: 'age', operator: 'IN', value: list(11) }, 'postgres', { limits: { listLength: 10 } })).toThrow(
            /more than 10 values/
        );
    });

    it('expect a text longer than limits.textLength to throw a RangeError', () => {
        expect(() => run({ field: 'name', operator: 'EQUAL', value: 'x'.repeat(1000) })).not.toThrow();
        expect(() => run({ field: 'name', operator: 'EQUAL', value: 'x'.repeat(1001) })).toThrow(RangeError);
        expect(() => run({ field: 'name', operator: 'IN', value: ['x'.repeat(1001)] })).toThrow(RangeError);
        expect(() => run({ field: 'name', operator: 'EQUAL', value: 'xxxx' }, 'postgres', { limits: { textLength: 3 } })).toThrow(
            RangeError
        );
    });

    it('expect more parameters than limits.params to throw a RangeError - SQL Server takes 2100', () => {
        const dates = Array.from({ length: 1000 }, (_, index) =>
            new Date(Date.UTC(2000, 0, 1 + index)).toISOString().slice(0, 10)
        );
        // a date of a list is two parameters
        expect(() => run({ field: 'born', operator: 'IN', value: dates }, 'mssql')).not.toThrow();
        expect(() =>
            run(
                {
                    group: 'AND',
                    children: [
                        { field: 'age', operator: 'EQUAL', value: 1 },
                        { field: 'born', operator: 'IN', value: dates }
                    ]
                },
                'mssql'
            )
        ).toThrow(/more than 2000 parameters/);
    });
});

// ------------------------------------------------------------------ a fuzz test

/** a seeded random JSON value: objects with filter keys and others, arrays, texts of SQL, numbers */
function fuzz(seed: number) {
    let state = seed >>> 0;
    const next = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)];
    const KEYS = ['field', 'operator', 'value', 'valueField', 'caseSensitive', 'group', 'children'];
    const scalar = (): unknown =>
        pick<() => unknown>([
            () => pick(HOSTILE),
            () => pick(FIELDS),
            () => pick(FILTER_OPERATORS),
            () => pick(['AND', 'OR', 'and', '']),
            () => Math.floor(next() * 20) - 5,
            () => next() * 100,
            () => pick([true, false, null]),
            () => pick(['2026-11-22', '2026-11-22T10:00:00Z', '2026-02-30', 'NULL', '0', '', ' '])
        ])();
    const value = (depth: number): unknown => {
        const kind = next();
        if (depth > 4 || kind < 0.5) {
            return scalar();
        }
        if (kind < 0.7) {
            return Array.from({ length: Math.floor(next() * 4) }, () => value(depth + 1));
        }
        const object: Record<string, unknown> = {};
        for (let index = Math.floor(next() * 5); index > 0; index--) {
            object[next() < 0.9 ? pick(KEYS) : pick(HOSTILE)] = value(depth + 1);
        }
        return object;
    };
    return () => value(0);
}

describe('a fuzz test', () => {
    it('expect 20000 random JSON values to give SQL of the grammar, or to throw a TypeError or a RangeError', () => {
        const next = fuzz(42);
        const outcomes = { sql: 0, typeError: 0, rangeError: 0 };
        for (let index = 0; index < 20_000; index++) {
            const filter = next();
            const dialect = DIALECTS[index % DIALECTS.length];
            let result: { sql: string; params: unknown[] } | undefined;
            try {
                result = run(filter, dialect);
            } catch (error) {
                if (error instanceof RangeError) {
                    outcomes.rangeError++;
                } else if (error instanceof TypeError) {
                    outcomes.typeError++;
                } else {
                    throw error;
                }
                // a TypeError of the filter, not one of JavaScript
                expect((error as Error).message, JSON.stringify(filter)).toMatch(/^toSqlWhere: /);
                continue;
            }
            outcomes.sql++;
            expectSafe(result, dialect);
        }
        // about 1900 give SQL, the rest throw: random objects are mostly no filter
        expect(outcomes.sql).toBeGreaterThan(1500);
        expect(outcomes.typeError).toBeGreaterThan(2000);
    });

    it('expect a JSON filter to give SQL of the grammar for every field, operator and kind of value', () => {
        const values = [
            ...HOSTILE.slice(0, 8),
            0,
            1,
            -1.5,
            true,
            false,
            null,
            '',
            '2026-11-22',
            '2026-11-22T10:00:00Z',
            ['a', 'NULL'],
            [1, 2],
            ['2026-11-22', null]
        ];
        for (const dialect of DIALECTS) {
            for (const field of FIELDS) {
                for (const operator of FILTER_OPERATORS) {
                    for (const value of values) {
                        for (const valueField of [undefined, 'name', 'age', 'active', 'left']) {
                            try {
                                expectSafe(run({ field, operator, value, valueField }, dialect), dialect);
                            } catch (error) {
                                if (!(error instanceof TypeError) || !error.message.startsWith('toSqlWhere: ')) {
                                    throw error;
                                }
                            }
                        }
                    }
                }
            }
        }
    });
});
