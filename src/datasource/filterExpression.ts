import { assertOptions } from './assertOptions';
import type { FieldType } from './field';

/**
 * How a {@link FilterCondition} compares the row's value with its `value`. The field's type (from
 * the datasource's `fields`, `'text'` when it is not listed) decides how the two are compared, and
 * which operators the grid offers for it: see {@link operatorsFor}. The filtering guide has the exact
 * rules of every operator for every type, written for a backend that has to filter the same way.
 *
 * - `EQUAL` / `NOT_EQUAL_TO` - the same / not the same. Text: the whole text, ignoring case unless
 *   the condition is `caseSensitive` - `'an'` does not match `'Ann'` (use a wildcard, `'an*'`, or
 *   `CONTAINS`). `date`: the same day, `datetime`: the same second
 * - `CONTAINS` / `DOES_NOT_CONTAIN`, `BEGIN_WITH`, `END_WITH` - text: has the value in it / has not,
 *   starts with it, ends with it
 * - `LESS_THAN`, `LESS_THAN_OR_EQUAL_TO`, `GREATER_THAN`, `GREATER_THAN_OR_EQUAL_TO` - number and
 *   date: smaller / earlier, larger / later
 * - `BETWEEN` - number and date: from `value[0]` to `value[1]`, both ends included: `[10, 20]`. A
 *   blank end is open, `[10, null]` is `GREATER_THAN_OR_EQUAL_TO 10`
 * - `IN` / `NOT_IN` - one of a list / none of it: `value` is an array (or text with one value per
 *   line). `'NULL'` in the list matches a blank
 * - `IS_BLANK` / `IS_NOT_BLANK` - the row value is blank / is not: null, undefined, `''` or 0 (or an
 *   invalid Date, in a date field). They take no `value`
 *
 * In a text value `*` and `%` are wildcards, any text: `where('name', 'EQUAL', 'per*2')` matches
 * `person2`. `_` is one character, any - as in SQL `LIKE`: `'p_mp'` matches `pump` and `PUMP`, not
 * `pmp`.
 *
 * **0 is blank.** A row value of 0 counts as blank, on purpose: in ERP style data 0 and empty mean
 * the same. `IS_BLANK` matches a 0 (the number, in any field - the text `'0'` is not blank) and
 * `IS_NOT_BLANK` leaves it out, and the header's value list (shown for text fields) puts a 0 under its
 * "Blank" entry. The other way round, a blank row value of a number field compares as 0 -
 * `where('age', 'LESS_THAN', 5)` matches the rows without an age - and of a boolean field as `false`.
 *
 * An operator the field's type does not offer (`CONTAINS` on a number, in a filter saved with v5)
 * still filters the way it did, see the guide's "Operators a type does not offer".
 *
 * @sample filtering
 * @example
 * ```ts
 * import { where } from '@simple-html/grid';
 *
 * datasource.filter(where('age', 'GREATER_THAN_OR_EQUAL_TO', 18));
 * datasource.filter(where('name', 'CONTAINS', 'son'));
 * datasource.filter(where('age', 'BETWEEN', [18, 30]));
 * datasource.filter(where('country', 'IN', ['Norway', 'Sweden']));
 * datasource.filter(where('email', 'IS_BLANK'));
 * ```
 */
export type FilterOperator =
    | 'EQUAL'
    | 'LESS_THAN_OR_EQUAL_TO'
    | 'GREATER_THAN_OR_EQUAL_TO'
    | 'LESS_THAN'
    | 'GREATER_THAN'
    | 'BETWEEN'
    | 'CONTAINS'
    | 'NOT_EQUAL_TO'
    | 'DOES_NOT_CONTAIN'
    | 'BEGIN_WITH'
    | 'END_WITH'
    | 'IN'
    | 'NOT_IN'
    | 'IS_BLANK'
    | 'IS_NOT_BLANK';

/**
 * @internal
 * every operator, to check one that comes from plain js or JSON
 */
export const FILTER_OPERATORS: readonly FilterOperator[] = [
    'EQUAL',
    'NOT_EQUAL_TO',
    'LESS_THAN',
    'LESS_THAN_OR_EQUAL_TO',
    'GREATER_THAN',
    'GREATER_THAN_OR_EQUAL_TO',
    'BETWEEN',
    'CONTAINS',
    'DOES_NOT_CONTAIN',
    'BEGIN_WITH',
    'END_WITH',
    'IN',
    'NOT_IN',
    'IS_BLANK',
    'IS_NOT_BLANK'
];

