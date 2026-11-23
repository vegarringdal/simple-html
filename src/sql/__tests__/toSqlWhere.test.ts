// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, FILTER_OPERATORS, type FilterOperator } from '../../datasource/filterExpression';
import { formatTexts } from '../../grid/columnFormat';
import { dateConditions } from '../../grid/filterAsShown';
import { type SqlColumn, type SqlDialect, type SqlOptions, toSqlWhere } from '../../sql';

/**
 * The SQL toSqlWhere writes for each dialect: every operator on every type, with and without case, in
 * the snapshot - and the rules behind it, one by one. That the SQL selects the rows the grid selects is
 * tested against a real database in sqlSqlite.test.ts; PostgreSQL, Oracle and SQL Server are not here, so
 * their SQL is checked as text: each choice is in the SQL guide with the docs it is based on.
 */

const DIALECTS: SqlDialect[] = ['postgres', 'oracle', 'sqlite', 'mssql'];

const COLUMNS: Record<string, string | SqlColumn> = {
    name: 'name',
    code: { column: 'code' },
    age: { column: 'age', type: 'number' },
    weight: { column: 'weight', type: 'number' },
    active: { column: 'active', type: 'boolean' },
    paid: { column: 'paid', type: 'boolean' },
    born: { column: 'born', type: 'date' },
    seen: { column: 'seen', type: 'datetime' },
    changed: { column: 'changed', type: 'datetime' }
};

const options = (dialect: SqlDialect, more: Partial<SqlOptions> = {}): SqlOptions => ({
    dialect,
    columns: COLUMNS,
    timeZone: 'Europe/Oslo',
    ...more
});

const sql = (filter: unknown, dialect: SqlDialect = 'postgres', more: Partial<SqlOptions> = {}) =>
    toSqlWhere(filter, options(dialect, more));

const where = (field: string, operator: FilterOperator, value?: unknown, extra: object = {}) =>
    value === undefined ? { field, operator, ...extra } : { field, operator, value, ...extra };

describe('the SQL of every operator, type and case', () => {
    const VALUES: Record<string, unknown> = {
        name: 'an*n_a!',
        age: 5,
        active: true,
        born: '2026-11-21T23:00:00.000Z',
        seen: '2026-11-21T23:00:00.000Z'
    };
    const LISTS: Record<string, unknown> = {
        name: ['Ann', 'NULL', 'b%_[x]'],
        age: [1, 2.5, 'NULL'],
        active: [true, 'NULL'],
        born: ['2026-11-22', 'NULL'],
        seen: ['2026-11-22T10:00:00']
    };
    const BETWEEN: Record<string, unknown> = {
        name: ['a', 'm'],
        age: [10, null],
        active: [true, null],
        born: ['2026-11-01T00:00', '2026-11-30T00:00'],
        seen: [null, '2026-11-30T12:00:00']
    };

    for (const dialect of DIALECTS) {
        it(`expect the SQL of ${dialect} to be the snapshot`, () => {
            const lines: string[] = [];
            for (const field of Object.keys(VALUES)) {
                for (const operator of FILTER_OPERATORS) {
                    for (const caseSensitive of field === 'name' ? [false, true] : [false]) {
                        const value =
                            operator === 'IN' || operator === 'NOT_IN'
                                ? LISTS[field]
                                : operator === 'BETWEEN'
                                  ? BETWEEN[field]
                                  : operator === 'IS_BLANK' || operator === 'IS_NOT_BLANK'
                                    ? undefined
                                    : VALUES[field];
                        const result = sql(where(field, operator, value, caseSensitive ? { caseSensitive } : {}), dialect);
                        lines.push(
                            `${field} ${operator}${caseSensitive ? ' caseSensitive' : ''}\n  ${result.sql}\n  ${JSON.stringify(result.params)}`
                        );
                    }
                }
            }
            expect(lines.join('\n')).toMatchSnapshot();
        });
    }
});

describe('no condition', () => {
    it('expect no filter, empty groups and ignored conditions to give 1=1 and no params', () => {
        for (const filter of [
            null,
            undefined,
            { group: 'AND', children: [] },
            { group: 'OR', children: [{ group: 'AND', children: [] }] },
            { children: [] },
            {},
            where('name', 'EQUAL', ''),
            where('name', 'EQUAL', null),
            { field: 'name', operator: 'EQUAL' },
            { field: 'name' },
            { operator: 'EQUAL', value: 'x' },
            { field: '', operator: 'EQUAL', value: 'x' },
            { field: 'name', operator: '', value: 'x' },
            { field: null, operator: null, value: 'x' },
            where('age', 'BETWEEN', [null, '']),
            where('age', 'BETWEEN', null),
            where('born', 'GREATER_THAN', new Date('invalid')),
            where('born', 'BETWEEN', [new Date('invalid'), null])
        ]) {
            for (const dialect of DIALECTS) {
                expect(sql(filter, dialect), JSON.stringify(filter)).toEqual({ sql: '1=1', params: [] });
            }
        }
    });

    it('expect ignored conditions to be left out of a group, as the grid leaves them out', () => {
        const filter = {
            group: 'OR',
            children: [where('name', 'EQUAL', ''), where('age', 'EQUAL', 1), { group: 'AND', children: [] }]
        };
        expect(sql(filter)).toEqual({ sql: '("age" IS NOT NULL AND "age" = $1)', params: [1] });
    });

    it('expect an IN without values to match no row, a NOT_IN every row', () => {
        for (const value of [[], null, undefined, '', ['']]) {
            expect(sql(where('name', 'IN', value)).sql).toBe('1=0');
            expect(sql(where('name', 'NOT_IN', value)).sql).toBe('1=1');
            expect(sql(where('age', 'IN', value)).sql).toBe('1=0');
        }
        // 1=0 in a group: the group decides
        expect(sql({ group: 'OR', children: [where('name', 'IN', []), where('age', 'EQUAL', 1)] }).sql).toBe(
            '(1=0 OR ("age" IS NOT NULL AND "age" = $1))'
        );
    });
});

