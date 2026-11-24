import { FILTER_OPERATORS, type FilterOperator } from '../datasource/filterExpression';
import { isBlank } from '../datasource/isBlank';
import { objectFilter, rangeOperator } from '../datasource/objectFilter';
import { textPatternParts } from '../datasource/textPattern';
import { type FieldTypeResult, readFormula } from '../grid/formula';
import type {
    SqlCalculatedColumn,
    SqlColumn,
    SqlColumnType,
    SqlDateStorage,
    SqlDialect,
    SqlLimits,
    SqlOptions,
    SqlParam,
    SqlWhere
} from '../sql';
import { DIALECTS, type Dialect } from './dialects';
import { markFilterError } from './filterError';
import { type FormulaSqlField, formulaSql } from './formulaSql';
import { show } from './show';
import { nextSecond, readFilterDate, startOfDay, startOfNextDay, type TimeZoneClock, timeZoneClock } from './sqlDates';

/**
 * @internal
 * toSqlWhere (src/sql.ts, where it is documented): the options checked, then the filter walked - each
 * group and condition checked and written as SQL, its values kept as parameters
 */
export function buildWhere(filter: unknown, options: SqlOptions): SqlWhere {
    const context = readOptions(options);
    if (filter === null || filter === undefined) {
        return { sql: NO_CONDITION, params: [] };
    }
    // what is wrong with the filter is the request's: marked for isSqlFilterError. The options were read above
    const sql = markFilterError(() => build(filter, context, 1, 'filter'));
    return { sql: sql ?? NO_CONDITION, params: context.params };
}

/** what is left when no condition is: always true, valid after WHERE in every dialect */
const NO_CONDITION = '1=1';
/** an IN without values: no row */
const NO_ROW = '1=0';

const DEFAULT_LIMITS: Readonly<Required<SqlLimits>> = {
    depth: 10,
    conditions: 100,
    listLength: 1000,
    textLength: 1000,
    params: 2000
};

const COLUMN_TYPES: readonly SqlColumnType[] = ['text', 'number', 'boolean', 'date', 'datetime'];
const DATE_STORAGES: readonly SqlDateStorage[] = ['local', 'utc', 'zoned', 'epochSeconds', 'epochMillis'];

// letters, digits and _, not first a digit; up to 128 (the longest name SQL Server and Oracle take), and
// up to two prefixes: schema.table.column
const COLUMN_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}(\.[A-Za-z_][A-Za-z0-9_]{0,127}){0,2}$/;

/** the comparisons, as SQL */
const COMPARISON: Partial<Record<FilterOperator, string>> = {
    EQUAL: '=',
    NOT_EQUAL_TO: '<>',
    LESS_THAN: '<',
    LESS_THAN_OR_EQUAL_TO: '<=',
    GREATER_THAN: '>',
    GREATER_THAN_OR_EQUAL_TO: '>='
};

/** one column of the options, checked: its name quoted for the dialect */
interface Column {
    sql: string;
    type: SqlColumnType;
    dateStorage: SqlDateStorage;
    booleanValues: { true: SqlParam; false: SqlParam };
}

/** the options checked, and the parameters made so far */
interface Context {
    dialect: Dialect;
    dialectName: SqlDialect;
    columns: Map<string, Column>;
    /** the calculated columns of the options, read; their SQL made when a filter uses one (calculatedColumn) */
    calculated: Map<string, SqlCalculatedColumn>;
    /** the calculated columns made SQL, and the ones being made (a cycle) */
    calculatedColumns: Map<string, Column>;
    making: Set<string>;
    /** the user's time zone, there when a column is a date */
    clock: TimeZoneClock | null;
    limits: Required<SqlLimits>;
    firstParam: number;
    params: SqlParam[];
    /** the conditions and groups seen, for limits.conditions */
    parts: number;
}

// ------------------------------------------------------------------ the options

function readOptions(options: SqlOptions): Context {
    if (!isPlainObject(options)) {
        throw new TypeError('toSqlWhere: options is an object: { dialect, columns }');
    }
    checkKeys(options, ['dialect', 'columns', 'timeZone', 'dateStorage', 'firstParam', 'limits', 'calculated'], 'options');

    const dialectName = own(options, 'dialect');
    if (typeof dialectName !== 'string' || !Object.hasOwn(DIALECTS, dialectName)) {
        throw new TypeError(`toSqlWhere: options.dialect is 'postgres', 'oracle', 'sqlite' or 'mssql', not ${show(dialectName)}`);
    }
    const dialect = DIALECTS[dialectName as SqlDialect];
    const dateStorage = readDateStorage(own(options, 'dateStorage') ?? 'local', 'options.dateStorage');

    const columnsOption = own(options, 'columns');
    if (!isPlainObject(columnsOption)) {
        throw new TypeError("toSqlWhere: options.columns is an object: { field: 'column' } or { field: { column, type } }");
    }
    const columns = new Map<string, Column>();
    for (const field of Object.keys(columnsOption)) {
        columns.set(field, readColumn(columnsOption[field], dialect, dateStorage, `options.columns[${show(field)}]`));
    }

    let clock: TimeZoneClock | null = null;
    const timeZone = own(options, 'timeZone');
    if (timeZone !== undefined) {
        // the user's time zone, sent by the browser with the filter: what is wrong with it is the request's
        clock = markFilterError(() => {
            if (typeof timeZone !== 'string') {
                throw new TypeError(
                    `toSqlWhere: options.timeZone is an IANA time zone, e.g. 'Europe/Oslo', not ${show(timeZone)}`
                );
            }
            return timeZoneClock(timeZone);
        });
    } else if ([...columns.values()].some((column) => isDateType(column.type))) {
        throw new TypeError(
            "toSqlWhere: options.timeZone is needed for the date columns: the user's IANA time zone, e.g. 'Europe/Oslo'"
        );
    }

    const firstParam = own(options, 'firstParam') ?? 1;
    if (!Number.isSafeInteger(firstParam) || (firstParam as number) < 1) {
        throw new TypeError(`toSqlWhere: options.firstParam is a whole number from 1, not ${show(firstParam)}`);
    }

    // the calculated columns come from the user's state, with the filter: what is wrong is the request's
    const calculated = markFilterError(() => readCalculated(own(options, 'calculated'), columns));

    return {
        dialect,
        dialectName: dialectName as SqlDialect,
        columns,
        calculated,
        calculatedColumns: new Map(),
        making: new Set(),
        clock,
        limits: readLimits(own(options, 'limits')),
        firstParam: firstParam as number,
        params: [],
        parts: 0
    };
}

