import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import type { FieldType } from '../field';
import { and, type FilterCondition, type FilterExpression, type FilterOperator, operatorsFor, where } from '../filterExpression';

/**
 * Every operator on every field type, with and without `caseSensitive`: the rules of the filtering
 * guide's "Operators", which a backend (the SQL helpers) has to follow too. Each row has an `id`, the
 * tests compare the ids of the rows a filter lets through.
 */

/** the ids of the rows the filter lets through, in the order of the data */
function ids(rows: object[], fields: Record<string, FieldType>, filter: FilterExpression | null): string[] {
    const ds = new Datasource({ fields });
    ds.setData(rows.map((row) => ({ ...row })));
    ds.filter(filter);
    return ds.getDataRows().map((row) => row.id);
}

describe('operatorsFor', () => {
    it('expect the operators of each type, in the order the grid shows them', () => {
        expect(operatorsFor('text')).toEqual([
            'EQUAL',
            'NOT_EQUAL_TO',
            'CONTAINS',
            'DOES_NOT_CONTAIN',
            'BEGIN_WITH',
            'END_WITH',
            'IN',
            'NOT_IN',
            'IS_BLANK',
            'IS_NOT_BLANK'
        ]);
        const range = [
            'EQUAL',
            'NOT_EQUAL_TO',
            'LESS_THAN',
            'LESS_THAN_OR_EQUAL_TO',
            'GREATER_THAN',
            'GREATER_THAN_OR_EQUAL_TO',
            'BETWEEN',
            'IN',
            'NOT_IN',
            'IS_BLANK',
            'IS_NOT_BLANK'
        ];
        expect(operatorsFor('number')).toEqual(range);
        expect(operatorsFor('date')).toEqual(range);
        expect(operatorsFor('datetime')).toEqual(range);
        expect(operatorsFor('boolean')).toEqual(['EQUAL', 'NOT_EQUAL_TO', 'IS_BLANK', 'IS_NOT_BLANK']);
    });

    it('expect a new list each call, and the operators of text for what is no type', () => {
        const list = operatorsFor('text');
        list.pop();
        expect(operatorsFor('text')).toHaveLength(10);
        expect(operatorsFor('nonsense' as FieldType)).toEqual(operatorsFor('text'));
    });
});

describe('where()', () => {
    it('expect caseSensitive only when it is true', () => {
        expect(where('name', 'EQUAL', 'Ann', { caseSensitive: true })).toEqual({
            field: 'name',
            operator: 'EQUAL',
            value: 'Ann',
            caseSensitive: true
        });
        expect('caseSensitive' in where('name', 'EQUAL', 'Ann', { caseSensitive: false })).toBe(false);
        expect('caseSensitive' in where('name', 'EQUAL', 'Ann')).toBe(false);
    });

    it('expect a TypeError for options that are a boolean, and for a BETWEEN that has no [from, to]', () => {
        expect(() => where('name', 'EQUAL', 'Ann', true as any)).toThrow(TypeError);
        expect(() => where('age', 'BETWEEN', 5)).toThrow("where('age', 'BETWEEN', value): value is [from, to]");
        expect(() => where('age', 'BETWEEN', [1, 2, 3])).toThrow(TypeError);
        expect(() => where('age', 'BETWEEN')).toThrow(TypeError);
        // an end can be null, it is open
        expect(where('age', 'BETWEEN', [1, null])).toEqual({ field: 'age', operator: 'BETWEEN', value: [1, null] });
    });
});

