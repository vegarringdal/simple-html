/**
 * `@simple-html/grid/sql` - a filter of the grid as the condition of a SQL `WHERE`, for a backend:
 * PostgreSQL, Oracle, SQLite and SQL Server. It has no DOM and no lit-html: Node loads it with `import`
 * and with `require`. See the SQL guide (guides/22-sql.md).
 *
 * ```ts
 * import { toSqlWhere } from '@simple-html/grid/sql';
 * ```
 *
 * The public API is all in this file, so its typings are one file without imports: dist/sql.d.ts.
 *
 * @module
 */
import { buildWhere } from './sql/buildWhere';

/**
 * Turns a filter of the grid into the condition of a SQL `WHERE`, with its values as parameters: the
 * rows the grid's own filter shows, selected by the database. For a backend that gets the filter from
 * the browser - `datasource.getFilter()`, `GridState.filter` - and loads only the rows it lets through.
 *
 * **The filter is taken as hostile input.** Every value is a parameter, never part of the SQL: the SQL
 * is fixed keywords, placeholders and the quoted columns of `columns`. A field (or `valueField`) that
 * is not in `columns` throws, so does anything that is no filter: a wrong shape, an unknown operator or
 * property, a value of the wrong type. A filter over a limit (`limits`) throws a `RangeError`. A message
 * shows at most 40 characters of what it is about. Answer both with a 400.
 *
 * It does not decide who may see which rows: AND your own conditions to it -
 * `WHERE tenant_id = $1 AND ${sql}`, with `firstParam: 2`.
 *
 * The rules are the grid's, see the filtering guide "Operators": a text ignores case unless the
 * condition is `caseSensitive` (`*` and `%` are wildcards, `_` one character), a blank number is 0, a
 * blank boolean false, a blank date is no date, a date is its day in the user's `timeZone`. A condition
 * the grid ignores (no field, no operator, no value) is left out. Where SQL does not do exactly what the
 * grid does, the SQL guide says so.
 *
 * @param filter the filter as it came, e.g. `JSON.parse(body).filter`: a `FilterExpression`, or null /
 * undefined for no filter
 * @param options the dialect, the columns, the user's time zone, see {@link SqlOptions}
 * @returns the SQL and the values of its placeholders, see {@link SqlWhere}. `1=1` when no condition is
 * left
 * @throws a `TypeError` for a filter that is no filter, a field that is not in `columns`, and for options
 * that are wrong; a `RangeError` for a filter over a limit
 *
 * @sample sql
 * @example
 * ```ts
 * import { toSqlWhere } from '@simple-html/grid/sql';
 *
 * const filter = {
 *     group: 'AND',
 *     children: [
 *         { field: 'name', operator: 'BEGIN_WITH', value: 'an' },
 *         { field: 'age', operator: 'GREATER_THAN', value: 18 }
 *     ]
 * };
 * const { sql, params } = toSqlWhere(filter, {
 *     dialect: 'postgres',
 *     columns: { name: 'customer_name', age: { column: 'age', type: 'number' } }
 * });
 * // sql: (("customer_name" IS NOT NULL AND LOWER("customer_name") LIKE LOWER($1) ESCAPE '!')
 * //       AND ("age" IS NOT NULL AND "age" > $2))
 * // params: ['an%', 18]
 * // await client.query(`SELECT * FROM customer WHERE ${sql}`, params);
 * ```
 */
export function toSqlWhere(filter: unknown, options: SqlOptions): SqlWhere {
    return buildWhere(filter, options);
}

/**
 * The database {@link toSqlWhere} writes SQL for. It decides the placeholders, how a name is quoted,
 * how texts are matched and how dates are written:
 *
 * | dialect | placeholders | a name | the driver |
 * | --- | --- | --- | --- |
 * | `'postgres'` | `$1`, `$2` ... | `"name"` | `pg`: `client.query(sql, params)` |
 * | `'oracle'` | `:1`, `:2` ... | `"NAME"` | `oracledb`: `connection.execute(sql, params)`, by position |
 * | `'sqlite'` | `?` | `"name"` | `node:sqlite`, `better-sqlite3`: `db.prepare(sql).all(...params)` |
 * | `'mssql'` | `@p1`, `@p2` ... | `[name]` | `mssql`: `request.input('p1', params[0])` ... |
 *
 * @sample sql
 * @example
 * ```ts
 * import { toSqlWhere } from '@simple-html/grid/sql';
 *
 * toSqlWhere({ field: 'name', operator: 'EQUAL', value: 'Ann' }, { dialect: 'mssql', columns: { name: 'name' } });
 * // { sql: '([name] IS NOT NULL AND LOWER([name]) COLLATE Latin1_General_100_BIN2 LIKE @p1)', params: ['ann'] }
 * ```
 */
