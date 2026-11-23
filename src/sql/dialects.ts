import type { SqlDateStorage, SqlDialect, SqlParam } from '../sql';
import { isoText } from './sqlDates';

/**
 * @internal
 * What toSqlWhere writes differently for each database. Every function gets SQL that toSqlWhere made
 * (quoted names, placeholders) and gives SQL back: no value of a filter is ever passed to these as SQL,
 * only as a parameter value (`patternLiteral`, `listValue`, `dateValue` make parameter values).
 *
 * The SQL guide (guides/22-sql.md) explains each choice, with links to the docs of each database.
 */
export interface Dialect {
    /** the placeholder of the n'th parameter, counted from 1: `$1`, `:1`, `?`, `@p1` */
    placeholder(n: number): string;
    /** one part of a name, quoted. The part is checked already: letters, digits and `_` only */
    quote(name: string): string;

    /** the wildcard of a pattern, "any text": `%` for LIKE, `*` for GLOB */
    anyText: string;
    /** the wildcard of a pattern, "one character": `_` for LIKE, `?` for GLOB */
    oneChar: string;
    /**
     * text for a pattern, with the characters the pattern takes as wildcards or escapes escaped. The
     * grid's wildcards (`*`, `%`, `_`) are never in it: buildWhere makes them the dialect's own, or
     * wildcardLiteral
     */
    patternLiteral(text: string): string;
    /**
     * one of the grid's wildcards (`*`, `%`, `_`) as a character of the pattern: escaped with `\` in the
     * value (`\_`), or every one of a condition that is `literal` (FilterCondition.literal). Escaped where
     * it is a wildcard of the dialect's pattern too
     */
    wildcardLiteral(wildcard: string): string;
    /**
     * `column` matches the pattern parameter `pattern`. The column in lower case, or as it is; `pattern` is
     * folded already (`$1` bound in lower case, or `LOWER($1)`, see foldedParam in buildWhere.ts)
     */
    match(column: string, pattern: string, caseSensitive: boolean): string;
    /** an expression compared code point by code point, case as it is: no collation of the database */
    binary(expression: string): string;
    /**
     * `column` is one of the text parameters: the column in upper case, or as it is; the parameters are
     * folded already (`$1` bound in upper case, or `UPPER($1)`, see foldedParam in buildWhere.ts)
     */
    inList(column: string, placeholders: string[], caseSensitive: boolean): string;
    /** the parameter value of a text of an IN list: the text, or a pattern without wildcards (mssql) */
    listValue(text: string): string;
    /** a text column is blank: null, or `''` */
    textBlank(column: string): string;
    /** not textBlank */
    textNotBlank(column: string): string;

    /** a number parameter, cast when the database needs it */
    numberParam(placeholder: string, value: number): string;

    /** what a date column is compared as */
    dateColumn(column: string, storage: SqlDateStorage): string;
    /** a date parameter, converted to a date of the database */
    dateParam(placeholder: string, storage: SqlDateStorage): string;
    /** the parameter value of a date: an instant (utc, zoned, epoch) or a wall clock (local), see sqlDates */
    dateValue(milliseconds: number, storage: SqlDateStorage): SqlParam;
    /** the day of a date column that holds wall clocks (`local`), for a `valueField` on a `date` */
    dayOf(column: string): string;

    /** the values of a boolean column, unless the column says */
    booleanValues: { true: SqlParam; false: SqlParam };
}

/** `LOWER(x)`, or x when the case is kept */
function fold(expression: string, caseSensitive: boolean, upper = false): string {
    if (caseSensitive) {
        return expression;
    }
    return `${upper ? 'UPPER' : 'LOWER'}(${expression})`;
}

const isTextDate = (storage: SqlDateStorage) => storage === 'local' || storage === 'utc' || storage === 'zoned';

/** epoch numbers, or the text the dialect writes for a wall clock */
function dateValue(milliseconds: number, storage: SqlDateStorage, separator: ' ' | 'T', zone: string): SqlParam {
    switch (storage) {
        case 'epochSeconds':
            return milliseconds / 1000;
        case 'epochMillis':
            return milliseconds;
        case 'zoned':
            return `${isoText(milliseconds, separator)}${zone}`;
        default:
            return isoText(milliseconds, separator);
    }
}