describe('text', () => {
    const rows = [
        { id: 'ann', name: 'Ann' },
        { id: 'ANN', name: 'ANN' },
        { id: 'anna', name: 'Anna' },
        { id: 'joanna', name: 'Joanna' },
        { id: 'null', name: null },
        { id: 'empty', name: '' },
        { id: 'zero', name: 0 },
        { id: 'lines', name: 'first\nAnn' }
    ];
    const text = (operator: FilterOperator, value: unknown, caseSensitive = false) =>
        ids(rows, {}, where('name', operator, value, { caseSensitive }));

    it('expect EQUAL to be the whole text, ignoring case - or matching it', () => {
        expect(text('EQUAL', 'ann')).toEqual(['ann', 'ANN']);
        expect(text('EQUAL', 'Ann', true)).toEqual(['ann']);
        expect(text('EQUAL', 'ann', true)).toEqual([]);
    });

    it('expect * and % to be any text, none too, line breaks too', () => {
        expect(text('EQUAL', 'an*')).toEqual(['ann', 'ANN', 'anna']);
        expect(text('EQUAL', 'An%', true)).toEqual(['ann', 'anna']);
        expect(text('EQUAL', '*ann*')).toEqual(['ann', 'ANN', 'anna', 'joanna', 'lines']);
        expect(text('EQUAL', 'first*ann')).toEqual(['lines']);
        expect(text('EQUAL', 'a*n*a')).toEqual(['anna']);
    });

    it('expect the whole value, not a line of it: EQUAL, BEGIN_WITH and END_WITH of a text of several lines', () => {
        expect(text('EQUAL', 'ann')).not.toContain('lines');
        expect(text('BEGIN_WITH', 'ann')).not.toContain('lines');
        expect(text('END_WITH', 'first')).toEqual([]);
        expect(text('END_WITH', 'ann')).toContain('lines');
    });

    it('expect NOT_EQUAL_TO to be the rows EQUAL leaves out, the blanks too', () => {
        expect(text('NOT_EQUAL_TO', 'ann')).toEqual(['anna', 'joanna', 'null', 'empty', 'zero', 'lines']);
        expect(text('NOT_EQUAL_TO', 'Ann', true)).toEqual(['ANN', 'anna', 'joanna', 'null', 'empty', 'zero', 'lines']);
        expect(text('NOT_EQUAL_TO', 'an*')).toEqual(['joanna', 'null', 'empty', 'zero', 'lines']);
    });

    it('expect CONTAINS and DOES_NOT_CONTAIN, ignoring case or matching it', () => {
        expect(text('CONTAINS', 'NN')).toEqual(['ann', 'ANN', 'anna', 'joanna', 'lines']);
        expect(text('CONTAINS', 'NN', true)).toEqual(['ANN']);
        expect(text('DOES_NOT_CONTAIN', 'nn')).toEqual(['null', 'empty', 'zero']);
        expect(text('DOES_NOT_CONTAIN', 'nn', true)).toEqual(['ANN', 'null', 'empty', 'zero']);
        expect(text('CONTAINS', 'o*n')).toEqual(['joanna']);
    });

    it('expect BEGIN_WITH and END_WITH, ignoring case or matching it', () => {
        expect(text('BEGIN_WITH', 'an')).toEqual(['ann', 'ANN', 'anna']);
        expect(text('BEGIN_WITH', 'AN', true)).toEqual(['ANN']);
        expect(text('END_WITH', 'NA')).toEqual(['anna', 'joanna']);
        expect(text('END_WITH', 'na', true)).toEqual(['anna', 'joanna']);
        expect(text('END_WITH', 'NA', true)).toEqual([]);
    });

    it('expect the rest of the value to be taken as it is: no regular expression, no escape', () => {
        const signs = [
            { id: 'dot', name: 'a.b' },
            { id: 'ab', name: 'axb' },
            { id: 'paren', name: '(x)' },
            { id: 'star', name: 'a*b' }
        ];
        expect(ids(signs, {}, where('name', 'EQUAL', 'a.b'))).toEqual(['dot']);
        expect(ids(signs, {}, where('name', 'CONTAINS', '(x'))).toEqual(['paren']);
        // a * is always a wildcard
        expect(ids(signs, {}, where('name', 'EQUAL', 'a*b'))).toEqual(['dot', 'ab', 'star']);
    });

    it('expect _ to be one character, any - as in SQL LIKE', () => {
        const codes = [
            { id: 'pump', name: 'PUMP-01' },
            { id: 'pumpAB', name: 'pump-ab' },
            { id: 'short', name: 'pump-1' },
            { id: 'underscore', name: 'pump_01' },
            { id: 'emoji', name: 'pump-🙂1' },
            { id: 'line', name: 'pump\n01' },
            { id: 'blank', name: null }
        ];
        // exactly one character: not none, not two
        expect(ids(codes, {}, where('name', 'EQUAL', 'pump-__'))).toEqual(['pump', 'pumpAB', 'emoji']);
        // a _ in the row is a character too: `\_` is a plain one (textPattern.test.ts)
        expect(ids(codes, {}, where('name', 'EQUAL', 'pump_01'))).toEqual(['pump', 'underscore', 'line']);
        expect(ids(codes, {}, where('name', 'BEGIN_WITH', 'p_mp'))).toEqual([
            'pump',
            'pumpAB',
            'short',
            'underscore',
            'emoji',
            'line'
        ]);
        expect(ids(codes, {}, where('name', 'END_WITH', '-_'))).toEqual(['short']);
        expect(ids(codes, {}, where('name', 'CONTAINS', '_*1'))).toEqual(['pump', 'short', 'underscore', 'emoji', 'line']);
        expect(ids(codes, {}, where('name', 'NOT_EQUAL_TO', 'pump-__'))).toEqual(['short', 'underscore', 'line', 'blank']);
        // with caseSensitive the other letters keep their case
        expect(ids(codes, {}, where('name', 'EQUAL', 'P_MP-01', { caseSensitive: true }))).toEqual(['pump']);
        // a blank row is '': no character for _
        expect(ids(codes, {}, where('name', 'EQUAL', '_'))).toEqual([]);
    });

    it('expect a number in the row to be its text, a blank to be the text ""', () => {
        expect(text('EQUAL', '0')).toEqual(['zero']);
        expect(text('CONTAINS', 'x')).toEqual([]);
    });

    it('expect IN / NOT_IN to compare the list ignoring case, "NULL" for the blanks (null, "", 0)', () => {
        expect(text('IN', ['ann', 'NULL'])).toEqual(['ann', 'ANN', 'null', 'empty', 'zero']);
        expect(text('NOT_IN', ['ann', 'NULL'])).toEqual(['anna', 'joanna', 'lines']);
        // no wildcards in a list
        expect(text('IN', ['an*'])).toEqual([]);
        // text with one value per line
        expect(text('IN', 'ann\nanna')).toEqual(['ann', 'ANN', 'anna']);
    });

    it('expect IN / NOT_IN with caseSensitive to compare the list as it is, the blanks as NULL in upper case', () => {
        expect(text('IN', ['Ann', 'NULL'], true)).toEqual(['ann', 'null', 'empty', 'zero']);
        expect(text('IN', ['ann', 'null'], true)).toEqual([]);
        expect(text('NOT_IN', ['Ann'], true)).toEqual(['ANN', 'anna', 'joanna', 'null', 'empty', 'zero', 'lines']);
    });

    it('expect the text NULL in a row to count as a blank for IN: in any case, as it is with caseSensitive', () => {
        const nulls = [
            { id: 'upper', name: 'NULL' },
            { id: 'lower', name: 'null' },
            { id: 'blank', name: null }
        ];
        expect(ids(nulls, {}, where('name', 'IN', ['NULL']))).toEqual(['upper', 'lower', 'blank']);
        expect(ids(nulls, {}, where('name', 'IN', ['NULL'], { caseSensitive: true }))).toEqual(['upper', 'blank']);
        expect(ids(nulls, {}, where('name', 'IN', ['null'], { caseSensitive: true }))).toEqual(['lower']);
    });

    it('expect an IN without a list, or an empty one, to match no row and NOT_IN every row', () => {
        expect(text('IN', [])).toEqual([]);
        expect(text('IN', null)).toEqual([]);
        expect(text('NOT_IN', [])).toHaveLength(rows.length);
    });

    it('expect IS_BLANK to be null, undefined, "" and 0 - caseSensitive changes nothing', () => {
        const blanks = ['null', 'empty', 'zero'];
        expect(text('IS_BLANK', undefined)).toEqual(blanks);
        expect(text('IS_BLANK', undefined, true)).toEqual(blanks);
        expect(text('IS_NOT_BLANK', undefined)).toEqual(['ann', 'ANN', 'anna', 'joanna', 'lines']);
        // the text '0' is a value
        expect(ids([{ id: 'zeroText', name: '0' }], {}, where('name', 'IS_BLANK'))).toEqual([]);
    });

    it('expect a number or a Date value to compare as one, caseSensitive left out', () => {
        const numbers = [
            { id: 'five', code: '5' },
            { id: 'ten', code: 10 }
        ];
        expect(ids(numbers, {}, where('code', 'GREATER_THAN', 6, { caseSensitive: true }))).toEqual(['ten']);
    });

    it('expect a valueField condition to match case with caseSensitive', () => {
        const pairs = [
            { id: 'same', a: 'Oslo', b: 'Oslo' },
            { id: 'case', a: 'Oslo', b: 'OSLO' }
        ];
        expect(ids(pairs, {}, { field: 'a', operator: 'EQUAL', valueField: 'b' })).toEqual(['same', 'case']);
        expect(ids(pairs, {}, { field: 'a', operator: 'EQUAL', valueField: 'b', caseSensitive: true })).toEqual(['same']);
    });

    it('expect only true to turn it on: a "true" of plain js does not', () => {
        expect(ids(rows, {}, { field: 'name', operator: 'EQUAL', value: 'Ann', caseSensitive: 'true' } as any)).toEqual([
            'ann',
            'ANN'
        ]);
    });

    describe('the operators a text field does not offer, kept for filters saved before', () => {
        it('expect LESS_THAN ... to compare the texts in lower case, as they are with caseSensitive - no wildcards', () => {
            const letters = [
                { id: 'a', name: 'a' },
                { id: 'B', name: 'B' },
                { id: 'c', name: 'c' }
            ];
            expect(ids(letters, {}, where('name', 'LESS_THAN', 'b'))).toEqual(['a']);
            expect(ids(letters, {}, where('name', 'LESS_THAN_OR_EQUAL_TO', 'b'))).toEqual(['a', 'B']);
            expect(ids(letters, {}, where('name', 'GREATER_THAN', 'b'))).toEqual(['c']);
            expect(ids(letters, {}, where('name', 'GREATER_THAN_OR_EQUAL_TO', 'b'))).toEqual(['B', 'c']);
            // 'B' < 'a' in code units
            expect(ids(letters, {}, where('name', 'LESS_THAN', 'a', { caseSensitive: true }))).toEqual(['B']);
            expect(ids(letters, {}, where('name', 'LESS_THAN', 'b*'))).toEqual(['a', 'B']);
        });

        it('expect BETWEEN to be the two of them', () => {
            const letters = [
                { id: 'a', name: 'a' },
                { id: 'B', name: 'B' },
                { id: 'c', name: 'c' }
            ];
            expect(ids(letters, {}, where('name', 'BETWEEN', ['b', 'c']))).toEqual(['B', 'c']);
            expect(ids(letters, {}, where('name', 'BETWEEN', ['b', 'c'], { caseSensitive: true }))).toEqual(['c']);
        });
    });
});

