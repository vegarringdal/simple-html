import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { type FilterCondition, type FilterOperator, where } from '../filterExpression';

/**
 * `literal: true` on a condition (FilterCondition.literal): `*`, `%` and `_` of a text value are
 * characters, not wildcards - the text is matched as it is. Find's getFindFilter() makes its conditions
 * with it. The SQL of it is compared with the grid on SQLite in src/sql/__tests__/sqlSqlite.test.ts.
 */

const NAMES = ['50% off', '500', '5', 'a_b', 'axb', 'a*b', 'aXb', 'A_B', '*', '%', '_', '', null, 'a\nb', 'tab_end'];

function namesOf(condition: FilterCondition): unknown[] {
    const datasource = new Datasource({ fields: { age: 'number' } });
    datasource.setData(NAMES.map((name, id) => ({ id, name, age: id })));
    datasource.filter(condition);
    return datasource.getRows().map((row) => row.name);
}

describe('filter - a literal condition', () => {
    it('expect the wildcards as characters with every operator that matches a pattern', () => {
        const cases: [FilterOperator, string, unknown[]][] = [
            ['CONTAINS', '50%', ['50% off']],
            ['CONTAINS', '_', ['a_b', 'A_B', '_', 'tab_end']],
            ['CONTAINS', '*', ['a*b', '*']],
            ['EQUAL', 'a_b', ['a_b', 'A_B']],
            ['EQUAL', '%', ['%']],
            ['BEGIN_WITH', '5', ['50% off', '500', '5']],
            ['BEGIN_WITH', 'a_', ['a_b', 'A_B']],
            ['END_WITH', '_b', ['a_b', 'A_B']],
            ['NOT_EQUAL_TO', 'a_b', ['50% off', '500', '5', 'axb', 'a*b', 'aXb', '*', '%', '_', '', null, 'a\nb', 'tab_end']],
            ['DOES_NOT_CONTAIN', '_', ['50% off', '500', '5', 'axb', 'a*b', 'aXb', '*', '%', '', null, 'a\nb']]
        ];
        for (const [operator, value, names] of cases) {
            expect(namesOf({ field: 'name', operator, value, literal: true }), `${operator} ${value}`).toEqual(names);
        }
        // and without: wildcards
        expect(namesOf({ field: 'name', operator: 'CONTAINS', value: '50%' })).toEqual(['50% off', '500']);
        // `_` is any one character, a line break too
        expect(namesOf({ field: 'name', operator: 'EQUAL', value: 'a_b' })).toEqual(['a_b', 'axb', 'a*b', 'aXb', 'A_B', 'a\nb']);
        expect(namesOf({ field: 'name', operator: 'CONTAINS', value: '*' })).toHaveLength(NAMES.length);
    });

    it('expect caseSensitive with it, and a text without wildcards to match as before', () => {
        expect(namesOf({ field: 'name', operator: 'CONTAINS', value: 'A_', literal: true, caseSensitive: true })).toEqual([
            'A_B'
        ]);
        expect(namesOf({ field: 'name', operator: 'CONTAINS', value: 'xb', literal: true })).toEqual(['axb', 'aXb']);
        expect(namesOf({ field: 'name', operator: 'CONTAINS', value: 'a\nb', literal: true })).toEqual(['a\nb']);
    });

    it('expect it ignored where there are no wildcards: IN, a number field, literal false', () => {
        expect(namesOf({ field: 'name', operator: 'IN', value: ['a_b', '%'], literal: true })).toEqual(['a_b', 'A_B', '%']);
        expect(namesOf({ field: 'age', operator: 'GREATER_THAN', value: 12, literal: true })).toEqual(['a\nb', 'tab_end']);
        expect(namesOf({ field: 'name', operator: 'CONTAINS', value: '50%', literal: false })).toEqual(['50% off', '500']);
    });

    it('expect where() to make it with { literal: true }, and leave it out else', () => {
        expect(where('name', 'CONTAINS', '50%', { literal: true })).toEqual({
            field: 'name',
            operator: 'CONTAINS',
            value: '50%',
            literal: true
        });
        expect(where('name', 'CONTAINS', 'a', { caseSensitive: true, literal: true })).toEqual({
            field: 'name',
            operator: 'CONTAINS',
            value: 'a',
            caseSensitive: true,
            literal: true
        });
        expect(where('name', 'CONTAINS', '50%', { literal: false })).toEqual({
            field: 'name',
            operator: 'CONTAINS',
            value: '50%'
        });
    });
});
