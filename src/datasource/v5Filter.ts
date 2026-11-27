import { type FilterExpression, isFilterOperator } from './filterExpression';

/**
 * The filters of v5 - `{ type: 'GROUP', logicalOperator, filterArguments }`, `{ attribute, operator,
 * value }` - as filters of v6: for the links, bookmarks and saved configs of before. The grid's own
 * converter of a v5 config (convertGridConfig, configVersion.ts) uses it, and so can a backend: this file
 * has no DOM, the sql entry (`@simple-html/grid/sql`) bundles it.
 *
 * What comes in is taken as hostile input, as toSqlWhere takes it: anything that is no filter throws a
 * `TypeError` - a node that is no object, `filterArguments` that is no array, an operator that is none -
 * and a filter nested deeper than {@link V5_MAX_DEPTH} a `RangeError`.
 */

/**
 * A filter as v5 had it: `datasource.filter()`, `GridConfig.filter`, `getFilter()`. A group has
 * `type: 'GROUP'` and `filterArguments`, a condition `attribute`, `operator`, `value` - `valueType:
 * 'ATTRIBUTE'` when the value is the name of another field. `attributeType` is the datasource's field
 * type in v6, it is dropped.
 *
 * @example
 * ```ts
 * import type { V5Filter } from '@simple-html/grid';
 *
 * const v5: V5Filter = {
 *     type: 'GROUP',
 *     logicalOperator: 'AND',
 *     filterArguments: [{ type: 'CONDITION', attribute: 'age', operator: 'GREATER_THAN', value: 18, valueType: 'VALUE' }]
 * };
 * ```
 */
export interface V5Filter {
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
    filterArguments?: V5Filter[];
}

/** @internal how deep the groups of a v5 filter may nest: deeper throws a RangeError */
export const V5_MAX_DEPTH = 100;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** the keys only a v6 filter has */
const V6_KEYS = ['group', 'children', 'field'];
/** the keys only a v5 filter has */
const V5_KEYS = ['filterArguments', 'attribute', 'logicalOperator', 'valueType', 'attributeType'];

/**
 * `true` for a filter of v5: an object with a key only v5 had - `filterArguments`, `attribute`,
 * `logicalOperator`, `valueType`, `attributeType`, or `type: 'GROUP'` / `'CONDITION'` - and none only
 * v6 has (`group`, `children`, `field`). Only the top is looked at: {@link convertV5Filter} checks the
 * rest.
 *
 * @example
 * ```ts
 * import { isV5Filter } from '@simple-html/grid';
 *
 * isV5Filter({ attribute: 'age', operator: 'EQUAL', value: 30 }); // true
 * isV5Filter({ field: 'age', operator: 'EQUAL', value: 30 }); // false: v6
 * isV5Filter(null); // false
 * ```
 */
export function isV5Filter(value: unknown): value is V5Filter {
    if (!isPlainObject(value) || V6_KEYS.some((key) => Object.hasOwn(value, key))) {
        return false;
    }
    return V5_KEYS.some((key) => Object.hasOwn(value, key)) || value.type === 'GROUP' || value.type === 'CONDITION';
}

/**
 * A filter of v5 as a filter of v6: a group's `logicalOperator` `'OR'` is an OR group, anything else an
 * AND group (as v5 did); a condition's `attribute` is its `field`, `valueType: 'ATTRIBUTE'` a
 * `valueField`. A condition without a field or an operator is left out - v5 ignored it too. `null` for
 * `null` / `undefined` and for a condition left out.
 *
 * Takes hostile input (a link, a request): what is no v5 filter throws.
 *
 * @param filter the v5 filter, e.g. `JSON.parse(params.get('filter'))`
 * @returns the v6 filter, or null for none
 * @throws a `TypeError` for what is no v5 filter - a node that is no object, `filterArguments` that is no
 * array, an operator that is none, a `BETWEEN` without `[from, to]` - and a `RangeError` for groups nested
 * deeper than 100
 *
 * @example
 * ```ts
 * import { convertV5Filter } from '@simple-html/grid'; // or '@simple-html/grid/sql' on a backend
 *
 * convertV5Filter({
 *     type: 'GROUP',
 *     logicalOperator: 'OR',
 *     filterArguments: [
 *         { attribute: 'country', operator: 'EQUAL', value: 'Norway' },
 *         { attribute: 'age', operator: 'GREATER_THAN', value: 'minAge', valueType: 'ATTRIBUTE' }
 *     ]
 * });
 * // { group: 'OR', children: [
 * //     { field: 'country', operator: 'EQUAL', value: 'Norway' },
 * //     { field: 'age', operator: 'GREATER_THAN', valueField: 'minAge' } ] }
 * ```
 */
export function convertV5Filter(filter: unknown): FilterExpression | null {
    if (filter === null || filter === undefined) {
        return null;
    }
    return convert(filter, 1, 'filter');
}

