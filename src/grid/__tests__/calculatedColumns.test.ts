// @vitest-environment happy-dom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { isGroupRow } from '../../datasource/entity';
import { where } from '../../datasource/filterExpression';
import type { CalculatedColumn } from '../calculatedColumns';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { columnChooserFields } from '../gridFunctions/contextMenuColumnChooser';
import { filterCallback } from '../gridFunctions/filterCallback';
import { GridInterface } from '../gridInterface';
import { mountGrid, renderedColumn, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf } from './interactionTestHelpers';

/**
 * Calculated columns in the grid (GridConfig.calculatedColumns, GridState.calculatedColumns): the values
 * the rows answer for them, shown in the cells, read only; sorted, filtered (the header filter too),
 * grouped, aggregated, formatted, exported, found; the state round trip; a removed one leaves the layout,
 * the sort and the filter; a formula with a problem throws before anything changes; an edit, undo and
 * upsert of a field it reads change it - and it is never an edit itself.
 */

const originalTimeZone = process.env.TZ;
beforeAll(() => {
    process.env.TZ = 'Europe/Oslo';
    stubCanvas();
    stubElementSizes();
});
afterAll(() => {
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});
beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 22, 10, 0));
});
afterEach(() => {
    vi.useRealTimers();
});

const rows = () => [
    { id: 1, name: 'Ann', price: 10, qty: 3, due: new Date(2026, 10, 20), status: 'open' },
    { id: 2, name: 'Bob', price: 2.5, qty: 4, due: new Date(2026, 10, 25), status: 'done' },
    { id: 3, name: 'Cid', price: 100, qty: null, due: null, status: 'open' }
];

const fields = (): DatasourceOptions => ({
    key: 'id',
    fields: { id: 'number', price: 'number', qty: 'number', due: 'date' }
});

const CALCULATED: Record<string, CalculatedColumn> = {
    total: { formula: '{price} * {qty}', label: 'Total' },
    daysLate: { formula: 'IF({status} = "done", 0, DAYS({due}, TODAY()))', label: 'Days late' },
    size: { formula: 'IF({total} >= 25, "big", "small")' }
};

const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    calculatedColumns: CALCULATED,
    columns: { total: { aggregate: 'sum' } },
    layout: {
        center: ['name', 'price', 'qty', 'total', 'daysLate', 'size', 'status'].map((field) => ({ fields: [field], width: 90 }))
    },
    ...more
});

const mount = (more: Partial<GridConfig> = {}, data = rows()) => mountGrid(config(more), data, fields());

/** waits for the grid's animation frame: the rows-changed microtask asks for it first */
const frame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
};

const column = (element: GridElement, field: string) => renderedColumn(element, field);