describe('number', () => {
    const rows = [
        { id: 'minus', age: -5 },
        { id: 'zero', age: 0 },
        { id: 'null', age: null },
        { id: 'ten', age: 10 },
        { id: 'twenty', age: 20 },
        { id: 'text', age: 'x' }
    ];
    const fields: Record<string, FieldType> = { age: 'number' };
    const number = (operator: FilterOperator, value?: unknown, caseSensitive = false) =>
        ids(rows, fields, where('age', operator, value, { caseSensitive }));

    it('expect EQUAL / NOT_EQUAL_TO, a blank (and what is no number) being 0', () => {
        expect(number('EQUAL', 10)).toEqual(['ten']);
        expect(number('EQUAL', 0)).toEqual(['zero', 'null', 'text']);
        expect(number('NOT_EQUAL_TO', 10)).toEqual(['minus', 'zero', 'null', 'twenty', 'text']);
        expect(number('NOT_EQUAL_TO', 0)).toEqual(['minus', 'ten', 'twenty']);
    });

    it('expect LESS_THAN ... GREATER_THAN_OR_EQUAL_TO, a blank being 0', () => {
        expect(number('LESS_THAN', 5)).toEqual(['minus', 'zero', 'null', 'text']);
        expect(number('LESS_THAN_OR_EQUAL_TO', 10)).toEqual(['minus', 'zero', 'null', 'ten', 'text']);
        expect(number('GREATER_THAN', 10)).toEqual(['twenty']);
        expect(number('GREATER_THAN_OR_EQUAL_TO', 10)).toEqual(['ten', 'twenty']);
        expect(number('GREATER_THAN', -1)).toEqual(['zero', 'null', 'ten', 'twenty', 'text']);
    });

    it('expect a value of text to be read as a number', () => {
        expect(number('EQUAL', '10')).toEqual(['ten']);
    });

    it('expect BETWEEN to include both ends', () => {
        expect(number('BETWEEN', [10, 20])).toEqual(['ten', 'twenty']);
        expect(number('BETWEEN', [-5, 0])).toEqual(['minus', 'zero', 'null', 'text']);
        expect(number('BETWEEN', [10, 10])).toEqual(['ten']);
        // 0 is an end, not a blank
        expect(number('BETWEEN', [0, 10])).toEqual(['zero', 'null', 'ten', 'text']);
    });

    it('expect a blank end to be open: GREATER_THAN_OR_EQUAL_TO or LESS_THAN_OR_EQUAL_TO', () => {
        expect(number('BETWEEN', [10, null])).toEqual(number('GREATER_THAN_OR_EQUAL_TO', 10));
        expect(number('BETWEEN', [undefined, 10])).toEqual(number('LESS_THAN_OR_EQUAL_TO', 10));
        expect(number('BETWEEN', ['', 10])).toEqual(number('LESS_THAN_OR_EQUAL_TO', 10));
    });

    it('expect from after to to match no row, as in SQL', () => {
        expect(number('BETWEEN', [20, 10])).toEqual([]);
    });

    it('expect IN / NOT_IN to compare the text the formatter shows, 0 as "0"', () => {
        expect(number('IN', [10, 0])).toEqual(['zero', 'ten']);
        expect(number('IN', ['NULL'])).toEqual(['null', 'text']);
        expect(number('NOT_IN', [10])).toEqual(['minus', 'zero', 'null', 'twenty', 'text']);
    });

    it('expect IS_BLANK to be null and 0 - and not a text', () => {
        expect(number('IS_BLANK')).toEqual(['zero', 'null']);
        expect(number('IS_NOT_BLANK')).toEqual(['minus', 'ten', 'twenty', 'text']);
    });

    it('expect caseSensitive to change nothing', () => {
        expect(number('EQUAL', 10, true)).toEqual(['ten']);
        expect(number('IN', [10], true)).toEqual(['ten']);
    });

    it('expect the text operators it does not offer to compare as before: CONTAINS, BEGIN_WITH >=, END_WITH <=, DOES_NOT_CONTAIN <', () => {
        expect(number('CONTAINS', 10)).toEqual(number('GREATER_THAN_OR_EQUAL_TO', 10));
        expect(number('BEGIN_WITH', 10)).toEqual(number('GREATER_THAN_OR_EQUAL_TO', 10));
        expect(number('END_WITH', 10)).toEqual(number('LESS_THAN_OR_EQUAL_TO', 10));
        expect(number('DOES_NOT_CONTAIN', 10)).toEqual(number('LESS_THAN', 10));
    });
});

