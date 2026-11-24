import { describe, expect, it } from 'vitest';
import { isSqlFilterError, type SqlColumn, type SqlDialect, toSqlWhere } from '../../sql';

/**
 * toSqlWhere({ calculated }): a filter on a calculated column compares its formula as SQL (formulaSql.ts).
 * The values are compared with the grid on SQLite in sqlFormulaSqlite.test.ts; here the SQL each
 * database gets - what was tried on PostgreSQL 17, Oracle 23 and SQL Server 2017 / 2022 (db<>fiddle) -
 * the formula as hostile input, and the errors
 */

const columns: Record<string, SqlColumn> = {
    price: { column: 'price', type: 'number' },
    qty: { column: 'qty', type: 'number' },
    name: { column: 'name', type: 'text' }
};
const where = (dialect: SqlDialect, formula: string, operator = 'EQUAL', value: unknown = 'x') =>
    toSqlWhere({ field: 'calc', operator, value } as never, { dialect, columns, calculated: { calc: formula } });

describe('toSqlWhere - calculated columns, the SQL of each database', () => {
    it('expect a number as text the way the grid writes it: 2.5, not 2.50, .5 or 2.5E+00', () => {
        expect(where('postgres', '{price} & ""').sql).toContain('CAST(trim_scale(CAST("price" AS numeric)) AS text)');
        expect(where('oracle', '{price} & ""').sql).toContain(
            `REGEXP_REPLACE(TO_CHAR("price", 'TM9', 'NLS_NUMERIC_CHARACTERS=''.,'''), '^(-?)\\.', '\\10.')`
        );
        expect(where('sqlite', '{price} & ""').sql).toContain(`printf('%.15g', "price")`);
        expect(where('mssql', '{price} & ""').sql).toContain(`LOWER(FORMAT(CAST([price] AS float), 'G15', 'en-US'))`);
    });

    it('expect / as numbers - never whole numbers - and a division by 0 to blank the whole value', () => {
        expect(where('postgres', '{price} / {qty}', 'GREATER_THAN', 1).sql).toContain(
            '(CAST("price" AS numeric) / NULLIF("qty", 0))'
        );
        expect(where('sqlite', '{price} / {qty}', 'GREATER_THAN', 1).sql).toContain('(CAST("price" AS REAL) / NULLIF("qty", 0))');
        expect(where('mssql', '{price} / {qty}', 'GREATER_THAN', 1).sql).toContain('(CAST([price] AS float) / NULLIF([qty], 0))');
        expect(where('oracle', 'COALESCE({price} / {qty}, 0)', 'GREATER_THAN', 1).sql).toContain(
            'CASE WHEN ("price" IS NOT NULL AND "qty" = 0) THEN NULL ELSE COALESCE'
        );
    });

    it('expect ROUND of a float as a decimal (halves away from 0), and tens on SQLite as a division', () => {
        expect(where('postgres', 'ROUND({price})', 'EQUAL', 3).sql).toContain('ROUND(CAST("price" AS numeric), 0)');
        expect(where('oracle', 'ROUND({price}, 1)', 'EQUAL', 3).sql).toContain('ROUND(CAST("price" AS NUMBER), 1)');
        expect(where('sqlite', 'ROUND({price}, -2)', 'EQUAL', 3).sql).toContain('(round("price" / 100.0) * 100)');
    });

    it('expect MIN and MAX to skip a blank in every database', () => {
        expect(where('postgres', 'MIN({price}, {qty})', 'EQUAL', 1).sql).toContain('LEAST("price", "qty")');
        expect(where('oracle', 'MIN({price}, {qty})', 'EQUAL', 1).sql).toContain(
            'LEAST(COALESCE("price", "qty"), COALESCE("qty", "price"))'
        );
        expect(where('mssql', 'MAX({price}, {qty})', 'EQUAL', 1).sql).toContain(
            '(SELECT MAX(v) FROM (VALUES ([price]), ([qty])) AS t(v))'
        );
    });

    it('expect a blank text to be NULL of a text type, and LEN to count the spaces at the end on SQL Server', () => {
        expect(where('mssql', 'LEFT("", 2)').sql).toContain('SUBSTRING(CAST(NULL AS nvarchar(max)), 1');
        expect(where('mssql', 'LEN({name})', 'EQUAL', 1).sql).toContain(
            "(LEN(CASE WHEN DATALENGTH([name]) = 0 THEN NULL ELSE [name] END + N'x') - 1)"
        );
    });

    it('expect a filter on a true / false formula to compare 1 and 0', () => {
        const { sql, params } = where('postgres', '{price} != {qty}', 'EQUAL', true);
        expect(sql).toContain('NOT ((');
        expect(params).toEqual([1]);
    });
});

