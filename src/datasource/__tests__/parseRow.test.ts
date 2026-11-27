import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import { parseFieldValue } from '../parseValue';

/**
 * datasource.parseRow() and setData(rows, { parse: true }): the values of a row as JSON gives them read
 * as the types of the fields (parseValue.ts)
 */

describe('parseFieldValue', () => {
    it('expect an ISO day as the start of that day in local time, not UTC', () => {
        const date = parseFieldValue('2026-11-22', 'date') as Date;
        expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 10, 22, 0]);
        // not a day there is
        expect(parseFieldValue('2026-02-30', 'date')).toEqual('2026-02-30');
    });

    it('expect a date and time as local time without a zone, the instant with one, a number as milliseconds', () => {
        const local = parseFieldValue('2026-11-22T08:30:00', 'datetime') as Date;
        expect([local.getDate(), local.getHours(), local.getMinutes()]).toEqual([22, 8, 30]);
        const spaced = parseFieldValue('2026-11-22 08:30', 'datetime') as Date;
        expect(spaced.getTime()).toEqual(new Date(2026, 10, 22, 8, 30).getTime());
        expect((parseFieldValue('2026-11-22T08:30:00.000Z', 'datetime') as Date).toISOString()).toEqual(
            '2026-11-22T08:30:00.000Z'
        );
        expect((parseFieldValue('2026-11-22T08:30:00+01:00', 'date') as Date).toISOString()).toEqual('2026-11-22T07:30:00.000Z');
        expect((parseFieldValue(0, 'date') as Date).getTime()).toEqual(0);
        const same = new Date();
        expect(parseFieldValue(same, 'date')).toBe(same);
    });

    it('expect text that is no date, and other values, left as they are', () => {
        for (const value of ['22.11.2026', 'today', '2026-11-22T25:00', true, { a: 1 }, Number.NaN]) {
            expect(parseFieldValue(value, 'date')).toBe(value);
        }
    });

    it('expect numbers from text that is one, nothing else', () => {
        expect(parseFieldValue('12.5', 'number')).toEqual(12.5);
        expect(parseFieldValue(' -3 ', 'number')).toEqual(-3);
        expect(parseFieldValue('1e3', 'number')).toEqual(1000);
        expect(parseFieldValue('.5', 'number')).toEqual(0.5);
        for (const value of ['12,5', '0x10', 'abc', '1 000', 'Infinity']) {
            expect(parseFieldValue(value, 'number')).toEqual(value);
        }
        expect(parseFieldValue(7, 'number')).toEqual(7);
    });

    it('expect true and false from their texts and from 1 and 0, other values as they are', () => {
        expect([true, 'true', 'TRUE', 1, '1'].map((value) => parseFieldValue(value, 'boolean'))).toEqual([
            true,
            true,
            true,
            true,
            true
        ]);
        expect([false, 'false', 0, '0'].map((value) => parseFieldValue(value, 'boolean'))).toEqual([false, false, false, false]);
        expect(parseFieldValue('Y', 'boolean')).toEqual('Y');
        expect(parseFieldValue(2, 'boolean')).toEqual(2);
    });

    it("expect '' as null for every type but text, null and undefined kept, text as it is", () => {
        expect(['date', 'datetime', 'number', 'boolean'].map((type) => parseFieldValue('', type as never))).toEqual([
            null,
            null,
            null,
            null
        ]);
        expect(parseFieldValue('', 'text')).toEqual('');
        expect(parseFieldValue(null, 'number')).toBeNull();
        expect(parseFieldValue(undefined, 'date')).toBeUndefined();
        expect(parseFieldValue(12, 'text')).toEqual(12);
    });
});

describe('datasource.parseRow', () => {
    it('expect the listed fields read as their types, the others as they are, the same object', () => {
        const datasource = new Datasource({
            fields: { born: 'date', amount: 'number', active: 'boolean', note: { label: 'Note' } }
        });
        const row = { born: '2026-11-22', amount: '12.5', active: 'true', note: '12', other: '2026-11-22' };
        expect(datasource.parseRow(row)).toBe(row);
        expect(row.born as unknown).toBeInstanceOf(Date);
        expect(row).toMatchObject({ amount: 12.5, active: true, note: '12', other: '2026-11-22' });
        // a field the row has not: not added
        expect(Object.keys(datasource.parseRow({ amount: '1' }))).toEqual(['amount']);
    });

    it('expect setData with parse to read every row, and the filter to see the dates', () => {
        const datasource = new Datasource({ key: 'id', fields: { born: 'date', id: 'number' } });
        datasource.setData(
            [
                { id: '1', born: '2026-11-22' },
                { id: '2', born: '2025-01-01' }
            ],
            { parse: true }
        );
        const rows = datasource.getAllData();
        expect(rows.map((row) => row.id)).toEqual([1, 2]);
        expect(rows[0].born).toBeInstanceOf(Date);
        expect(datasource.hasChanges()).toBe(false);
    });
});
