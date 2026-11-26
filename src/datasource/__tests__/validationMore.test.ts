import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import type { FieldConfig } from '../field';

/**
 * The built-in validators added to required, min, max, minLength, maxLength and pattern: integer,
 * decimals, oneOf, email - and min / max of a date (a day as 'YYYY-MM-DD')
 */

/** the messages of a value of one field with these rules */
function messagesFor(field: FieldConfig, value: unknown): string[] {
    const datasource = new Datasource({ fields: { value: field } });
    datasource.setData([{ value }]);
    return datasource.validate().flatMap((error) => error.messages);
}

describe('integer', () => {
    it.each([
        [3, []],
        [-12, []],
        [0, []],
        [2.5, ['Must be a whole number']],
        [null, []],
        ['2.5', []]
    ])('expect %s to give %j', (value, messages) => {
        expect(messagesFor({ type: 'number', validate: ['integer'] }, value)).toEqual(messages);
    });
});

describe('decimals', () => {
    const two: FieldConfig = { type: 'number', validate: [{ id: 'decimals', value: 2 }] };
    it.each([
        [12.5, []],
        [12.25, []],
        [12.255, ['Must have at most 2 decimals']],
        // 0.30000000000000004: two decimals, the rest is the floating point's
        [0.1 + 0.2, []],
        [1e21, []],
        [null, []]
    ])('expect %s to give %j', (value, messages) => {
        expect(messagesFor(two, value)).toEqual(messages);
    });

    it('expect 0 decimals to be a whole number, and a value of 21 or a fraction to throw', () => {
        expect(messagesFor({ type: 'number', validate: [{ id: 'decimals', value: 0 }] }, 1.5)).toEqual([
            'Must have at most 0 decimals'
        ]);
        expect(() => messagesFor({ type: 'number', validate: [{ id: 'decimals', value: 21 }] }, 1)).toThrow(
            "rule 'decimals', which takes the number of decimals, 0 to 20"
        );
        expect(() => messagesFor({ type: 'number', validate: [{ id: 'decimals', value: 1.5 }] }, 1)).toThrow(/0 to 20/);
    });
});

describe('oneOf', () => {
    const status: FieldConfig = { validate: [{ id: 'oneOf', value: ['Open', 'Closed'] }] };
    it.each([
        ['Open', []],
        ['open', ['Must be one of Open, Closed']],
        ['Done', ['Must be one of Open, Closed']],
        [null, []],
        ['', []]
    ])('expect %j to give %j', (value, messages) => {
        expect(messagesFor(status, value)).toEqual(messages);
    });

    it('expect a number compared as text, and no list or an empty one to throw', () => {
        expect(messagesFor({ type: 'number', validate: [{ id: 'oneOf', value: [1, 2, 3] }] }, 2)).toEqual([]);
        expect(messagesFor({ type: 'number', validate: [{ id: 'oneOf', value: [1, 2, 3] }] }, 4)).toEqual([
            'Must be one of 1, 2, 3'
        ]);
        expect(() => messagesFor({ validate: [{ id: 'oneOf', value: [] }] }, 'x')).toThrow(
            "rule 'oneOf', which takes a list of the values allowed"
        );
        expect(() => messagesFor({ validate: ['oneOf'] }, 'x')).toThrow(/a list of the values allowed/);
    });
});

describe('email', () => {
    it.each([
        ['ann@example.com', []],
        ['ann.berg+x@mail.example.no', []],
        ['ann@example', ['Not an email address']],
        ['ann example.com', ['Not an email address']],
        ['ann @example.com', ['Not an email address']],
        ['', []],
        [null, []]
    ])('expect %j to give %j', (value, messages) => {
        expect(messagesFor({ validate: ['email'] }, value)).toEqual(messages);
    });
});

describe('min and max of a date', () => {
    const range: FieldConfig = {
        type: 'datetime',
        validate: [
            { id: 'min', value: '2026-01-01' },
            { id: 'max', value: '2026-12-31' }
        ]
    };
    it.each([
        [new Date(2026, 0, 1), []],
        [new Date(2025, 11, 31, 23, 59), ['Must be at least 2026-01-01']],
        // a datetime on the day of max is within it
        [new Date(2026, 11, 31, 23, 59, 59), []],
        [new Date(2027, 0, 1), ['Must be at most 2026-12-31']],
        [null, []]
    ])('expect %s to give %j', (value, messages) => {
        expect(messagesFor(range, value)).toEqual(messages);
    });

    it('expect a number still a number, and a value that is no number and no day to throw', () => {
        expect(messagesFor({ type: 'number', validate: [{ id: 'min', value: 0 }] }, -1)).toEqual(['Must be at least 0']);
        // a day limit does not check a number, a number limit no date
        expect(messagesFor({ type: 'number', validate: [{ id: 'min', value: '2026-01-01' }] }, -1)).toEqual([]);
        expect(messagesFor({ type: 'date', validate: [{ id: 'min', value: 0 }] }, new Date(2000, 0, 1))).toEqual([]);
        for (const value of ['2026-02-31', '26-1-1', 'today', null]) {
            expect(() => messagesFor({ type: 'date', validate: [{ id: 'min', value }] }, null), String(value)).toThrow(
                "rule 'min', which takes a number or a day ('YYYY-MM-DD')"
            );
        }
    });
});