describe('placeholders, names and groups', () => {
    const filter = { group: 'AND', children: [where('age', 'EQUAL', 1), where('age', 'EQUAL', 2), where('age', 'EQUAL', 3)] };

    it('expect the placeholders of each dialect, in order', () => {
        expect(sql(filter, 'postgres').sql).toBe(
            '(("age" IS NOT NULL AND "age" = $1) AND ("age" IS NOT NULL AND "age" = $2) AND ("age" IS NOT NULL AND "age" = $3))'
        );
        expect(sql(filter, 'oracle').sql).toBe(
            '(("age" IS NOT NULL AND "age" = :1) AND ("age" IS NOT NULL AND "age" = :2) AND ("age" IS NOT NULL AND "age" = :3))'
        );
        expect(sql(filter, 'sqlite').sql).toBe(
            '(("age" IS NOT NULL AND "age" = ?) AND ("age" IS NOT NULL AND "age" = ?) AND ("age" IS NOT NULL AND "age" = ?))'
        );
        expect(sql(filter, 'mssql').sql).toBe(
            '(([age] IS NOT NULL AND [age] = @p1) AND ([age] IS NOT NULL AND [age] = @p2) AND ([age] IS NOT NULL AND [age] = @p3))'
        );
        expect(sql(filter).params).toEqual([1, 2, 3]);
    });

    it('expect firstParam to number the placeholders from it', () => {
        expect(sql(filter, 'postgres', { firstParam: 4 }).sql).toContain('$4) AND');
        expect(sql(filter, 'postgres', { firstParam: 4 }).sql).toContain('$6)');
        expect(sql(filter, 'oracle', { firstParam: 2 }).sql).toContain(':4)');
        expect(sql(filter, 'mssql', { firstParam: 10 }).sql).toContain('@p12)');
        // sqlite's ? are taken in order
        expect(sql(filter, 'sqlite', { firstParam: 10 }).sql).toBe(sql(filter, 'sqlite').sql);
    });

    it('expect a name with a schema and a table to be quoted part by part', () => {
        const columns = { a: 'sales.orders.total', b: 'orders.Total_2', c: '_x' };
        expect(toSqlWhere(where('a', 'IS_BLANK'), { dialect: 'postgres', columns }).sql).toBe(
            `("sales"."orders"."total" IS NULL OR "sales"."orders"."total" = '')`
        );
        expect(toSqlWhere(where('b', 'IS_BLANK'), { dialect: 'mssql', columns }).sql).toBe(
            '([orders].[Total_2] IS NULL OR DATALENGTH([orders].[Total_2]) = 0)'
        );
        expect(toSqlWhere(where('c', 'IS_BLANK'), { dialect: 'oracle', columns }).sql).toBe('"_x" IS NULL');
    });

    it('expect AND and OR groups to nest in brackets, one child without', () => {
        const nested = {
            group: 'OR',
            children: [
                where('age', 'EQUAL', 1),
                { group: 'AND', children: [where('age', 'EQUAL', 2), where('weight', 'EQUAL', 3)] }
            ]
        };
        expect(sql(nested).sql).toBe(
            '(("age" IS NOT NULL AND "age" = $1) OR (("age" IS NOT NULL AND "age" = $2) AND ("weight" IS NOT NULL AND "weight" = $3)))'
        );
        expect(sql({ group: 'OR', children: [where('age', 'EQUAL', 1)] }).sql).toBe('("age" IS NOT NULL AND "age" = $1)');
        // group left out is AND, as in the grid
        expect(sql({ children: [where('age', 'EQUAL', 1), where('age', 'EQUAL', 2)] }).sql).toContain(') AND (');
    });

    it('expect several fields to name one column', () => {
        const columns = { a: 'x', b: { column: 'x', type: 'number' as const } };
        expect(toSqlWhere(where('b', 'EQUAL', 1), { dialect: 'sqlite', columns }).sql).toBe('("x" IS NOT NULL AND "x" = ?)');
    });
});

describe('text', () => {
    it('expect case to be ignored with LOWER on the column and the value folded before it is bound, kept with caseSensitive', () => {
        expect(sql(where('name', 'EQUAL', 'Ann'))).toEqual({
            sql: `("name" IS NOT NULL AND LOWER("name") LIKE $1 ESCAPE '!')`,
            params: ['ann']
        });
        expect(sql(where('name', 'EQUAL', 'Ann', { caseSensitive: true }))).toEqual({
            sql: `("name" IS NOT NULL AND "name" LIKE $1 ESCAPE '!')`,
            params: ['Ann']
        });
        // caseSensitive false, null: ignoring case
        expect(sql(where('name', 'EQUAL', 'Ann', { caseSensitive: false })).sql).toContain('LOWER');
        expect(sql(where('name', 'EQUAL', 'Ann', { caseSensitive: null })).sql).toContain('LOWER');
    });

    it('expect sqlite to match with GLOB, which keeps case, and LOWER for ignoring it', () => {
        expect(sql(where('name', 'CONTAINS', 'An'), 'sqlite')).toEqual({
            sql: '("name" IS NOT NULL AND LOWER("name") GLOB ?)',
            params: ['*an*']
        });
        expect(sql(where('name', 'CONTAINS', 'An', { caseSensitive: true }), 'sqlite').sql).toBe(
            '("name" IS NOT NULL AND "name" GLOB ?)'
        );
    });

    it('expect mssql to match with LIKE in a binary collation: case and trailing spaces count', () => {
        expect(sql(where('name', 'EQUAL', 'Ann'), 'mssql').sql).toBe(
            '([name] IS NOT NULL AND LOWER([name]) COLLATE Latin1_General_100_BIN2 LIKE @p1)'
        );
        expect(sql(where('name', 'EQUAL', 'Ann', { caseSensitive: true }), 'mssql').sql).toBe(
            '([name] IS NOT NULL AND [name] COLLATE Latin1_General_100_BIN2 LIKE @p1)'
        );
    });

    it('expect * and % to be wildcards, _ one character, every other character of LIKE and GLOB literal', () => {
        const value = 'a*b%c_d!e[f]g?h\\i';
        expect(sql(where('name', 'EQUAL', value), 'postgres').params).toEqual(['a%b%c_d!!e[f]g?h\\i']);
        expect(sql(where('name', 'EQUAL', value), 'oracle').params).toEqual(['a%b%c_d!!e[f]g?h\\i']);
        expect(sql(where('name', 'EQUAL', value), 'mssql').params).toEqual(['a%b%c_d!e[[]f]g?h\\i']);
        expect(sql(where('name', 'EQUAL', value), 'sqlite').params).toEqual(['a*b*c?d!e[[]f]g[?]h\\i']);
    });

    it('expect _ next to the other wildcards and at the ends of CONTAINS to be one character', () => {
        expect(sql(where('name', 'CONTAINS', '_*_'), 'postgres').params).toEqual(['%_%_%']);
        expect(sql(where('name', 'BEGIN_WITH', '__'), 'sqlite').params).toEqual(['??*']);
        expect(sql(where('name', 'END_WITH', '%_'), 'mssql').params).toEqual(['%%_']);
    });

    it('expect the pattern of each operator', () => {
        const patterns = (dialect: SqlDialect) =>
            (['EQUAL', 'NOT_EQUAL_TO', 'CONTAINS', 'DOES_NOT_CONTAIN', 'BEGIN_WITH', 'END_WITH'] as const).map(
                (operator) => sql(where('name', operator, 'ab'), dialect).params[0]
            );
        expect(patterns('postgres')).toEqual(['ab', 'ab', '%ab%', '%ab%', 'ab%', '%ab']);
        expect(patterns('sqlite')).toEqual(['ab', 'ab', '*ab*', '*ab*', 'ab*', '*ab']);
    });

    it('expect NOT_EQUAL_TO and DOES_NOT_CONTAIN to match the blank rows, in every dialect', () => {
        expect(sql(where('name', 'NOT_EQUAL_TO', 'x'), 'oracle').sql).toBe(
            `("name" IS NULL OR NOT (LOWER("name") LIKE :1 ESCAPE '!'))`
        );
        expect(sql(where('name', 'DOES_NOT_CONTAIN', 'x'), 'mssql').sql).toBe(
            '([name] IS NULL OR NOT (LOWER([name]) COLLATE Latin1_General_100_BIN2 LIKE @p1))'
        );
    });

    it("expect a blank row to match a pattern of wildcards only - '' matches '*'", () => {
        expect(sql(where('name', 'EQUAL', '*')).sql).toBe(`("name" IS NULL OR LOWER("name") LIKE $1 ESCAPE '!')`);
        expect(sql(where('name', 'NOT_EQUAL_TO', '%')).sql).toBe(
            `("name" IS NOT NULL AND NOT (LOWER("name") LIKE $1 ESCAPE '!'))`
        );
    });

    it("expect oracle never to compare with '' - it is null there", () => {
        const filters = [
            where('name', 'IS_BLANK'),
            where('name', 'IS_NOT_BLANK'),
            where('name', 'IN', ['NULL', 'a']),
            where('name', 'NOT_IN', ['NULL']),
            where('name', 'EQUAL', '*'),
            { field: 'name', operator: 'LESS_THAN', valueField: 'code' }
        ];
        for (const filter of filters) {
            expect(sql(filter, 'oracle').sql).not.toContain("''");
        }
        expect(sql(where('name', 'IS_BLANK'), 'oracle').sql).toBe('"name" IS NULL');
        expect(sql(where('name', 'IS_NOT_BLANK'), 'oracle').sql).toBe('"name" IS NOT NULL');
    });

    it("expect IS_BLANK on mssql to count trailing spaces: '   ' is not blank", () => {
        expect(sql(where('name', 'IS_BLANK'), 'mssql').sql).toBe('([name] IS NULL OR DATALENGTH([name]) = 0)');
        expect(sql(where('name', 'IS_NOT_BLANK'), 'mssql').sql).toBe('([name] IS NOT NULL AND DATALENGTH([name]) > 0)');
    });

    it('expect the comparisons a text does not offer to compare code point by code point', () => {
        expect(sql(where('name', 'LESS_THAN', 'm'), 'postgres').sql).toBe('("name" IS NULL OR LOWER("name") COLLATE "C" < $1)');
        expect(sql(where('name', 'GREATER_THAN', 'm', { caseSensitive: true }), 'postgres').sql).toBe(
            '("name" IS NOT NULL AND "name" COLLATE "C" > $1)'
        );
        expect(sql(where('name', 'LESS_THAN_OR_EQUAL_TO', 'm'), 'sqlite').sql).toBe(
            '("name" IS NULL OR LOWER("name") COLLATE BINARY <= ?)'
        );
        expect(sql(where('name', 'GREATER_THAN_OR_EQUAL_TO', 'm'), 'mssql').sql).toBe(
            '([name] IS NOT NULL AND LOWER([name]) COLLATE Latin1_General_100_BIN2 >= @p1)'
        );
        expect(sql(where('name', 'LESS_THAN', 'm'), 'oracle').sql).toBe('("name" IS NULL OR LOWER("name") < :1)');
        // no wildcards there
        expect(sql(where('name', 'LESS_THAN', 'm*')).params).toEqual(['m*']);
    });

    it('expect a BETWEEN of texts to be the two comparisons', () => {
        // a blank row is '': not >= 'a', but <= 'm'
        expect(sql(where('name', 'BETWEEN', ['a', 'm']))).toEqual({
            sql: '(("name" IS NOT NULL AND LOWER("name") COLLATE "C" >= $1) AND ("name" IS NULL OR LOWER("name") COLLATE "C" <= $2))',
            params: ['a', 'm']
        });
    });

    it('expect a number, a Date or a boolean value on a text column to throw - the grid compares them as their type', () => {
        expect(() => sql(where('name', 'EQUAL', 5))).toThrow(/is a text for a text column/);
        expect(() => sql(where('name', 'EQUAL', new Date()))).toThrow(TypeError);
        expect(() => sql(where('name', 'EQUAL', true))).toThrow(TypeError);
        expect(() => sql(where('name', 'BETWEEN', [1, 2]))).toThrow(TypeError);
    });
});

