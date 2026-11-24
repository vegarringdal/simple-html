import { describe, expect, it } from 'vitest';
import { convertGridConfig } from '../../grid/configVersion';
import { convertV5Filter, isV5Filter, normalizeFilter, V5_MAX_DEPTH } from '../v5Filter';

/**
 * The filters of v5 as filters of v6 (v5Filter.ts): convertV5Filter, isV5Filter, normalizeFilter - for
 * links, bookmarks and saved configs of before, in the browser and on a backend
 */

const v5 = {
    type: 'GROUP',
    logicalOperator: 'AND',
    filterArguments: [
        {
            type: 'CONDITION',
            logicalOperator: 'NONE',
            attribute: 'age',
            attributeType: 'number',
            operator: 'GREATER_THAN',
            value: 18,
            valueType: 'VALUE'
        },
        {
            type: 'GROUP',
            logicalOperator: 'OR',
            filterArguments: [
                { attribute: 'country', operator: 'EQUAL', value: 'Norway' },
                { attribute: 'country', operator: 'EQUAL', value: 'Sweden' }
            ]
        }
    ]
};

const v6 = {
    group: 'AND',
    children: [
        { field: 'age', operator: 'GREATER_THAN', value: 18 },
        {
            group: 'OR',
            children: [
                { field: 'country', operator: 'EQUAL', value: 'Norway' },
                { field: 'country', operator: 'EQUAL', value: 'Sweden' }
            ]
        }
    ]
};

describe('convertV5Filter', () => {
    it('expect groups and conditions as v6: the AND and OR groups, attribute as field, attributeType dropped', () => {
        expect(convertV5Filter(v5)).toEqual(v6);
    });

    it('expect a value of another field (valueType ATTRIBUTE) as valueField, a condition without a value as it is', () => {
        expect(convertV5Filter({ attribute: 'age', operator: 'LESS_THAN', value: 'minAge', valueType: 'ATTRIBUTE' })).toEqual({
            field: 'age',
            operator: 'LESS_THAN',
            valueField: 'minAge'
        });
        expect(convertV5Filter({ attribute: 'email', operator: 'IS_BLANK' })).toEqual({ field: 'email', operator: 'IS_BLANK' });
        expect(convertV5Filter({ attribute: 'age', operator: 'BETWEEN', value: [1, 5] })).toEqual({
            field: 'age',
            operator: 'BETWEEN',
            value: [1, 5]
        });
    });

    it('expect anything but OR to be AND, an incomplete condition left out (v5 ignored it), null for none', () => {
        expect(
            convertV5Filter({
                logicalOperator: 'NONE',
                filterArguments: [{ attribute: 'age' }, { operator: 'EQUAL', value: 1 }, { attribute: '', operator: 'EQUAL' }]
            })
        ).toEqual({ group: 'AND', children: [] });
        expect(convertV5Filter({ attribute: 'age', operator: null })).toBeNull();
        expect(convertV5Filter(null)).toBeNull();
        expect(convertV5Filter(undefined)).toBeNull();
    });

    it('expect what is no v5 filter to throw a TypeError, the place in the filter named', () => {
        expect(() => convertV5Filter('age')).toThrow("convertV5Filter: filter is a v5 condition or group (an object), not 'age'");
        expect(() => convertV5Filter({ filterArguments: 'x' })).toThrow('convertV5Filter: filter.filterArguments is an array');
        expect(() => convertV5Filter({ filterArguments: [1] })).toThrow('filter.filterArguments[0] is a v5 condition or group');
        expect(() => convertV5Filter({ attribute: 'age', operator: 'DROP TABLE' })).toThrow(
            `convertV5Filter: filter.operator is no operator: 'DROP TABLE'`
        );
        expect(() => convertV5Filter({ attribute: 7, operator: 'EQUAL' })).toThrow(TypeError);
        expect(() => convertV5Filter({ attribute: 'age', operator: 'BETWEEN', value: 3 })).toThrow('of BETWEEN is [from, to]');
        expect(() => convertV5Filter({ attribute: 'age', operator: 'EQUAL', value: 3, valueType: 'ATTRIBUTE' })).toThrow(
            "(valueType 'ATTRIBUTE')"
        );
    });

    it('expect groups nested deeper than the limit to throw a RangeError, not to run out of stack', () => {
        let deep: Record<string, unknown> = { attribute: 'a', operator: 'EQUAL', value: 1 };
        for (let i = 0; i < V5_MAX_DEPTH; i++) {
            deep = { filterArguments: [deep] };
        }
        expect(() => convertV5Filter(deep)).toThrow(RangeError);
        expect(() => convertV5Filter((deep.filterArguments as unknown[])[0])).not.toThrow();
    });

    it('expect convertGridConfig to convert the filter of a v5 config with it', () => {
        const converted = convertGridConfig({
            attributes: [{ attribute: 'age' }],
            columnsCenter: [{ rows: ['age'], width: 100 }],
            filter: v5
        });
        expect(converted.state?.filter).toEqual(v6);
    });
});

describe('isV5Filter', () => {
    it('expect a v5 group and condition, not a v6 one, nor what is no filter', () => {
        expect(isV5Filter(v5)).toBe(true);
        expect(isV5Filter({ attribute: 'age', operator: 'EQUAL', value: 1 })).toBe(true);
        expect(isV5Filter({ type: 'CONDITION' })).toBe(true);
        expect(isV5Filter({ logicalOperator: 'AND', filterArguments: [] })).toBe(true);
        expect(isV5Filter(v6)).toBe(false);
        expect(isV5Filter({ field: 'age', operator: 'EQUAL', value: 1 })).toBe(false);
        // both: not a v5 one
        expect(isV5Filter({ field: 'age', attribute: 'age' })).toBe(false);
        for (const value of [null, undefined, 'x', 1, [], [v5], {}]) {
            expect(isV5Filter(value)).toBe(false);
        }
    });
});

describe('normalizeFilter', () => {
    it('expect a v5 filter converted, a v6 one as it is (the same object), none as null', () => {
        expect(normalizeFilter(v5)).toEqual(v6);
        expect(normalizeFilter(v6)).toBe(v6);
        const condition = { field: 'age', operator: 'EQUAL', value: 1 };
        expect(normalizeFilter(condition)).toBe(condition);
        expect(normalizeFilter(null)).toBeNull();
        expect(normalizeFilter(undefined)).toBeNull();
        expect(normalizeFilter('')).toBeNull();
    });

    it('expect JSON text of either shape read (a link), null as JSON too', () => {
        expect(normalizeFilter(JSON.stringify(v5))).toEqual(v6);
        expect(normalizeFilter(JSON.stringify(v6))).toEqual(v6);
        expect(normalizeFilter('null')).toBeNull();
    });

    it('expect what is neither to throw a TypeError: not taken as no filter', () => {
        expect(() => normalizeFilter('{age')).toThrow("normalizeFilter: the text is no JSON: '{age'");
        expect(() => normalizeFilter('"x"')).toThrow('the JSON is a text');
        expect(() => normalizeFilter(5)).toThrow('normalizeFilter: a filter is a v6 or a v5 filter (an object), not 5');
        expect(() => normalizeFilter([v6])).toThrow(TypeError);
        expect(() => normalizeFilter({ name: 'x' })).toThrow(TypeError);
        expect(() => normalizeFilter({ attribute: 'a', operator: 'NOPE' })).toThrow('convertV5Filter');
    });
});