function readColumn(entry: unknown, dialect: Dialect, dateStorage: SqlDateStorage, where: string): Column {
    const column: SqlColumn | undefined =
        typeof entry === 'string' ? { column: entry } : isPlainObject(entry) ? (entry as any) : undefined;
    if (!column) {
        throw new TypeError(`toSqlWhere: ${where} is the column's name, or { column, type }, not ${show(entry)}`);
    }
    checkKeys(column, ['column', 'type', 'dateStorage', 'booleanValues'], where);

    const name = own(column, 'column');
    if (typeof name !== 'string' || !COLUMN_NAME.test(name)) {
        throw new TypeError(
            `toSqlWhere: ${where}: the column ${show(name)} is letters, digits and _ (not first a digit), with up to two prefixes: schema.table.column`
        );
    }
    const type = own(column, 'type') ?? 'text';
    if (!COLUMN_TYPES.includes(type as SqlColumnType)) {
        throw new TypeError(`toSqlWhere: ${where}.type is one of ${COLUMN_TYPES.join(', ')}, not ${show(type)}`);
    }
    const columnStorage = own(column, 'dateStorage');
    if (columnStorage !== undefined && !isDateType(type as SqlColumnType)) {
        throw new TypeError(`toSqlWhere: ${where}.dateStorage is for a date or datetime column`);
    }
    const booleanValues = own(column, 'booleanValues');
    if (booleanValues !== undefined && type !== 'boolean') {
        throw new TypeError(`toSqlWhere: ${where}.booleanValues is for a boolean column`);
    }

    return {
        sql: name.split('.').map(dialect.quote).join('.'),
        type: type as SqlColumnType,
        dateStorage: columnStorage === undefined ? dateStorage : readDateStorage(columnStorage, `${where}.dateStorage`),
        booleanValues:
            booleanValues === undefined ? dialect.booleanValues : readBooleanValues(booleanValues, `${where}.booleanValues`)
    };
}

function readDateStorage(storage: unknown, where: string): SqlDateStorage {
    if (!DATE_STORAGES.includes(storage as SqlDateStorage)) {
        throw new TypeError(`toSqlWhere: ${where} is one of ${DATE_STORAGES.join(', ')}, not ${show(storage)}`);
    }
    return storage as SqlDateStorage;
}

function readBooleanValues(values: unknown, where: string): Column['booleanValues'] {
    const isParam = (value: unknown) =>
        typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
    if (!isPlainObject(values) || !isParam(own(values, 'true')) || !isParam(own(values, 'false'))) {
        throw new TypeError(`toSqlWhere: ${where} is { true, false }, each a text, number or boolean: { true: 'Y', false: 'N' }`);
    }
    checkKeys(values, ['true', 'false'], where);
    if (values.true === values.false) {
        throw new TypeError(`toSqlWhere: ${where}: true and false are two different values`);
    }
    return { true: values.true as SqlParam, false: values.false as SqlParam };
}

function readLimits(limits: unknown): Required<SqlLimits> {
    if (limits === undefined) {
        return DEFAULT_LIMITS;
    }
    if (!isPlainObject(limits)) {
        throw new TypeError('toSqlWhere: options.limits is an object: { depth, conditions, listLength, textLength, params }');
    }
    checkKeys(limits, Object.keys(DEFAULT_LIMITS), 'options.limits');
    const read: Record<string, number> = { ...DEFAULT_LIMITS };
    for (const key of Object.keys(limits)) {
        const value = limits[key];
        if (!Number.isSafeInteger(value) || (value as number) < 1) {
            throw new TypeError(`toSqlWhere: options.limits.${key} is a whole number from 1, not ${show(value)}`);
        }
        read[key] = value as number;
    }
    return read as Required<SqlLimits>;
}

// ------------------------------------------------------------------ the filter

/**
 * a group or a condition as SQL, null when the grid ignores it (an empty group, a condition without a
 * field, an operator or the value it needs)
 * @param depth how deep the groups nest here, the top group is 1
 * @param where the path of the node in the filter, for the messages: filter.children[2]
 */
