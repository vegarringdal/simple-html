import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { and, or, where } from '../filterExpression';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { name: 'person2', group: 'group2', age: 23, index: 1 },
    { name: 'person1', group: 'group2', age: 34, index: 2 },
    { name: 'person1', group: 'group1', age: 32, index: 3 },
    { name: 'person1', group: 'group1', age: 56, index: 4 },
    { name: 'person4', group: 'group1', age: 55, index: 5 }
];

let ds: Datasource;

describe('datasource filterstring ', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('single', () => {
        ds.filter(where('name', 'EQUAL', 'person1'));
        expect(ds.getFilterString()).toEqual("([name] <<equal_to>> 'person1')".toUpperCase());
    });

    it('2 attributes, default to and', () => {
        ds.filter(and(where('group', 'EQUAL', 'group1'), where('name', 'EQUAL', 'person1')));
        expect(ds.getFilterString()).toEqual("([group] <<equal_to>> 'group1' AND [name] <<equal_to>> 'person1')".toUpperCase());
    });

    it('or statement', () => {
        ds.filter(or(where('group', 'EQUAL', 'group1'), where('name', 'EQUAL', 'person1')));
        expect(ds.getFilterString()).toEqual("([group] <<equal_to>> 'group1' OR [name] <<equal_to>> 'person1')".toUpperCase());
    });

    it('or statement with sub and statements', () => {
        ds.filter(
            or(
                and(where('group', 'EQUAL', 'group2'), where('name', 'EQUAL', 'person2')),
                and(where('group', 'EQUAL', 'group1'), where('name', 'EQUAL', 'person4'))
            )
        );
        expect(ds.getFilterString()).toEqual(
            "(([group] <<equal_to>> 'group2' AND [name] <<equal_to>> 'person2') OR ([group] <<equal_to>> 'group1' AND [name] <<equal_to>> 'person4'))".toUpperCase()
        );
    });

    it('and statement with sub or statements', () => {
        ds.filter(
            and(
                or(where('group', 'EQUAL', 'group1'), where('name', 'EQUAL', 'person2')),
                or(where('group', 'EQUAL', 'group2'), where('name', 'EQUAL', 'person4'))
            )
        );
        expect(ds.getFilterString()).toEqual(
            "(([group] <<equal_to>> 'group1' OR [name] <<equal_to>> 'person2') AND ([group] <<equal_to>> 'group2' OR [name] <<equal_to>> 'person4'))".toUpperCase()
        );
    });

    it('or statement with sub and statements', () => {
        ds.filter(
            and(
                where('word5', 'BEGIN_WITH', 'c'),
                where('word7', 'BEGIN_WITH', 'c'),
                and(where('word7', 'CONTAINS', 'c'), where('word7', 'CONTAINS', 'c'))
            )
        );
        expect(ds.getFilterString()).toEqual(
            "([word5] <<start_with>> 'c' AND [word7] <<start_with>> 'c' AND ([word7] <<contains>> 'c' AND [word7] <<contains>> 'c'))".toUpperCase()
        );
    });
});

describe('datasource filter tree (footer chips)', () => {
    let ds2: Datasource;
    beforeAll(() => {
        ds2 = new Datasource();
        ds2.setData(simpleArray.slice());
    });

    it('no filter -> null', () => {
        expect(ds2.getFilterTree()).toEqual(null);
    });

    it('single condition -> group with one condition child', () => {
        ds2.filter(where('name', 'EQUAL', 'person1'));
        expect(ds2.getFilterTree()).toEqual({
            kind: 'group',
            group: 'AND',
            children: [{ kind: 'condition', label: 'name', operator: 'EQUAL', value: 'person1', hasValue: true }]
        });
    });

    it('group keeps its logical operator', () => {
        ds2.filter(or(where('group', 'EQUAL', 'group1'), where('name', 'CONTAINS', 'person')));
        expect(ds2.getFilterTree()).toEqual({
            kind: 'group',
            group: 'OR',
            children: [
                { kind: 'condition', label: 'group', operator: 'EQUAL', value: 'group1', hasValue: true },
                { kind: 'condition', label: 'name', operator: 'CONTAINS', value: 'person', hasValue: true }
            ]
        });
    });

    it('blank operators carry no value', () => {
        ds2.filter(and(where('name', 'IS_BLANK')));
        expect(ds2.getFilterTree()?.children[0]).toEqual({
            kind: 'condition',
            label: 'name',
            operator: 'IS_BLANK',
            value: '',
            hasValue: false
        });
    });

    it('nested groups preserve their structure', () => {
        ds2.filter(
            or(and(where('group', 'EQUAL', 'group2'), where('name', 'EQUAL', 'person2')), where('group', 'EQUAL', 'group1'))
        );
        const tree = ds2.getFilterTree();
        expect(tree?.group).toEqual('OR');
        expect(tree?.children[0].kind).toEqual('group');
        expect((tree!.children[0] as { children: unknown[] }).children).toHaveLength(2);
        expect(tree?.children[1]).toEqual({
            kind: 'condition',
            label: 'group',
            operator: 'EQUAL',
            value: 'group1',
            hasValue: true
        });
    });
});

describe('datasource filter tree - formatterOf, a formatter of its own for the values of a field', () => {
    // what the grid passes for a lookup column: the label of a value, the value when it has none
    const names: Record<string, string> = { NO: 'Norway', SE: 'Sweden' };
    const countryName = {
        format: (value: unknown) => names[String(value)] ?? String(value ?? ''),
        parse: (text: string) => text
    };
    const ofCountry = (field: string) => (field === 'country' ? countryName : undefined);

    const datasource = () => {
        const ds = new Datasource({ fields: { age: 'number' } });
        ds.setData([{ country: 'NO', age: 1 }]);
        return ds;
    };
    const values = (ds: Datasource) =>
        ds.getFilterTree(undefined, ofCountry)?.children.map((node) => (node.kind === 'condition' ? node.value : node));

    it('expect the values of IN and NOT_IN to be formatted with it, NULL (the blanks) as it is', () => {
        const ds = datasource();
        ds.filter(and(where('country', 'IN', ['NO', 'SE', 'XX', 'NULL']), where('country', 'NOT_IN', 'SE\nnull')));
        expect(values(ds)).toEqual(['Norway, Sweden, XX, NULL', 'Sweden, null']);
    });

    it('expect the value of a condition to be formatted with it, the other fields with their own', () => {
        const ds = datasource();
        ds.filter(and(where('country', 'EQUAL', 'SE'), where('age', 'GREATER_THAN', 2), where('country', 'IS_BLANK')));
        expect(values(ds)).toEqual(['Sweden', '2', '']);
    });

    it('expect the values of IN as they are without it, and in getFilterString()', () => {
        const ds = datasource();
        ds.filter(where('country', 'IN', ['NO', 'SE']));
        expect(ds.getFilterTree()?.children[0]).toMatchObject({ value: 'NO, SE' });
        expect(ds.getFilterTree(undefined, () => undefined)?.children[0]).toMatchObject({ value: 'NO, SE' });
        expect(ds.getFilterString()).toEqual("([COUNTRY] <<IN>> ['NO','SE'])");
    });
});