/**
 * the operators of a number, date and datetime field, in the order the grid shows them
 */
const RANGE_OPERATORS: readonly FilterOperator[] = [
    'EQUAL',
    'NOT_EQUAL_TO',
    'LESS_THAN',
    'LESS_THAN_OR_EQUAL_TO',
    'GREATER_THAN',
    'GREATER_THAN_OR_EQUAL_TO',
    'BETWEEN',
    'IN',
    'NOT_IN',
    'IS_BLANK',
    'IS_NOT_BLANK'
];

/**
 * the operators of each type, in the order the grid shows them, see operatorsFor
 */
const OPERATORS_OF_TYPE: Readonly<Record<FieldType, readonly FilterOperator[]>> = {
    text: [
        'EQUAL',
        'NOT_EQUAL_TO',
        'CONTAINS',
        'DOES_NOT_CONTAIN',
        'BEGIN_WITH',
        'END_WITH',
        'IN',
        'NOT_IN',
        'IS_BLANK',
        'IS_NOT_BLANK'
    ],
    number: RANGE_OPERATORS,
    date: RANGE_OPERATORS,
    datetime: RANGE_OPERATORS,
    boolean: ['EQUAL', 'NOT_EQUAL_TO', 'IS_BLANK', 'IS_NOT_BLANK']
};

/**
 * The operators of a field type: the ones that mean something for it, in the order the grid shows
 * them. The grid offers these, and only these, in a header filter's menu and in the filter editor - a
 * column's `filterOperators` can offer fewer.
 *
 * | type | operators |
 * | --- | --- |
 * | `text` | `EQUAL`, `NOT_EQUAL_TO`, `CONTAINS`, `DOES_NOT_CONTAIN`, `BEGIN_WITH`, `END_WITH`, `IN`, `NOT_IN`, `IS_BLANK`, `IS_NOT_BLANK` |
 * | `number`, `date`, `datetime` | `EQUAL`, `NOT_EQUAL_TO`, `LESS_THAN`, `LESS_THAN_OR_EQUAL_TO`, `GREATER_THAN`, `GREATER_THAN_OR_EQUAL_TO`, `BETWEEN`, `IN`, `NOT_IN`, `IS_BLANK`, `IS_NOT_BLANK` |
 * | `boolean` | `EQUAL`, `NOT_EQUAL_TO`, `IS_BLANK`, `IS_NOT_BLANK` |
 *
 * The datasource still filters on an operator a type does not offer - `CONTAINS` on a number, in a
 * filter saved with v5 - the way it did, see {@link FilterOperator}.
 *
 * @param type a field type. One that is no type gives the operators of `text`, the type of a field
 * that is not listed
 * @returns a new list each call
 *
 * @sample filtering
 * @example
 * ```ts
 * import { operatorsFor } from '@simple-html/grid';
 *
 * operatorsFor('boolean'); // ['EQUAL', 'NOT_EQUAL_TO', 'IS_BLANK', 'IS_NOT_BLANK']
 * operatorsFor(datasource.getField('age').type).includes('BETWEEN'); // true for a number field
 * ```
 */
export function operatorsFor(type: FieldType): FilterOperator[] {
    return [...(OPERATORS_OF_TYPE[type] ?? OPERATORS_OF_TYPE.text)];
}

/**
 * @internal
 * true if the value is one of the operators
 */
export function isFilterOperator(value: unknown): value is FilterOperator {
    return FILTER_OPERATORS.some((operator) => operator === value);
}