function build(node: unknown, context: Context, depth: number, where: string): string | null {
    if (!isPlainObject(node)) {
        throw new TypeError(`toSqlWhere: ${where} is a condition or a group (an object), not ${show(node)}`);
    }
    context.parts++;
    if (context.parts > context.limits.conditions) {
        throw new RangeError(`toSqlWhere: the filter has more than ${context.limits.conditions} conditions and groups`);
    }
    if (Object.hasOwn(node, 'children') || Object.hasOwn(node, 'group')) {
        return buildGroup(node, context, depth, where);
    }
    return buildCondition(node, context, where);
}

function buildGroup(node: Record<string, unknown>, context: Context, depth: number, where: string): string | null {
    checkKeys(node, ['group', 'children'], where);
    if (depth > context.limits.depth) {
        throw new RangeError(`toSqlWhere: the groups of the filter nest more than ${context.limits.depth} deep`);
    }
    // the grid takes anything but OR as AND: here it is AND, OR or left out (AND)
    const group = own(node, 'group');
    if (group !== undefined && group !== 'AND' && group !== 'OR') {
        throw new TypeError(`toSqlWhere: ${where}.group is 'AND' or 'OR', not ${show(group)}`);
    }
    const children = own(node, 'children');
    if (!Array.isArray(children)) {
        throw new TypeError(`toSqlWhere: ${where}.children is an array of conditions and groups, not ${show(children)}`);
    }
    const parts: string[] = [];
    for (let index = 0; index < children.length; index++) {
        const part = build(children[index], context, depth + 1, `${where}.children[${index}]`);
        if (part !== null) {
            parts.push(part);
        }
    }
    if (parts.length <= 1) {
        // an empty group is ignored, as in the grid: it does not filter out any row
        return parts[0] ?? null;
    }
    return `(${parts.join(group === 'OR' ? ' OR ' : ' AND ')})`;
}

function buildCondition(node: Record<string, unknown>, context: Context, where: string): string | null {
    checkKeys(node, ['field', 'operator', 'value', 'valueField', 'caseSensitive', 'literal'], where);
    // each is read once: a getter can not give one value to the check and another to the SQL
    const field = readName(own(node, 'field'), `${where}.field`);
    const operator = own(node, 'operator');
    const valueField = readName(own(node, 'valueField'), `${where}.valueField`);
    const caseSensitive = own(node, 'caseSensitive');
    const literal = own(node, 'literal');
    const value = own(node, 'value');

    if (
        operator !== undefined &&
        operator !== null &&
        operator !== '' &&
        !FILTER_OPERATORS.includes(operator as FilterOperator)
    ) {
        throw new TypeError(`toSqlWhere: ${where}.operator is one of ${FILTER_OPERATORS.join(', ')}, not ${show(operator)}`);
    }
    if (caseSensitive !== undefined && caseSensitive !== null && typeof caseSensitive !== 'boolean') {
        throw new TypeError(`toSqlWhere: ${where}.caseSensitive is true or false, not ${show(caseSensitive)}`);
    }
    if (literal !== undefined && literal !== null && typeof literal !== 'boolean') {
        throw new TypeError(`toSqlWhere: ${where}.literal is true or false, not ${show(literal)}`);
    }
    // the names are checked first: a field that is not in the columns throws, also in a condition the
    // grid would leave out
    const column = field === undefined ? undefined : columnOf(context, field, `${where}.field`);
    const other = valueField === undefined ? undefined : columnOf(context, valueField, `${where}.valueField`);
    if (!column || !operator) {
        return null;
    }
    const op = operator as FilterOperator;
    // case is for text only, as in the grid
    const exact = caseSensitive === true && column.type === 'text';

    switch (op) {
        case 'IS_BLANK':
        case 'IS_NOT_BLANK':
            return blank(context, column, op === 'IS_BLANK');
        case 'IN':
        case 'NOT_IN': {
            const sql = inList(context, column, value, exact, `${where}.value`);
            return op === 'IN' ? sql : not(sql);
        }
        case 'BETWEEN':
            return between(context, column, value, exact, `${where}.value`);
    }
    if (other) {
        return compareColumns(context, column, op, other, exact, where);
    }
    if (isBlank(value)) {
        // no value: the grid ignores it. A blank value never means "is blank", that is IS_BLANK
        return null;
    }
    return compare(context, column, op, value, exact, `${where}.value`, literal === true);
}

/** a field or valueField: a text, or nothing (undefined, null, '') */
function readName(name: unknown, where: string): string | undefined {
    if (name === undefined || name === null || name === '') {
        return undefined;
    }
    if (typeof name !== 'string') {
        throw new TypeError(`toSqlWhere: ${where} is the name of a field, not ${show(name)}`);
    }
    return name;
}

function columnOf(context: Context, field: string, where: string): Column {
    const column = context.columns.get(field);
    if (column) {
        return column;
    }
    if (context.calculated.has(field)) {
        return calculatedColumn(context, field);
    }
    throw new TypeError(`toSqlWhere: ${where} ${show(field)} is not one of the columns`);
}

// ------------------------------------------------------------------ the calculated columns