describe('calculated columns - the values', () => {
    it('expect the cells to show the values the formulas compute, a row without a value empty', async () => {
        const { element } = await mount();

        expect(column(element, 'total')).toEqual(['30', '10', '']);
        // due 2026-11-20, today 2026-11-22: 2 days late; done: 0; no due date: blank
        expect(column(element, 'daysLate')).toEqual(['2', '0', '']);
        // a calculated column reads another; a comparison with a blank is false
        expect(column(element, 'size')).toEqual(['big', 'small', 'small']);
    });

    it('expect the datasource to have their types and labels, the rows to answer them - and nothing stored on a row', async () => {
        const { datasource } = await mount();
        const row = datasource.getAllData()[0];

        expect(datasource.getField('total')).toMatchObject({ type: 'number', label: 'Total' });
        expect(datasource.getField('size')).toMatchObject({ type: 'text', label: 'Size' });
        expect(row.total).toEqual(30);
        expect(Object.keys(row)).not.toContain('total');
        expect(JSON.parse(JSON.stringify(row))).not.toHaveProperty('total');
        expect(row.__rowState).toBeUndefined();
        expect(datasource.getChanges().modifiedEntities).toEqual([]);
    });

    it('expect an edit of a field it reads to change it on screen, undo to take it back - only the edit is a change', async () => {
        const { element, datasource } = await mount();
        const row = datasource.getAllData()[0];

        row.qty = 5;
        await frame();
        expect(column(element, 'total')[0]).toEqual('50');
        expect(column(element, 'size')[0]).toEqual('big');
        expect(datasource.getChanges().modifiedEntities).toEqual([{ id: 1, qty: 5 }]);

        datasource.undo();
        await frame();
        expect(column(element, 'total')[0]).toEqual('30');
        expect(datasource.hasChanges()).toBe(false);
    });

    it('expect an upsert of a field it reads to change it, the totals row and the aggregate to follow', async () => {
        const { element, datasource } = await mount({ totalsRow: true });

        expect(datasource.aggregate('total', 'sum')).toEqual(40);
        datasource.upsert([{ id: 2, price: 5 }]);
        await frame();

        expect(column(element, 'total')[1]).toEqual('20');
        expect(datasource.aggregate('total', 'sum')).toEqual(50);
        expect(element.querySelector('.simple-html-grid-totals')?.textContent).toContain('50');
    });

    it('expect a calculated column to be read only: no edit from the grid, setting it does nothing', async () => {
        const { gridInterface, datasource } = await mount();
        const row = datasource.getAllData()[0];

        expect(gridInterface.__isCellReadonly(row, 'total')).toBe(true);
        row.total = 999;
        expect(row.total).toEqual(30);
        expect(datasource.hasChanges()).toBe(false);
    });

    it('expect the value of a day: TODAY() is today when it is read', async () => {
        const { datasource } = await mount();
        const row = datasource.getAllData()[0];

        expect(row.daysLate).toEqual(2);
        vi.setSystemTime(new Date(2026, 10, 25, 9, 0));
        expect(row.daysLate).toEqual(5);
    });
});

describe('calculated columns - sort, filter, group, aggregate', () => {
    it('expect a sort on a calculated column to sort on its values, blank first as any number', async () => {
        const { element, datasource } = await mount();

        datasource.sort({ attribute: 'total', ascending: false });

        expect(column(element, 'name')).toEqual(['Ann', 'Bob', 'Cid']);
        datasource.sort({ attribute: 'total', ascending: true });
        expect(column(element, 'name')).toEqual(['Cid', 'Bob', 'Ann']);
    });

    it('expect the header filter and a filter of code to filter on the values computed per row', async () => {
        const { element, datasource } = await mount();
        const grid = gridOf(element);

        filterCallback(grid, 20, 'total');
        expect(column(element, 'name')).toEqual(['Ann']);
        expect(gridOf(element).gridInterface.getState().filter).toMatchObject({ children: [{ field: 'total' }] });

        datasource.filter(where('size', 'EQUAL', 'small'));
        expect(column(element, 'name')).toEqual(['Bob', 'Cid']);
        datasource.filter(where('total', 'IS_BLANK'));
        expect(column(element, 'name')).toEqual(['Cid']);
    });

    it('expect a grouping on a calculated column, and the sum of the group', async () => {
        const { datasource } = await mount();

        datasource.group([{ attribute: 'size', title: 'Size' }]);
        datasource.expandGroup();
        const groups = datasource.getRows().filter(isGroupRow);

        expect(groups.map((group) => group.__groupName)).toEqual(['Size: big', 'Size: small']);
        expect(datasource.aggregate('total', 'sum', groups[0])).toEqual(30);
        expect(datasource.aggregate('total', 'sum', groups[1])).toEqual(10);
    });

    it('expect a kept aggregate to be computed again when a field it reads changes, and only then', async () => {
        const { datasource } = await mount();
        const count = () => datasource.getDataContainer().__getChangeCount('total');

        expect(datasource.aggregate('total', 'sum')).toEqual(40);
        const kept = count();
        datasource.getAllData()[0].name = 'Anne';
        expect(count()).toEqual(kept);
        expect(datasource.aggregate('total', 'sum')).toEqual(40);
        datasource.getAllData()[0].price = 20;
        expect(datasource.aggregate('total', 'sum')).toEqual(70);
    });

    it('expect the CSV and the Excel export and Find to have the values computed', async () => {
        const { gridInterface } = await mount();

        const csv = gridInterface.getCsv({ formatted: false });
        expect(csv.split('\r\n')[1]).toEqual('Ann,10,3,30,2,big,open');
        expect(gridInterface.find('small')).toEqual(2);
        const blob = await gridInterface.getExcel();
        expect(blob.size).toBeGreaterThan(0);
    });

    it('expect a calculated text that starts with = to be escaped in the CSV, as any text: no formula for the spreadsheet', async () => {
        const { gridInterface } = await mount({
            calculatedColumns: { code: { formula: '"=" & {name} & "+1"' } },
            columns: {},
            layout: {
                center: [
                    { fields: ['name'], width: 90 },
                    { fields: ['code'], width: 90 }
                ]
            }
        });

        expect(gridInterface.getCsv().split('\r\n')[1]).toEqual("Ann,'=Ann+1");
        // and a formula that makes markup is a text: the cell's value, never html
        gridInterface.setState({ calculatedColumns: { code: { formula: '"<img src=x onerror=alert(1)>"' } } });
        expect(gridInterface.getDatasource().getAllData()[0].code).toEqual('<img src=x onerror=alert(1)>');
    });
});