/**
 * One test on one field: `field` `operator` `value`. The field's type comes from the datasource's
 * `fields` (`'text'` when it is not listed), the condition has none of its own.
 *
 * - `field` - the property on the row
 * - `operator` - how to compare, see {@link FilterOperator}
 * - `value` - what to compare with. Left out for `IS_BLANK` / `IS_NOT_BLANK`, an array for `IN` /
 *   `NOT_IN`, `[from, to]` for `BETWEEN`, a `Date` for date fields. A number value compares as a
 *   number and a `Date` as a date, also on a field that is not listed
 * - `valueField` - compare with another field of the same row instead of `value` (not `BETWEEN`)
 * - `caseSensitive` - `true`: a text is compared with upper and lower case as they are
 *
 * A condition without `field` or `operator` is ignored: it does not filter out anything. So is one
 * without the value it needs: a blank `value` (null, undefined, `''`, an invalid Date) and no
 * `valueField`, or a `BETWEEN` without a `[from, to]` that has an end.
 *
 * {@link where} builds one. A `valueField` condition is written out:
 *
 * @sample filtering
 * @example
 * ```ts
 * import { where } from '@simple-html/grid';
 *
 * where('age', 'GREATER_THAN', 18); // { field: 'age', operator: 'GREATER_THAN', value: 18 }
 * where('name', 'EQUAL', 'Ann', { caseSensitive: true }); // finds Ann, not ANN
 *
 * // rows changed after they were approved
 * datasource.filter({ field: 'changed', operator: 'GREATER_THAN', valueField: 'approved' });
 * ```
 */
export interface FilterCondition {
    /** the field to test, the property on the row */
    field: string;
    /** how to compare, see {@link FilterOperator} */
    operator: FilterOperator;
    /**
     * what to compare with, not used by `IS_BLANK` / `IS_NOT_BLANK` or when `valueField` is set. An
     * array for `IN` / `NOT_IN`, `[from, to]` for `BETWEEN`
     */
    value?: unknown;
    /**
     * the name of another field: the row's value of that field is what is compared with. Not used
     * by `BETWEEN`, it takes its ends from `value`
     */
    valueField?: string;
    /**
     * `true`: a text is compared with upper and lower case as they are - `'Ann'` does not find `'ANN'`
     * or `'ann'`. Default `false`: case is ignored, the two texts are compared in lower case (`IN` /
     * `NOT_IN`: in upper case). Only `true` turns it on.
     *
     * For the conditions that compare text: on a `text` field (also a field that is not listed),
     * with a value that is no number and no `Date`. Every text operator takes it: `EQUAL` and
     * `NOT_EQUAL_TO` (wildcards too), `CONTAINS`, `DOES_NOT_CONTAIN`, `BEGIN_WITH`, `END_WITH`, `IN` /
     * `NOT_IN` (the list as it is, write a blank as `'NULL'`), and the `LESS_THAN` ... a text field
     * does not offer. Ignored on a number, date, datetime and boolean field - their `IN` compares the
     * formatted text ignoring case - and by `IS_BLANK` / `IS_NOT_BLANK`.
     */
    caseSensitive?: boolean;
}

/**
 * Conditions and groups joined by AND (every child must match) or OR (one is enough). Groups nest,
 * so any mix of AND and OR can be written. A group without children is ignored.
 *
 * {@link and} and {@link or} build one.
 *
 * @sample filtering
 * @example
 * ```ts
 * import { and, type FilterGroup, or, where } from '@simple-html/grid';
 *
 * // age >= 18 AND (country = 'Norway' OR country = 'Sweden')
 * const filter: FilterGroup = {
 *     group: 'AND',
 *     children: [
 *         { field: 'age', operator: 'GREATER_THAN_OR_EQUAL_TO', value: 18 },
 *         {
 *             group: 'OR',
 *             children: [
 *                 { field: 'country', operator: 'EQUAL', value: 'Norway' },
 *                 { field: 'country', operator: 'EQUAL', value: 'Sweden' }
 *             ]
 *         }
 *     ]
 * };
 * // the same, with the builders
 * and(where('age', 'GREATER_THAN_OR_EQUAL_TO', 18), or(where('country', 'EQUAL', 'Norway'), where('country', 'EQUAL', 'Sweden')));
 * ```
 */
export interface FilterGroup {
    /** `'AND'`: every child must match, `'OR'`: one is enough */
    group: 'AND' | 'OR';
    /** the conditions and groups in the group */
    children: FilterExpression[];
}