describe('toSqlWhere - a formula is hostile input', () => {
    it('expect the texts of a formula as literals with their quotes doubled, never SQL', () => {
        const formula = `{name} = "x'); DROP TABLE customer; --"`;
        for (const dialect of ['postgres', 'oracle', 'sqlite', 'mssql'] as const) {
            const { sql } = where(dialect, formula, 'EQUAL', true);
            expect(sql, dialect).toContain(`'x''); DROP TABLE customer; --'`);
            expect(sql.replace(/'(?:[^']|'')*'/g, "''"), dialect).not.toContain('DROP');
        }
    });

    it('expect a text with a backslash as its bytes in hex on PostgreSQL: right whatever standard_conforming_strings is', () => {
        const { sql } = where('postgres', `{name} = "a\\' OR 1=1 --"`, 'EQUAL', true);
        expect(sql).toContain(`convert_from(decode('615c27204f5220313d31202d2d', 'hex'), 'UTF8')`);
        expect(sql).not.toContain('OR 1=1');
    });

    it('expect a NUL in a text of a formula, a field of the grid and a field not in columns to throw a TypeError the backend answers with 400', () => {
        for (const formula of ['{name} & "a\0b"', '{__KEY} + 1', '{secret} + 1', 'LEFT(', '{price} + "a"']) {
            let thrown: unknown;
            try {
                where('postgres', formula);
            } catch (error) {
                thrown = error;
            }
            expect(thrown, formula).toBeInstanceOf(TypeError);
            expect(isSqlFilterError(thrown), formula).toBe(true);
        }
        expect(() => toSqlWhere(null, { dialect: 'postgres', columns, calculated: { calc: 42 } as never })).toThrow(
            /is a formula, or \{ formula, type\? \}/
        );
    });

    it('expect a calculated column read twice by another, read twice ... to stop at the most SQL a formula may have', () => {
        const calculated: Record<string, string> = { c0: '{price} + {qty}' };
        for (let index = 1; index <= 30; index++) {
            calculated[`c${index}`] = `{c${index - 1}} + {c${index - 1}}`;
        }
        expect(() =>
            toSqlWhere({ field: 'c30', operator: 'EQUAL', value: 1 }, { dialect: 'postgres', columns, calculated })
        ).toThrow(RangeError);
    });

    it('expect an unused calculated column with a problem not to matter: it is read when a filter uses it', () => {
        expect(
            toSqlWhere(
                { field: 'price', operator: 'EQUAL', value: 1 },
                { dialect: 'postgres', columns, calculated: { bad: '{nope}' } }
            ).sql
        ).toBe('("price" IS NOT NULL AND "price" = $1)');
    });
});