describe('date and datetime', () => {
    const rows = [
        { id: 'jan1', d: new Date(2026, 0, 1, 0, 0, 0) },
        { id: 'jan1noon', d: new Date(2026, 0, 1, 12, 30, 15, 500) },
        { id: 'jan2', d: new Date(2026, 0, 2, 9, 0, 0) },
        { id: 'jan3', d: new Date(2026, 0, 3) },
        { id: 'null', d: null },
        { id: 'invalid', d: new Date('x') }
    ];
    const date = (operator: FilterOperator, value?: unknown) => ids(rows, { d: 'date' }, where('d', operator, value));
    const datetime = (operator: FilterOperator, value?: unknown) => ids(rows, { d: 'datetime' }, where('d', operator, value));

    it('expect a date field to compare the day, a blank row date only matching NOT_EQUAL_TO', () => {
        expect(date('EQUAL', new Date(2026, 0, 1, 18))).toEqual(['jan1', 'jan1noon']);
        expect(date('NOT_EQUAL_TO', new Date(2026, 0, 1))).toEqual(['jan2', 'jan3', 'null', 'invalid']);
        expect(date('LESS_THAN', new Date(2026, 0, 2))).toEqual(['jan1', 'jan1noon']);
        expect(date('LESS_THAN_OR_EQUAL_TO', new Date(2026, 0, 2))).toEqual(['jan1', 'jan1noon', 'jan2']);
        expect(date('GREATER_THAN', new Date(2026, 0, 2))).toEqual(['jan3']);
        expect(date('GREATER_THAN_OR_EQUAL_TO', new Date(2026, 0, 2))).toEqual(['jan2', 'jan3']);
    });

    it('expect a datetime field to compare to the second', () => {
        expect(datetime('EQUAL', new Date(2026, 0, 1, 12, 30, 15))).toEqual(['jan1noon']);
        expect(datetime('GREATER_THAN', new Date(2026, 0, 1, 12, 30, 15))).toEqual(['jan2', 'jan3']);
    });

    it("expect BETWEEN of a date field to go from the start of from's day to the end of to's day", () => {
        expect(date('BETWEEN', [new Date(2026, 0, 1, 23), new Date(2026, 0, 2, 1)])).toEqual(['jan1', 'jan1noon', 'jan2']);
        expect(date('BETWEEN', [new Date(2026, 0, 2), null])).toEqual(['jan2', 'jan3']);
        expect(date('BETWEEN', [null, new Date(2026, 0, 1)])).toEqual(['jan1', 'jan1noon']);
        expect(date('BETWEEN', [new Date(2026, 0, 3), new Date(2026, 0, 1)])).toEqual([]);
    });

    it('expect BETWEEN of a datetime field to include its ends, to the second', () => {
        const from = new Date(2026, 0, 1, 12, 30, 15);
        expect(datetime('BETWEEN', [from, new Date(2026, 0, 2, 9, 0, 0)])).toEqual(['jan1noon', 'jan2']);
        expect(datetime('BETWEEN', [new Date(2026, 0, 1, 12, 30, 16), null])).toEqual(['jan2', 'jan3']);
    });

    it('expect the ends as text (after JSON) to be read as dates', () => {
        const ends = [new Date(2026, 0, 2).toISOString(), new Date(2026, 0, 3).toISOString()];
        expect(date('BETWEEN', JSON.parse(JSON.stringify(ends)))).toEqual(['jan2', 'jan3']);
    });

    it('expect IS_BLANK to be null and an invalid date', () => {
        expect(date('IS_BLANK')).toEqual(['null', 'invalid']);
        expect(date('IS_NOT_BLANK')).toEqual(['jan1', 'jan1noon', 'jan2', 'jan3']);
    });

    it('expect IN to compare the text the formatter shows', () => {
        expect(date('IN', ['2026-01-01', 'NULL'])).toEqual(['jan1', 'jan1noon', 'null', 'invalid']);
        expect(date('NOT_IN', ['2026-01-01'])).toEqual(['jan2', 'jan3', 'null', 'invalid']);
    });

    it('expect the text operators it does not offer to compare as before', () => {
        const jan2 = new Date(2026, 0, 2);
        expect(date('CONTAINS', jan2)).toEqual(date('GREATER_THAN_OR_EQUAL_TO', jan2));
        expect(date('BEGIN_WITH', jan2)).toEqual(date('GREATER_THAN_OR_EQUAL_TO', jan2));
        expect(date('END_WITH', jan2)).toEqual(date('LESS_THAN_OR_EQUAL_TO', jan2));
        expect(date('DOES_NOT_CONTAIN', jan2)).toEqual(date('LESS_THAN', jan2));
    });
});

