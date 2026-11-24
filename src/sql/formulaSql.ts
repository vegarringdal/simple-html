import type { FormulaNode, FormulaType } from '../grid/formula';
import type { SqlDialect } from '../sql';

/**
 * @internal
 * A formula of a calculated column (formula.ts, the grid's language) as an SQL expression, for
 * `toSqlWhere({ calculated })`: a filter on a calculated column compares the expression as it compares a
 * column. The expression gives what the grid computes in the browser - the tests run it on SQLite and
 * compare it with the grid, the SQL of the other databases was tried on db<>fiddle (PostgreSQL 17, Oracle
 * 23, SQL Server 2017 and 2022), see the SQL guide.
 *
 * **The values.** A number is a number, a text a text, true / false `1` / `0` - blank is NULL, never `''`
 * (a text that would be `''` is NULL, as the grid's blank).
 *
 * **The rules of the grid**, each written out, because SQL has others:
 *
 * - a comparison with a blank is false, `=` true for two blanks: `a IS NOT NULL AND b IS NOT NULL AND
 *   a < b` - never NULL, so `NOT` of it is right. AND, OR, NOT and IF take a blank as false
 * - a text compares in any case: `LOWER()` on both sides
 * - `/` divides as numbers, never as whole numbers (`7 / 2` is 3 in PostgreSQL, SQLite and SQL Server)
 * - a division by 0 makes the whole value blank, not only its part: each part has an "error" condition
 *   beside its value (`err`), and the value is NULL when it is true - as the grid's row problem
 * - ROUND halves away from 0: a float is rounded as a decimal (PostgreSQL and Oracle round a float half
 *   to even); SQLite's `round()` takes no negative digits, so tens are a division
 * - MIN and MAX skip a blank: LEAST of PostgreSQL does, Oracle's and SQLite's do not (COALESCE in front of
 *   each), SQL Server has none before 2022 (MIN of a VALUES list)
 * - a number as text (`&`, LEFT, LEN ...) is written as the grid writes it: `2.5`, `4`, `0.3` - not
 *   `2.50` (PostgreSQL's numeric), `.5` (Oracle), `4.0` (SQLite), `2.5E+00` (SQL Server)
 * - LEFT, MID, SUBSTRING start at 1 (a start below is 1: PostgreSQL and SQL Server count from 0 there,
 *   Oracle does not), a count is cut to a whole number, a negative one is 0
 * - CONTAINS of `''` is true (CHARINDEX and INSTR say no, or NULL)
 *
 * Not yet: dates (a date field, TODAY, DAYS, YEAR, MONTH) throw a `TypeError`.
 *
 * **Safe.** A formula is hostile input, as a filter is. It is read by formula.ts into parts of a fixed
 * kind; a field is a column of the options (its quoted name) or another calculated column; a number is
 * digits; a text is a literal with its quotes doubled (no backslash escape: PostgreSQL gets the bytes
 * as hex when the text has a `\`), never a value pasted into the SQL as it is. The SQL of a formula is
 * at most MAX_FORMULA_SQL characters: a column read twice by another, read twice ... would grow fast.
 */

/** the most characters the SQL of one calculated column may have */
export const MAX_FORMULA_SQL = 100_000;

/** what the SQL of a formula needs to know of a field */
export interface FormulaSqlField {
    /** the SQL of its value: a quoted column, or the expression of another calculated column */
    sql: string;
    type: FormulaType;
    /** a boolean column: how it holds true and false */
    booleanValues?: { true: unknown; false: unknown };
    /** a calculated column: its value is NULL already where it can not be computed */
    calculated?: boolean;
}

/** what is written differently for each database */
interface FormulaDialect {
    /** a text literal: the text is checked (no NUL, no lone surrogate) */
    text(value: string): string;
    /** a blank text: NULL of a text type (SUBSTRING(NULL, ...) does not know its type on SQL Server) */
    nullText: string;
    /** a number as the grid writes it */
    numberText(x: string): string;
    /** a text that is `''` as NULL (SQL Server: `'  ' = ''` is true there, so DATALENGTH) */
    blankToNull(x: string): string;
    concat(parts: string[]): string;
    divide(a: string, b: string): string;
    round(x: string, digits: number): string;
    /** a whole number of a count or a position, from a number that is not NULL */
    whole(x: string): string;
    substr(text: string, start: string, count: string): string;
    /** how many characters, NULL for NULL */
    length(text: string): string;
    right(text: string, count: string): string;
    /** `needle` is in `haystack`: both not NULL, folded already */
    contains(haystack: string, needle: string): string;
    trim(text: string): string;
    least(values: string[]): string;
    greatest(values: string[]): string;
    /** a value of a boolean column, as SQL */
    booleanLiteral(value: unknown): string;
    binary(x: string): string;
}

