import type { CalculatedField } from '../datasource/calculatedField';
import type { Entity } from '../datasource/entity';
import type { FieldType } from '../datasource/field';
import { fillText, TEXTS } from '../texts';
import {
    clobFieldProblem,
    compileFormula,
    FORMULA_TYPES,
    type Formula,
    type FormulaProblem,
    type FormulaType,
    formulaProblemText
} from './formula';

/**
 * The calculated columns (`GridConfig.calculatedColumns`, `GridState.calculatedColumns`): a column whose
 * value is computed from the other fields of its row by a formula (formula.ts) - `{price} * {qty}`, the
 * days a row is late. Read only; otherwise a column like any other: in the layout, sorted, filtered,
 * grouped, aggregated, formatted, coloured, exported.
 *
 * The grid gives the datasource a calculated field for each (`datasource.__setCalculatedField()`, see
 * CalculatedField): the rows answer a read of it with its value, computed then - nothing is stored on a
 * row, so it is no edit, not in `getChanges()`, and always the value of the row as it is.
 *
 * Here: the public type, the checks of a state from plain JavaScript or JSON (hostile: a name is a
 * strict pattern, a formula is read by formula.ts), and the formulas read together - a calculated column
 * can read another, not itself (a cycle is a problem).
 */

/**
 * The type of the values of a calculated column: a number, a text, a date or true / false - the type
 * its formula gives. A `boolean` column shows checkboxes, a `date` column its day.
 *
 * @example
 * ```ts
 * import type { CalculatedType } from '@simple-html/grid';
 *
 * const type: CalculatedType = 'number';
 * ```
 */
export type CalculatedType = 'number' | 'text' | 'date' | 'boolean';

/**
 * A calculated column: its values computed from the other fields of the row by a formula - plain JSON,
 * in the state. Its field is the key it has in `GridConfig.calculatedColumns` /
 * `GridState.calculatedColumns`: a letter, then letters, digits, `_` and `#` (64 at most), no field of the
 * datasource or of the rows. Put it in the layout as any field.
 *
 * - **`formula`**: `{price} * {qty}`, `DAYS({due}, TODAY())`, `IF({qty} > 10, "bulk", "single")` - see
 *   the guide "Calculated columns" for the language: fields in braces, numbers, texts in quotes,
 *   `+ - * /`, `&`, the comparisons, AND / OR / NOT and a few functions. Text, not code: nothing runs.
 * - **`label`**: its label, default the field name made readable. `ColumnConfig.label` and
 *   `ColumnFormat.label` win over it, as over a field's label.
 * - **`type`**: the type of its values. Left out, the formula's; given, it must be the formula's (a
 *   `TypeError` if not) - a saved state keeps saying what it holds.
 *
 * Read only: its cells are not edited, a paste skips them. A row where the formula can not be computed
 * (a division by 0) has an empty cell. A formula with a problem - a syntax error, a field the grid does
 * not know, a type that does not fit - throws a `TypeError` when the grid is made, or `setState()` or
 * `updateConfig()` is given it; the grid config dialog shows the problem at once.
 *
 * @sample calculated-columns
 * @example
 * ```ts
 * import type { GridConfig } from '@simple-html/grid';
 *
 * const config: GridConfig = {
 *     calculatedColumns: {
 *         total: { formula: '{price} * {qty}', label: 'Total' },
 *         daysLate: { formula: 'MAX(0, DAYS({due}, TODAY()))', label: 'Days late', type: 'number' }
 *     },
 *     columns: { total: { aggregate: 'sum', format: { number: { decimals: 2 } } } },
 *     layout: {
 *         center: [
 *             { fields: ['price'], width: 80 },
 *             { fields: ['qty'], width: 60 },
 *             { fields: ['total'], width: 90 },
 *             { fields: ['daysLate'], width: 80 }
 *         ]
 *     }
 * };
 * ```
 */
export interface CalculatedColumn {
    /** the formula: `{price} * {qty}`. At most 1000 characters */
    formula: string;
    /** its label, default the field name made readable */
    label?: string;
    /** the type of its values: left out the formula's, given it must be the formula's */
    type?: CalculatedType;
}

/** the most calculated columns a grid can have */
export const MAX_CALCULATED_COLUMNS = 50;

/**
 * the field name of a calculated column: a letter, then letters, digits, `_` and `#`, 64 at most. Not `__`
 * first (the grid's own), not `__proto__` or anything else that is no plain name
 */