export type SqlDialect = 'postgres' | 'oracle' | 'sqlite' | 'mssql';

/**
 * The type of a column for {@link toSqlWhere}: how a condition on it compares, as the grid compares a
 * field of that type - the same names as the grid's `FieldType`.
 *
 * - `'text'` - texts, ignoring case unless the condition is `caseSensitive`, `*` and `%` are wildcards,
 *   `_` one character
 * - `'number'` - numbers, a blank (null) is 0
 * - `'boolean'` - true and false, a blank is false
 * - `'date'` - the day, in the user's time zone (`SqlOptions.timeZone`)
 * - `'datetime'` - the second, in the user's time zone
 *
 * @sample sql
 * @example
 * ```ts
 * import type { SqlOptions } from '@simple-html/grid/sql';
 *
 * const columns: SqlOptions['columns'] = {
 *     name: 'name', // text
 *     age: { column: 'age', type: 'number' },
 *     born: { column: 'born', type: 'date' }
 * };
 * ```
 */
export type SqlColumnType = 'text' | 'number' | 'boolean' | 'date' | 'datetime';

/**
 * How a `date` or `datetime` column holds its dates, see the SQL guide "Dates and time zones". It
 * decides what the date parameters are:
 *
 * - `'local'` (the default) - a type without a time zone (PostgreSQL `date` / `timestamp`, Oracle `DATE`
 *   / `TIMESTAMP`, SQL Server `date` / `datetime` / `datetime2`, SQLite text such as
 *   `'2026-11-22 08:30:00'`), holding the wall clock of the user's `timeZone`. The parameters are that
 *   wall clock: `'2026-11-22 00:00:00'`
 * - `'utc'` - the same types, holding the time in UTC. The parameters are the UTC wall clock: the start
 *   of 22 November in Oslo is `'2026-11-21 23:00:00'`
 * - `'zoned'` - a type with a time zone: PostgreSQL `timestamptz`, Oracle `TIMESTAMP WITH TIME ZONE` /
 *   `WITH LOCAL TIME ZONE`, SQL Server `datetimeoffset`, SQLite ISO text with `Z` or an offset
 *   (`toISOString()`). The parameters are UTC with the offset written out: `'2026-11-21 23:00:00+00:00'`
 * - `'epochSeconds'` / `'epochMillis'` - a number: the seconds / milliseconds since 1970-01-01 UTC (a JS
 *   `getTime()` is milliseconds). The parameters are numbers
 *
 * @sample sql
 * @example
 * ```ts
 * import { toSqlWhere } from '@simple-html/grid/sql';
 *
 * const created = { field: 'created', operator: 'EQUAL', value: '2026-11-21T23:00:00.000Z' };
 * toSqlWhere(created, {
 *     dialect: 'postgres',
 *     timeZone: 'Europe/Oslo',
 *     columns: { created: { column: 'created_at', type: 'date', dateStorage: 'zoned' } }
 * });
 * // sql: ("created_at" IS NOT NULL AND "created_at" >= CAST($1 AS timestamptz)
 * //       AND "created_at" < CAST($2 AS timestamptz))
 * // params: ['2026-11-21 23:00:00+00:00', '2026-11-22 23:00:00+00:00'] - 22 November in Oslo
 * ```
 */
export type SqlDateStorage = 'local' | 'utc' | 'zoned' | 'epochSeconds' | 'epochMillis';

/**
 * A value {@link toSqlWhere} binds as a parameter: a text, a number or a boolean. Dates are text or
 * numbers (see {@link SqlDateStorage}), so every driver takes them as they are.
 */
export type SqlParam = string | number | boolean;

/**
 * One field a filter may use, in `SqlOptions.columns`: its column and its type. Writing just the column
 * (`name: 'customer_name'`) is a text column.
 *
 * @sample sql
 * @example
 * ```ts
 * import type { SqlColumn } from '@simple-html/grid/sql';
 *
 * const active: SqlColumn = { column: 'is_active', type: 'boolean', booleanValues: { true: 'Y', false: 'N' } };
 * const changed: SqlColumn = { column: 'audit.changes.changed_at', type: 'datetime', dateStorage: 'utc' };
 * ```
 */
export interface SqlColumn {
    /**
     * The column's name: letters (a-z, A-Z), digits and `_`, not starting with a digit, at most 128 of
     * them - with up to two prefixes, `schema.table.column`. It is quoted (`"name"`, `[name]` on SQL
     * Server), so write it as the database has it: PostgreSQL folds a name created without quotes to
     * lower case, Oracle to UPPER case (`'CUSTOMER_NAME'`).
     */
    column: string;
    /** how a condition on it compares, default `'text'` */
    type?: SqlColumnType;
    /** `date` / `datetime` only: how the column holds a date. Default `SqlOptions.dateStorage` */
    dateStorage?: SqlDateStorage;
    /**
     * `boolean` only: the values the column holds for true and false - `{ true: 'Y', false: 'N' }` for a
     * `CHAR(1)`. Default: `true` / `false` on postgres and mssql (`boolean`, `bit`), `1` / `0` on oracle and
     * sqlite. A column that is null is false, as a blank boolean in the grid
     */
    booleanValues?: {
        /** what the column holds for true */
        true: SqlParam;
        /** what the column holds for false */
        false: SqlParam;
    };
}

