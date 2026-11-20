import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';

/**
 * Bugs found while turning on TypeScript strict mode.
 */

const rows = () => [
    { a: 'x', g: 'one' },
    { a: 'y', g: 'two' }
];

describe('getFilterString - same rules as the filter itself', () => {
    it('expect incomplete conditions and empty groups to be left out', () => {
        const ds = new Datasource();
        ds.setData(rows());
        ds.filter({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [
                { type: 'CONDITION' },
                { type: 'CONDITION', attribute: 'a', operator: 'EQUAL', value: 'x', attributeType: 'text' },
                { type: 'GROUP', logicalOperator: 'OR', filterArguments: [] }
            ]
        });

        // used to render the blank condition as "[UNDEFINED] <<UNDEFINED>> ''"
        expect(ds.getFilterString()).toEqual("([A] <<EQUAL_TO>> 'X')");
    });

    it('expect a group without logicalOperator to show as AND, which is what the filter runs', () => {
        const ds = new Datasource();
        ds.setData(rows());
        ds.filter({
            filterArguments: [
                { attribute: 'a', operator: 'EQUAL', value: 'x', attributeType: 'text' },
                { attribute: 'g', operator: 'EQUAL', value: 'one', attributeType: 'text' }
            ]
        });

        expect(ds.getFilterString()).toEqual("([A] <<EQUAL_TO>> 'X' AND [G] <<EQUAL_TO>> 'ONE')");
    });

    it('expect an attribute missing from the grid config to show its own name', () => {
        const ds = new Datasource();
        ds.setData(rows());
        ds.filter({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [{ type: 'CONDITION', attribute: 'a', operator: 'EQUAL', value: 'x', attributeType: 'text' }]
        });
        const gridWithoutA = { gridInterface: { __getGridConfig: () => ({ __attributes: {} }) } } as any;

        expect(ds.getFilterString(gridWithoutA)).toEqual("([A] <<EQUAL_TO>> 'X')");
    });
});

describe('grouping set but not applied yet', () => {
    it('expect expandGroup and collapseGroup to do nothing until the grouping is applied', () => {
        const ds = new Datasource();
        ds.setData(rows());
        ds.setGrouping([{ attribute: 'g', title: 'g' }]);

        // used to throw: the groups only exist once group() has run
        expect(() => ds.expandGroup()).not.toThrow();
        expect(() => ds.collapseGroup()).not.toThrow();
        expect(ds.getRows().map((r) => r.a)).toEqual(['x', 'y']);
    });
});

describe('DataContainer.replace', () => {
    it('expect replaced rows to get a key, so setErrors works', () => {
        const container = new DataContainer();
        container.setData(rows());

        container.replace([{ a: 'z', g: 'three' }], 0, 1);
        const replaced = container.getDataSet()[0];

        expect(replaced.__KEY).not.toBeUndefined();
        expect(() => container.setErrors(new Map([[String(replaced.__KEY), 'wrong']]))).not.toThrow();
        expect(replaced.__rowError).toEqual('wrong');
    });
});