/** the text of a literal: its single quotes doubled - no database here reads `''` as anything else */
const quoted = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** each value, or the first of the others that is not NULL: LEAST / GREATEST that skip NULL, NULL when all are */
function skippingNull(name: string, values: string[]): string {
    if (values.length === 1) {
        return values[0];
    }
    const each = values.map((value, index) => `COALESCE(${[value, ...values.filter((_, other) => other !== index)].join(', ')})`);
    return `${name}(${each.join(', ')})`;
}

/** a count: whole, 0 at least, at most a billion (an integer of every database) */
function count(whole: (x: string) => string, x: string): string {
    return `CASE WHEN ${x} < 0 THEN 0 WHEN ${x} > 1000000000 THEN 1000000000 ELSE ${whole(x)} END`;
}

const WHITESPACE_CODES = [32, 9, 10, 13];

/** the UTF-8 bytes of a text as hex: digits only */
function hexOf(value: string): string {
    return Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const postgres: FormulaDialect = {
    // without a backslash a quoted literal is the text whatever standard_conforming_strings is; with one,
    // the bytes as hex
    text: (value) => (value.includes('\\') ? `convert_from(decode('${hexOf(value)}', 'hex'), 'UTF8')` : quoted(value)),
    nullText: 'CAST(NULL AS text)',
    // trim_scale (PostgreSQL 13): 2.50 is 2.5; a float as numeric has 15 digits, 0.1 + 0.2 is 0.3
    numberText: (x) => `CAST(trim_scale(CAST(${x} AS numeric)) AS text)`,
    blankToNull: (x) => `NULLIF(${x}, '')`,
    concat: (parts) => parts.join(' || '),
    divide: (a, b) => `(CAST(${a} AS numeric) / NULLIF(${b}, 0))`,
    round: (x, digits) => `ROUND(CAST(${x} AS numeric), ${digits})`,
    whole: (x) => `CAST(TRUNC(${x}) AS integer)`,
    substr: (text, start, n) => `SUBSTR(${text}, ${start}, ${n})`,
    length: (text) => `LENGTH(${text})`,
    right: (text, n) => `RIGHT(${text}, ${n})`,
    contains: (haystack, needle) => `STRPOS(${haystack}, ${needle}) > 0`,
    trim: (text) => `BTRIM(${text}, ${WHITESPACE_CODES.map((code) => `CHR(${code})`).join(' || ')})`,
    least: (values) => (values.length === 1 ? values[0] : `LEAST(${values.join(', ')})`),
    greatest: (values) => (values.length === 1 ? values[0] : `GREATEST(${values.join(', ')})`),
    booleanLiteral: (value) => (typeof value === 'boolean' ? String(value).toUpperCase() : literalOf(postgres, value)),
    binary: (x) => `${x} COLLATE "C"`
};

const oracle: FormulaDialect = {
    text: quoted,
    nullText: 'NULL',
    // TO_CHAR writes .5 for 0.5: the 0 put in front; the decimal mark a `.` whatever NLS says
    numberText: (x) => `REGEXP_REPLACE(TO_CHAR(${x}, 'TM9', 'NLS_NUMERIC_CHARACTERS=''.,'''), '^(-?)\\.', '\\10.')`,
    // '' is NULL in Oracle
    blankToNull: (x) => x,
    concat: (parts) => parts.join(' || '),
    divide: (a, b) => `(${a} / NULLIF(${b}, 0))`,
    round: (x, digits) => `ROUND(CAST(${x} AS NUMBER), ${digits})`,
    whole: (x) => `TRUNC(${x})`,
    substr: (text, start, n) => `SUBSTR(${text}, ${start}, ${n})`,
    length: (text) => `LENGTH(${text})`,
    // SUBSTR(t, -n) is NULL when n is longer than t, and SUBSTR(t, 0) is all of it
    right: (text, n) =>
        `CASE WHEN ${n} = 0 THEN NULL WHEN ${n} >= LENGTH(${text}) THEN ${text} ELSE SUBSTR(${text}, -(${n})) END`,
    contains: (haystack, needle) => `INSTR(${haystack}, ${needle}) > 0`,
    trim: (text) =>
        `REGEXP_REPLACE(${text}, '^[ ' || CHR(9) || CHR(10) || CHR(13) || ']+|[ ' || CHR(9) || CHR(10) || CHR(13) || ']+$', '')`,
    least: (values) => skippingNull('LEAST', values),
    greatest: (values) => skippingNull('GREATEST', values),
    booleanLiteral: (value) => literalOf(oracle, value),
    binary: (x) => x
};

const sqlite: FormulaDialect = {
    text: quoted,
    nullText: 'NULL',
    // a whole number as it is; a real with 15 digits, as the grid keeps them: 4.0 is 4, 0.1 + 0.2 is 0.3
    // (printf of NULL is '0': NULL first)
    numberText: (x) =>
        `CASE WHEN ${x} IS NULL THEN NULL WHEN typeof(${x}) = 'integer' THEN CAST(${x} AS TEXT) ELSE printf('%.15g', ${x}) END`,
    blankToNull: (x) => `NULLIF(${x}, '')`,
    concat: (parts) => parts.join(' || '),
    divide: (a, b) => `(CAST(${a} AS REAL) / NULLIF(${b}, 0))`,
    round: (x, digits) => (digits >= 0 ? `round(${x}, ${digits})` : `(round(${x} / ${10 ** -digits}.0) * ${10 ** -digits})`),
    whole: (x) => `CAST(${x} AS INTEGER)`,
    substr: (text, start, n) => `substr(${text}, ${start}, ${n})`,
    length: (text) => `length(${text})`,
    right: (text, n) =>
        `CASE WHEN ${n} = 0 THEN NULL WHEN ${n} >= length(${text}) THEN ${text} ELSE substr(${text}, -(${n})) END`,
    contains: (haystack, needle) => `instr(${haystack}, ${needle}) > 0`,
    trim: (text) => `trim(${text}, ${WHITESPACE_CODES.map((code) => `char(${code})`).join(' || ')})`,
    least: (values) => skippingNull('min', values),
    greatest: (values) => skippingNull('max', values),
    booleanLiteral: (value) => literalOf(sqlite, value),
    binary: (x) => `${x} COLLATE BINARY`
};

const mssql: FormulaDialect = {
    text: (value) => `N${quoted(value)}`,
    nullText: 'CAST(NULL AS nvarchar(max))',
    // G15 in en-US: 2.5, 4, 0.3; LOWER makes 1E+21 JavaScript's 1e+21
    numberText: (x) => `LOWER(FORMAT(CAST(${x} AS float), 'G15', 'en-US'))`,
    blankToNull: (x) => `CASE WHEN DATALENGTH(${x}) = 0 THEN NULL ELSE ${x} END`,
    concat: (parts) => parts.join(' + '),
    divide: (a, b) => `(CAST(${a} AS float) / NULLIF(${b}, 0))`,
    round: (x, digits) => `ROUND(${x}, ${digits})`,
    whole: (x) => `CAST(${x} AS int)`,
    // an emoji is two characters here (UTF-16 units), unless the column has a collation of supplementary
    // characters (_SC): COLLATE ..._SC in the SQL conflicts with the collations of what it meets (Msg 468)
    substr: (text, start, n) => `SUBSTRING(${text}, ${start}, ${n})`,
    // LEN leaves out the spaces at the end
    length: (text) => `(LEN(${text} + N'x') - 1)`,
    right: (text, n) => `RIGHT(${text}, ${n})`,
    contains: (haystack, needle) => `CHARINDEX(${needle}, ${mssqlBinary(haystack)}) > 0`,
    trim: (text) => `TRIM(${WHITESPACE_CODES.map((code) => `CHAR(${code})`).join(' + ')} FROM ${text})`,
    // no LEAST before 2022: MIN of the values skips NULL
    least: (values) =>
        values.length === 1 ? values[0] : `(SELECT MIN(v) FROM (VALUES ${values.map((v) => `(${v})`).join(', ')}) AS t(v))`,
    greatest: (values) =>
        values.length === 1 ? values[0] : `(SELECT MAX(v) FROM (VALUES ${values.map((v) => `(${v})`).join(', ')}) AS t(v))`,
    booleanLiteral: (value) => (typeof value === 'boolean' ? (value ? '1' : '0') : literalOf(mssql, value)),
    binary: (x) => mssqlBinary(x)
};

function mssqlBinary(x: string): string {
    return `${x} COLLATE Latin1_General_100_BIN2`;
}

/** a value of a boolean column's values as SQL: a number as it is, a text a literal */
function literalOf(dialect: FormulaDialect, value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    if (typeof value === 'string') {
        return dialect.text(checkedText(value));
    }
    if (typeof value === 'boolean') {
        return value ? '1' : '0';
    }
    throw new TypeError(`toSqlWhere: a boolean column's value ${String(value)} can not be in the SQL of a formula`);
}

const DIALECTS: Readonly<Record<SqlDialect, FormulaDialect>> = { postgres, oracle, sqlite, mssql };

/** a text a database can hold: no NUL, no lone surrogate */
function checkedText(value: string): string {
    if (value.includes('\0') || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value)) {
        throw new TypeError('toSqlWhere: a text of the formula has a NUL character or a lone surrogate');
    }
    return value;
}