describe('the escape `\\`: `\\_`, `\\%`, `\\*` and `\\\\` are characters, the other wildcards stay wildcards', () => {
    it("expect each dialect's pattern: the escaped character plain, the wildcard next to it its own", () => {
        // S\_\_den*: S, two plain `_`, den, then any text
        const value = 'S\\_\\_den*';
        expect(sql(where('name', 'EQUAL', value), 'postgres').params).toEqual(['s!_!_den%']);
        expect(sql(where('name', 'EQUAL', value), 'oracle').params).toEqual(['s!_!_den%']);
        expect(sql(where('name', 'EQUAL', value), 'mssql').params).toEqual(['s[_][_]den%']);
        expect(sql(where('name', 'EQUAL', value), 'sqlite').params).toEqual(['s__den*']);
    });

    it('expect \\% and \\* plain, \\\\ one backslash, a backslash before another letter a backslash', () => {
        const value = '50\\%_\\*%\\\\C:\\temp';
        expect(sql(where('name', 'EQUAL', value), 'postgres').params).toEqual(['50!%_*%\\c:\\temp']);
        expect(sql(where('name', 'EQUAL', value), 'mssql').params).toEqual(['50[%]_*%\\c:\\temp']);
        expect(sql(where('name', 'EQUAL', value), 'sqlite').params).toEqual(['50%?[*]*\\c:\\temp']);
    });

    it('expect literal to take the backslash as it is too', () => {
        expect(sql(where('name', 'EQUAL', 'a\\_b', { literal: true }), 'postgres').params).toEqual(['a\\!_b']);
        expect(sql(where('name', 'EQUAL', 'a\\_b', { literal: true }), 'sqlite').params).toEqual(['a\\_b']);
    });
});

describe('literal: the wildcards of the grid as characters', () => {
    const literal = { literal: true };

    it("expect *, % and _ to be characters of each dialect's pattern, escaped where they are its wildcards", () => {
        const value = 'a*b%c_d!e[f]g?h';
        // LIKE ESCAPE '!': % and _ escaped, * is no wildcard of LIKE
        expect(sql(where('name', 'EQUAL', value, literal), 'postgres').params).toEqual(['a*b!%c!_d!!e[f]g?h']);
        expect(sql(where('name', 'EQUAL', value, literal), 'oracle').params).toEqual(['a*b!%c!_d!!e[f]g?h']);
        // LIKE without an escape: in brackets
        expect(sql(where('name', 'EQUAL', value, literal), 'mssql').params).toEqual(['a*b[%]c[_]d!e[[]f]g?h']);
        // GLOB: * in brackets, % and _ are no wildcards of it
        expect(sql(where('name', 'EQUAL', value, literal), 'sqlite').params).toEqual(['a[*]b%c_d!e[[]f]g[?]h']);
    });

    it('expect the pattern of each operator: the wildcards of the dialect around the text, the text as it is', () => {
        const patterns = (dialect: SqlDialect) =>
            (['EQUAL', 'NOT_EQUAL_TO', 'CONTAINS', 'DOES_NOT_CONTAIN', 'BEGIN_WITH', 'END_WITH'] as const).map(
                (operator) => sql(where('name', operator, '50%', literal), dialect).params[0]
            );
        expect(patterns('postgres')).toEqual(['50!%', '50!%', '%50!%%', '%50!%%', '50!%%', '%50!%']);
        expect(patterns('sqlite')).toEqual(['50%', '50%', '*50%*', '*50%*', '50%*', '*50%']);
        expect(patterns('mssql')).toEqual(['50[%]', '50[%]', '%50[%]%', '%50[%]%', '50[%]%', '%50[%]']);
    });

    it("expect a blank row to match a text of wildcards no more: '' does not contain '%'", () => {
        expect(sql(where('name', 'CONTAINS', '%')).sql).toBe(`("name" IS NULL OR LOWER("name") LIKE $1 ESCAPE '!')`);
        expect(sql(where('name', 'CONTAINS', '%', literal)).sql).toBe(
            `("name" IS NOT NULL AND LOWER("name") LIKE $1 ESCAPE '!')`
        );
        expect(sql(where('name', 'DOES_NOT_CONTAIN', '%', literal)).sql).toBe(
            `("name" IS NULL OR NOT (LOWER("name") LIKE $1 ESCAPE '!'))`
        );
    });

    it('expect it with caseSensitive, and on a value that is not ASCII', () => {
        expect(sql(where('name', 'CONTAINS', 'A_b', { caseSensitive: true, literal: true }))).toEqual({
            sql: `("name" IS NOT NULL AND "name" LIKE $1 ESCAPE '!')`,
            params: ['%A!_b%']
        });
        expect(sql(where('name', 'CONTAINS', 'Æ_', literal))).toEqual({
            sql: `("name" IS NOT NULL AND LOWER("name") LIKE LOWER($1) ESCAPE '!')`,
            params: ['%Æ!_%']
        });
    });

    it('expect it ignored where there are no wildcards: IN, a comparison, a number, a valueField', () => {
        for (const [condition, other] of [
            [where('name', 'IN', ['a_b', '%'], literal), where('name', 'IN', ['a_b', '%'])],
            [where('name', 'LESS_THAN', 'a_b', literal), where('name', 'LESS_THAN', 'a_b')],
            [where('age', 'EQUAL', 5, literal), where('age', 'EQUAL', 5)],
            [
                where('name', 'EQUAL', undefined, { valueField: 'code', literal: true }),
                where('name', 'EQUAL', undefined, { valueField: 'code' })
            ]
        ]) {
            for (const dialect of DIALECTS) {
                expect(sql(condition, dialect), JSON.stringify(condition)).toEqual(sql(other, dialect));
            }
        }
    });

    it('expect anything but true, false or null to throw', () => {
        expect(sql(where('name', 'CONTAINS', '%', { literal: false }))).toEqual(sql(where('name', 'CONTAINS', '%')));
        expect(sql(where('name', 'CONTAINS', '%', { literal: null }))).toEqual(sql(where('name', 'CONTAINS', '%')));
        for (const bad of ['true', 1, {}]) {
            expect(() => sql(where('name', 'CONTAINS', '%', { literal: bad })), String(bad)).toThrow(/literal is true or false/);
        }
        expect(() => sql(where('name', 'CONTAINS', '%', { literall: true }))).toThrow(
            /takes field, operator, value, valueField, caseSensitive, literal/
        );
    });
});