/** options.calculated: by field, a formula or `{ formula, type?, label? }`; no field of `columns` */
function readCalculated(option: unknown, columns: Map<string, Column>): Map<string, SqlCalculatedColumn> {
    const calculated = new Map<string, SqlCalculatedColumn>();
    if (option === undefined || option === null) {
        return calculated;
    }
    if (!isPlainObject(option)) {
        throw new TypeError(
            "toSqlWhere: options.calculated is an object: { total: '{price} * {qty}' } or { total: { formula } }"
        );
    }
    for (const field of Object.keys(option)) {
        const where = `options.calculated[${show(field)}]`;
        if (columns.has(field)) {
            throw new TypeError(
                `toSqlWhere: ${where} is a field of options.columns too: a calculated column has a name of its own`
            );
        }
        const entry = option[field];
        const column: SqlCalculatedColumn = typeof entry === 'string' ? { formula: entry } : (entry as SqlCalculatedColumn);
        if (!isPlainObject(column) || typeof column.formula !== 'string') {
            throw new TypeError(`toSqlWhere: ${where} is a formula, or { formula, type? }, not ${show(entry)}`);
        }
        checkKeys(column, ['formula', 'type', 'label'], where);
        calculated.set(field, {
            formula: own(column, 'formula') as string,
            type: own(column, 'type') as SqlCalculatedColumn['type']
        });
    }
    return calculated;
}

/**
 * A calculated column as a column: its formula as SQL (formulaSql.ts), made the first time a filter uses
 * it. Its fields are the columns and the other calculated columns
 * @throws a `TypeError` for a formula with a problem, a type that is not the formula's, a cycle, dates
 */
function calculatedColumn(context: Context, field: string): Column {
    const done = context.calculatedColumns.get(field);
    if (done) {
        return done;
    }
    const where = `options.calculated[${show(field)}]`;
    if (context.making.has(field)) {
        throw new TypeError(`toSqlWhere: ${where}: its formula reads itself, through the other calculated columns`);
    }
    context.making.add(field);
    const entry = context.calculated.get(field) as SqlCalculatedColumn;
    const typeOf = (name: string): FieldTypeResult => {
        const column = context.columns.get(name);
        if (column) {
            return { type: column.type === 'datetime' ? 'date' : column.type };
        }
        if (context.calculated.has(name)) {
            return { type: calculatedColumn(context, name).type as 'number' | 'text' | 'boolean' };
        }
        return undefined;
    };
    const read = readFormula(entry.formula, typeOf);
    if ('problem' in read) {
        const { id, values } = read.problem;
        throw new TypeError(
            id === 'unknownField'
                ? `toSqlWhere: ${where}.formula reads ${values.field}, which is not one of the columns`
                : `toSqlWhere: ${where}.formula has a problem: ${id} ${JSON.stringify(values)}`
        );
    }
    if (entry.type !== undefined && entry.type !== read.type) {
        throw new TypeError(`toSqlWhere: ${where}.type is ${show(entry.type)}, its formula gives a ${read.type}`);
    }
    const fieldOf = (name: string): FormulaSqlField => {
        const column = context.columns.get(name);
        if (column) {
            return {
                sql: column.sql,
                type: column.type === 'datetime' ? 'date' : column.type,
                booleanValues: column.booleanValues
            };
        }
        const other = calculatedColumn(context, name);
        return { sql: other.sql, type: other.type as 'number' | 'text' | 'boolean', calculated: true };
    };
    const column: Column = {
        sql: `(${formulaSql(read.node, read.type, context.dialectName, fieldOf)})`,
        type: read.type as SqlColumnType,
        dateStorage: 'local',
        // a true / false formula is 1 / 0 in the SQL
        booleanValues: { true: 1, false: 0 }
    };
    context.making.delete(field);
    context.calculatedColumns.set(field, column);
    return column;
}

// ------------------------------------------------------------------ the conditions

/**
 * a condition with a value: field operator value
 * @param literal FilterCondition.literal: `*`, `%` and `_` of a text are characters, not wildcards
 */
function compare(
    context: Context,
    column: Column,
    operator: FilterOperator,
    value: unknown,
    exact: boolean,
    where: string,
    literal = false
) {
    switch (column.type) {
        case 'text':
            return compareText(context, column, operator, readText(context, value, where), exact, literal);
        case 'number':
            return compareNumber(context, column, rangeOperator(operator), readNumber(value, where));
        case 'boolean':
            return compareBoolean(context, column, operator, readBoolean(value, where));
        default:
            return compareDate(context, column, rangeOperator(operator), readFilterDate(value, clockOf(context), 'utc', where));
    }
}

/**
 * Text: the pattern operators with LIKE (GLOB on sqlite) - `*` and `%` are wildcards (any text), `_` one
 * character, `\*`, `\%`, `\_` and `\\` the character itself, the rest is literal; with `literal` all of it is - and the comparisons a text does not offer
 * (LESS_THAN ...) code point by code point. Whether a blank row (null, `''`) matches is the grid's answer
 * for `''`
 */
function compareText(
    context: Context,
    column: Column,
    operator: FilterOperator,
    text: string,
    exact: boolean,
    literal: boolean
): string {
    const { dialect } = context;
    const blankMatches = blankRowMatches('text', operator, text, exact, literal);
    const comparison = COMPARISON[operator];
    if (comparison && operator !== 'EQUAL' && operator !== 'NOT_EQUAL_TO') {
        return nullable(
            column.sql,
            blankMatches,
            `${dialect.binary(fold(column.sql, exact))} ${comparison} ${foldedParam(context, text, exact)}`
        );
    }
    // EQUAL, an operator of plain js that is none, CONTAINS, BEGIN_WITH, END_WITH and their NOT
    const fromStart = operator !== 'CONTAINS' && operator !== 'DOES_NOT_CONTAIN' && operator !== 'END_WITH';
    const toEnd = operator !== 'CONTAINS' && operator !== 'DOES_NOT_CONTAIN' && operator !== 'BEGIN_WITH';
    const any = dialect.anyText;
    // the same parts the grid's filter reads (textPatternParts): the plain text escaped for the dialect,
    // the wildcards the dialect's own, a `\_` (or every `_` with `literal`) a plain `_` of the pattern
    const body = textPatternParts(text, literal)
        .map((part) => {
            if (part.type === 'text') {
                return dialect.patternLiteral(part.text);
            }
            if (part.type === 'char') {
                return dialect.wildcardLiteral(part.char);
            }
            return part.wildcard === '_' ? dialect.oneChar : any;
        })
        .join('');
    const pattern = `${fromStart ? '' : any}${body}${toEnd ? '' : any}`;
    const match = dialect.match(column.sql, foldedParam(context, pattern, exact), exact);
    const negated = operator === 'NOT_EQUAL_TO' || operator === 'DOES_NOT_CONTAIN';
    return nullable(column.sql, blankMatches, negated ? `NOT (${match})` : match);
}