const OR = (parts: (string | null)[]): string | null => {
    const kept = parts.filter((part): part is string => part !== null);
    return kept.length === 0 ? null : kept.length === 1 ? kept[0] : `(${kept.join(' OR ')})`;
};

/**
 * @internal
 * The SQL of a formula: its value, NULL where it is blank or can not be computed (as the grid's cell)
 * @param node the formula read (readFormula of formula.ts), its types checked
 * @param fieldOf the SQL of a field the formula reads: a column, another calculated column
 * @throws a `TypeError` for what is not in SQL yet (dates), a `RangeError` for SQL over MAX_FORMULA_SQL
 */
export function formulaSql(
    node: FormulaNode,
    _type: FormulaType,
    dialectName: SqlDialect,
    fieldOf: (field: string) => FormulaSqlField
): string {
    const d = DIALECTS[dialectName];
    const limit = (sql: string): string => {
        if (sql.length > MAX_FORMULA_SQL) {
            throw new RangeError(`toSqlWhere: the SQL of a formula is longer than ${MAX_FORMULA_SQL} characters`);
        }
        return sql;
    };

    const typeOf = (each: FormulaNode): FormulaType => {
        switch (each.kind) {
            case 'number':
            case 'negate':
                return 'number';
            case 'text':
                return 'text';
            case 'boolean':
            case 'not':
                return 'boolean';
            case 'field':
                return fieldOf(each.name).type;
            case 'binary':
                switch (each.operator) {
                    case '+':
                    case '-':
                    case '*':
                    case '/':
                        return 'number';
                    case '&':
                        return 'text';
                    default:
                        return 'boolean';
                }
            case 'call':
                return callType(each.name, each.args);
        }
    };
    const callType = (name: string, args: FormulaNode[]): FormulaType => {
        switch (name) {
            case 'IF':
                return typeOf(args[1]);
            case 'COALESCE':
            case 'MIN':
            case 'MAX':
                return typeOf(args[0]);
            case 'ROUND':
            case 'ABS':
            case 'DAYS':
            case 'YEAR':
            case 'MONTH':
            case 'LEN':
                return 'number';
            case 'TODAY':
                return 'date';
            case 'ISBLANK':
            case 'CONTAINS':
                return 'boolean';
            default:
                return 'text';
        }
    };
    const noDates = (each: FormulaNode) => {
        if (typeOf(each) === 'date') {
            throw new TypeError('toSqlWhere: a formula with dates is not made SQL yet: compute it in the database');
        }
    };

    /** a boolean's predicate as a value: 1 or 0 */
    const asValue = (predicate: string) => `CASE WHEN ${predicate} THEN 1 ELSE 0 END`;

    /** the value of a part: NULL for blank. The error of the part is apart (err) */
    const value = (each: FormulaNode): string => {
        noDates(each);
        switch (each.kind) {
            case 'number':
                return String(each.value);
            case 'text':
                return each.value === '' ? d.nullText : d.text(checkedText(each.value));
            case 'boolean':
                return each.value ? '1' : '0';
            case 'field':
                return fieldValue(each.name);
            case 'negate':
                return `(-${value(each.arg)})`;
            case 'not':
                return asValue(predicate(each));
            case 'binary': {
                const { operator } = each;
                switch (operator) {
                    case '+':
                    case '-':
                    case '*':
                        return limit(`(${value(each.left)} ${operator} ${value(each.right)})`);
                    case '/':
                        return limit(d.divide(value(each.left), value(each.right)));
                    case '&':
                        return joined([each.left, each.right]);
                    default:
                        return asValue(predicate(each));
                }
            }
            case 'call':
                return limit(callValue(each.name, each.args));
        }
    };

    const fieldValue = (name: string): string => {
        const field = fieldOf(name);
        if (field.calculated) {
            return `(${field.sql})`;
        }
        switch (field.type) {
            case 'text':
                return d.blankToNull(field.sql);
            case 'boolean': {
                const values = field.booleanValues ?? { true: true, false: false };
                return `CASE WHEN ${field.sql} = ${d.booleanLiteral(values.true)} THEN 1 WHEN ${field.sql} = ${d.booleanLiteral(values.false)} THEN 0 END`;
            }
            default:
                return field.sql;
        }
    };

    /** a value of any type as text, NULL for blank: a number as the grid writes it, true / false as `true` / `false` */
    const textOf = (each: FormulaNode): string => {
        const sql = value(each);
        switch (typeOf(each)) {
            case 'number':
                return d.numberText(sql);
            case 'boolean':
                return `CASE ${sql} WHEN 1 THEN ${d.text('true')} WHEN 0 THEN ${d.text('false')} END`;
            default:
                return sql;
        }
    };

    /** `&` and CONCAT: a blank is '', all of it '' is blank */
    const joined = (parts: FormulaNode[]): string =>
        limit(d.blankToNull(`(${d.concat(parts.map((part) => `COALESCE(${textOf(part)}, ${d.text('')})`))})`));

    /** a count or a position of the functions of text: NULL for blank */
    const countOf = (each: FormulaNode): string => {
        const sql = value(each);
        return `CASE WHEN ${sql} IS NULL THEN NULL ELSE ${count(d.whole, sql)} END`;
    };

    const callValue = (name: string, args: FormulaNode[]): string => {
        switch (name) {
            case 'IF':
                return `CASE WHEN ${predicate(args[0])} THEN ${value(args[1])} ELSE ${value(args[2])} END`;
            case 'ROUND': {
                const digits = args[1] ? constantOf(args[1]) : 0;
                if (digits === undefined) {
                    throw new TypeError(
                        'toSqlWhere: the digits of ROUND in a formula are a number written in it, e.g. ROUND({price}, 2)'
                    );
                }
                return d.round(value(args[0]), digits);
            }
            case 'ABS':
                return `ABS(${value(args[0])})`;
            case 'MIN':
                return d.least(args.map(value));
            case 'MAX':
                return d.greatest(args.map(value));
            case 'CONCAT':
                return joined(args);
            case 'COALESCE':
                return args.length === 1 ? value(args[0]) : `COALESCE(${args.map(value).join(', ')})`;
            case 'ISBLANK':
            case 'CONTAINS':
                return asValue(callPredicate(name, args));
            case 'LEFT':
                return d.blankToNull(d.substr(textOf(args[0]), '1', countOf(args[1])));
            case 'RIGHT':
                return d.blankToNull(d.right(textOf(args[0]), countOf(args[1])));
            case 'MID':
            case 'SUBSTRING': {
                const start = countOf(args[1]);
                return d.blankToNull(
                    d.substr(textOf(args[0]), `CASE WHEN ${start} < 1 THEN 1 ELSE ${start} END`, countOf(args[2]))
                );
            }
            case 'LEN':
                return `COALESCE(${d.length(textOf(args[0]))}, 0)`;
            case 'UPPER':
                return `UPPER(${textOf(args[0])})`;
            case 'LOWER':
                return `LOWER(${textOf(args[0])})`;
            case 'TRIM':
                return d.blankToNull(d.trim(textOf(args[0])));
            default:
                throw new TypeError(`toSqlWhere: ${name}() in a formula is not made SQL yet: compute it in the database`);
        }
    };

    /** a boolean part as a predicate that is true or false, never NULL (a blank is false) */
    const predicate = (each: FormulaNode): string => {
        switch (each.kind) {
            case 'boolean':
                return each.value ? '1=1' : '1=0';
            case 'not':
                return `NOT (${predicate(each.arg)})`;
            case 'binary': {
                const { operator, left, right } = each;
                if (operator === 'AND' || operator === 'OR') {
                    return limit(`(${predicate(left)} ${operator} ${predicate(right)})`);
                }
                if (
                    operator === '=' ||
                    operator === '<>' ||
                    operator === '<' ||
                    operator === '<=' ||
                    operator === '>' ||
                    operator === '>='
                ) {
                    return limit(compare(operator, left, right));
                }
                break;
            }
            case 'call':
                if (each.name === 'ISBLANK' || each.name === 'CONTAINS') {
                    return callPredicate(each.name, each.args);
                }
                break;
        }
        // a boolean value: a field, IF, COALESCE - a blank is false
        return `COALESCE(${value(each)}, 0) = 1`;
    };

    const callPredicate = (name: string, args: FormulaNode[]): string => {
        if (name === 'ISBLANK') {
            noDates(args[0]);
            return `${value(args[0])} IS NULL`;
        }
        // CONTAINS: a blank part is '', in every text
        const haystack = textOf(args[0]);
        const needle = textOf(args[1]);
        return `(${needle} IS NULL OR (${haystack} IS NOT NULL AND ${d.contains(`LOWER(${haystack})`, `LOWER(${needle})`)}))`;
    };

    const compare = (operator: string, left: FormulaNode, right: FormulaNode): string => {
        const text = typeOf(left) === 'text';
        const a = value(left);
        const b = value(right);
        const x = text ? d.binary(`LOWER(${a})`) : a;
        const y = text ? `LOWER(${b})` : b;
        const both = `${a} IS NOT NULL AND ${b} IS NOT NULL`;
        const equal = `((${a} IS NULL AND ${b} IS NULL) OR (${both} AND ${x} = ${y}))`;
        switch (operator) {
            case '=':
                return equal;
            case '<>':
                return `NOT ${equal}`;
            default:
                return `(${both} AND ${x} ${operator} ${y})`;
        }
    };

    /** the condition of a part that can not be computed - a division by 0 - as the grid runs it; null for never */
    const err = (each: FormulaNode): string | null => {
        switch (each.kind) {
            case 'negate':
            case 'not':
                return err(each.arg);
            case 'binary': {
                const { operator, left, right } = each;
                if (operator === 'AND' || operator === 'OR') {
                    // the right is not run when the left decides
                    const rightErr = err(right);
                    const taken = operator === 'AND' ? predicate(left) : `NOT (${predicate(left)})`;
                    return OR([err(left), rightErr && `(${taken} AND ${rightErr})`]);
                }
                const divide = operator === '/' ? `(${value(left)} IS NOT NULL AND ${value(right)} = 0)` : null;
                return OR([err(left), err(right), divide]);
            }
            case 'call': {
                const { name, args } = each;
                if (name === 'IF') {
                    const condition = predicate(args[0]);
                    const [yes, no] = [err(args[1]), err(args[2])];
                    return OR([err(args[0]), yes && `(${condition} AND ${yes})`, no && `(NOT (${condition}) AND ${no})`]);
                }
                if (name === 'COALESCE') {
                    // run until a value is not blank: the next one runs only when this one is blank
                    let found = err(args[args.length - 1]);
                    for (let index = args.length - 2; index >= 0; index--) {
                        found = OR([err(args[index]), found && `(${value(args[index])} IS NULL AND ${found})`]);
                    }
                    return found;
                }
                return OR(args.map(err));
            }
            default:
                return null;
        }
    };

    noDates(node);
    // a true / false formula is 1 / 0 - and blank, as the grid's: `{active}` alone of a blank row
    const sql = value(node);
    const error = err(node);
    return limit(error ? `CASE WHEN ${error} THEN NULL ELSE ${sql} END` : sql);
}

/** the number a part is written as - `2`, `-1` - undefined for another part */
function constantOf(node: FormulaNode): number | undefined {
    if (node.kind === 'number') {
        return node.value;
    }
    if (node.kind === 'negate' && node.arg.kind === 'number') {
        return -node.arg.value;
    }
    return undefined;
}
