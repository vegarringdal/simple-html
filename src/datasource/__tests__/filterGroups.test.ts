import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

/**
 * - a group without logicalOperator is AND, as documented on FilterArgument
 * - empty groups and incomplete conditions (no attribute or no operator) are ignored: they never
 *   restrict rows, whatever the parent operator is
 * - getFilterTree shows an empty group as a group with no children, never as a condition
 */

const data = () => [
    { a: 'x', b: 'y' },
    { a: 'x', b: 'q' },
    { a: 'z', b: 'y' }
];

const rows = (ds: Datasource) => ds.getRows().map((r) => `${r.a}${r.b}`);

const filtered = (filter: any) => {
    const ds = new Datasource();
    ds.setData(data());
    ds.filter(filter);
    return ds;
};

const aIsX = { type: 'CONDITION', attribute: 'a', operator: 'EQUAL', value: 'x', attributeType: 'text' };
const bIsY = { type: 'CONDITION', attribute: 'b', operator: 'EQUAL', value: 'y', attributeType: 'text' };

describe('filter groups - default logical operator', () => {
    it('expect a top group without logicalOperator to be AND', () => {
        expect(rows(filtered({ filterArguments: [aIsX, bIsY] }))).toEqual(['xy']);
    });

    it('expect a nested group without logicalOperator to be AND', () => {
        const ds = filtered({ type: 'GROUP', logicalOperator: 'OR', filterArguments: [{ filterArguments: [aIsX, bIsY] }] });
        expect(rows(ds)).toEqual(['xy']);
    });
});

describe('filter groups - group or condition', () => {
    it('expect a condition without type that has a logicalOperator to still be a condition', () => {
        // only a filterArguments array makes it a group, as documented on FilterArgument
        const aIsXNoType = { attribute: 'a', operator: 'EQUAL', value: 'x', attributeType: 'text', logicalOperator: 'AND' };
        expect(rows(filtered({ logicalOperator: 'AND', filterArguments: [aIsXNoType] }))).toEqual(['xy', 'xq']);
    });

    it('expect an empty filterArguments array without type to be an (ignored) group', () => {
        expect(rows(filtered({ logicalOperator: 'AND', filterArguments: [aIsX, { filterArguments: [] }] }))).toEqual([
            'xy',
            'xq'
        ]);
    });
});

describe('filter groups - empty groups and incomplete conditions are ignored', () => {
    it('expect an empty OR group in an AND group to not remove every row', () => {
        const ds = filtered({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [{ type: 'GROUP', logicalOperator: 'OR', filterArguments: [] }]
        });
        expect(rows(ds)).toEqual(['xy', 'xq', 'zy']);
    });

    it('expect an empty AND group in an OR group to not match every row', () => {
        const ds = filtered({
            type: 'GROUP',
            logicalOperator: 'OR',
            filterArguments: [aIsX, { type: 'GROUP', logicalOperator: 'AND', filterArguments: [] }]
        });
        expect(rows(ds)).toEqual(['xy', 'xq']);
    });

    it('expect a group holding only empty groups to be ignored', () => {
        const ds = filtered({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [
                aIsX,
                {
                    type: 'GROUP',
                    logicalOperator: 'AND',
                    filterArguments: [{ type: 'GROUP', logicalOperator: 'OR', filterArguments: [] }]
                }
            ]
        });
        expect(rows(ds)).toEqual(['xy', 'xq']);
    });

    it('expect a condition without attribute or operator to be ignored in an AND group', () => {
        const ds = filtered({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [aIsX, { type: 'CONDITION' }, { type: 'CONDITION', attribute: 'b' }]
        });
        expect(rows(ds)).toEqual(['xy', 'xq']);
    });
});

describe('filter groups - getFilterTree', () => {
    it('expect an empty group to be a group with no children', () => {
        const ds = filtered({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [aIsX, { type: 'GROUP', logicalOperator: 'OR', filterArguments: [] }]
        });
        const tree = ds.getFilterTree()!;
        expect(tree.children[1]).toEqual({ kind: 'group', logicalOperator: 'OR', children: [] });
    });

    it('expect incomplete conditions to be left out, like the filter ignores them', () => {
        const ds = filtered({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [aIsX, { type: 'CONDITION' }]
        });
        const tree = ds.getFilterTree()!;
        expect(tree.children.length).toEqual(1);
        expect(tree.children[0]).toMatchObject({ kind: 'condition', label: 'a', operator: 'EQUAL' });
    });
});