describe('IN and NOT_IN', () => {
    it('expect a text IN to compare in upper case, NULL as the blanks', () => {
        expect(sql(where('name', 'IN', ['Ann', 'NULL']))).toEqual({
            sql: `(("name" IS NULL OR "name" = '') OR UPPER("name") COLLATE "C" IN ($1, $2))`,
            params: ['ANN', 'NULL']
        });
        expect(sql(where('name', 'IN', ['Ann', 'b']))).toEqual({
            sql: '("name" IS NOT NULL AND UPPER("name") COLLATE "C" IN ($1, $2))',
            params: ['ANN', 'B']
        });
        expect(sql(where('name', 'NOT_IN', ['Ann']))).toEqual({
            sql: 'NOT ("name" IS NOT NULL AND UPPER("name") COLLATE "C" IN ($1))',
            params: ['ANN']
        });
    });

    it("expect 'null' in any case, and null, to be the blanks - with caseSensitive only 'NULL'", () => {
        for (const blank of ['NULL', 'null', 'Null', null]) {
            expect(sql(where('name', 'IN', [blank])).sql).toContain(`"name" = ''`);
        }
        expect(sql(where('name', 'IN', ['NULL'], { caseSensitive: true })).sql).toContain(`"name" = ''`);
        // the text null, as the grid's String(null): a row with that text
        expect(sql(where('name', 'IN', ['null'], { caseSensitive: true }))).toEqual({
            sql: '("name" IS NOT NULL AND "name" COLLATE "C" IN ($1))',
            params: ['null']
        });
        expect(sql(where('name', 'IN', [null], { caseSensitive: true })).params).toEqual(['null']);
    });

    it('expect a text with one value per line, numbers and booleans as their text', () => {
        expect(sql(where('name', 'IN', 'a\nb\nNULL')).params).toEqual(['A', 'B', 'NULL']);
        expect(sql(where('name', 'IN', [5, true, 'x', 'x'])).params).toEqual(['5', 'TRUE', 'X']);
        expect(sql(where('name', 'IN', 7)).params).toEqual(['7']);
    });

    it('expect mssql to match each value with LIKE, its wildcards literal', () => {
        expect(sql(where('name', 'IN', ['a%', 'b_[c]']), 'mssql')).toEqual({
            sql: '([name] IS NOT NULL AND (UPPER([name]) COLLATE Latin1_General_100_BIN2 LIKE @p1 OR UPPER([name]) COLLATE Latin1_General_100_BIN2 LIKE @p2))',
            params: ['A[%]', 'B[_][[]C]']
        });
    });

    it('expect a value that is not ASCII only to be folded by the database, as its column: the same text matches', () => {
        // JavaScript folds ß to SS and SQLite folds ASCII letters only: the database folds both sides
        expect(sql(where('name', 'IN', ['Ærø', 'Oslo']))).toEqual({
            sql: '("name" IS NOT NULL AND UPPER("name") COLLATE "C" IN (UPPER($1), $2))',
            params: ['Ærø', 'OSLO']
        });
        expect(sql(where('name', 'CONTAINS', 'Straße'), 'sqlite')).toEqual({
            sql: '("name" IS NOT NULL AND LOWER("name") GLOB LOWER(?))',
            params: ['*Straße*']
        });
        expect(sql(where('name', 'LESS_THAN', 'Å'), 'oracle').sql).toBe('("name" IS NULL OR LOWER("name") < LOWER(:1))');
        // kept as it is with caseSensitive
        expect(sql(where('name', 'IN', ['Ærø'], { caseSensitive: true })).params).toEqual(['Ærø']);
    });

    it('expect oracle to split a list of more than 1000 values', () => {
        const list = Array.from({ length: 2500 }, (_, index) => `v${index}`);
        const result = toSqlWhere(where('name', 'IN', list), {
            ...options('oracle'),
            limits: { listLength: 3000, params: 3000 }
        });
        expect(result.params).toHaveLength(2500);
        expect(result.sql.match(/ IN \(/g)).toHaveLength(3);
        expect(result.sql).toContain(':1000) OR UPPER("name") IN (:1001');
    });

    it('expect a number IN to compare numbers, NULL the null rows', () => {
        expect(sql(where('age', 'IN', [1, 2.5, '3', 'NULL']))).toEqual({
            sql: '("age" IS NULL OR "age" IN ($1, CAST($2 AS numeric), $3))',
            params: [1, 2.5, 3]
        });
        expect(sql(where('age', 'NOT_IN', [0]), 'mssql').sql).toBe('NOT ([age] IS NOT NULL AND [age] IN (@p1))');
        expect(sql(where('age', 'IN', ['NULL'])).sql).toBe('"age" IS NULL');
        expect(() => sql(where('age', 'IN', ['1,5']))).toThrow(/is a number or 'NULL'/);
        expect(() => sql(where('age', 'IN', [' 1']))).toThrow(TypeError);
        expect(() => sql(where('age', 'IN', [Number.NaN]))).toThrow(TypeError);
    });

    it('expect a date IN to compare the day of each, the text the grid shows as that day in the time zone', () => {
        expect(sql(where('born', 'IN', ['2026-11-22', '2026-11-24', 'NULL']))).toEqual({
            sql: '("born" IS NULL OR (("born" >= CAST($1 AS timestamp) AND "born" < CAST($2 AS timestamp)) OR ("born" >= CAST($3 AS timestamp) AND "born" < CAST($4 AS timestamp))))',
            params: ['2026-11-22 00:00:00', '2026-11-23 00:00:00', '2026-11-24 00:00:00', '2026-11-25 00:00:00']
        });
        expect(sql(where('seen', 'IN', ['2026-11-22T10:00:00']))).toEqual({
            sql: '("seen" IS NOT NULL AND ("seen" >= CAST($1 AS timestamp) AND "seen" < CAST($2 AS timestamp)))',
            params: ['2026-11-22 10:00:00', '2026-11-22 10:00:01']
        });
    });

    it('expect a boolean IN of TRUE / FALSE / NULL, as the grid has them for a boolean', () => {
        expect(sql(where('active', 'IN', ['TRUE', 'null']), 'oracle')).toEqual({
            sql: '("active" IS NULL OR "active" IN (:1))',
            params: [1]
        });
        expect(sql(where('active', 'NOT_IN', [false, 'true']), 'postgres').params).toEqual([false, true]);
        expect(() => sql(where('active', 'IN', ['yes']))).toThrow(/true, false or 'NULL'/);
    });

    it('expect a valueField to be left out of IN, as in the grid', () => {
        expect(sql({ field: 'name', operator: 'IN', value: ['a'], valueField: 'code' })).toEqual(sql(where('name', 'IN', ['a'])));
    });
});

describe('numbers', () => {
    it('expect a blank (null) row to be 0: decided when the SQL is made, the column compared as it is', () => {
        expect(sql(where('age', 'LESS_THAN', 5)).sql).toBe('("age" IS NULL OR "age" < $1)');
        expect(sql(where('age', 'GREATER_THAN', 5)).sql).toBe('("age" IS NOT NULL AND "age" > $1)');
        expect(sql(where('age', 'EQUAL', 0)).sql).toBe('("age" IS NULL OR "age" = $1)');
        expect(sql(where('age', 'NOT_EQUAL_TO', 0)).sql).toBe('("age" IS NOT NULL AND "age" <> $1)');
        expect(sql(where('age', 'NOT_EQUAL_TO', 3)).sql).toBe('("age" IS NULL OR "age" <> $1)');
        expect(sql(where('age', 'GREATER_THAN_OR_EQUAL_TO', -1)).sql).toBe('("age" IS NULL OR "age" >= $1)');
    });

    it('expect IS_BLANK to be null or 0', () => {
        expect(sql(where('age', 'IS_BLANK'), 'mssql').sql).toBe('([age] IS NULL OR [age] = 0)');
        expect(sql(where('age', 'IS_NOT_BLANK'), 'mssql').sql).toBe('([age] IS NOT NULL AND [age] <> 0)');
    });

    it('expect postgres to cast a number that is not whole: a parameter takes the type of an integer column', () => {
        expect(sql(where('age', 'GREATER_THAN', 2.5)).sql).toBe('("age" IS NOT NULL AND "age" > CAST($1 AS numeric))');
        expect(sql(where('age', 'GREATER_THAN', 2 ** 60)).sql).toContain('CAST($1 AS numeric)');
        expect(sql(where('age', 'GREATER_THAN', 2.5), 'oracle').sql).toBe('("age" IS NOT NULL AND "age" > :1)');
    });

    it('expect a text value to be read as Number() reads it, as the grid does', () => {
        expect(sql(where('age', 'EQUAL', '12')).params).toEqual([12]);
        expect(sql(where('age', 'EQUAL', ' 1.5 ')).params).toEqual([1.5]);
        expect(sql(where('age', 'EQUAL', '1e3')).params).toEqual([1000]);
        for (const value of ['abc', '1,5', Number.NaN, Number.POSITIVE_INFINITY, true, new Date(), {}, [1]]) {
            expect(() => sql(where('age', 'EQUAL', value)), String(value)).toThrow(TypeError);
        }
    });

    it('expect BETWEEN to be the two comparisons, a blank end open, from after to no row', () => {
        expect(sql(where('age', 'BETWEEN', [10, 20]))).toEqual({
            sql: '(("age" IS NOT NULL AND "age" >= $1) AND ("age" IS NULL OR "age" <= $2))',
            params: [10, 20]
        });
        expect(sql(where('age', 'BETWEEN', [10, null])).sql).toBe('("age" IS NOT NULL AND "age" >= $1)');
        expect(sql(where('age', 'BETWEEN', ['', 20])).sql).toBe('("age" IS NULL OR "age" <= $1)');
        // 0 is an end
        expect(sql(where('age', 'BETWEEN', [0, null])).sql).toBe('("age" IS NULL OR "age" >= $1)');
        expect(sql(where('age', 'BETWEEN', [20, 10])).params).toEqual([20, 10]);
    });

    it('expect the operators a number does not offer to be the ones the grid takes them as', () => {
        const as = (operator: FilterOperator) => sql(where('age', operator, 5)).sql;
        expect(as('CONTAINS')).toBe(as('GREATER_THAN_OR_EQUAL_TO'));
        expect(as('BEGIN_WITH')).toBe(as('GREATER_THAN_OR_EQUAL_TO'));
        expect(as('END_WITH')).toBe(as('LESS_THAN_OR_EQUAL_TO'));
        expect(as('DOES_NOT_CONTAIN')).toBe(as('LESS_THAN'));
    });
});

describe('booleans', () => {
    it('expect EQUAL false to match the blank rows, EQUAL true not', () => {
        expect(sql(where('active', 'EQUAL', true))).toEqual({ sql: '("active" IS NOT NULL AND "active" = $1)', params: [true] });
        expect(sql(where('active', 'EQUAL', false))).toEqual({ sql: '("active" IS NULL OR "active" = $1)', params: [false] });
        expect(sql(where('active', 'NOT_EQUAL_TO', true))).toEqual({
            sql: '("active" IS NULL OR "active" <> $1)',
            params: [true]
        });
        expect(sql(where('active', 'NOT_EQUAL_TO', false))).toEqual({
            sql: '("active" IS NOT NULL AND "active" <> $1)',
            params: [false]
        });
    });

    it('expect the values of each dialect: true / false on postgres and mssql, 1 / 0 on oracle and sqlite', () => {
        expect(sql(where('active', 'EQUAL', true), 'postgres').params).toEqual([true]);
        expect(sql(where('active', 'EQUAL', true), 'mssql').params).toEqual([true]);
        expect(sql(where('active', 'EQUAL', true), 'oracle').params).toEqual([1]);
        expect(sql(where('active', 'EQUAL', false), 'sqlite').params).toEqual([0]);
    });

    it("expect booleanValues for a column that holds other values: 'Y' / 'N'", () => {
        const columns = { flag: { column: 'flag', type: 'boolean' as const, booleanValues: { true: 'Y', false: 'N' } } };
        expect(toSqlWhere(where('flag', 'EQUAL', false), { dialect: 'oracle', columns })).toEqual({
            sql: '("flag" IS NULL OR "flag" = :1)',
            params: ['N']
        });
    });

    it('expect any other operator to be EQUAL, and IS_BLANK to be null only - false is a value', () => {
        expect(sql(where('active', 'GREATER_THAN', true)).sql).toBe(sql(where('active', 'EQUAL', true)).sql);
        expect(sql(where('active', 'CONTAINS', false)).sql).toBe(sql(where('active', 'EQUAL', false)).sql);
        expect(sql(where('active', 'IS_BLANK')).sql).toBe('"active" IS NULL');
        expect(sql(where('active', 'IS_NOT_BLANK')).sql).toBe('"active" IS NOT NULL');
    });

    it('expect a value that is not true or false to throw', () => {
        for (const value of ['true', 1, 0, {}, []]) {
            expect(() => sql(where('active', 'EQUAL', value)), JSON.stringify(value)).toThrow(TypeError);
        }
    });
});

describe('dates', () => {
    // 22 November in Oslo: from 2026-11-21T23:00Z to 2026-11-22T23:00Z
    const day = '2026-11-21T23:00:00.000Z';

    it('expect a date to be its day in the time zone, a range from its start to the next day', () => {
        expect(sql(where('born', 'EQUAL', day))).toEqual({
            sql: '("born" IS NOT NULL AND "born" >= CAST($1 AS timestamp) AND "born" < CAST($2 AS timestamp))',
            params: ['2026-11-22 00:00:00', '2026-11-23 00:00:00']
        });
        const ranges = (['LESS_THAN', 'LESS_THAN_OR_EQUAL_TO', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL_TO'] as const).map(
            (operator) => sql(where('born', operator, day))
        );
        expect(ranges).toEqual([
            { sql: '("born" IS NOT NULL AND "born" < CAST($1 AS timestamp))', params: ['2026-11-22 00:00:00'] },
            { sql: '("born" IS NOT NULL AND "born" < CAST($1 AS timestamp))', params: ['2026-11-23 00:00:00'] },
            { sql: '("born" IS NOT NULL AND "born" >= CAST($1 AS timestamp))', params: ['2026-11-23 00:00:00'] },
            { sql: '("born" IS NOT NULL AND "born" >= CAST($1 AS timestamp))', params: ['2026-11-22 00:00:00'] }
        ]);
    });

    it('expect a blank date to match NOT_EQUAL_TO only', () => {
        expect(sql(where('born', 'NOT_EQUAL_TO', day))).toEqual({
            sql: '("born" IS NULL OR "born" < CAST($1 AS timestamp) OR "born" >= CAST($2 AS timestamp))',
            params: ['2026-11-22 00:00:00', '2026-11-23 00:00:00']
        });
        expect(sql(where('born', 'IS_BLANK')).sql).toBe('"born" IS NULL');
        expect(sql(where('born', 'IS_NOT_BLANK')).sql).toBe('"born" IS NOT NULL');
        expect(sql(where('born', 'IS_BLANK'), 'sqlite').sql).toBe('julianday("born") IS NULL');
    });

    it('expect a datetime to be its second', () => {
        expect(sql(where('seen', 'EQUAL', '2026-11-22T10:30:15.750Z')).params).toEqual([
            '2026-11-22 11:30:15',
            '2026-11-22 11:30:16'
        ]);
        expect(sql(where('seen', 'GREATER_THAN', '2026-11-22T10:30:15.750Z')).params).toEqual(['2026-11-22 11:30:16']);
    });

    it('expect each dialect to read the parameter with a fixed format', () => {
        expect(sql(where('born', 'EQUAL', day), 'oracle').sql).toBe(
            `("born" IS NOT NULL AND "born" >= TO_DATE(:1, 'YYYY-MM-DD HH24:MI:SS') AND "born" < TO_DATE(:2, 'YYYY-MM-DD HH24:MI:SS'))`
        );
        expect(sql(where('born', 'EQUAL', day), 'mssql')).toEqual({
            sql: '([born] IS NOT NULL AND [born] >= CAST(@p1 AS datetime2(0)) AND [born] < CAST(@p2 AS datetime2(0)))',
            params: ['2026-11-22T00:00:00', '2026-11-23T00:00:00']
        });
        expect(sql(where('born', 'EQUAL', day), 'sqlite').sql).toBe(
            '(julianday("born") IS NOT NULL AND julianday("born") >= julianday(?) AND julianday("born") < julianday(?))'
        );
    });

    it('expect the storage of the dates to decide the parameters', () => {
        const of = (dialect: SqlDialect, dateStorage: SqlColumn['dateStorage']) =>
            toSqlWhere(where('born', 'EQUAL', day), {
                dialect,
                timeZone: 'Europe/Oslo',
                columns: { born: { column: 'born', type: 'date', dateStorage } }
            });
        expect(of('postgres', 'utc').params).toEqual(['2026-11-21 23:00:00', '2026-11-22 23:00:00']);
        expect(of('postgres', 'zoned')).toEqual({
            sql: '("born" IS NOT NULL AND "born" >= CAST($1 AS timestamptz) AND "born" < CAST($2 AS timestamptz))',
            params: ['2026-11-21 23:00:00+00:00', '2026-11-22 23:00:00+00:00']
        });
        expect(of('oracle', 'zoned')).toEqual({
            sql: `("born" IS NOT NULL AND "born" >= TO_TIMESTAMP_TZ(:1, 'YYYY-MM-DD HH24:MI:SS TZH:TZM') AND "born" < TO_TIMESTAMP_TZ(:2, 'YYYY-MM-DD HH24:MI:SS TZH:TZM'))`,
            params: ['2026-11-21 23:00:00 +00:00', '2026-11-22 23:00:00 +00:00']
        });
        expect(of('mssql', 'zoned')).toEqual({
            sql: '([born] IS NOT NULL AND [born] >= CAST(@p1 AS datetimeoffset(0)) AND [born] < CAST(@p2 AS datetimeoffset(0)))',
            params: ['2026-11-21T23:00:00+00:00', '2026-11-22T23:00:00+00:00']
        });
        expect(of('sqlite', 'zoned').params).toEqual(['2026-11-21 23:00:00', '2026-11-22 23:00:00']);
        expect(of('postgres', 'epochMillis')).toEqual({
            sql: '("born" IS NOT NULL AND "born" >= $1 AND "born" < $2)',
            params: [Date.parse('2026-11-21T23:00:00Z'), Date.parse('2026-11-22T23:00:00Z')]
        });
        expect(of('sqlite', 'epochSeconds')).toEqual({
            sql: '("born" IS NOT NULL AND "born" >= ? AND "born" < ?)',
            params: [Date.parse('2026-11-21T23:00:00Z') / 1000, Date.parse('2026-11-22T23:00:00Z') / 1000]
        });
        // the default storage for all, a column's own wins
        const all = toSqlWhere(where('born', 'EQUAL', day), {
            dialect: 'postgres',
            timeZone: 'Europe/Oslo',
            dateStorage: 'utc',
            columns: { born: { column: 'born', type: 'date' } }
        });
        expect(all.params).toEqual(['2026-11-21 23:00:00', '2026-11-22 23:00:00']);
    });

    it('expect the days the clocks change to be 23 and 25 hours long for an instant, 1 day on the wall clock', () => {
        const utc = (value: string, dateStorage: SqlColumn['dateStorage']) =>
            toSqlWhere(where('born', 'EQUAL', value), {
                dialect: 'postgres',
                timeZone: 'Europe/Oslo',
                columns: { born: { column: 'born', type: 'date', dateStorage } }
            }).params;
        expect(utc('2026-03-29T12:00:00', 'utc')).toEqual(['2026-03-28 23:00:00', '2026-03-29 22:00:00']);
        expect(utc('2026-10-25T12:00:00', 'utc')).toEqual(['2026-10-24 22:00:00', '2026-10-25 23:00:00']);
        expect(utc('2026-10-25T12:00:00', 'local')).toEqual(['2026-10-25 00:00:00', '2026-10-26 00:00:00']);
    });

    it('expect the time zone to decide the day of an instant', () => {
        const at = (timeZone: string) => toSqlWhere(where('born', 'EQUAL', day), { ...options('postgres'), timeZone }).params;
        expect(at('Europe/Oslo')).toEqual(['2026-11-22 00:00:00', '2026-11-23 00:00:00']);
        expect(at('UTC')).toEqual(['2026-11-21 00:00:00', '2026-11-22 00:00:00']);
        expect(at('America/New_York')).toEqual(['2026-11-21 00:00:00', '2026-11-22 00:00:00']);
        expect(at('Asia/Tokyo')).toEqual(['2026-11-22 00:00:00', '2026-11-23 00:00:00']);
    });

    it('expect a Date to be its instant', () => {
        expect(sql(where('born', 'EQUAL', new Date(day))).params).toEqual(['2026-11-22 00:00:00', '2026-11-23 00:00:00']);
    });

    it("expect a date-only text to be UTC midnight, as the grid's new Date() reads it", () => {
        expect(sql(where('seen', 'EQUAL', '2026-11-22')).params).toEqual(['2026-11-22 01:00:00', '2026-11-22 01:00:01']);
        // the day before in New York
        expect(sql(where('born', 'EQUAL', '2026-11-22'), 'postgres', { timeZone: 'America/New_York' }).params).toEqual([
            '2026-11-21 00:00:00',
            '2026-11-22 00:00:00'
        ]);
    });

    it('expect BETWEEN from the start of the first day to the end of the last, an end open', () => {
        expect(sql(where('born', 'BETWEEN', ['2026-11-01T12:00', '2026-11-30T08:00']))).toEqual({
            sql: '("born" IS NOT NULL AND "born" >= CAST($1 AS timestamp) AND "born" < CAST($2 AS timestamp))',
            params: ['2026-11-01 00:00:00', '2026-12-01 00:00:00']
        });
        expect(sql(where('born', 'BETWEEN', [null, '2026-11-30T08:00'])).params).toEqual(['2026-12-01 00:00:00']);
        expect(sql(where('seen', 'BETWEEN', ['2026-11-30T08:00:00', '2026-11-30T08:00:00'])).params).toEqual([
            '2026-11-30 08:00:00',
            '2026-11-30 08:00:01'
        ]);
    });

    it('expect the operators a date does not offer to be the ones the grid takes them as', () => {
        const as = (operator: FilterOperator) => sql(where('born', operator, day));
        expect(as('CONTAINS')).toEqual(as('GREATER_THAN_OR_EQUAL_TO'));
        expect(as('BEGIN_WITH')).toEqual(as('GREATER_THAN_OR_EQUAL_TO'));
        expect(as('END_WITH')).toEqual(as('LESS_THAN_OR_EQUAL_TO'));
        expect(as('DOES_NOT_CONTAIN')).toEqual(as('LESS_THAN'));
    });

    it('expect a value that is no date to throw', () => {
        for (const value of [5, true, 'yesterday', '22.11.2026', {}, ['2026-11-22']]) {
            expect(() => sql(where('born', 'EQUAL', value)), JSON.stringify(value)).toThrow(TypeError);
        }
    });

    it('expect the hour the clocks go back to be compared as an instant: the first 02:30 only (the grid: both)', () => {
        const zoned = (value: string) =>
            toSqlWhere(where('seen', 'EQUAL', value), {
                dialect: 'postgres',
                timeZone: 'Europe/Oslo',
                columns: { seen: { column: 'seen', type: 'datetime', dateStorage: 'zoned' } }
            }).params;
        // 02:30 summer time and 02:30 winter time, an hour apart, are both 02:30 on the wall clock
        expect(zoned('2026-10-25T00:30:00Z')).toEqual(['2026-10-25 00:30:00+00:00', '2026-10-25 00:30:01+00:00']);
        expect(zoned('2026-10-25T01:30:00Z')).toEqual(['2026-10-25 00:30:00+00:00', '2026-10-25 00:30:01+00:00']);
    });
});

describe('valueField', () => {
    it('expect numbers to compare with a blank as 0 on both sides', () => {
        expect(sql({ field: 'age', operator: 'GREATER_THAN', valueField: 'weight' })).toEqual({
            sql: 'COALESCE("age", 0) > COALESCE("weight", 0)',
            params: []
        });
        expect(sql({ field: 'age', operator: 'END_WITH', valueField: 'weight' }).sql).toBe(
            'COALESCE("age", 0) <= COALESCE("weight", 0)'
        );
    });

    it('expect texts to compare with a blank as an empty text, without wildcards', () => {
        expect(sql({ field: 'name', operator: 'EQUAL', valueField: 'code' }, 'oracle').sql).toBe(
            '(("name" IS NULL AND "code" IS NULL) OR ("name" IS NOT NULL AND "code" IS NOT NULL AND LOWER("name") = LOWER("code")))'
        );
        expect(sql({ field: 'name', operator: 'LESS_THAN', valueField: 'code', caseSensitive: true }, 'postgres').sql).toBe(
            `(("code" IS NOT NULL AND "code" <> '') AND (("name" IS NULL OR "name" = '') OR "name" COLLATE "C" < "code"))`
        );
        expect(sql({ field: 'name', operator: 'NOT_EQUAL_TO', valueField: 'code' }, 'sqlite').sql).toMatch(/^NOT \(\(/);
    });

    it('expect a text pattern with a valueField to throw: not supported', () => {
        for (const operator of ['CONTAINS', 'DOES_NOT_CONTAIN', 'BEGIN_WITH', 'END_WITH'] as const) {
            expect(() => sql({ field: 'name', operator, valueField: 'code' })).toThrow(/not supported on text/);
        }
    });

    it('expect booleans to compare with a blank row as false, a blank other column matching nothing', () => {
        expect(sql({ field: 'active', operator: 'EQUAL', valueField: 'paid' }, 'oracle')).toEqual({
            sql: '("paid" IS NOT NULL AND COALESCE("active", :1) = "paid")',
            params: [0]
        });
        expect(sql({ field: 'active', operator: 'NOT_EQUAL_TO', valueField: 'paid' }).sql).toBe(
            '("paid" IS NULL OR COALESCE("active", $1) <> "paid")'
        );
    });

    it('expect dates to compare as they are, a date on its day, a blank only NOT_EQUAL_TO', () => {
        expect(sql({ field: 'changed', operator: 'GREATER_THAN', valueField: 'seen' })).toEqual({
            sql: '("changed" IS NOT NULL AND "seen" IS NOT NULL AND "changed" > "seen")',
            params: []
        });
        expect(sql({ field: 'born', operator: 'NOT_EQUAL_TO', valueField: 'seen' }, 'oracle').sql).toBe(
            '(TRUNC("born") IS NULL OR TRUNC("seen") IS NULL OR TRUNC("born") <> TRUNC("seen"))'
        );
        expect(sql({ field: 'born', operator: 'EQUAL', valueField: 'seen' }, 'sqlite').sql).toBe(
            '(date("born") IS NOT NULL AND date("seen") IS NOT NULL AND date("born") = date("seen"))'
        );
    });

    it('expect a date on its day with dates stored as instants to throw: the day is in the time zone', () => {
        const columns = {
            a: { column: 'a', type: 'date' as const, dateStorage: 'zoned' as const },
            b: { column: 'b', type: 'date' as const, dateStorage: 'zoned' as const },
            c: { column: 'c', type: 'datetime' as const, dateStorage: 'zoned' as const },
            d: { column: 'd', type: 'datetime' as const, dateStorage: 'utc' as const }
        };
        const run = (filter: unknown) => toSqlWhere(filter, { dialect: 'postgres', columns, timeZone: 'UTC' });
        expect(() => run({ field: 'a', operator: 'EQUAL', valueField: 'b' })).toThrow(/needs dateStorage 'local'/);
        expect(run({ field: 'c', operator: 'LESS_THAN', valueField: 'a' }).sql).toBe(
            '("c" IS NOT NULL AND "a" IS NOT NULL AND "c" < "a")'
        );
        expect(() => run({ field: 'c', operator: 'EQUAL', valueField: 'd' })).toThrow(/holds its dates as utc/);
    });

    it('expect columns of different types to throw', () => {
        expect(() => sql({ field: 'age', operator: 'EQUAL', valueField: 'name' })).toThrow(/compare the same types/);
        expect(() => sql({ field: 'born', operator: 'EQUAL', valueField: 'active' })).toThrow(TypeError);
    });

    it('expect the valueField to win over the value, and not to be used by BETWEEN and IS_BLANK', () => {
        expect(sql({ field: 'age', operator: 'EQUAL', value: 3, valueField: 'weight' }).params).toEqual([]);
        expect(sql({ field: 'age', operator: 'BETWEEN', value: [1, 2], valueField: 'weight' })).toEqual(
            sql(where('age', 'BETWEEN', [1, 2]))
        );
        expect(sql({ field: 'age', operator: 'IS_BLANK', valueField: 'weight' })).toEqual(sql(where('age', 'IS_BLANK')));
        // '' and null are no valueField
        expect(sql({ field: 'age', operator: 'EQUAL', value: 3, valueField: '' }).params).toEqual([3]);
    });
});

describe('the options', () => {
    it('expect wrong options to throw a TypeError', () => {
        const bad: unknown[] = [
            null,
            'postgres',
            {},
            { dialect: 'mysql', columns: {} },
            { dialect: 'postgres' },
            { dialect: 'postgres', columns: [] },
            { dialect: 'postgres', columns: { a: 5 } },
            { dialect: 'postgres', columns: { a: { column: 'a', type: 'money' } } },
            { dialect: 'postgres', columns: { a: { column: 'a', typ: 'text' } } },
            { dialect: 'postgres', columns: { a: { column: 'a', dateStorage: 'utc' } } },
            { dialect: 'postgres', columns: { a: { column: 'a', type: 'date', dateStorage: 'iso' } }, timeZone: 'UTC' },
            { dialect: 'postgres', columns: { a: { column: 'a', booleanValues: { true: 1, false: 0 } } } },
            { dialect: 'postgres', columns: { a: { column: 'a', type: 'boolean', booleanValues: { true: 1, false: 1 } } } },
            { dialect: 'postgres', columns: { a: { column: 'a', type: 'boolean', booleanValues: { true: {}, false: 0 } } } },
            { dialect: 'postgres', columns: { a: { column: 'a', type: 'date' } } },
            { dialect: 'postgres', columns: { a: 'a' }, timeZone: 'Mars/Olympus' },
            { dialect: 'postgres', columns: { a: 'a' }, timeZone: 1 },
            { dialect: 'postgres', columns: { a: 'a' }, timezone: 'UTC' },
            { dialect: 'postgres', columns: { a: 'a' }, firstParam: 0 },
            { dialect: 'postgres', columns: { a: 'a' }, firstParam: 1.5 },
            { dialect: 'postgres', columns: { a: 'a' }, firstParam: '2' },
            { dialect: 'postgres', columns: { a: 'a' }, limits: { depth: 0 } },
            { dialect: 'postgres', columns: { a: 'a' }, limits: { rows: 10 } },
            { dialect: 'postgres', columns: { a: 'a' }, dateStorage: 'text' }
        ];
        for (const options of bad) {
            expect(() => toSqlWhere(null, options as SqlOptions), JSON.stringify(options)).toThrow(TypeError);
        }
    });

    it('expect the options to be checked also when there is no filter', () => {
        expect(() => toSqlWhere(null, { dialect: 'postgres', columns: { a: 'a b' } })).toThrow(/letters, digits and _/);
    });
});

describe('a header filter as shown: a week is a range of the column, no date functions', () => {
    // the grid makes its dates in the time zone of the browser: Oslo, as options.timeZone
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

    /** the conditions the header filter makes of `2026-W47` typed in a column shown as weekIso */
    const week = (field: string, operator: FilterOperator, type: 'date' | 'datetime') =>
        and(...dateConditions(field, operator, new Date(2026, 10, 16), type, 'weekIso', formatTexts(), new Date(2026, 10, 22)));

    it('expect = 2026-W47 to be from Monday to before the Monday after: an index on the column works', () => {
        expect(sql(week('born', 'EQUAL', 'date'))).toEqual({
            sql: '("born" IS NOT NULL AND "born" >= CAST($1 AS timestamp) AND "born" < CAST($2 AS timestamp))',
            params: ['2026-11-16 00:00:00', '2026-11-23 00:00:00']
        });
        // a datetime column: the same range, its last second included
        expect(sql(week('seen', 'EQUAL', 'datetime'))).toEqual({
            sql: '("seen" IS NOT NULL AND "seen" >= CAST($1 AS timestamp) AND "seen" < CAST($2 AS timestamp))',
            params: ['2026-11-16 00:00:00', '2026-11-23 00:00:00']
        });
    });

    it('expect > the week to be from the Monday after, ≤ to before it, ≠ outside it or null', () => {
        expect(sql(week('born', 'GREATER_THAN', 'date'))).toEqual({
            sql: '("born" IS NOT NULL AND "born" >= CAST($1 AS timestamp))',
            params: ['2026-11-23 00:00:00']
        });
        expect(sql(week('seen', 'LESS_THAN_OR_EQUAL_TO', 'datetime'))).toEqual({
            sql: '("seen" IS NOT NULL AND "seen" < CAST($1 AS timestamp))',
            params: ['2026-11-23 00:00:00']
        });
        expect(sql(week('born', 'NOT_EQUAL_TO', 'date'))).toEqual({
            sql: '(("born" IS NOT NULL AND "born" < CAST($1 AS timestamp)) OR ("born" IS NOT NULL AND "born" >= CAST($2 AS timestamp)) OR "born" IS NULL)',
            params: ['2026-11-16 00:00:00', '2026-11-23 00:00:00']
        });
    });

    it('expect 2026-W40..2026-W47 in each dialect: Monday of week 40 to before the Monday after week 47', () => {
        const filter = and(
            ...dateConditions(
                'born',
                'BETWEEN',
                [new Date(2026, 8, 28), new Date(2026, 10, 16)],
                'date',
                'weekIso',
                formatTexts(),
                new Date(2026, 10, 22)
            )
        );
        expect(DIALECTS.map((dialect) => sql(filter, dialect))).toEqual([
            {
                sql: '("born" IS NOT NULL AND "born" >= CAST($1 AS timestamp) AND "born" < CAST($2 AS timestamp))',
                params: ['2026-09-28 00:00:00', '2026-11-23 00:00:00']
            },
            {
                sql: `("born" IS NOT NULL AND "born" >= TO_DATE(:1, 'YYYY-MM-DD HH24:MI:SS') AND "born" < TO_DATE(:2, 'YYYY-MM-DD HH24:MI:SS'))`,
                params: ['2026-09-28 00:00:00', '2026-11-23 00:00:00']
            },
            {
                sql: '(julianday("born") IS NOT NULL AND julianday("born") >= julianday(?) AND julianday("born") < julianday(?))',
                params: ['2026-09-28 00:00:00', '2026-11-23 00:00:00']
            },
            {
                sql: '([born] IS NOT NULL AND [born] >= CAST(@p1 AS datetime2(0)) AND [born] < CAST(@p2 AS datetime2(0)))',
                params: ['2026-09-28T00:00:00', '2026-11-23T00:00:00']
            }
        ]);
    });

    it('expect the conditions to be plain data: the same SQL after the filter went through JSON', () => {
        const filter = week('born', 'NOT_EQUAL_TO', 'date');
        expect(sql(JSON.parse(JSON.stringify(filter)))).toEqual(sql(filter));
    });
});
