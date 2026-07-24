import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

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
        ds.filter({ attribute: 'name', operator: 'EQUAL', value: 'person1' });
        expect(ds.getFilterString()).toEqual("([name] <<equal_to>> 'person1')".toUpperCase());
    });

    it('2 attributes, default to and', () => {
        ds.filter([
            { attribute: 'group', operator: 'EQUAL', value: 'group1' },
            { attribute: 'name', operator: 'EQUAL', value: 'person1' }
        ]);
        expect(ds.getFilterString()).toEqual("([group] <<equal_to>> 'group1' AND [name] <<equal_to>> 'person1')".toUpperCase());
    });

    it('or statement', () => {
        ds.filter({
            logicalOperator: 'OR',
            filterArguments: [
                { attribute: 'group', operator: 'EQUAL', value: 'group1' },
                { attribute: 'name', operator: 'EQUAL', value: 'person1' }
            ]
        });
        expect(ds.getFilterString()).toEqual("([group] <<equal_to>> 'group1' OR [name] <<equal_to>> 'person1')".toUpperCase());
    });

    it('or statement with sub and statements', () => {
        ds.filter({
            logicalOperator: 'OR',
            filterArguments: [
                {
                    logicalOperator: 'AND',
                    filterArguments: [
                        { attribute: 'group', operator: 'EQUAL', value: 'group2' },
                        { attribute: 'name', operator: 'EQUAL', value: 'person2' }
                    ]
                },
                {
                    logicalOperator: 'AND',
                    filterArguments: [
                        { attribute: 'group', operator: 'EQUAL', value: 'group1' },
                        { attribute: 'name', operator: 'EQUAL', value: 'person4' }
                    ]
                }
            ]
        });
        expect(ds.getFilterString()).toEqual(
            "(([group] <<equal_to>> 'group2' AND [name] <<equal_to>> 'person2') OR ([group] <<equal_to>> 'group1' AND [name] <<equal_to>> 'person4'))".toUpperCase()
        );
    });

    it('and statement with sub or statements', () => {
        ds.filter({
            logicalOperator: 'AND',
            filterArguments: [
                {
                    logicalOperator: 'OR',
                    filterArguments: [
                        { attribute: 'group', operator: 'EQUAL', value: 'group1' },
                        { attribute: 'name', operator: 'EQUAL', value: 'person2' }
                    ]
                },
                {
                    logicalOperator: 'OR',
                    filterArguments: [
                        { attribute: 'group', operator: 'EQUAL', value: 'group2' },
                        { attribute: 'name', operator: 'EQUAL', value: 'person4' }
                    ]
                }
            ]
        });
        expect(ds.getFilterString()).toEqual(
            "(([group] <<equal_to>> 'group1' OR [name] <<equal_to>> 'person2') AND ([group] <<equal_to>> 'group2' OR [name] <<equal_to>> 'person4'))".toUpperCase()
        );
    });

    it('or statement with sub and statements', () => {
        ds.filter({
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: [
                {
                    type: 'CONDITION',
                    logicalOperator: 'NONE',
                    valueType: 'VALUE',
                    attribute: 'word5',
                    attributeType: 'text',
                    operator: 'BEGIN_WITH',
                    value: 'c'
                },
                {
                    type: 'CONDITION',
                    logicalOperator: 'NONE',
                    valueType: 'VALUE',
                    attribute: 'word7',
                    attributeType: 'text',
                    operator: 'BEGIN_WITH',
                    value: 'c'
                },
                {
                    type: 'GROUP',
                    logicalOperator: 'AND',
                    attribute: 'select',
                    operator: 'EQUAL',
                    valueType: 'VALUE',
                    attributeType: 'text',
                    filterArguments: [
                        {
                            type: 'CONDITION',
                            logicalOperator: 'NONE',
                            attribute: 'word7',
                            operator: 'CONTAINS',
                            valueType: 'VALUE',
                            filterArguments: [],
                            value: 'c'
                        },
                        {
                            type: 'CONDITION',
                            logicalOperator: 'NONE',
                            attribute: 'word7',
                            operator: 'CONTAINS',
                            valueType: 'VALUE',
                            filterArguments: [],
                            value: 'c'
                        }
                    ],
                    value: ''
                }
            ]
        });
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
        ds2.filter({ attribute: 'name', operator: 'EQUAL', value: 'person1' });
        expect(ds2.getFilterTree()).toEqual({
            kind: 'group',
            logicalOperator: 'AND',
            children: [{ kind: 'condition', label: 'name', operator: 'EQUAL', value: 'person1', hasValue: true }]
        });
    });

    it('group keeps its logical operator', () => {
        ds2.filter({
            logicalOperator: 'OR',
            filterArguments: [
                { attribute: 'group', operator: 'EQUAL', value: 'group1' },
                { attribute: 'name', operator: 'CONTAINS', value: 'person' }
            ]
        });
        expect(ds2.getFilterTree()).toEqual({
            kind: 'group',
            logicalOperator: 'OR',
            children: [
                { kind: 'condition', label: 'group', operator: 'EQUAL', value: 'group1', hasValue: true },
                { kind: 'condition', label: 'name', operator: 'CONTAINS', value: 'person', hasValue: true }
            ]
        });
    });

    it('blank operators carry no value', () => {
        ds2.filter([{ attribute: 'name', operator: 'IS_BLANK' }]);
        expect(ds2.getFilterTree()?.children[0]).toEqual({
            kind: 'condition',
            label: 'name',
            operator: 'IS_BLANK',
            value: '',
            hasValue: false
        });
    });

    it('nested groups preserve their structure', () => {
        ds2.filter({
            logicalOperator: 'OR',
            filterArguments: [
                {
                    logicalOperator: 'AND',
                    filterArguments: [
                        { attribute: 'group', operator: 'EQUAL', value: 'group2' },
                        { attribute: 'name', operator: 'EQUAL', value: 'person2' }
                    ]
                },
                { attribute: 'group', operator: 'EQUAL', value: 'group1' }
            ]
        });
        const tree = ds2.getFilterTree();
        expect(tree?.logicalOperator).toEqual('OR');
        expect(tree?.children[0].kind).toEqual('group');
        expect((tree?.children[0] as { children: unknown[] }).children).toHaveLength(2);
        expect(tree?.children[1]).toEqual({
            kind: 'condition',
            label: 'group',
            operator: 'EQUAL',
            value: 'group1',
            hasValue: true
        });
    });
});
