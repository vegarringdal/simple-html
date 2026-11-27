// @vitest-environment happy-dom
import { DatabaseSync } from 'node:sqlite';
import { beforeAll, describe, expect, it } from 'vitest';
import { mountGrid, stubCanvas, stubElementSizes } from '../../grid/__tests__/gridTestHelpers';
import { headerFilterInput } from '../../grid/__tests__/interactionTestHelpers';
import type { GridConfig } from '../../grid/gridConfig';
import { toSqlWhere } from '../../sql';

/**
 * A text or number column shown as checkboxes (ColumnFormat.checkbox) has a checkbox in its header, as a
 * boolean column: checked (the checked value), not checked (any other, a blank too), neither (no
 * filter). Plain conditions: the grid and SQLite select the same rows
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

const rows = [
    { id: 1, flag: 'Y', on: 1 },
    { id: 2, flag: 'N', on: 0 },
    { id: 3, flag: null, on: null },
    { id: 4, flag: 'y', on: 2 },
    { id: 5, flag: 'Y', on: 1 }
];

const config = (): GridConfig => ({
    columns: {
        flag: { format: { checkbox: { checked: 'Y', unchecked: 'N' } } },
        on: { format: { checkbox: {} } }
    },
    layout: { center: ['id', 'flag', 'on'].map((field) => ({ fields: [field], width: 100 })) }
});

const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE t (id INTEGER, flag TEXT, "on" INTEGER)');
for (const row of rows) {
    db.prepare('INSERT INTO t VALUES (?, ?, ?)').run(row.id, row.flag, row.on);
}
const columns = { id: { column: 'id', type: 'number' as const }, flag: 'flag', on: { column: 'on', type: 'number' as const } };

describe('the header filter of a column shown as checkboxes', () => {
    for (const field of ['flag', 'on']) {
        it(`expect ${field}: a checkbox - checked, not checked, neither - the grid and SQLite the same rows`, async () => {
            const { gridInterface, datasource, element } = await mountGrid(
                config(),
                rows.map((row) => ({ ...row })),
                { key: 'id', fields: { id: 'number', on: 'number' } }
            );
            const box = headerFilterInput(element, field);
            expect(box.type, 'a checkbox in the header').toBe('checkbox');
            expect(box.indeterminate).toBe(true);
            const steps: number[][] = [];
            for (let step = 0; step < 3; step++) {
                const input = headerFilterInput(element, field);
                // the browser's cycle: indeterminate -> checked -> not checked -> (the grid) indeterminate
                input.checked = step !== 1;
                input.indeterminate = false;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                const grid = datasource.getRows().map((row) => row.id as number);
                const filter = gridInterface.getServerFilter();
                const { sql, params } = toSqlWhere(JSON.parse(JSON.stringify(filter)), { dialect: 'sqlite', columns });
                const selected = (
                    db.prepare(`SELECT id FROM t WHERE ${sql} ORDER BY id`).all(...(params as never[])) as { id: number }[]
                ).map((row) => row.id);
                expect(selected, `step ${step}: ${sql}`).toEqual([...grid].sort((a, b) => a - b));
                steps.push(grid);
            }
            // checked: the checked value only (not 'y', not 2); not checked: the others, the blank too; then every row
            expect(steps).toEqual([
                [1, 5],
                [2, 3, 4],
                [1, 2, 3, 4, 5]
            ]);
            expect(gridInterface.getState().headerFilters?.[field] ?? null).toBeDefined();
        });
    }
});