describe('boolean', () => {
    const rows = [
        { id: 'true', b: true },
        { id: 'false', b: false },
        { id: 'null', b: null },
        { id: 'undefined' },
        { id: 'empty', b: '' }
    ];
    const bool = (operator: FilterOperator, value?: unknown) => ids(rows, { b: 'boolean' }, where('b', operator, value));

    it('expect a blank to be false: EQUAL false matches it, EQUAL true does not', () => {
        expect(bool('EQUAL', true)).toEqual(['true']);
        expect(bool('EQUAL', false)).toEqual(['false', 'null', 'undefined', 'empty']);
    });

    it('expect NOT_EQUAL_TO to be the rows EQUAL leaves out', () => {
        expect(bool('NOT_EQUAL_TO', true)).toEqual(['false', 'null', 'undefined', 'empty']);
        expect(bool('NOT_EQUAL_TO', false)).toEqual(['true']);
    });

    it('expect IS_BLANK to be the blanks - false is a value', () => {
        expect(bool('IS_BLANK')).toEqual(['null', 'undefined', 'empty']);
        expect(bool('IS_NOT_BLANK')).toEqual(['true', 'false']);
    });

    it('expect caseSensitive to change nothing, and the operators it does not offer to be EQUAL (as v5)', () => {
        expect(ids(rows, { b: 'boolean' }, where('b', 'EQUAL', true, { caseSensitive: true }))).toEqual(['true']);
        expect(bool('LESS_THAN', true)).toEqual(['true']);
        expect(bool('CONTAINS', false)).toEqual(bool('EQUAL', false));
    });
});

