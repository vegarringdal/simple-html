import { describe, expect, it } from 'vitest';
import { DataContainer } from '../dataContainer';
import { Datasource } from '../dataSource';
import { and, type FilterCondition, type FilterExpression, type FilterGroup, or, where } from '../filterExpression';

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
        // an empty condition, as plain js or the filter editor's "add condition" can leave it
        ds.filter(and({} as FilterCondition, where('a', 'EQUAL', 'x'), or()));

        // used to render the blank condition as "[UNDEFINED] <<UNDEFINED>> ''"
        expect(ds.getFilterString()).toEqual("([A] <<EQUAL_TO>> 'X')");
    });

    it('expect a group without `group` to show as AND, which is what the filter runs', () => {
        const ds = new Datasource();
        ds.setData(rows());
        // only plain js can leave `group` out
        ds.filter({ children: [where('a', 'EQUAL', 'x'), where('g', 'EQUAL', 'one')] } as FilterGroup);

        expect(ds.getFilterString()).toEqual("([A] <<EQUAL_TO>> 'X' AND [G] <<EQUAL_TO>> 'ONE')");
    });

    it('expect a field without a label to show its own name, a label from fields, or what label() gives', () => {
        const filter: FilterExpression = and(where('a', 'EQUAL', 'x'));

        const ds = new Datasource();
        ds.setData(rows());
        ds.filter(filter);
        expect(ds.getFilterString()).toEqual("([A] <<EQUAL_TO>> 'X')");

        const labelled = new Datasource({ fields: { a: { label: 'Letter' } } });
        labelled.setData(rows());
        labelled.filter(filter);
        expect(labelled.getFilterString()).toEqual("([LETTER] <<EQUAL_TO>> 'X')");
        // the grid passes its column labels, it used to pass the grid itself
        expect(labelled.getFilterString((field) => `column ${field}`)).toEqual("([COLUMN A] <<EQUAL_TO>> 'X')");
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
