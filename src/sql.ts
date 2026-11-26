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

import { withoutFields as without } from './datasource/filterFields';
import { convertV5Filter as convertV5, isV5Filter as isV5, normalizeFilter as normalize } from './datasource/v5Filter';
import { buildWhere } from './sql/buildWhere';
import { isMarkedFilterError, markFilterError } from './sql/filterError';
import { sqlColumnsOf } from './sql/sqlColumns';

/**
 * Turns a filter of the grid into the condition of a SQL `WHERE`, with its values as parameters: the
 * rows the grid's own filter shows, selected by the database. For a backend that gets the filter from
 * the browser - `datasource.getFilter()`, `GridState.filter` - and loads only the rows it lets through.
 *
 * **The filter is taken as hostile input.** Every value is a parameter, never part of the SQL: the SQL
 * is fixed keywords, placeholders and the quoted columns of `columns`. A field (or `valueField`) that
 * is not in `columns` throws, so does anything that is no filter: a wrong shape, an unknown operator or
 * property, a value of the wrong type. A filter over a limit (`limits`) throws a `RangeError`. A message
 * shows at most 40 characters of what it is about. Answer both with a 400: {@link isSqlFilterError} is
 * true for them and for a `timeZone` that is none (the user's, sent with the filter) - not for the other
 * options that are wrong, a mistake of the backend's code.
 *
 * It does not decide who may see which rows: AND your own conditions to it -
 * `WHERE tenant_id = $1 AND ${sql}`, with `firstParam: 2`.
 *
 * The rules are the grid's, see the filtering guide "Operators": a text ignores case unless the
 * condition is `caseSensitive` (`*` and `%` are wildcards, `_` one character, unless it is `literal`), a
 * blank number is 0, a blank boolean false, a blank date is no date, a date is its day in the user's
 * `timeZone`. A condition
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
 *   `_` one character - characters like any other when the condition is `literal`
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
 * const code: SqlColumn = { column: 'PROJECT_CODE', caseSensitive: true }; // its index is used
 * const notes: SqlColumn = { column: 'NOTES', clobType: true }; // an Oracle CLOB: LIKE only
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
    /**
     * `text` only: `true` - every condition on the column compares with its case, also one the filter
     * sends without `caseSensitive` (or with `false`): `"PROJECT_CODE" = :1`, so an index on the column is
     * used - `LOWER("PROJECT_CODE")` would not use it. The grid's `FieldConfig.caseSensitive`
     */
    caseSensitive?: boolean;
    /**
     * `text` only: `true` - the column is a LOB, an Oracle `CLOB` / `NCLOB`, which SQL compares with `LIKE`
     * only. LOB columns are not supported as such; this filters one as plain text: `EQUAL` and
     * `NOT_EQUAL_TO` are a `LIKE` of the whole text (its wildcards escaped), `CONTAINS`, `DOES_NOT_CONTAIN`,
     * `BEGIN_WITH`, `END_WITH`, `IS_BLANK` and `IS_NOT_BLANK` as on any text. Any other operator (`IN`, `<`,
     * `BETWEEN` ...), a `valueField` on either side and a formula that reads it (`calculated`, `shown`)
     * throw a `TypeError` that `isSqlFilterError()` knows. The grid's `FieldConfig.clobType`, whose filters
     * offer only those
     */
    clobType?: boolean;
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
    /**
     * The calculated columns of the grid (`gridInterface.getState().calculatedColumns`), by field: a filter
     * on one compares its formula, written as SQL, as it compares a column. Its formula reads the fields of
     * `columns` and the other calculated columns - no field `columns` has not. See {@link SqlCalculatedColumn}.
     * A formula with dates needs `timeZone`: a date is its day in the user's time zone, as in the grid.
     */
    calculated?: Record<string, string | SqlCalculatedColumn>;
    /**
     * The columns the grid filters on the text their template shows (a text column with `format.text`:
     * `{first} {last}`), each as a formula of that text - `gridInterface.getShownFormulas()` gives them. A
     * condition on such a field compares the formula's SQL, as the grid compares the text: `= 'Ann Berg'`
     * is `CONCAT("first", ' ', "last")` in SQL. The formula reads the columns (the field's own too) and the
     * calculated columns. What is wrong with one is a `TypeError` that `isSqlFilterError()` knows
     */
    shown?: Record<string, string>;
}

