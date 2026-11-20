/**
 * How a {@link FilterCondition} compares the row's value with its `value`. The field's type (from
 * the datasource's `fields`, `'text'` when it is not listed) decides how the two are compared.
 *
 * - `EQUAL` - text: the same, ignoring case. Number: the same. `date`: the same day, `datetime`: the same second
 * - `NOT_EQUAL_TO` - the opposite of `EQUAL`
 * - `LESS_THAN` - number and date: smaller / earlier. Text: compared as lower case text
 * - `LESS_THAN_OR_EQUAL_TO` - `LESS_THAN` or `EQUAL`
 * - `GREATER_THAN` - number and date: larger / later. Text: compared as lower case text
 * - `GREATER_THAN_OR_EQUAL_TO` - `GREATER_THAN` or `EQUAL`
 * - `CONTAINS` - text: has the value somewhere in it, ignoring case. Number and date: `GREATER_THAN_OR_EQUAL_TO`
 * - `DOES_NOT_CONTAIN` - text: does not have the value in it, ignoring case. Number and date: `LESS_THAN`
 * - `BEGIN_WITH` - text: starts with the value, ignoring case. Number and date: `GREATER_THAN_OR_EQUAL_TO`
 * - `END_WITH` - text: ends with the value, ignoring case. Number and date: `LESS_THAN_OR_EQUAL_TO`
 * - `IN` - one of a list: `value` is an array (or text with one value per line), compared as upper case text. Number and date fields compare their formatted text. `'NULL'` in the list matches a blank
 * - `NOT_IN` - the opposite of `IN`
 * - `IS_BLANK` - the row value is null, undefined, `''` or 0 (or an invalid Date, in a date field). Takes no `value`
 * - `IS_NOT_BLANK` - the opposite of `IS_BLANK`. Takes no `value`
 *
 * In a text value `*` and `%` are wildcards: `where('name', 'EQUAL', 'per*2')` matches `person2`.
 * A blank row date (null, `''`, an invalid Date) is never before, after or on a date: of the
 * comparisons it only matches `NOT_EQUAL_TO`. A `boolean` field compares every operator as `EQUAL`,
 * apart from `IN` / `NOT_IN` and the blank ones.
 *
 * **0 is blank.** A row value of 0 counts as blank, on purpose: in ERP style data 0 and empty mean
 * the same. For number fields `IS_BLANK` matches 0 too and `IS_NOT_BLANK` leaves it out, and the
 * header's value list (shown for text fields) puts a 0 under its "Blank" entry.
 *
 * @example
 * ```ts
 * datasource.filter(where('age', 'GREATER_THAN_OR_EQUAL_TO', 18));
 * datasource.filter(where('name', 'CONTAINS', 'son'));
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
 * One test on one field: `field` `operator` `value`. The field's type comes from the datasource's
 * `fields` (`'text'` when it is not listed), the condition has none of its own.
 *
 * - `field` - the property on the row
 * - `operator` - how to compare, see {@link FilterOperator}
 * - `value` - what to compare with. Left out for `IS_BLANK` / `IS_NOT_BLANK`, an array for `IN` /
 *   `NOT_IN`, a `Date` for date fields. A number value compares as a number and a `Date` as a date,
 *   also on a field that is not listed
 * - `valueField` - compare with another field of the same row instead of `value`
 *
 * A condition without `field` or `operator`, and a date condition without the value it needs, is
 * ignored: it does not filter out anything.
 *
 * {@link where} builds one. A `valueField` condition is written out:
 *
 * @example
 * ```ts
 * where('age', 'GREATER_THAN', 18); // { field: 'age', operator: 'GREATER_THAN', value: 18 }
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
    /** what to compare with, not used by `IS_BLANK` / `IS_NOT_BLANK` or when `valueField` is set */
    value?: unknown;
    /** the name of another field: the row's value of that field is what is compared with */
    valueField?: string;
}

/**
 * Conditions and groups joined by AND (every child must match) or OR (one is enough). Groups nest,
 * so any mix of AND and OR can be written. A group without children is ignored.
 *
 * {@link and} and {@link or} build one.
 *
 * @example
 * ```ts
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
 * `datasource.filter()` takes, `datasource.getFilter()` returns and the grid saves in
 * `GridConfig.filter`. It is plain data, so it can be stored as JSON (a `Date` value comes back as
 * text, which a `date` / `datetime` field still reads).
 *
 * Build one with {@link and}, {@link or} and {@link where}, or write the objects out.
 *
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
 * @example
 * ```ts
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
 * @example
 * ```ts
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
 * then has no `value` property
 *
 * @example
 * ```ts
 * where('age', 'GREATER_THAN', 18); // { field: 'age', operator: 'GREATER_THAN', value: 18 }
 * where('born', 'LESS_THAN', new Date(2000, 0, 1));
 * where('country', 'NOT_IN', ['Norway', 'Sweden']);
 * where('email', 'IS_BLANK'); // { field: 'email', operator: 'IS_BLANK' }
 * ```
 */
export function where(field: string, operator: FilterOperator, value?: unknown): FilterCondition {
    return value === undefined ? { field, operator } : { field, operator, value };
}

/**
 * @internal
 * true for a group, false for a condition. A group is what has a `children` array - also when
 * plain js leaves out `group` (that is read as AND).
 */
export function isFilterGroup(expression: FilterExpression): expression is FilterGroup {
    return 'children' in expression && Array.isArray(expression.children);
}