/**
 * A filter: one {@link FilterCondition}, or a {@link FilterGroup} of them. This is what
 * `datasource.filter()` takes, `datasource.getFilter()` returns and the grid keeps in its state
 * (`GridState.filter`). It is plain data, so it can be stored as JSON (a `Date` value comes back as
 * text, which a `date` / `datetime` field still reads).
 *
 * Build one with {@link and}, {@link or} and {@link where}, or write the objects out.
 *
 * @sample filtering
 * @example
 * ```ts
 * import { and, or, where } from '@simple-html/grid';
 *
 * // a single condition
 * datasource.filter(where('balance', 'GREATER_THAN', 2500));
 *
 * // age > 18 AND (a = 'x' OR a = 'y')
 * datasource.filter(and(where('age', 'GREATER_THAN', 18), or(where('a', 'EQUAL', 'x'), where('a', 'EQUAL', 'y'))));
 *
 * // no filter
 * datasource.filter(null);
 * ```
 */
export type FilterExpression = FilterGroup | FilterCondition;

/**
 * A group where every child must match.
 *
 * @param children conditions and groups. None gives an empty group, which filters out nothing
 *
 * @sample filtering
 * @example
 * ```ts
 * import { and, where } from '@simple-html/grid';
 *
 * // country = 'Norway' AND age < 30
 * datasource.filter(and(where('country', 'EQUAL', 'Norway'), where('age', 'LESS_THAN', 30)));
 * ```
 */
export function and(...children: FilterExpression[]): FilterGroup {
    return { group: 'AND', children };
}

/**
 * A group where one matching child is enough.
 *
 * @param children conditions and groups. None gives an empty group, which filters out nothing
 *
 * @sample filtering
 * @example
 * ```ts
 * import { or, where } from '@simple-html/grid';
 *
 * // country = 'Norway' OR country = 'Sweden'
 * datasource.filter(or(where('country', 'EQUAL', 'Norway'), where('country', 'EQUAL', 'Sweden')));
 * ```
 */
export function or(...children: FilterExpression[]): FilterGroup {
    return { group: 'OR', children };
}

/**
 * A condition: `field` `operator` `value`.
 *
 * @param field the field to test, the property on the row
 * @param operator how to compare, see {@link FilterOperator}
 * @param value what to compare with. Leave it out for `IS_BLANK` / `IS_NOT_BLANK`, the condition
 * then has no `value` property. `[from, to]` for `BETWEEN`, an end can be null
 * @param options.caseSensitive `true` to compare a text with upper and lower case as they are, see
 * {@link FilterCondition}. Default `false`: the condition has no `caseSensitive` property
 * @throws a `TypeError` for a `BETWEEN` whose value is not `[from, to]`, and for options that are not
 * an object (`where(field, operator, value, true)`)
 *
 * @sample filtering
 * @example
 * ```ts
 * import { where } from '@simple-html/grid';
 *
 * where('age', 'GREATER_THAN', 18); // { field: 'age', operator: 'GREATER_THAN', value: 18 }
 * where('born', 'LESS_THAN', new Date(2000, 0, 1));
 * where('age', 'BETWEEN', [18, 30]); // 18 to 30, both included
 * where('age', 'BETWEEN', [18, null]); // 18 or more
 * where('country', 'NOT_IN', ['Norway', 'Sweden']);
 * where('name', 'BEGIN_WITH', 'Mc', { caseSensitive: true }); // { ..., caseSensitive: true }
 * where('email', 'IS_BLANK'); // { field: 'email', operator: 'IS_BLANK' }
 * ```
 */
export function where(
    field: string,
    operator: FilterOperator,
    value?: unknown,
    options: { caseSensitive?: boolean } = {}
): FilterCondition {
    assertOptions('where', options, "where('name', 'EQUAL', 'Ann', { caseSensitive: true })");
    if (operator === 'BETWEEN' && !isRange(value)) {
        throw new TypeError(
            `where('${field}', 'BETWEEN', value): value is [from, to], an end can be null - got ${JSON.stringify(value)}`
        );
    }
    const condition: FilterCondition = value === undefined ? { field, operator } : { field, operator, value };
    if (options.caseSensitive === true) {
        condition.caseSensitive = true;
    }
    return condition;
}

/**
 * @internal
 * true for the value of a `BETWEEN`: an array of two, `[from, to]`. An end can be blank, it is open
 */
export function isRange(value: unknown): value is [unknown, unknown] {
    return Array.isArray(value) && value.length === 2;
}

/**
 * @internal
 * true for a group, false for a condition. A group is what has a `children` array - also when
 * plain js leaves out `group` (that is read as AND).
 */
export function isFilterGroup(expression: FilterExpression): expression is FilterGroup {
    return 'children' in expression && Array.isArray(expression.children);
}