// LIKE with ESCAPE '!': `!` escapes `%`, `_` and itself. Oracle allows nothing else after it (ORA-01424).
// `%` and `_` are wildcards of the grid too, so only `!` is escaped in the text between them - they are
// escaped on their own when they are plain characters, `\%` in the value or `literal` (bangWildcard).
// The grid's escape `\` is no escape of the pattern: ESCAPE '!' makes `\` a plain character, as it is
// in the value once the grid has read it (textPatternParts)
const escapeWithBang = (text: string) => text.replace(/!/g, '!!');

/** a wildcard of the grid as a character of a LIKE pattern with ESCAPE '!': `%` and `_` escaped, `*` is none */
const bangWildcard = (wildcard: string) => (wildcard === '*' ? wildcard : `!${wildcard}`);

/**
 * PostgreSQL. LIKE is case-sensitive, `LOWER()` of the column and a folded value ignore case. `COLLATE "C"` compares bytes,
 * which is code point order in UTF-8
 */
const postgres: Dialect = {
    placeholder: (n) => `$${n}`,
    quote: (name) => `"${name}"`,
    anyText: '%',
    oneChar: '_',
    patternLiteral: escapeWithBang,
    wildcardLiteral: bangWildcard,
    match: (column, pattern, caseSensitive) => `${fold(column, caseSensitive)} LIKE ${pattern} ESCAPE '!'`,
    binary: (expression) => `${expression} COLLATE "C"`,
    inList: (column, placeholders, caseSensitive) =>
        `${postgres.binary(fold(column, caseSensitive, true))} IN (${placeholders.join(', ')})`,
    listValue: (text) => text,
    textBlank: (column) => `(${column} IS NULL OR ${column} = '')`,
    textNotBlank: (column) => `(${column} IS NOT NULL AND ${column} <> '')`,
    // a parameter sent as text takes the type of the column: '12.5' is no integer, so a number that is
    // not a whole number is cast. A whole number stays as it is, an index on an integer column is used
    numberParam: (placeholder, value) => (Number.isSafeInteger(value) ? placeholder : `CAST(${placeholder} AS numeric)`),
    dateColumn: (column) => column,
    dateParam: (placeholder, storage) => {
        if (!isTextDate(storage)) {
            return placeholder;
        }
        return `CAST(${placeholder} AS ${storage === 'zoned' ? 'timestamptz' : 'timestamp'})`;
    },
    dateValue: (milliseconds, storage) => dateValue(milliseconds, storage, ' ', '+00:00'),
    dayOf: (column) => `CAST(${column} AS date)`,
    booleanValues: { true: true, false: false }
};

/**
 * Oracle. `''` is null, so a blank text is `IS NULL`. LIKE and `<` compare binary with the default
 * NLS_COMP=BINARY. An IN list has at most 1000 values before 23ai: longer lists are split
 */
const oracle: Dialect = {
    placeholder: (n) => `:${n}`,
    quote: (name) => `"${name}"`,
    anyText: '%',
    oneChar: '_',
    patternLiteral: escapeWithBang,
    wildcardLiteral: bangWildcard,
    match: (column, pattern, caseSensitive) => `${fold(column, caseSensitive)} LIKE ${pattern} ESCAPE '!'`,
    binary: (expression) => expression,
    inList: (column, placeholders, caseSensitive) => {
        const lists: string[] = [];
        for (let start = 0; start < placeholders.length; start += 1000) {
            const list = placeholders.slice(start, start + 1000);
            lists.push(`${fold(column, caseSensitive, true)} IN (${list.join(', ')})`);
        }
        return lists.length === 1 ? lists[0] : `(${lists.join(' OR ')})`;
    },
    listValue: (text) => text,
    textBlank: (column) => `${column} IS NULL`,
    textNotBlank: (column) => `${column} IS NOT NULL`,
    numberParam: (placeholder) => placeholder,
    dateColumn: (column) => column,
    dateParam: (placeholder, storage) => {
        if (!isTextDate(storage)) {
            return placeholder;
        }
        // a DATE, not a TIMESTAMP: a DATE column compared with a TIMESTAMP is converted, its index not used
        return storage === 'zoned'
            ? `TO_TIMESTAMP_TZ(${placeholder}, 'YYYY-MM-DD HH24:MI:SS TZH:TZM')`
            : `TO_DATE(${placeholder}, 'YYYY-MM-DD HH24:MI:SS')`;
    },
    dateValue: (milliseconds, storage) => dateValue(milliseconds, storage, ' ', ' +00:00'),
    dayOf: (column) => `TRUNC(${column})`,
    booleanValues: { true: 1, false: 0 }
};