/** a number: a blank (null) row is 0, decided here - the column is compared as it is, so its index works */
function compareNumber(context: Context, column: Column, operator: FilterOperator, value: number): string {
    const placeholder = context.dialect.numberParam(param(context, value), value);
    const blankMatches = blankRowMatches('number', operator, value, false);
    return nullable(column.sql, blankMatches, `${column.sql} ${COMPARISON[operator]} ${placeholder}`);
}

/** a boolean: EQUAL or NOT_EQUAL_TO (any other operator is EQUAL, as in the grid), a blank row is false */
function compareBoolean(context: Context, column: Column, operator: FilterOperator, value: boolean): string {
    const op = operator === 'NOT_EQUAL_TO' ? 'NOT_EQUAL_TO' : 'EQUAL';
    const placeholder = param(context, value ? column.booleanValues.true : column.booleanValues.false);
    const blankMatches = blankRowMatches('boolean', op, value, false);
    return nullable(column.sql, blankMatches, `${column.sql} ${COMPARISON[op]} ${placeholder}`);
}

/**
 * A date: the day (`date`) or second (`datetime`) of the value is the range from its start to the start
 * of the next (excluded) - an index on the column works. A blank row date matches only NOT_EQUAL_TO
 */
function compareDate(context: Context, column: Column, operator: FilterOperator, wall: number): string {
    const x = context.dialect.dateColumn(column.sql, column.dateStorage);
    const [start, end] = dateRange(context, column, wall);
    switch (operator) {
        case 'NOT_EQUAL_TO': {
            const before = dateParam(context, column, start);
            const after = dateParam(context, column, end);
            return `(${x} IS NULL OR ${x} < ${before} OR ${x} >= ${after})`;
        }
        case 'EQUAL':
            return dateBetween(context, column, x, start, end);
        case 'LESS_THAN':
            return dateBetween(context, column, x, null, start);
        case 'LESS_THAN_OR_EQUAL_TO':
            return dateBetween(context, column, x, null, end);
        case 'GREATER_THAN':
            return dateBetween(context, column, x, end, null);
        default:
            return dateBetween(context, column, x, start, null);
    }
}

/** `x` from `from` (included) to `to` (excluded), an end null is open. Never a blank (null) date */
function dateBetween(context: Context, column: Column, x: string, from: number | null, to: number | null): string {
    const parts = [`${x} IS NOT NULL`];
    if (from !== null) {
        parts.push(`${x} >= ${dateParam(context, column, from)}`);
    }
    if (to !== null) {
        parts.push(`${x} < ${dateParam(context, column, to)}`);
    }
    return `(${parts.join(' AND ')})`;
}

/**
 * the start and the end (excluded) of the day or the second of a wall clock, as the column holds dates:
 * wall clocks for `local`, instants for the others. The second after an instant is one second on: when
 * the clocks go back, the wall clock of the second is shown twice, the earlier is the one (see
 * TimeZoneClock.instantOf)
 */
function dateRange(context: Context, column: Column, wall: number): [number, number] {
    const clock = clockOf(context);
    const local = column.dateStorage === 'local';
    if (column.type === 'date') {
        const start = startOfDay(wall);
        const end = startOfNextDay(wall);
        return local ? [start, end] : [clock.instantOf(start), clock.instantOf(end)];
    }
    const start = local ? wall : clock.instantOf(wall);
    return [start, nextSecond(start)];
}

function dateParam(context: Context, column: Column, milliseconds: number): string {
    const { dialect } = context;
    return dialect.dateParam(param(context, dialect.dateValue(milliseconds, column.dateStorage)), column.dateStorage);
}

/** IS_BLANK / IS_NOT_BLANK. Blank: null, `''` (text), 0 (number) - false is a value, as in the grid */
function blank(context: Context, column: Column, isBlankOperator: boolean): string {
    const { dialect } = context;
    const name = column.sql;
    switch (column.type) {
        case 'text':
            return isBlankOperator ? dialect.textBlank(name) : dialect.textNotBlank(name);
        case 'number':
            return isBlankOperator ? `(${name} IS NULL OR ${name} = 0)` : `(${name} IS NOT NULL AND ${name} <> 0)`;
        case 'boolean':
            return `${name} IS ${isBlankOperator ? '' : 'NOT '}NULL`;
        default: {
            const x = dialect.dateColumn(name, column.dateStorage);
            return `${x} IS ${isBlankOperator ? '' : 'NOT '}NULL`;
        }
    }
}

