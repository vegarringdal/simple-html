// @vitest-environment happy-dom
import { DatabaseSync } from 'node:sqlite';
import { beforeAll, describe, expect, it } from 'vitest';
import { and, type FilterExpression, where } from '../../datasource/filterExpression';
import { mountGrid, stubCanvas, stubElementSizes } from '../../grid/__tests__/gridTestHelpers';
import { gridOf } from '../../grid/__tests__/interactionTestHelpers';
import type { GridConfig } from '../../grid/gridConfig';
import { dropDownFilterData } from '../../grid/gridFunctions/dropDownFilterData';
import { toSqlWhere } from '../../sql';

/**
 * A text column with a template (`format.text`) is filtered on the text it shows: in the grid (the
 * datasource's __setFilterText), and in SQL with the formula of that text (gridInterface.getShownFormulas,
 * toSqlWhere({ shown })). The same filters through both, on SQLite: the same rows
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

const rows = [
    { id: 1, first: 'Ann', last: 'Berg', order: 'A-1', amount: 12.5, born: new Date(1990, 4, 17) },
    { id: 2, first: 'Bob', last: null, order: 'B-2', amount: 3, born: null },
    { id: 3, first: 'anne', last: 'Dahl', order: '', amount: null, born: new Date(2001, 0, 2) },
    { id: 4, first: null, last: 'Eng', order: 'A-10', amount: 0, born: new Date(1990, 4, 18) },
    { id: 5, first: 'Cid', last: 'Fox', order: 'c 3', amount: 1250, born: null }
];

const config = (): GridConfig => ({
    columns: {
        first: { format: { text: '{first} {last}' } },
        order: { format: { text: 'order {value} ({id})' } },
        // filtered on its value
        last: { format: { text: '[{last}]', filterAsShown: false } }
    },
    layout: { center: ['id', 'first', 'last', 'order', 'amount', 'born'].map((field) => ({ fields: [field], width: 100 })) }
});

const fields = { id: 'number', amount: 'number', born: 'date' } as const;

const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE t (id INTEGER, first TEXT, last TEXT, "order" TEXT, amount REAL, born TEXT)');
{
    const insert = db.prepare('INSERT INTO t VALUES (?, ?, ?, ?, ?, ?)');
    const day = (date: Date | null) =>
        date
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
            : null;
    for (const row of rows) {
        insert.run(row.id, row.first, row.last, row.order, row.amount, day(row.born));
    }
}
const columns = {
    id: { column: 'id', type: 'number' as const },
    first: 'first',
    last: 'last',
    order: 'order',
    amount: { column: 'amount', type: 'number' as const },
    born: { column: 'born', type: 'date' as const }
};

describe('a column filtered on the text its template shows', () => {
    const cases: [string, FilterExpression][] = [
        ['first = "ann berg"', where('first', 'EQUAL', 'ann berg')],
        ['first contains "ann"', where('first', 'CONTAINS', 'ann')],
        ['first begins with " "', where('first', 'BEGIN_WITH', ' ')],
        ['first ends with "dahl"', where('first', 'END_WITH', 'dahl')],
        ['first IN', where('first', 'IN', ['Ann Berg', 'Bob '])],
        ['order contains "(4)"', where('order', 'CONTAINS', '(4)')],
        ['order = "order  (3)"', where('order', 'EQUAL', 'order  (3)')],
        ['order not contains "a-1"', where('order', 'DOES_NOT_CONTAIN', 'a-1')],
        ['last (on its value) = "berg"', where('last', 'EQUAL', 'berg')],
        ['both', and(where('first', 'CONTAINS', 'an'), where('order', 'BEGIN_WITH', 'order a'))]
    ];
    for (const [name, filter] of cases) {
        it(`expect ${name}: the grid and SQLite select the same rows`, async () => {
            const { gridInterface, datasource } = await mountGrid(
                config(),
                rows.map((row) => ({ ...row })),
                { key: 'id', fields }
            );
            datasource.filter(filter);
            const grid = datasource.getRows().map((row) => row.id as number);
            const shown = gridInterface.getShownFormulas();
            const sent = gridInterface.getServerFilter();
            const { sql, params } = toSqlWhere(JSON.parse(JSON.stringify(sent)), {
                dialect: 'sqlite',
                columns,
                shown,
                timeZone: 'UTC'
            });
            const selected = (
                db.prepare(`SELECT id FROM t WHERE ${sql} ORDER BY id`).all(...(params as never[])) as { id: number }[]
            ).map((row) => row.id);
            expect(selected).toEqual([...grid].sort((a, b) => a - b));
        });
    }

    it('expect the formulas: each templated text column filtered as shown, not one filtered on its value', async () => {
        const { gridInterface } = await mountGrid(config(), rows, { key: 'id', fields });
        expect(gridInterface.getShownFormulas()).toEqual({
            first: 'CONCAT({first}, " ", {last})',
            order: 'CONCAT("order ", {order}, " (", {id}, ")")'
        });
        // the backend has no id: the order's template can not be made there - left out, its conditions too
        expect(gridInterface.getShownFormulas({ fields: ['first', 'last', 'order'] })).toEqual({
            first: 'CONCAT({first}, " ", {last})'
        });
    });

    it('expect a template with a field of another formatter or a datetime field to have no formula: the browser filters it', async () => {
        const { gridInterface, datasource } = await mountGrid(
            {
                columns: { first: { format: { text: '{first} {amount}' } }, order: { format: { text: '{order} {born}' } } },
                layout: { center: ['first', 'order'].map((field) => ({ fields: [field], width: 100 })) }
            },
            rows.map((row) => ({ ...row })),
            { key: 'id', fields: { id: 'number', amount: { type: 'number', formatter: 'numberComma' }, born: 'datetime' } }
        );
        expect(gridInterface.getShownFormulas()).toEqual({});
        datasource.filter(and(where('first', 'CONTAINS', '12,5'), where('order', 'CONTAINS', 'A')));
        // the grid filters the shown text: 12,5 is the comma's
        expect(datasource.getRows().map((row) => row.id)).toEqual([1]);
        expect(gridInterface.getServerFilter()).toBeNull();
    });

    it('expect the value list of the filter menu to list the texts shown, its IN to select them', async () => {
        const { gridInterface, datasource, element } = await mountGrid(
            config(),
            rows.map((row) => ({ ...row })),
            { key: 'id', fields }
        );
        const texts = dropDownFilterData(gridOf(element), 'first', false, null)?.entries.map((entry) => entry.text);
        expect(new Set(texts)).toEqual(new Set(['Ann Berg', 'anne Dahl', 'Bob ', 'Cid Fox', ' Eng']));
        datasource.filter(where('first', 'IN', ['Ann Berg']));
        expect(datasource.getRows().map((row) => row.id)).toEqual([1]);
        // turned off: the value again
        gridInterface.setState({ formats: { first: { text: '{first} {last}', filterAsShown: false } } });
        datasource.filter(where('first', 'IN', ['Ann']));
        expect(datasource.getRows().map((row) => row.id)).toEqual([1]);
    });
});

describe('a valueField that is a column filtered on its template', () => {
    it('expect the other column compared as the row has it, as in the grid: not its template', async () => {
        const db = new DatabaseSync(':memory:');
        db.exec('CREATE TABLE t (id INTEGER, first TEXT, last TEXT)');
        db.exec("INSERT INTO t VALUES (1, 'Ann', 'Ann'), (2, 'Bob', 'Cid')");
        const config: GridConfig = {
            columns: { last: { format: { text: '[{last}]' } } },
            layout: { center: ['id', 'first', 'last'].map((field) => ({ fields: [field], width: 100 })) }
        };
        const { datasource, gridInterface } = await mountGrid(
            config,
            [
                { id: 1, first: 'Ann', last: 'Ann' },
                { id: 2, first: 'Bob', last: 'Cid' }
            ],
            { key: 'id', fields: { id: 'number' } }
        );
        const filter = and({ field: 'first', operator: 'EQUAL', valueField: 'last' } as never);
        datasource.filter(filter);
        expect(datasource.getRows().map((row) => row.id)).toEqual([1]);
        const columns = { id: { column: 'id', type: 'number' as const }, first: 'first', last: 'last' };
        const sql = toSqlWhere(filter, {
            dialect: 'sqlite',
            columns,
            shown: gridInterface.getShownFormulas({ fields: ['id', 'first', 'last'] })
        });
        const found = db.prepare(`SELECT id FROM t WHERE ${sql.sql} ORDER BY id`).all(...(sql.params as never[]));
        expect(found.map((row) => row.id)).toEqual([1]);
    });
});