function convert(node: unknown, depth: number, where: string): FilterExpression | null {
    if (!isPlainObject(node)) {
        throw new TypeError(`convertV5Filter: ${where} is a v5 condition or group (an object), not ${shown(node)}`);
    }
    if (depth > V5_MAX_DEPTH) {
        throw new RangeError(`convertV5Filter: the groups of the filter nest more than ${V5_MAX_DEPTH} deep`);
    }
    if (node.type === 'GROUP' || Object.hasOwn(node, 'filterArguments')) {
        const args = node.filterArguments ?? [];
        if (!Array.isArray(args)) {
            throw new TypeError(`convertV5Filter: ${where}.filterArguments is an array, not ${shown(args)}`);
        }
        const children: FilterExpression[] = [];
        args.forEach((child, index) => {
            const converted = convert(child, depth + 1, `${where}.filterArguments[${index}]`);
            if (converted) {
                children.push(converted);
            }
        });
        return { group: node.logicalOperator === 'OR' ? 'OR' : 'AND', children };
    }
    const { attribute, operator, value, valueType } = node;
    // incomplete: v5 ignored it
    if (attribute === null || attribute === undefined || attribute === '' || operator === null || operator === undefined) {
        return null;
    }
    if (typeof attribute !== 'string') {
        throw new TypeError(`convertV5Filter: ${where}.attribute is the name of a field, not ${shown(attribute)}`);
    }
    if (!isFilterOperator(operator)) {
        throw new TypeError(`convertV5Filter: ${where}.operator is no operator: ${shown(operator)}`);
    }
    if (valueType === 'ATTRIBUTE') {
        if (typeof value !== 'string' || !value) {
            throw new TypeError(
                `convertV5Filter: ${where}.value is the name of a field (valueType 'ATTRIBUTE'), not ${shown(value)}`
            );
        }
        return { field: attribute, operator, valueField: value };
    }
    if (operator === 'BETWEEN' && !(Array.isArray(value) && value.length === 2)) {
        throw new TypeError(`convertV5Filter: ${where}.value of BETWEEN is [from, to], not ${shown(value)}`);
    }
    return value === undefined ? { field: attribute, operator } : { field: attribute, operator, value };
}

/**
 * A filter of either shape as a filter of v6 - the one place that decides the shape of a filter from a
 * request, a link or a saved config:
 *
 * - `null`, `undefined` and `''`: `null`, no filter
 * - text: read as JSON first (`?filter=` of a link), then as below
 * - a v5 filter ({@link isV5Filter}): {@link convertV5Filter}
 * - a v6 filter - an object with `group` / `children`, or `field`: as it is, the same object. Check it
 *   where it is used: `toSqlWhere()` on a backend, `datasource.filter()` in the browser
 *
 * @throws a `TypeError` for anything else - text that is no JSON, a number, an array, an object of
 * neither shape - and what convertV5Filter throws: a filter that can not be read is not taken as no
 * filter, which would show every row
 *
 * @example
 * ```ts
 * import { normalizeFilter } from '@simple-html/grid'; // or '@simple-html/grid/sql' on a backend
 *
 * normalizeFilter(new URLSearchParams(location.search).get('filter')); // a link of v5 or v6
 * normalizeFilter({ attribute: 'age', operator: 'EQUAL', value: 30 }); // { field: 'age', operator: 'EQUAL', value: 30 }
 * normalizeFilter({ field: 'age', operator: 'EQUAL', value: 30 }); // the same object
 * normalizeFilter(null); // null
 * ```
 */
export function normalizeFilter(filter: unknown): FilterExpression | null {
    if (filter === null || filter === undefined || filter === '') {
        return null;
    }
    if (typeof filter === 'string') {
        let parsed: unknown;
        try {
            parsed = JSON.parse(filter);
        } catch {
            throw new TypeError(`normalizeFilter: the text is no JSON: ${shown(filter)}`);
        }
        if (typeof parsed === 'string') {
            throw new TypeError(`normalizeFilter: the JSON is a text, not a filter: ${shown(parsed)}`);
        }
        return normalizeFilter(parsed);
    }
    if (isV5Filter(filter)) {
        return convertV5Filter(filter);
    }
    if (isPlainObject(filter) && V6_KEYS.some((key) => Object.hasOwn(filter, key))) {
        return filter as unknown as FilterExpression;
    }
    throw new TypeError(`normalizeFilter: a filter is a v6 or a v5 filter (an object), not ${shown(filter)}`);
}

/** at most 40 characters of a value, for a message */
function shown(value: unknown): string {
    let text: string;
    try {
        text = typeof value === 'string' ? `'${value}'` : (JSON.stringify(value) ?? String(value));
    } catch {
        text = Object.prototype.toString.call(value);
    }
    return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}