/**
 * BETWEEN `[from, to]`: GREATER_THAN_OR_EQUAL_TO from AND LESS_THAN_OR_EQUAL_TO to, each with the rules of
 * the type. A blank end is open, both blank (or no value) is ignored. A `valueField` is not used
 */
function between(context: Context, column: Column, value: unknown, exact: boolean, where: string): string | null {
    if (isBlank(value)) {
        return null;
    }
    if (!Array.isArray(value) || value.length !== 2) {
        throw new TypeError(`toSqlWhere: ${where} of BETWEEN is [from, to], an end can be null - not ${show(value)}`);
    }
    const [from, to] = [value[0], value[1]];
    if (isBlank(from) && isBlank(to)) {
        return null;
    }
    if (isDateType(column.type)) {
        const clock = clockOf(context);
        const fromRange = isBlank(from) ? null : dateRange(context, column, readFilterDate(from, clock, 'utc', `${where}[0]`));
        const toRange = isBlank(to) ? null : dateRange(context, column, readFilterDate(to, clock, 'utc', `${where}[1]`));
        const x = context.dialect.dateColumn(column.sql, column.dateStorage);
        return dateBetween(context, column, x, fromRange ? fromRange[0] : null, toRange ? toRange[1] : null);
    }
    const parts: string[] = [];
    const ends: [unknown, FilterOperator, string][] = [
        [from, 'GREATER_THAN_OR_EQUAL_TO', `${where}[0]`],
        [to, 'LESS_THAN_OR_EQUAL_TO', `${where}[1]`]
    ];
    for (const [end, operator, endWhere] of ends) {
        if (!isBlank(end)) {
            parts.push(compare(context, column, operator, end, exact, endWhere));
        }
    }
    return parts.length === 1 ? parts[0] : `(${parts.join(' AND ')})`;
}

/**
 * IN: one of a list, `'NULL'` in it is a blank row. The list is an array, or a text with one value per
 * line. No list or `[]`: no row (NOT_IN, the NOT of it: every row). A text compares in upper case (as it
 * is with caseSensitive), a number as a number, a date on its day or second, a boolean as TRUE / FALSE
 */
function inList(context: Context, column: Column, value: unknown, exact: boolean, where: string): string {
    let list: unknown[] = [];
    if (Array.isArray(value)) {
        list = value;
    } else if (typeof value === 'string') {
        list = value.split('\n');
    } else if (value !== null && value !== undefined) {
        list = [value];
    }
    if (list.length > context.limits.listLength) {
        throw new RangeError(`toSqlWhere: ${where} has more than ${context.limits.listLength} values`);
    }
    const { dialect } = context;
    const name = column.sql;
    // the list's values as the type reads them, without the blanks: `'NULL'` (any case, or as it is for
    // text with caseSensitive) and null are the blank row
    let hasBlank = false;
    const values: unknown[] = [];
    list.forEach((item, index) => {
        const itemWhere = `${where}[${index}]`;
        if (item === null || item === '' || (typeof item === 'string' && (exact ? item : item.toUpperCase()) === 'NULL')) {
            // null is the text 'null' in the grid: with caseSensitive, the text 'null' and not a blank row
            hasBlank ||= item !== '' && !(exact && item === null);
            if (column.type !== 'text' || item === '') {
                return;
            }
        }
        values.push(readListItem(context, column, item, itemWhere));
    });

    if (column.type === 'text') {
        const texts = [...new Set(values as string[])];
        const placeholders = texts.map((text) => foldedParam(context, dialect.listValue(text), exact, true));
        const match = placeholders.length ? dialect.inList(name, placeholders, exact) : null;
        if (hasBlank) {
            return match ? `(${dialect.textBlank(name)} OR ${match})` : dialect.textBlank(name);
        }
        return match ? `(${name} IS NOT NULL AND ${match})` : NO_ROW;
    }

    if (isDateType(column.type)) {
        const x = dialect.dateColumn(name, column.dateStorage);
        const ranges = (values as number[]).map((wall) => {
            const [start, end] = dateRange(context, column, wall);
            const from = dateParam(context, column, start);
            const to = dateParam(context, column, end);
            return `(${x} >= ${from} AND ${x} < ${to})`;
        });
        return nullableList(x, hasBlank, ranges.length > 1 ? `(${ranges.join(' OR ')})` : (ranges[0] ?? null));
    }

    // number, boolean
    const unique = [...new Set(values as SqlParam[])];
    const placeholders = unique.map((item) =>
        typeof item === 'number' ? dialect.numberParam(param(context, item), item) : param(context, item)
    );
    return nullableList(name, hasBlank, placeholders.length ? `${name} IN (${placeholders.join(', ')})` : null);
}

/** an IN of a number, date or boolean: `match` (or nothing) with or without the blank (null) rows */
function nullableList(x: string, hasBlank: boolean, match: string | null): string {
    if (!match) {
        return hasBlank ? `${x} IS NULL` : NO_ROW;
    }
    return hasBlank ? `(${x} IS NULL OR ${match})` : `(${x} IS NOT NULL AND ${match})`;
}