/**
 * A calculated column for {@link SqlOptions.calculated}: `CalculatedColumn` of the grid - the formula
 * (`'{price} * {qty}'`), and the type and label it may have (the label is not used). A formula is text
 * from the user's state, taken as hostile as a filter: what is wrong with it is a `TypeError` that
 * `isSqlFilterError()` knows - a 400.
 *
 * @example
 * ```ts
 * import { type SqlCalculatedColumn, toSqlWhere } from '@simple-html/grid/sql';
 *
 * declare const body: { filter: unknown; calculated: Record<string, SqlCalculatedColumn> };
 * const { sql, params } = toSqlWhere(body.filter, {
 *     dialect: 'postgres',
 *     columns: { price: { column: 'price', type: 'number' }, qty: { column: 'qty', type: 'number' } },
 *     calculated: body.calculated // { total: { formula: '{price} * {qty}' } }
 * });
 * ```
 */
export interface SqlCalculatedColumn {
    /** the formula, in the language of the grid's calculated columns: `{price} * {qty}` */
    formula: string;
    /** the type of its values: left out the formula's, given it must be the formula's */
    type?: 'number' | 'text' | 'date' | 'boolean';
    /** the column's label in the grid: not used */
    label?: string;
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

// ------------------------------------------------------------------ the filters, v6 and v5

/**
 * A filter of the grid - the same shape as `FilterExpression` of `@simple-html/grid` (a test keeps them
 * one): a condition, or an AND / OR group of them. Its own name here, so the typings of this entry are one
 * file. See the filtering guide.
 */
export type SqlFilter = SqlFilterGroup | SqlFilterCondition;

/** a group of a {@link SqlFilter}: `FilterGroup` of the grid */
export interface SqlFilterGroup {
    /** `'AND'`: every child must match, `'OR'`: one is enough */
    group: 'AND' | 'OR';
    /** the conditions and groups in the group */
    children: SqlFilter[];
}

/** a condition of a {@link SqlFilter}: `FilterCondition` of the grid */
export interface SqlFilterCondition {
    /** the field to test */
    field: string;
    /** how to compare */
    operator: SqlFilterOperator;
    /** what to compare with: an array for `IN` / `NOT_IN`, `[from, to]` for `BETWEEN` */
    value?: unknown;
    /** another field, whose value is compared with */
    valueField?: string;
    /** a text compared with the case of its letters */
    caseSensitive?: boolean;
    /** `*`, `%` and `_` are characters like any other */
    literal?: boolean;
}

/** the operators of a condition: `FilterOperator` of the grid */
export type SqlFilterOperator =
    | 'EQUAL'
    | 'NOT_EQUAL_TO'
    | 'LESS_THAN'
    | 'LESS_THAN_OR_EQUAL_TO'
    | 'GREATER_THAN'
    | 'GREATER_THAN_OR_EQUAL_TO'
    | 'BETWEEN'
    | 'CONTAINS'
    | 'DOES_NOT_CONTAIN'
    | 'BEGIN_WITH'
    | 'END_WITH'
    | 'IN'
    | 'NOT_IN'
    | 'IS_BLANK'
    | 'IS_NOT_BLANK';

/**
 * A filter as v5 had it - `V5Filter` of `@simple-html/grid`: a group has `type: 'GROUP'` and
 * `filterArguments`, a condition `attribute`, `operator`, `value`
 */
export interface SqlV5Filter {
    /** `'GROUP'` for a group, `'CONDITION'` for a condition */
    type?: 'GROUP' | 'CONDITION';
    /** a group's: `'OR'` is an OR group, anything else AND */
    logicalOperator?: 'AND' | 'OR' | 'NONE';
    /** a condition's field */
    attribute?: string | null;
    /** the field's type: dropped, the datasource's `fields` have it in v6 */
    attributeType?: string | null;
    /** a condition's operator: the names of v6 */
    operator?: string | null;
    /** a condition's value - the name of another field with `valueType: 'ATTRIBUTE'` */
    value?: unknown;
    /** `'ATTRIBUTE'`: `value` is another field, a `valueField` in v6 */
    valueType?: 'VALUE' | 'ATTRIBUTE' | null;
    /** a group's conditions and groups */
    filterArguments?: SqlV5Filter[];
}

/**
 * `true` for a filter of v5 - `convertV5Filter` of `@simple-html/grid`, the same function: an object with
 * a key only v5 had (`filterArguments`, `attribute`, `logicalOperator` ...) and none only v6 has.
 *
 * @example
 * ```ts
 * import { isV5Filter } from '@simple-html/grid/sql';
 *
 * isV5Filter({ attribute: 'age', operator: 'EQUAL', value: 30 }); // true
 * ```
 */
export function isV5Filter(value: unknown): value is SqlV5Filter {
    return isV5(value);
}

/**
 * A filter of v5 as one of v6, for the old links and bookmarks a backend still gets - `convertV5Filter`
 * of `@simple-html/grid`, the same function. `null` for none. Hand the result to {@link toSqlWhere}.
 *
 * @throws a `TypeError` for what is no v5 filter, a `RangeError` for groups nested deeper than 100 -
 * answer both with a 400 ({@link isSqlFilterError})
 *
 * @example
 * ```ts
 * import { convertV5Filter, toSqlWhere } from '@simple-html/grid/sql';
 *
 * const filter = convertV5Filter({ attribute: 'name', operator: 'BEGIN_WITH', value: 'an' });
 * // { field: 'name', operator: 'BEGIN_WITH', value: 'an' }
 * toSqlWhere(filter, { dialect: 'postgres', columns: { name: 'name' } });
 * ```
 */
export function convertV5Filter(filter: unknown): SqlFilter | null {
    return markFilterError(() => convertV5(filter));
}

/**
 * A filter of either shape - v5, v6, or either as JSON text (`?filter=`) - as one of v6, `null` for none:
 * `normalizeFilter` of `@simple-html/grid`, the same function. A v6 filter is returned as it is:
 * {@link toSqlWhere} checks it.
 *
 * @throws a `TypeError` for what is neither - text that is no JSON, a number, an object of neither shape:
 * it is not taken as no filter, which would select every row. Answer it with a 400 ({@link isSqlFilterError})
 *
 * @example
 * ```ts
 * import { normalizeFilter, toSqlWhere } from '@simple-html/grid/sql';
 *
 * declare const body: string; // the request's
 * const filter = normalizeFilter(JSON.parse(body).filter); // a v5 or a v6 filter, or none
 * const { sql, params } = toSqlWhere(filter, { dialect: 'postgres', columns: { name: 'name' } });
 * ```
 */
export function normalizeFilter(filter: unknown): SqlFilter | null {
    return markFilterError(() => normalize(filter));
}

// ------------------------------------------------------------------ errors

/**
 * `true` for an error of a filter that came from outside: what {@link toSqlWhere}, {@link convertV5Filter}
 * and {@link normalizeFilter} throw for the filter - its shape, its values, a limit - and for a
 * `timeZone` that is none (the user's, sent with the filter): the request's mistake, answer it with a 400.
 * `false` for anything else, among them a `TypeError` of the other `options` that are wrong: a mistake of
 * the backend's code. The error stays the `TypeError` or `RangeError` it was.
 *
 * @example
 * ```ts
 * import { isSqlFilterError, normalizeFilter, toSqlWhere } from '@simple-html/grid/sql';
 *
 * function where(body: { filter: unknown; timeZone: string }) {
 *     try {
 *         return toSqlWhere(normalizeFilter(body.filter), { dialect: 'postgres', columns: { name: 'name' }, timeZone: body.timeZone });
 *     } catch (error) {
 *         if (isSqlFilterError(error)) {
 *             return { status: 400, message: error.message };
 *         }
 *         throw error; // a 500
 *     }
 * }
 * ```
 */
export function isSqlFilterError(error: unknown): error is TypeError | RangeError {
    return isMarkedFilterError(error);
}

// ------------------------------------------------------------------ the fields

/**
 * A filter without the conditions on some fields - `withoutFields` of `@simple-html/grid`, the same
 * function: a condition taken out matches every row (left out of an AND group, its OR group left out
 * whole), so the SQL selects every row the whole filter lets through, maybe more. For the calculated
 * columns, and the fields the database does not have. `null` when nothing is left.
 *
 * @param fields the fields whose conditions go: a list, a Set, or a function true for each of them
 *
 * @example
 * ```ts
 * import { type SqlFilter, toSqlWhere, withoutFields } from '@simple-html/grid/sql';
 *
 * declare const body: { filter: SqlFilter };
 * const columns = { name: 'name', age: 'age' };
 * // the fields the database has not: out, the browser filters on them
 * const filter = withoutFields(body.filter, (field) => !Object.hasOwn(columns, field));
 * toSqlWhere(filter, { dialect: 'postgres', columns });
 * ```
 */
export function withoutFields(
    filter: SqlFilter | null | undefined,
    fields: Iterable<string> | ((field: string) => boolean)
): SqlFilter | null {
    return without(filter, fields);
}

/**
 * The options of {@link sqlColumnsFromFields}
 */
export interface SqlFieldsOptions {
    /**
     * the case of the column names: `'asIs'` (the default) the field's name, `'upper'` / `'lower'`. The
     * names are quoted: Oracle's unquoted names are upper case - `'upper'` - PostgreSQL's lower case
     */
    nameCase?: 'asIs' | 'upper' | 'lower';
    /** the name of a field's column, before `nameCase`: `(field) => 'customer.' + field` - default the field */
    column?: (field: string) => string;
    /** how the `date` and `datetime` columns hold their dates, see {@link SqlDateStorage}. Left out: `'local'` */
    dateStorage?: SqlDateStorage;
}

/**
 * The `columns` of {@link toSqlWhere} from the fields of the grid's datasource - the same object as
 * `DatasourceOptions.fields`: `{ born: 'date', age: { type: 'number', label: 'Age' } }`. Each field is a
 * column of its type (a field without one is `'text'`), named as the field - `nameCase` and `column`
 * change that. A field's `caseSensitive` and `clobType` are the column's (SqlColumn). One list of the
 * fields for the browser and the backend keeps their types the same.
 *
 * @param fields the datasource's fields: a type, or a config with `type`, `caseSensitive` and `clobType`
 * (the rest is not read)
 * @throws a `TypeError` for fields that are no object, a type that is none, wrong options
 *
 * @example
 * ```ts
 * import { type SqlFilter, sqlColumnsFromFields, toSqlWhere } from '@simple-html/grid/sql';
 *
 * declare const filter: SqlFilter;
 * const fields = { project: 'text', born: 'date', amount: { type: 'number', label: 'Amount' } } as const;
 * const columns = sqlColumnsFromFields(fields, { nameCase: 'upper' });
 * // { project: { column: 'PROJECT', type: 'text' }, born: { column: 'BORN', type: 'date' },
 * //   amount: { column: 'AMOUNT', type: 'number' } }
 * toSqlWhere(filter, { dialect: 'oracle', columns });
 * ```
 */
export function sqlColumnsFromFields(
    fields: Readonly<
        Record<
            string,
            SqlColumnType | { readonly type?: SqlColumnType; readonly caseSensitive?: boolean; readonly clobType?: boolean }
        >
    >,
    options: SqlFieldsOptions = {}
): Record<string, SqlColumn> {
    return sqlColumnsOf(fields, options);
}
