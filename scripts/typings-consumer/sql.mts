/**
 * A backend's code, an ES module, against the published typings of `@simple-html/grid/sql`: Node's
 * own resolution (node16), the package's "exports", no DOM in lib, no @types/node. The package names
 * itself, so this resolves through its package.json as a user's code does. `npm run check:typings`.
 */
import {
    type SqlColumn,
    type SqlColumnType,
    type SqlDateStorage,
    type SqlDialect,
    type SqlLimits,
    type SqlOptions,
    type SqlParam,
    type SqlFieldsOptions,
    type SqlFilter,
    type SqlWhere,
    convertV5Filter,
    isSqlFilterError,
    isV5Filter,
    normalizeFilter,
    sqlColumnsFromFields,
    toSqlWhere,
    withoutFields
} from '@simple-html/grid/sql';

const dialect: SqlDialect = 'postgres';
const type: SqlColumnType = 'date';
const storage: SqlDateStorage = 'zoned';
const born: SqlColumn = { column: 'public.customer.born', type, dateStorage: storage };
const limits: SqlLimits = { depth: 5, conditions: 50, listLength: 100, textLength: 200, params: 500 };
const options: SqlOptions = { dialect, columns: { name: 'name', born }, timeZone: 'Europe/Oslo', firstParam: 2, limits };

// the filter is unknown: JSON from a browser
const body: unknown = JSON.parse('{"filter":{"field":"name","operator":"EQUAL","value":"Ann"}}');
const where: SqlWhere = toSqlWhere((body as { filter: unknown }).filter, options);
const params: SqlParam[] = where.params;
const sql: string = where.sql;

// @ts-expect-error a dialect that is none
toSqlWhere(null, { dialect: 'mysql', columns: {} });
// @ts-expect-error a column type that is none
const money: SqlColumn = { column: 'price', type: 'money' };
// @ts-expect-error booleanValues are values, not a list
const flags: SqlColumn = { column: 'flag', type: 'boolean', booleanValues: ['N', 'Y'] };

// the helpers beside it: a v5 link, the fields of the datasource, the conditions the database has not
const fromLink: SqlFilter | null = normalizeFilter('{"attribute":"name","operator":"EQUAL","value":"Ann"}');
const old: SqlFilter | null = isV5Filter(body) ? convertV5Filter(body) : null;
const columns: Record<string, SqlColumn> = sqlColumnsFromFields({ name: 'text', born: { type: 'date' } }, { nameCase: 'upper' });
const left: SqlFilter | null = withoutFields(fromLink, ['total']);
const fields: SqlFieldsOptions = { nameCase: 'lower', dateStorage: 'utc' };
let status = 200;
try {
    toSqlWhere(left, { dialect, columns, timeZone: 'UTC' });
} catch (error) {
    status = isSqlFilterError(error) ? 400 : 500;
}
// @ts-expect-error a field type that is none
sqlColumnsFromFields({ price: 'money' });

export { fields, flags, money, old, params, sql, status };