const NAME = /^[A-Za-z][A-Za-z0-9_#]{0,63}$/;

/**
 * the names of the properties every object has (`constructor`, `toString`, `hasOwnProperty` ...): a
 * calculated column of one of them would answer for it on every row
 */
const OBJECT_NAMES: ReadonlySet<string> = new Set(Object.getOwnPropertyNames(Object.prototype));

/** the keys of a calculated column, for the check of one from plain JavaScript or JSON */
const KEYS: readonly (keyof CalculatedColumn)[] = ['formula', 'label', 'type'];

/**
 * @internal
 * true when a text is a field name a calculated column can have: NAME, not one of OBJECT_NAMES
 */
export function isCalculatedName(name: string): boolean {
    return NAME.test(name) && !OBJECT_NAMES.has(name);
}

/**
 * The type of a field that is not calculated, as a formula reads it: its type, `'clob'` for a text field
 * with `clobType` (FieldConfig.clobType) - a formula can not read it, the problem `clobField`
 */
export type FormulaFieldType = FieldType | 'clob';

/** a calculated column read: its formula, or the problem it has */
export type CompiledColumn = { formula: Formula } | { problem: FormulaProblem };

/**
 * @internal
 * The formulas of calculated columns read together: a formula can read another calculated column - of
 * the type its formula gives - not itself, round or straight (`cycle`). A column whose formula reads one
 * with a problem has the problem `fieldProblem`. A `type` given that is not the formula's is the problem
 * `result`.
 * @param columns the calculated columns, by field. Plain data, checked (assertCalculatedColumns) or the
 * dialog's
 * @param fieldType the type of a field that is not calculated - of the datasource, a column of the grid;
 * undefined for a field the grid does not know
 * @returns by field, in the order of `columns`
 */
export function compileCalculatedColumns(
    columns: Readonly<Record<string, CalculatedColumn>>,
    fieldType: (field: string) => FormulaFieldType | undefined
): Map<string, CompiledColumn> {
    const done = new Map<string, CompiledColumn>();
    const reading = new Set<string>();
    const names = new Set(Object.keys(columns));

    const read = (name: string): CompiledColumn => {
        const known = done.get(name);
        if (known) {
            return known;
        }
        if (reading.has(name)) {
            return { problem: { id: 'cycle', values: { field: `{${name}}` } } };
        }
        reading.add(name);
        const column = columns[name];
        let compiled: CompiledColumn = compileFormula(column.formula, (field) => {
            if (names.has(field)) {
                const other = read(field);
                if ('problem' in other) {
                    return {
                        problem:
                            other.problem.id === 'cycle' ? other.problem : { id: 'fieldProblem', values: { field: `{${field}}` } }
                    };
                }
                return { type: other.formula.type };
            }
            const type = fieldType(field);
            if (type === 'clob') {
                return clobFieldProblem(field);
            }
            return type ? { type: formulaTypeOf(type) } : undefined;
        });
        reading.delete(name);
        if ('formula' in compiled && column.type !== undefined && column.type !== compiled.formula.type) {
            compiled = { problem: { id: 'result', values: {}, types: { got: compiled.formula.type, expected: column.type } } };
        }
        done.set(name, compiled);
        return compiled;
    };

    const all = new Map<string, CompiledColumn>();
    for (const name of names) {
        all.set(name, read(name));
    }
    return all;
}

/** the type a field has in a formula: a datetime is a date */
export function formulaTypeOf(type: FieldType): FormulaType {
    return type === 'datetime' ? 'date' : type;
}

/**
 * @internal
 * The calculated fields the datasource is given for calculated columns without problems: each reads the
 * row's own fields (an own property, `Object.hasOwn`) and the other calculated fields; the fields of the
 * rows it is computed from, through the calculated columns it reads too (`uses`)
 * @param compiled the calculated columns read (compileCalculatedColumns): a column with a problem is
 * left out
 * @param labelOf the label of a column
 */
export function calculatedFields(
    compiled: ReadonlyMap<string, CompiledColumn>,
    labelOf: (name: string) => string
): Map<string, CalculatedField> {
    const formulas = new Map<string, Formula>();
    for (const [name, each] of compiled) {
        if ('formula' in each) {
            formulas.set(name, each.formula);
        }
    }
    /** the fields of the rows a column is computed from: its own and those of the columns it reads */
    const usesOf = (name: string, seen = new Set<string>()): string[] => {
        seen.add(name);
        const formula = formulas.get(name) as Formula;
        return formula.fields.flatMap((field) => (formulas.has(field) ? (seen.has(field) ? [] : usesOf(field, seen)) : [field]));
    };
    const daily = (name: string, seen = new Set<string>()): boolean => {
        seen.add(name);
        const formula = formulas.get(name) as Formula;
        return formula.usesToday || formula.fields.some((field) => formulas.has(field) && !seen.has(field) && daily(field, seen));
    };
    const fields = new Map<string, CalculatedField>();
    for (const [name, formula] of formulas) {
        fields.set(name, {
            type: formula.type,
            label: labelOf(name),
            value: (row) => {
                const result = formula.evaluate(readerOf(row, formulas));
                return 'value' in result ? result.value : null;
            },
            uses: [...new Set(usesOf(name))],
            daily: daily(name)
        });
    }
    return fields;
}

/**
 * @internal
 * How a formula reads the fields of a row: a calculated column through the row (the proxy computes it),
 * another field only as an own property of the row - `{constructor}` is not the row's prototype's
 * @param calculated the names of the calculated columns
 */
export function readerOf(row: Entity, calculated: { has(name: string): boolean }): (field: string) => unknown {
    return (field) => (calculated.has(field) || Object.hasOwn(row, field) ? row[field] : undefined);
}

/**
 * @internal
 * The label of a calculated column without one: its field name made readable, as a column's
 */
export function calculatedLabel(column: CalculatedColumn | undefined, name: string, pretty: (name: string) => string): string {
    return column?.label?.trim() ? column.label : pretty(name);
}

/** a plain object, not null or an array */
const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** a problem of a formula as English text, for a TypeError */
function englishProblem(problem: FormulaProblem): string {
    return formulaProblemText(problem, (id, values) => fillText((TEXTS as Record<string, string>)[id] ?? id, values));
}

/**
 * @internal
 * Throws when calculated columns from plain JavaScript or JSON - a config, a saved state - are not what
 * they must be, before anything changes:
 * - an object of columns by field name, MAX_CALCULATED_COLUMNS at most
 * - each name a letter, then letters, digits, `_` and `#` (64 at most) - not a field of the rows
 *   (`isTaken`): the column would hide its values
 * - each column an object of `formula` (text), `label` (text, not empty) and `type` (a CalculatedType)
 * - every formula without a problem (compileCalculatedColumns): its syntax, its fields, its types
 * @param fieldType the type of a field that is not calculated, undefined for one the grid does not know
 * @param isTaken true for a name that is a field of the datasource or of its rows
 * @param name how the message names it: `GridConfig: calculatedColumns`, `setState: calculatedColumns`
 * @throws a `TypeError` naming the column, what it has and what it takes
 */
export function assertCalculatedColumns(
    columns: unknown,
    fieldType: (field: string) => FormulaFieldType | undefined,
    isTaken: (name: string) => boolean,
    name: string
): asserts columns is Record<string, CalculatedColumn> {
    if (!isObject(columns)) {
        throw new TypeError(
            `${name} is ${JSON.stringify(columns)}, it is an object of columns by field: { total: { formula: '{price} * {qty}' } }`
        );
    }
    const names = Object.keys(columns);
    if (names.length > MAX_CALCULATED_COLUMNS) {
        throw new TypeError(`${name} has ${names.length} columns, ${MAX_CALCULATED_COLUMNS} at most`);
    }
    for (const field of names) {
        const at = `${name}.${field}`;
        if (!isCalculatedName(field)) {
            throw new TypeError(
                `${name} has the field ${JSON.stringify(field.slice(0, 70))}: a field name is a letter, then letters, digits, _ and #, 64 at most - not a name every object has (constructor, toString ...)`
            );
        }
        if (isTaken(field)) {
            throw new TypeError(
                `${at}: '${field}' is a field of the datasource or its rows, a calculated column needs a name of its own`
            );
        }
        const column = columns[field];
        if (!isObject(column)) {
            throw new TypeError(`${at} is ${JSON.stringify(column)}, it is a column: { formula, label?, type? }`);
        }
        for (const key of Object.keys(column)) {
            if (!KEYS.some((known) => known === key)) {
                throw new TypeError(`${at} has '${key.slice(0, 70)}', a calculated column has ${KEYS.join(', ')}`);
            }
        }
        if (typeof column.formula !== 'string') {
            throw new TypeError(`${at}.formula is ${JSON.stringify(column.formula)}, it is text: '{price} * {qty}'`);
        }
        if (column.label !== undefined && (typeof column.label !== 'string' || column.label.trim() === '')) {
            throw new TypeError(`${at}.label is ${JSON.stringify(column.label)}, it is text, not empty`);
        }
        if (column.type !== undefined && !FORMULA_TYPES.some((type) => type === column.type)) {
            throw new TypeError(
                `${at}.type is ${JSON.stringify(column.type)}, it is ${FORMULA_TYPES.map((type) => `'${type}'`).join(', ')}`
            );
        }
    }
    const compiled = compileCalculatedColumns(columns as Record<string, CalculatedColumn>, fieldType);
    for (const [field, each] of compiled) {
        if ('problem' in each) {
            throw new TypeError(`${name}.${field}.formula: ${englishProblem(each.problem)}`);
        }
    }
}