describe('conditions that are ignored: no value', () => {
    const rows = [
        { id: 'a', name: 'a', age: 1, born: new Date(2026, 0, 1), active: true },
        { id: 'b', name: '', age: null, born: null, active: null }
    ];
    const fields: Record<string, FieldType> = { age: 'number', born: 'date', active: 'boolean' };
    const all = ['a', 'b'];

    for (const [field, operator] of [
        ['name', 'EQUAL'],
        ['name', 'CONTAINS'],
        ['name', 'NOT_EQUAL_TO'],
        ['age', 'LESS_THAN'],
        ['age', 'EQUAL'],
        ['born', 'GREATER_THAN'],
        ['active', 'EQUAL']
    ] as const) {
        it(`expect ${field} ${operator} with a blank value (null, undefined, '') to be ignored`, () => {
            for (const value of [null, undefined, '']) {
                const condition: FilterCondition = { field, operator, value };
                expect(ids(rows, fields, condition)).toEqual(all);
                expect(ids(rows, fields, and(condition, where('id', 'EQUAL', 'b')))).toEqual(['b']);
            }
        });
    }

    it('expect a BETWEEN without an end, without a pair, or with a valueField and no value, to be ignored', () => {
        expect(ids(rows, fields, { field: 'age', operator: 'BETWEEN', value: [null, ''] })).toEqual(all);
        expect(ids(rows, fields, { field: 'age', operator: 'BETWEEN', value: 5 })).toEqual(all);
        expect(ids(rows, fields, { field: 'age', operator: 'BETWEEN', value: [1, 2, 3] })).toEqual(all);
        expect(ids(rows, fields, { field: 'age', operator: 'BETWEEN', valueField: 'age' })).toEqual(all);
    });

    it('expect a valueField condition not to need a value', () => {
        expect(ids(rows, fields, { field: 'name', operator: 'EQUAL', valueField: 'id' })).toEqual(['a']);
    });

    it('expect the filter string and the tree to leave them out', () => {
        const ds = new Datasource({ fields });
        ds.setData(rows);
        ds.filter(and({ field: 'name', operator: 'EQUAL', value: '' }, where('age', 'BETWEEN', [null, null])));
        expect(ds.getFilterString()).toEqual('');
        expect(ds.getFilterTree()).toBeNull();
    });
});