/**
 * The limits {@link toSqlWhere} puts on a filter, so a filter from a browser can not make a query that
 * is too large. A filter over a limit throws a `RangeError`. Each is a whole number of at least 1.
 *
 * @sample sql
 * @example
 * ```ts
 * import { toSqlWhere } from '@simple-html/grid/sql';
 *
 * declare const filter: unknown;
 * toSqlWhere(filter, { dialect: 'sqlite', columns: { name: 'name' }, limits: { listLength: 200, conditions: 20 } });
 * ```
 */
export interface SqlLimits {
    /** how deep groups nest, the top group is 1. Default 10 */
    depth?: number;
    /** the conditions and groups of the filter, also the ones left out. Default 100 */
    conditions?: number;
    /** the values of one `IN` / `NOT_IN`. Default 1000 (an Oracle `IN` list takes 1000 before 23ai) */
    listLength?: number;
    /** the characters (UTF-16 code units) of one text value. Default 1000 */
    textLength?: number;
    /** the parameters of the WHERE clause. Default 2000 (SQL Server takes 2100 in one request) */
    params?: number;
}

/**
 * The options of {@link toSqlWhere}.
 *
 * @sample sql
 * @example
 * ```ts
 * import { type SqlOptions, toSqlWhere } from '@simple-html/grid/sql';
 *
 * const options: SqlOptions = {
 *     dialect: 'postgres',
 *     columns: {
 *         name: 'customer_name',
 *         age: { column: 'age', type: 'number' },
 *         born: { column: 'born', type: 'date' },
 *         active: { column: 'is_active', type: 'boolean' }
 *     },
 *     timeZone: 'Europe/Oslo'
 * };
 * const { sql, params } = toSqlWhere({ field: 'age', operator: 'GREATER_THAN', value: 18 }, options);
 * // ("age" IS NOT NULL AND "age" > $1), [18]
 * ```
 */
export interface SqlOptions {
    /** the database, see {@link SqlDialect} */
    dialect: SqlDialect;
    /**
     * The whitelist: the only fields a filter may use, each with its column. A filter with any other
     * field (or `valueField`) throws. Own properties only: `__proto__`, `constructor` or `toString` are
     * fields like any other, unknown unless you list them. Several fields can name one column
     */
    columns: Record<string, string | SqlColumn>;
    /**
     * The user's time zone, an IANA name (`'Europe/Oslo'`, `'UTC'`): a date of the filter is on the day
     * and at the time it is in this zone, as the grid in the user's browser reads it. Required when a
     * column is a `date` or `datetime`. The browser has it: `Intl.DateTimeFormat().resolvedOptions().timeZone`
     */
    timeZone?: string;
    /** how the `date` / `datetime` columns hold their dates, unless a column says. Default `'local'` */
    dateStorage?: SqlDateStorage;
    /**
     * The number of the first placeholder, default 1: `3` gives `$3`, `$4` ... - for a query that has two
     * parameters of its own before. Not used by sqlite, whose `?` are taken in order
     */
    firstParam?: number;
    /** the limits on the size of the filter, see {@link SqlLimits} */
    limits?: SqlLimits;
}

/**
 * What {@link toSqlWhere} returns: the condition of a `WHERE` and its parameters.
 *
 * - `sql` - one condition, in brackets when it has more than one part, so it can be ANDed with your
 *   own: `WHERE tenant_id = $1 AND ${sql}`. `1=1` when the filter leaves no condition (no filter, empty
 *   groups, only conditions the grid ignores)
 * - `params` - the values for the placeholders of `sql`, in their order: `params[0]` is `$1` (or the
 *   first `?`, `:1`, `@p1`)
 *
 * @sample sql
 * @example
 * ```ts
 * import { toSqlWhere } from '@simple-html/grid/sql';
 *
 * declare const filter: unknown;
 * const { sql, params } = toSqlWhere(filter, { dialect: 'postgres', columns: { name: 'name' }, firstParam: 2 });
 * const query = `SELECT * FROM customer WHERE tenant_id = $1 AND ${sql}`;
 * const values = [42, ...params];
 * ```
 */
export interface SqlWhere {
    /** the condition, without the `WHERE` */
    sql: string;
    /** the values of the placeholders, in the order they are in `sql` */
    params: SqlParam[];
}