/** one value of an IN list, not a blank: text, a number, a date's wall clock, a boolean's value */
function readListItem(context: Context, column: Column, item: unknown, where: string): unknown {
    switch (column.type) {
        case 'text': {
            // the grid compares String(value): a number or a boolean in the list too
            if (typeof item !== 'string' && typeof item !== 'boolean' && !(typeof item === 'number' && Number.isFinite(item))) {
                if (item !== null) {
                    throw new TypeError(`toSqlWhere: ${where} is a text, number or boolean, not ${show(item)}`);
                }
            }
            return readText(context, String(item), where);
        }
        case 'number': {
            // a text is read as a number: '2.00' is 2 - the grid compares it with the text its formatter shows
            const number = typeof item === 'string' && item.trim() === item ? Number(item) : item;
            if (typeof number !== 'number' || !Number.isFinite(number)) {
                throw new TypeError(`toSqlWhere: ${where} is a number or 'NULL', not ${show(item)}`);
            }
            return number;
        }
        case 'boolean': {
            const text = typeof item === 'string' || typeof item === 'boolean' ? String(item).toUpperCase() : '';
            if (text !== 'TRUE' && text !== 'FALSE') {
                throw new TypeError(`toSqlWhere: ${where} is true, false or 'NULL', not ${show(item)}`);
            }
            return text === 'TRUE' ? column.booleanValues.true : column.booleanValues.false;
        }
        default:
            // the text the grid's formatter shows, '2026-11-22', is the day in the user's time zone
            return readFilterDate(item, clockOf(context), 'local', where);
    }
}

/**
 * A `valueField` condition: the column compared with another column of the row - EQUAL, NOT_EQUAL_TO,
 * LESS_THAN ... (number and date also the legacy text operators, a boolean takes any as EQUAL). Both
 * columns have the same type (a date and a datetime go together) and the same date storage
 */
function compareColumns(
    context: Context,
    column: Column,
    operator: FilterOperator,
    other: Column,
    exact: boolean,
    where: string
) {
    const sameType = column.type === other.type || (isDateType(column.type) && isDateType(other.type));
    if (!sameType) {
        throw new TypeError(
            `toSqlWhere: ${where}.valueField is a ${other.type} column, the field a ${column.type}: compare the same types`
        );
    }
    const { dialect } = context;
    const [a, b] = [column.sql, other.sql];
    switch (column.type) {
        case 'number':
            // a blank is 0 on both sides
            return `COALESCE(${a}, 0) ${COMPARISON[rangeOperator(operator)]} COALESCE(${b}, 0)`;
        case 'boolean': {
            if (
                column.booleanValues.true !== other.booleanValues.true ||
                column.booleanValues.false !== other.booleanValues.false
            ) {
                throw new TypeError(`toSqlWhere: ${where}.valueField holds true and false as other values than the field`);
            }
            // the row value blank is false, the other column's value is taken as it is: null matches nothing
            const isFalse = param(context, column.booleanValues.false);
            return operator === 'NOT_EQUAL_TO'
                ? `(${b} IS NULL OR COALESCE(${a}, ${isFalse}) <> ${b})`
                : `(${b} IS NOT NULL AND COALESCE(${a}, ${isFalse}) = ${b})`;
        }
        case 'text':
            return compareTextColumns(dialect, a, b, operator, exact, where);
        default: {
            if (column.dateStorage !== other.dateStorage) {
                throw new TypeError(
                    `toSqlWhere: ${where}.valueField holds its dates as ${other.dateStorage}, the field as ${column.dateStorage}`
                );
            }
            if (column.type === 'date' && column.dateStorage !== 'local') {
                throw new TypeError(
                    `toSqlWhere: ${where}: a valueField on a date column needs dateStorage 'local' - the day of an instant is in the user's time zone`
                );
            }
            const day = column.type === 'date';
            const x = day ? dialect.dayOf(a) : dialect.dateColumn(a, column.dateStorage);
            const y = day ? dialect.dayOf(b) : dialect.dateColumn(b, other.dateStorage);
            const op = rangeOperator(operator);
            // a blank date on either side is no date: only NOT_EQUAL_TO matches
            return op === 'NOT_EQUAL_TO'
                ? `(${x} IS NULL OR ${y} IS NULL OR ${x} <> ${y})`
                : `(${x} IS NOT NULL AND ${y} IS NOT NULL AND ${x} ${COMPARISON[op]} ${y})`;
        }
    }
}

/** two text columns, a blank (null, `''`) is `''`: EQUAL and the comparisons, no wildcards */
function compareTextColumns(dialect: Dialect, a: string, b: string, operator: FilterOperator, exact: boolean, where: string) {
    const left = dialect.binary(fold(a, exact));
    const right = fold(b, exact);
    const [aBlank, bBlank] = [dialect.textBlank(a), dialect.textBlank(b)];
    const [aText, bText] = [dialect.textNotBlank(a), dialect.textNotBlank(b)];
    const equal = `((${aBlank} AND ${bBlank}) OR (${aText} AND ${bText} AND ${left} = ${right}))`;
    // '' is before every text that is not ''
    const less = `(${bText} AND (${aBlank} OR ${left} < ${right}))`;
    const lessOrEqual = `(${aBlank} OR (${bText} AND ${left} <= ${right}))`;
    switch (operator) {
        case 'EQUAL':
            return equal;
        case 'NOT_EQUAL_TO':
            return not(equal);
        case 'LESS_THAN':
            return less;
        case 'LESS_THAN_OR_EQUAL_TO':
            return lessOrEqual;
        case 'GREATER_THAN':
            return not(lessOrEqual);
        case 'GREATER_THAN_OR_EQUAL_TO':
            return not(less);
        default:
            throw new TypeError(
                `toSqlWhere: ${where}: ${operator} with a valueField is not supported on text, only EQUAL, NOT_EQUAL_TO and the comparisons`
            );
    }
}

// ------------------------------------------------------------------ values

