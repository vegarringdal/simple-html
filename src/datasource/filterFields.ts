import type { FilterExpression } from './filterExpression';

/**
 * A filter without the conditions on some fields - the calculated columns, the fields a backend does not
 * have - for a backend that filters the rest. The browser filters on all of it; the backend's part must
 * let every row through that the whole filter lets through, so a condition taken out matches every row:
 *
 * - in an AND group it is left out: `a AND calc` is `a`
 * - an OR group with one is left out whole: `a OR calc` can be true for any row
 * - a group left with nothing, and the top, is `null`: no filter
 *
 * The backend then sends some rows the browser's filter drops, never fewer. A condition is taken out when
 * its `field` or its `valueField` is one of the fields. This file has no DOM: the sql entry
 * (`@simple-html/grid/sql`) bundles it.
 *
 * @param filter the filter: `datasource.getFilter()`, null for none
 * @param fields the fields whose conditions go - a list, a Set, or a function true for each of them
 * @returns the filter without them, a copy where something was taken out - null when nothing is left
 *
 * @example
 * ```ts
 * import { withoutFields } from '@simple-html/grid'; // or '@simple-html/grid/sql' on a backend
 *
 * const calculated = Object.keys(gridInterface.getState().calculatedColumns); // ['total']
 * withoutFields(datasource.getFilter(), calculated);
 * // AND(country = Norway, total > 100)  -> country = Norway
 * // OR(country = Norway, total > 100)   -> null: any row can have a total over 100
 * ```
 */
export function withoutFields(
    filter: FilterExpression | null | undefined,
    fields: Iterable<string> | ((field: string) => boolean)
): FilterExpression | null {
    if (!filter) {
        return null;
    }
    const set = typeof fields === 'function' ? null : new Set(fields);
    const goes = (field: string | undefined) =>
        field !== undefined && (set ? set.has(field) : (fields as (field: string) => boolean)(field));
    return strip(filter, goes);
}

/** the filter without the conditions `goes` is true for - null: it matches every row */
function strip(node: FilterExpression, goes: (field: string | undefined) => boolean): FilterExpression | null {
    if ('children' in node) {
        // an empty group filters out nothing: as it is
        if (!node.children.length) {
            return node;
        }
        const children: FilterExpression[] = [];
        for (const child of node.children) {
            const left = strip(child, goes);
            if (left === null) {
                // a child that matches every row: an OR of it does too
                if (node.group === 'OR') {
                    return null;
                }
                continue;
            }
            children.push(left);
        }
        if (!children.length) {
            return null;
        }
        return children.length === node.children.length && children.every((child, index) => child === node.children[index])
            ? node
            : { ...node, children };
    }
    return goes(node.field) || goes(node.valueField) ? null : node;
}
