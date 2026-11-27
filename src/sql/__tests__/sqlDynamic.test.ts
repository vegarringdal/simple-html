// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { type FilterOperator, where } from '../../datasource/filterExpression';
import { valueText } from '../../datasource/valueText';
import { toSqlWhere } from '../../sql';

/**
 * A column of values of several types (`dynamicCellTypeColumn`: another field names each row's type) is a
 * text field: the grid filters, sorts and groups it by valueText() - a date as `2026-11-25`, the text its
 * cell shows - and a database keeps it as text, the same ISO text. The grid's filter and toSqlWhere on
 * SQLite select the same rows
 */

const rows = [
    { id: 1, valueType: 'number', value: 36 },
    { id: 2, valueType: 'date', value: new Date(1990, 4, 17) },
    { id: 3, valueType: 'datetime', value: new Date(2026, 10, 25, 14, 30) },
    { id: 4, valueType: 'boolean', value: true },
    { id: 5, valueType: 'text', value: 'Ann' },
    { id: 6, valueType: 'number', value: 2.5 },
    { id: 7, valueType: 'text', value: null },
    { id: 8, valueType: 'date', value: new Date(2026, 10, 25) }
];

describe('valueText', () => {
    it('expect a date as the default date formats write it, the rest as String()', () => {
        expect(valueText(new Date(1990, 4, 17))).toBe('1990-05-17');
        expect(valueText(new Date(2026, 10, 25, 14, 30, 5))).toBe('2026-11-25T14:30:05');
        expect(valueText(new Date(Number.NaN))).toBe('');
        expect([valueText(36), valueText(true), valueText(null), valueText('x')]).toEqual(['36', 'true', '', 'x']);
    });
});

describe('a column of several types: the grid and SQLite select the same rows', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE t (id INTEGER, value TEXT)');
    const insert = db.prepare('INSERT INTO t VALUES (?, ?)');
    for (const row of rows) {
        // the database keeps the value as text, the ISO text of a date
        insert.run(row.id, row.value === null ? null : valueText(row.value));
    }
    const datasource = new Datasource({ key: 'id' });
    datasource.setData(rows.map((row) => ({ ...row })));

    const cases: [FilterOperator, string][] = [
        ['EQUAL', '1990-05-17'],
        ['CONTAINS', '1990-05'],
        ['BEGIN_WITH', '2026-11-25'],
        ['EQUAL', '2026-11-25T14:30:00'],
        ['EQUAL', '36'],
        ['EQUAL', 'true'],
        ['CONTAINS', 'an'],
        ['NOT_EQUAL_TO', '36'],
        ['CONTAINS', 'May']
    ];
    for (const [operator, value] of cases) {
        it(`expect value ${operator} ${value}`, () => {
            datasource.filter(where('value', operator, value));
            const grid = datasource.getRows().map((row) => row.id as number);
            const { sql, params } = toSqlWhere(where('value', operator, value), {
                dialect: 'sqlite',
                columns: { value: 'value' }
            });
            const selected = (db.prepare(`SELECT id FROM t WHERE ${sql}`).all(...(params as never[])) as { id: number }[]).map(
                (row) => row.id
            );
            expect(selected.sort((a, b) => a - b)).toEqual(grid.sort((a, b) => a - b));
        });
    }

    it('expect a date to be found by the text its cell shows, not JavaScript s date text', () => {
        datasource.filter(where('value', 'EQUAL', '1990-05-17'));
        expect(datasource.getRows().map((row) => row.id)).toEqual([2]);
        datasource.filter(where('value', 'CONTAINS', 'May'));
        expect(datasource.getRows()).toEqual([]);
    });

    it('expect the dates sorted with the texts by their ISO text', () => {
        datasource.filter(null);
        datasource.sort({ attribute: 'value', ascending: true });
        const order = datasource.getRows().map((row) => valueText(row.value));
        expect(order.indexOf('1990-05-17')).toBeLessThan(order.indexOf('2026-11-25'));
        expect(order.indexOf('2026-11-25')).toBeLessThan(order.indexOf('2026-11-25T14:30:00'));
    });
});