/** a text value, not too long, no NUL (PostgreSQL can not hold it), no lone surrogate */
function readText(context: Context, value: unknown, where: string): string {
    if (typeof value !== 'string') {
        // the grid compares a number value as numbers, a Date as a date: give the column that type
        throw new TypeError(
            `toSqlWhere: ${where} is a text for a text column, not ${show(value)} - a column with numbers or dates has that type in options.columns`
        );
    }
    if (value.length > context.limits.textLength) {
        throw new RangeError(`toSqlWhere: ${where} is longer than ${context.limits.textLength} characters`);
    }
    if (value.includes('\0') || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value)) {
        throw new TypeError(`toSqlWhere: ${where} has a NUL character or a lone surrogate, it is no text a database holds`);
    }
    return value;
}

/** a number value: a finite number, or a text `Number()` reads as one (`'12'`, the grid reads it so) */
function readNumber(value: unknown, where: string): number {
    const number = typeof value === 'string' ? Number(value) : value;
    if (typeof number !== 'number' || !Number.isFinite(number)) {
        throw new TypeError(`toSqlWhere: ${where} is a number for a number column, not ${show(value)}`);
    }
    return number;
}

function readBoolean(value: unknown, where: string): boolean {
    if (typeof value !== 'boolean') {
        throw new TypeError(`toSqlWhere: ${where} is true or false for a boolean column, not ${show(value)}`);
    }
    return value;
}

// ------------------------------------------------------------------ helpers

/** a parameter: its value kept, its placeholder returned. Call it in the order the SQL has them */
function param(context: Context, value: SqlParam): string {
    if (context.params.length >= context.limits.params) {
        throw new RangeError(`toSqlWhere: the filter needs more than ${context.limits.params} parameters`);
    }
    context.params.push(value);
    return context.dialect.placeholder(context.firstParam + context.params.length - 1);
}

/**
 * `match` for the rows with a value, and the blank (null) rows by what the grid does with them: a
 * predicate that is true or false, never null - so `NOT` of it, and of a group of them, is right
 */
function nullable(column: string, blankMatches: boolean, match: string): string {
    return blankMatches ? `(${column} IS NULL OR ${match})` : `(${column} IS NOT NULL AND ${match})`;
}

/** what the grid's filter does with a blank (null) row: decides the null branch of the SQL */
function blankRowMatches(
    type: SqlColumnType,
    operator: FilterOperator,
    value: unknown,
    caseSensitive: boolean,
    literal = false
): boolean {
    return objectFilter({ value: null }, { field: 'value', operator, value, type, caseSensitive, literal });
}

function not(sql: string): string {
    if (sql === NO_ROW) {
        return NO_CONDITION;
    }
    return `NOT ${wrap(sql)}`;
}

/** sql in brackets, unless one pair is around all of it already */
function wrap(sql: string): string {
    if (sql.startsWith('(')) {
        let depth = 0;
        for (let index = 0; index < sql.length; index++) {
            depth += sql[index] === '(' ? 1 : sql[index] === ')' ? -1 : 0;
            if (depth === 0) {
                if (index === sql.length - 1) {
                    return sql;
                }
                break;
            }
        }
    }
    return `(${sql})`;
}

/** `LOWER(x)`, or x when the case is kept */
function fold(sql: string, exact: boolean): string {
    return exact ? sql : `LOWER(${sql})`;
}

/** true for a text of ASCII characters only: its case is folded the same by JavaScript and every database */
function isAscii(text: string): boolean {
    for (let index = 0; index < text.length; index++) {
        if (text.charCodeAt(index) > 127) {
            return false;
        }
    }
    return true;
}

/**
 * A text parameter compared ignoring case (`exact` false): folded here, before it is bound - `'FINLAND'`
 * for `$1`, not `UPPER($1)` - when it is ASCII only, as A-Z and a-z fold the same in JavaScript and in
 * every database. Another text is folded by the database, `UPPER($1)`, as its column is: JavaScript and
 * the database fold `ß`, and SQLite every letter that is not ASCII, differently, and a text must match
 * the same text. With `exact` the text is bound as it is
 * @param upper `UPPER` (the IN lists, as the grid), else `LOWER`
 */
function foldedParam(context: Context, text: string, exact: boolean, upper = false): string {
    if (exact) {
        return param(context, text);
    }
    if (isAscii(text)) {
        return param(context, upper ? text.toUpperCase() : text.toLowerCase());
    }
    return `${upper ? 'UPPER' : 'LOWER'}(${param(context, text)})`;
}

function clockOf(context: Context): TimeZoneClock {
    // readOptions makes the clock when a column is a date, only a date column gets here
    return context.clock as TimeZoneClock;
}

function isDateType(type: SqlColumnType): boolean {
    return type === 'date' || type === 'datetime';
}

/** a plain object, as JSON.parse() makes: not an array, a Date, a class */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

/** an own property, nothing from the prototype */
function own(object: object, key: string): unknown {
    return Object.hasOwn(object, key) ? (object as Record<string, unknown>)[key] : undefined;
}

/** every own property is one of `keys`: a typo (`caseSensitiv`) throws instead of being ignored */
function checkKeys(object: object, keys: readonly string[], where: string) {
    for (const key of Object.getOwnPropertyNames(object)) {
        if (!keys.includes(key)) {
            throw new TypeError(`toSqlWhere: ${where} has ${show(key)}, it takes ${keys.join(', ')}`);
        }
    }
}