describe('toSqlWhere - calculated columns with dates', () => {
    const dated: Record<string, SqlColumn> = {
        due: { column: 'due', type: 'date' },
        utc: { column: 'utc', type: 'datetime', dateStorage: 'utc' },
        zoned: { column: 'zoned', type: 'datetime', dateStorage: 'zoned' },
        seconds: { column: 'seconds', type: 'datetime', dateStorage: 'epochSeconds' },
        millis: { column: 'millis', type: 'datetime', dateStorage: 'epochMillis' }
    };
    const sqlOf = (dialect: SqlDialect, formula: string, timeZone = 'Europe/Oslo') =>
        toSqlWhere(
            { field: 'calc', operator: 'GREATER_THAN', value: 0 },
            { dialect, columns: dated, timeZone, calculated: { calc: formula } }
        ).sql;

    it('expect a date column as its day in the time zone: the wall clock on every database', () => {
        expect(sqlOf('postgres', 'YEAR({due})')).toContain('EXTRACT(YEAR FROM CAST("due" AS date))');
        expect(sqlOf('oracle', 'YEAR({due})')).toContain('EXTRACT(YEAR FROM TRUNC("due"))');
        expect(sqlOf('sqlite', 'YEAR({due})')).toContain(`strftime('%Y', date("due"))`);
        expect(sqlOf('mssql', 'YEAR({due})')).toContain('YEAR(CAST([due] AS date))');
    });

    it('expect the instants in the time zone on PostgreSQL and Oracle', () => {
        expect(sqlOf('postgres', 'YEAR({utc})')).toContain(`CAST(timezone('Europe/Oslo', timezone('UTC', "utc")) AS date)`);
        expect(sqlOf('postgres', 'YEAR({zoned})')).toContain(`CAST(timezone('Europe/Oslo', "zoned") AS date)`);
        expect(sqlOf('postgres', 'YEAR({millis})')).toContain(`to_timestamp("millis" / 1000.0)`);
        expect(sqlOf('oracle', 'YEAR({utc})')).toContain(
            `TRUNC(CAST(FROM_TZ(CAST("utc" AS TIMESTAMP), 'UTC') AT TIME ZONE 'Europe/Oslo' AS DATE))`
        );
        expect(sqlOf('oracle', 'YEAR({seconds})')).toContain(`NUMTODSINTERVAL("seconds", 'SECOND')`);
    });

    it('expect the instants on SQLite and SQL Server in UTC only - else a TypeError', () => {
        expect(sqlOf('sqlite', 'YEAR({seconds})', 'UTC')).toContain(`date("seconds", 'unixepoch')`);
        expect(sqlOf('mssql', 'YEAR({zoned})', 'Etc/UTC')).toContain(`CAST(SWITCHOFFSET([zoned], '+00:00') AS date)`);
        expect(() => sqlOf('sqlite', 'YEAR({utc})')).toThrow(/sqlite can read its day in Europe\/Oslo only/);
        expect(() => sqlOf('mssql', 'YEAR({zoned})')).toThrow(TypeError);
        expect(() => sqlOf('mssql', 'YEAR({seconds})', 'UTC')).toThrow(TypeError);
    });

    it('expect TODAY() as the day it is in the time zone now, a literal', () => {
        const clock = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Kiritimati' }).format(new Date());
        expect(sqlOf('postgres', 'DAYS({due}, TODAY())', 'Pacific/Kiritimati')).toContain(`DATE '${clock}'`);
        expect(sqlOf('mssql', 'DAYS({due}, TODAY())', 'Pacific/Kiritimati')).toContain(
            `DATEDIFF(day, CAST([due] AS date), CAST('${clock}' AS date))`
        );
    });

    it('expect a date formula to be a date column of days: a filter compares the day', () => {
        const { sql, params } = toSqlWhere(
            { field: 'first', operator: 'EQUAL', value: '2026-03-29' },
            { dialect: 'postgres', columns: dated, timeZone: 'Europe/Oslo', calculated: { first: 'MIN({due}, {zoned})' } }
        );
        expect(sql).toContain('LEAST(CAST("due" AS date)');
        expect(params).toEqual(['2026-03-29 00:00:00', '2026-03-30 00:00:00']);
    });
});
