import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import type { FilterCondition, FilterOperator } from '../filterExpression';
import { escapeTextPattern, textPatternParts } from '../textPattern';

/**
 * The escape `\` of a text filter value (textPattern.ts): `\*`, `\%`, `\_` and `\\` are the character
 * itself, the wildcards without it stay wildcards. The SQL of it is compared with the grid on SQLite in
 * src/sql/__tests__/sqlSqlite.test.ts, its pattern per dialect in toSqlWhere.test.ts.
 */

const NAMES = ['S__den', 'Sweden', 'S_den', '50% off', '500', '50%', 'a*b', 'axb', 'a\\b', 'a\\_b', 'C:\\temp', '\\', null];

function namesOf(condition: FilterCondition): unknown[] {
    const datasource = new Datasource();
    datasource.setData(NAMES.map((name, id) => ({ id, name })));
    datasource.filter(condition);
    return datasource.getRows().map((row) => row.name);
}
const named = (operator: FilterOperator, value: string) => namesOf({ field: 'name', operator, value });

describe('textPatternParts', () => {
    it('expect plain text, wildcards and escaped characters', () => {
        expect(textPatternParts('S\\_\\_den*')).toEqual([
            { type: 'text', text: 'S' },
            { type: 'char', char: '_' },
            { type: 'char', char: '_' },
            { type: 'text', text: 'den' },
            { type: 'wildcard', wildcard: '*' }
        ]);
        expect(textPatternParts('50\\%%_')).toEqual([
            { type: 'text', text: '50' },
            { type: 'char', char: '%' },
            { type: 'wildcard', wildcard: '%' },
            { type: 'wildcard', wildcard: '_' }
        ]);
    });

    it('expect \\\\ to be one backslash, a backslash before anything else or at the end a backslash', () => {
        expect(textPatternParts('a\\\\*')).toEqual([
            { type: 'text', text: 'a\\' },
            { type: 'wildcard', wildcard: '*' }
        ]);
        expect(textPatternParts('C:\\temp\\')).toEqual([{ type: 'text', text: 'C:\\temp\\' }]);
        expect(textPatternParts('')).toEqual([]);
    });

    it('expect literal to take all of it as it is: wildcards as characters, the backslash too', () => {
        expect(textPatternParts('a\\_*', true)).toEqual([
            { type: 'text', text: 'a\\' },
            { type: 'char', char: '_' },
            { type: 'char', char: '*' }
        ]);
    });

    it('expect escapeTextPattern to give a value that matches the text as it is', () => {
        expect(escapeTextPattern('50% off_*\\')).toEqual('50\\% off\\_\\*\\\\');
        for (const name of NAMES.filter((n) => n !== null) as string[]) {
            expect(named('EQUAL', escapeTextPattern(name)), name).toEqual([name]);
        }
    });
});

describe('filter - the escape \\ in a text value', () => {
    it('expect `_` to stay one character, `\\_` to be an underscore', () => {
        expect(named('EQUAL', 'S__den')).toEqual(['S__den', 'Sweden']);
        expect(named('EQUAL', 'S\\_\\_den')).toEqual(['S__den']);
        expect(named('EQUAL', 'S\\__den')).toEqual(['S__den']);
        expect(named('CONTAINS', '\\_')).toEqual(['S__den', 'S_den', 'a\\_b']);
    });

    it('expect `\\%` and `\\*` to be the character, next to a wildcard', () => {
        expect(named('CONTAINS', '50%')).toEqual(['50% off', '500', '50%']);
        expect(named('CONTAINS', '50\\%')).toEqual(['50% off', '50%']);
        expect(named('EQUAL', '50\\%')).toEqual(['50%']);
        expect(named('BEGIN_WITH', '50\\%')).toEqual(['50% off', '50%']);
        expect(named('EQUAL', '50\\%*')).toEqual(['50% off', '50%']);
        expect(named('EQUAL', 'a\\*b')).toEqual(['a*b']);
        expect(named('EQUAL', 'a*b')).toEqual(['a*b', 'axb', 'a\\b', 'a\\_b']);
    });

    it('expect a backslash: `\\\\` one, before another letter itself, with literal as it is', () => {
        expect(named('EQUAL', 'C:\\temp')).toEqual(['C:\\temp']);
        expect(named('EQUAL', 'a\\\\b')).toEqual(['a\\b']);
        expect(named('EQUAL', 'a\\b')).toEqual(['a\\b']);
        expect(named('EQUAL', '\\')).toEqual(['\\']);
        expect(named('EQUAL', '\\\\')).toEqual(['\\']);
        // a\\_ : `a\`, then any one character
        expect(named('BEGIN_WITH', 'a\\\\_')).toEqual(['a\\b', 'a\\_b']);
        expect(named('EQUAL', 'a\\\\_b')).toEqual(['a\\_b']);
        expect(namesOf({ field: 'name', operator: 'EQUAL', value: 'a\\_b', literal: true })).toEqual(['a\\_b']);
    });

    it('expect NOT_EQUAL_TO and DOES_NOT_CONTAIN to be the other rows', () => {
        expect(named('NOT_EQUAL_TO', 'S\\_\\_den')).toEqual(NAMES.filter((n) => n !== 'S__den'));
        expect(named('DOES_NOT_CONTAIN', '\\%')).toEqual(NAMES.filter((n) => !n?.includes('%')));
    });
});