/**
 * SQLite. LIKE ignores the case of ASCII letters and has no way to keep it, so patterns are GLOB: it
 * keeps the case, `LOWER()` of the column and a folded value ignore it (ASCII letters only, as SQLite's LOWER). Dates are
 * text or numbers: julianday() reads every ISO 8601 text, with or without `T`, seconds or `Z`
 */
const sqlite: Dialect = {
    placeholder: () => '?',
    quote: (name) => `"${name}"`,
    anyText: '*',
    oneChar: '?',
    // GLOB has no escape: a special character is literal in brackets
    patternLiteral: (text) => text.replace(/[?[]/g, '[$&]'),
    // `%` and `_` are no wildcards of GLOB, `*` is
    wildcardLiteral: (wildcard) => (wildcard === '*' ? '[*]' : wildcard),
    match: (column, pattern, caseSensitive) => `${fold(column, caseSensitive)} GLOB ${pattern}`,
    binary: (expression) => `${expression} COLLATE BINARY`,
    inList: (column, placeholders, caseSensitive) =>
        `${sqlite.binary(fold(column, caseSensitive, true))} IN (${placeholders.join(', ')})`,
    listValue: (text) => text,
    textBlank: (column) => `(${column} IS NULL OR ${column} = '')`,
    textNotBlank: (column) => `(${column} IS NOT NULL AND ${column} <> '')`,
    numberParam: (placeholder) => placeholder,
    dateColumn: (column, storage) => (isTextDate(storage) ? `julianday(${column})` : column),
    dateParam: (placeholder, storage) => (isTextDate(storage) ? `julianday(${placeholder})` : placeholder),
    // julianday() reads a text without an offset as UTC: the UTC text of `zoned` needs no `+00:00`
    dateValue: (milliseconds, storage) => dateValue(milliseconds, storage, ' ', ''),
    dayOf: (column) => `date(${column})`,
    booleanValues: { true: 1, false: 0 }
};

/**
 * SQL Server. Case and `=` follow the column's collation, and `=` ignores trailing spaces: texts are
 * matched with LIKE (trailing spaces count for nvarchar, the type a JS string is sent as) in a binary
 * collation. LIKE's wildcards are literal in brackets: `[%]`, `[_]`, `[[]` (an IN value)
 */
const mssql: Dialect = {
    placeholder: (n) => `@p${n}`,
    quote: (name) => `[${name}]`,
    anyText: '%',
    oneChar: '_',
    // `%` and `_` are wildcards of the grid too: in brackets on their own when the condition is `literal`
    patternLiteral: (text) => text.replace(/\[/g, '[[]'),
    wildcardLiteral: (wildcard) => (wildcard === '*' ? wildcard : `[${wildcard}]`),
    match: (column, pattern, caseSensitive) => `${mssql.binary(fold(column, caseSensitive))} LIKE ${pattern}`,
    binary: (expression) => `${expression} COLLATE Latin1_General_100_BIN2`,
    inList: (column, placeholders, caseSensitive) => {
        const matches = placeholders.map((p) => `${mssql.binary(fold(column, caseSensitive, true))} LIKE ${p}`);
        return matches.length === 1 ? matches[0] : `(${matches.join(' OR ')})`;
    },
    // an IN value is matched with LIKE: all its wildcards are literal
    listValue: (text) => text.replace(/[%_[]/g, '[$&]'),
    // `= ''` is true for '   ' too: DATALENGTH counts the trailing spaces
    textBlank: (column) => `(${column} IS NULL OR DATALENGTH(${column}) = 0)`,
    textNotBlank: (column) => `(${column} IS NOT NULL AND DATALENGTH(${column}) > 0)`,
    numberParam: (placeholder) => placeholder,
    dateColumn: (column) => column,
    // the ISO 8601 text with T is read the same whatever SET LANGUAGE / DATEFORMAT is
    dateParam: (placeholder, storage) => {
        if (!isTextDate(storage)) {
            return placeholder;
        }
        return `CAST(${placeholder} AS ${storage === 'zoned' ? 'datetimeoffset(0)' : 'datetime2(0)'})`;
    },
    dateValue: (milliseconds, storage) => dateValue(milliseconds, storage, 'T', '+00:00'),
    dayOf: (column) => `CAST(${column} AS date)`,
    booleanValues: { true: true, false: false }
};

/** @internal the dialects by name */
export const DIALECTS: Readonly<Record<SqlDialect, Dialect>> = { postgres, oracle, sqlite, mssql };
