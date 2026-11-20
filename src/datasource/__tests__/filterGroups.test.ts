import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { and, type FilterCondition, type FilterExpression, type FilterGroup, or, where } from '../filterExpression';

/**
 * - a group is what has a `children` array. Anything but `group: 'OR'` is AND, so plain js that
 *   leaves `group` out gets AND
 * - empty groups and incomplete conditions (no field or no operator) are ignored: they never
 *   restrict rows, whatever the parent group is
 * - getFilterTree shows an empty group as a group with no children, never as a condition
 *
 * The casts are plain js input: the types do not allow these shapes.
 */

const data = () => [
    { a: 'x', b: 'y' },
    { a: 'x', b: 'q' },
    { a: 'z', b: 'y' }
];

const rows = (ds: Datasource) => ds.getRows().map((r) => `${r.a}${r.b}`);

const filtered = (filter: FilterExpression) => {
    const ds = new Datasource();
    ds.setData(data());
    ds.filter(filter);
    return ds;
};

const aIsX = where('a', 'EQUAL', 'x');
const bIsY = where('b', 'EQUAL', 'y');

describe('filter groups - default group operator', () => {
    it('expect a top group without `group` to be AND', () => {
        expect(rows(filtered({ children: [aIsX, bIsY] } as FilterGroup))).toEqual(['xy']);
    });

    it('expect a nested group without `group` to be AND', () => {
        const ds = filtered(or({ children: [aIsX, bIsY] } as FilterGroup));
        expect(rows(ds)).toEqual(['xy']);
    });
});

describe('filter groups - group or condition', () => {
    it('expect a condition that also has a `group` to still be a condition', () => {
        // only a children array makes it a group
        const aIsXWithGroup = { field: 'a', operator: 'EQUAL', value: 'x', group: 'AND' } as FilterCondition;
        expect(rows(filtered(and(aIsXWithGroup)))).toEqual(['xy', 'xq']);
    });

    it('expect an empty children array to be an (ignored) group', () => {
        expect(rows(filtered(and(aIsX, and())))).toEqual(['xy', 'xq']);
    });
});

describe('filter groups - empty groups and incomplete conditions are ignored', () => {
    it('expect an empty OR group in an AND group to not remove every row', () => {
        const ds = filtered(and(or()));
        expect(rows(ds)).toEqual(['xy', 'xq', 'zy']);
    });

    it('expect an empty AND group in an OR group to not match every row', () => {
        const ds = filtered(or(aIsX, and()));
        expect(rows(ds)).toEqual(['xy', 'xq']);
    });

    it('expect a group holding only empty groups to be ignored', () => {
        const ds = filtered(and(aIsX, and(or())));
        expect(rows(ds)).toEqual(['xy', 'xq']);
    });

    it('expect a condition without field or operator to be ignored in an AND group', () => {
        const ds = filtered(and(aIsX, {} as FilterCondition, { field: 'b' } as FilterCondition));
        expect(rows(ds)).toEqual(['xy', 'xq']);
    });

    it('expect a condition without field or operator to be ignored in an OR group', () => {
        const ds = filtered(or(aIsX, { operator: 'EQUAL', value: 'z' } as FilterCondition));
        expect(rows(ds)).toEqual(['xy', 'xq']);
    });
});

describe('filter groups - getFilterTree', () => {
    it('expect an empty group to be a group with no children', () => {
        const ds = filtered(and(aIsX, or()));
        const tree = ds.getFilterTree()!;
        expect(tree.children[1]).toEqual({ kind: 'group', logicalOperator: 'OR', children: [] });
    });

    it('expect incomplete conditions to be left out, like the filter ignores them', () => {
        const ds = filtered(and(aIsX, {} as FilterCondition));
        const tree = ds.getFilterTree()!;
        expect(tree.children.length).toEqual(1);
        expect(tree.children[0]).toMatchObject({ kind: 'condition', label: 'a', operator: 'EQUAL' });
    });
});