describe('calculated columns - the state', () => {
    it('expect getState() to have them, and a state saved as JSON to give them back', async () => {
        const { gridInterface } = await mount();
        const saved = JSON.parse(JSON.stringify(gridInterface.getState()));

        expect(saved.calculatedColumns).toEqual(CALCULATED);
        gridInterface.setState({ calculatedColumns: {} });
        expect(gridInterface.getState().calculatedColumns).toEqual({});
        gridInterface.setState(saved);
        expect(gridInterface.getState().calculatedColumns).toEqual(CALCULATED);
        expect(gridInterface.getState().layout.center.map((each) => each.fields[0])).toContain('size');
        expect(gridInterface.getDatasource().getAllData()[0].size).toEqual('big');
    });

    it('expect one left out to leave the layout, the sort, the filter, the header filter, the detail form, its format', async () => {
        const { gridInterface, datasource, element } = await mount({
            columns: { total: { aggregate: 'sum', format: { number: { decimals: 2 } } } },
            detailForm: { show: true, fields: ['name', 'size'] }
        });
        filterCallback(gridOf(element), 'big', 'size');
        datasource.sort({ attribute: 'size', ascending: true });

        const { size: _, ...rest } = CALCULATED;
        gridInterface.setState({ calculatedColumns: rest });
        const state = gridInterface.getState();

        expect(state.layout.center.map((each) => each.fields[0])).not.toContain('size');
        expect(state.filter).toBeNull();
        expect(state.sorting).toEqual([]);
        expect(state.headerFilters).toEqual({});
        expect(state.detailForm.fields).toEqual(['name']);
        expect(datasource.getAllData()[0].size).toBeUndefined();
        expect(column(element, 'name')).toEqual(['Ann', 'Bob', 'Cid']);
        // the column chooser does not offer it
        expect(columnChooserFields(gridOf(element), '').map((each) => each.field)).not.toContain('size');
        expect(state.formats.total).toEqual({ number: { decimals: 2 } });
    });

    it('expect resetState() to go back to the config’s, a new one from setState() shown at once', async () => {
        const { gridInterface, element } = await mount();

        gridInterface.setState({
            calculatedColumns: { ...CALCULATED, half: { formula: '{price} / 2' } },
            layout: {
                center: [
                    { fields: ['name'], width: 90 },
                    { fields: ['half'], width: 90 }
                ]
            }
        });
        expect(column(element, 'half')).toEqual(['5', '1.25', '50']);

        gridInterface.resetState();
        expect(gridInterface.getState().calculatedColumns).toEqual(CALCULATED);
        expect(column(element, 'total')).toEqual(['30', '10', '']);
    });

    it('expect updateConfig({ calculatedColumns }) to show them now, and resetState() to go back to them', async () => {
        const { gridInterface } = await mount();

        gridInterface.updateConfig({ calculatedColumns: { total: { formula: '{price} + {qty}' } } });
        expect(gridInterface.getDatasource().getAllData()[0].total).toEqual(13);
        expect(gridInterface.getDatasource().getAllData()[0].size).toBeUndefined();
        gridInterface.resetState();
        expect(gridInterface.getState().calculatedColumns).toEqual({ total: { formula: '{price} + {qty}' } });
    });

    it('expect a formula with a problem to throw a TypeError naming it - and nothing to change', async () => {
        const { gridInterface } = await mount();
        const before = gridInterface.getState();

        expect(() => gridInterface.setState({ calculatedColumns: { bad: { formula: '{price} *' } } })).toThrow(
            new TypeError('setState: calculatedColumns.bad.formula: The formula ends too soon')
        );
        expect(() => gridInterface.setState({ calculatedColumns: { bad: { formula: '{name} * 2' } } })).toThrow(
            /calculatedColumns\.bad\.formula: \* takes a number: \{name\} is a text/
        );
        expect(() => gridInterface.setState({ calculatedColumns: { bad: { formula: '{nope} + 1' } } })).toThrow(
            /No field \{nope\}/
        );
        expect(() => gridInterface.setState({ calculatedColumns: { a: { formula: '{b}' }, b: { formula: '{a} + 1' } } })).toThrow(
            /is computed from itself/
        );
        expect(() => gridInterface.setState({ calculatedColumns: { bad: { formula: '1', type: 'text' } } })).toThrow(
            /The formula gives a number, it must give a text/
        );
        // a format that does not fit the column's type: the new calculated columns are taken back
        expect(() =>
            gridInterface.setState({
                calculatedColumns: { half: { formula: '{price} / 2' } },
                formats: { half: { date: 'weekIso' } }
            })
        ).toThrow(/formats\.half\.date is for a date or datetime field/);
        expect(gridInterface.getState()).toEqual(before);
        expect(gridInterface.getDatasource().getField('half').type).toEqual('text');
    });

    it('expect a field name to be a plain name of its own: not a field of the data, the grid’s own, or every object’s', async () => {
        const { gridInterface } = await mount();
        const set = (name: string) => () => gridInterface.setState({ calculatedColumns: { [name]: { formula: '1' } } });

        expect(set('price')).toThrow(/'price' is a field of the datasource or its rows/);
        expect(set('name')).toThrow(/'name' is a field of the datasource or its rows/);
        for (const name of [
            '__KEY',
            '__proto__',
            'constructor',
            'toString',
            'hasOwnProperty',
            '1st',
            'a b',
            'a-b',
            '',
            'x'.repeat(65)
        ]) {
            expect(set(name), name).toThrow(TypeError);
        }
        expect(() => gridInterface.setState(JSON.parse('{ "calculatedColumns": { "__proto__": { "formula": "1" } } }'))).toThrow(
            /a field name is a letter/
        );
        expect(set('net_2')).not.toThrow();
    });

    it('expect the config to be checked too: a TypeError when the grid is made, the datasource left as it was', async () => {
        const datasource = new Datasource(fields());
        datasource.setData(rows());

        expect(() => new GridInterface(config({ calculatedColumns: { bad: { formula: 'IF(1, 2, 3)' } } }), datasource)).toThrow(
            /GridConfig: calculatedColumns\.bad\.formula: IF takes true \/ false: 1 is a number/
        );
        expect(() => new GridInterface(config({ columns: { total: { format: { date: 'weekIso' } } } }), datasource)).toThrow(
            /columns\.total\.format\.date is for a date or datetime field, 'total' is number/
        );
        expect(datasource.__getCalculatedField('total')).toBeUndefined();
        expect(datasource.getAllData()[0].total).toBeUndefined();
    });

    it('expect destroy() to take the calculated fields back from the datasource', async () => {
        const { gridInterface, datasource } = await mount();

        gridInterface.destroy();

        expect(datasource.getAllData()[0].total).toBeUndefined();
        expect(datasource.getField('total').type).toEqual('text');
    });

    it('expect the detail form to show a calculated value, read only', async () => {
        const { element } = await mount({ detailForm: { show: true, fields: ['name', 'total'] } });
        gridOf(element).gridInterface.getDatasource().select(1);
        await frame();

        const input = element.querySelector<HTMLInputElement>('.simple-html-grid-detail-form-field[data-field="total"] input');
        expect(input?.value).toEqual('30');
        expect(input?.readOnly).toBe(true);
    });
});