describe('getFilterString() and getFilterTree()', () => {
    const build = (filter: FilterExpression) => {
        const ds = new Datasource({ fields: { age: { type: 'number', label: 'Age' }, born: 'date', name: { label: 'Name' } } });
        ds.setData([]);
        ds.filter(filter);
        return ds;
    };

    it('expect a condition that matches case to keep the case of its value, <<MATCH_CASE>> after it', () => {
        const ds = build(and(where('name', 'EQUAL', 'Ann', { caseSensitive: true }), where('name', 'CONTAINS', 'Bo')));
        expect(ds.getFilterString()).toEqual("([NAME] <<EQUAL_TO>> 'Ann' <<MATCH_CASE>> AND [NAME] <<CONTAINS>> 'BO')");
        expect(ds.getFilterTree()?.children.map((node) => node.kind === 'condition' && node.caseSensitive)).toEqual([
            true,
            false
        ]);
    });

    it('expect an IN that matches case to keep its list as it is', () => {
        const ds = build(where('name', 'IN', ['Ann', 'NULL'], { caseSensitive: true }));
        expect(ds.getFilterString()).toEqual("([NAME] <<IN>> ['Ann','NULL'] <<MATCH_CASE>>)");
    });

    it('expect caseSensitive where it is ignored not to be shown: a number field, IS_BLANK', () => {
        const ds = build(
            and(where('age', 'EQUAL', 5, { caseSensitive: true }), where('name', 'IS_BLANK', undefined, { caseSensitive: true }))
        );
        expect(ds.getFilterString()).toEqual("([AGE] <<EQUAL_TO>> '5' AND [NAME] <<IS_BLANK>>)");
        expect(ds.getFilterTree()?.children.map((node) => node.kind === 'condition' && node.caseSensitive)).toEqual([
            false,
            false
        ]);
    });

    it("expect a BETWEEN as '10' <<AND>> '20', an open end as ''", () => {
        expect(build(where('age', 'BETWEEN', [10, 20])).getFilterString()).toEqual("([AGE] <<BETWEEN>> '10' <<AND>> '20')");
        expect(build(where('age', 'BETWEEN', [10, null])).getFilterString()).toEqual("([AGE] <<BETWEEN>> '10' <<AND>> '')");
        expect(build(where('born', 'BETWEEN', [new Date(2026, 0, 1), new Date(2026, 1, 1)])).getFilterString()).toEqual(
            "([BORN] <<BETWEEN>> '2026-01-01' <<AND>> '2026-02-01')"
        );
    });

    it('expect the tree of a BETWEEN to have the start in value, the end in valueTo', () => {
        expect(build(where('age', 'BETWEEN', [10, 20])).getFilterTree()?.children[0]).toEqual({
            kind: 'condition',
            field: 'age',
            label: 'Age',
            operator: 'BETWEEN',
            value: '10',
            valueTo: '20',
            hasValue: true,
            caseSensitive: false
        });
        expect(build(where('age', 'BETWEEN', [null, 20])).getFilterTree()?.children[0]).toMatchObject({
            value: '',
            valueTo: '20'
        });
    });
});

describe('the filter as plain JSON', () => {
    it('expect caseSensitive and a BETWEEN of dates to filter the same after JSON', () => {
        const rows = [
            { id: 'ann', name: 'Ann', born: new Date(2026, 0, 1) },
            { id: 'ANN', name: 'ANN', born: new Date(2026, 0, 5) }
        ];
        const filter = and(
            where('name', 'EQUAL', 'ANN', { caseSensitive: true }),
            where('born', 'BETWEEN', [new Date(2026, 0, 2), null])
        );
        const fields: Record<string, FieldType> = { born: 'date' };
        expect(ids(rows, fields, filter)).toEqual(['ANN']);
        expect(ids(rows, fields, JSON.parse(JSON.stringify(filter)))).toEqual(['ANN']);
        expect(JSON.parse(JSON.stringify(filter)).children[0].caseSensitive).toBe(true);
    });
});
