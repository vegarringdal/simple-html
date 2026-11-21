// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { fillRows } from '../gridFunctions/fillDown';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * Fill down (plan item 34, fillDown.ts): Ctrl+D / Cmd+D in a cell and gridInterface.fillDown() copy the
 * top row of each range into the rows under it - a range of one row, or the cell with the focus, takes
 * the row above - and the fill handle at the bottom right corner of the last range fills the rows it is
 * dragged over. The drag itself is checked in the real browser (fill-check.js, IMPORVEMENT.md): happy-dom
 * has no hit test.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

// name | status, born, code (readonly), team
const config = (options: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: { code: { readonly: true } },
    layout: {
        left: [{ fields: ['name'], width: 100 }],
        center: [
            { fields: ['status'], width: 100 },
            { fields: ['born'], width: 100 },
            { fields: ['code'], width: 100 },
            { fields: ['team'], width: 100 }
        ]
    },
    ...options
});

const rows = () => [
    { id: 1, name: 'Ann', status: 'open', born: new Date(2000, 0, 1), code: 'A', team: 'x' },
    { id: 2, name: 'Bob', status: 'done', born: null, code: 'B', team: 'x' },
    { id: 3, name: 'Cid', status: null, born: new Date(1990, 5, 6), code: 'C', team: 'y' },
    { id: 4, name: 'Dan', status: 'late', born: null, code: 'D', team: 'y' }
];

const fields = (): DatasourceOptions => ({ key: 'id', fields: { id: 'number', born: 'date' } });

const mount = (options: Partial<GridConfig> = {}) => mountGrid(config(options), rows(), fields());

/** the cell element of a body cell: its field and its row in the displayed rows, 0 based */
function cellOf(element: GridElement, field: string, row: number): HTMLElement {
    const input = Array.from(element.querySelectorAll<HTMLInputElement>(`input[data-attribute="${field}"]`)).find(
        (input) => (input.closest('.simple-html-grid-col-cell') as any)?.$row === row
    ) as HTMLInputElement;
    return input.closest('.simple-html-grid-col-cell') as HTMLElement;
}

/** a key down in a cell's input, as the browser sends it: returns the event, to see if it was used */
function keyInCell(element: GridElement, field: string, row: number, init: KeyboardEventInit) {
    const input = cellOf(element, field, row).querySelector('input') as HTMLInputElement;
    input.focus();
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(event);
    return event;
}

const column = (element: { datasource: { getDataRows(): any[] } }, field: string) =>
    element.datasource.getDataRows().map((row) => row[field]);

describe('fill down - Ctrl+D', () => {
    it("expect the top row of the range in the rows under it, a readonly column skipped, Ctrl+D not the browser's", async () => {
        const mounted = await mount();
        const { element, gridInterface } = mounted;
        gridInterface.setRanges([{ fromRow: 0, fromField: 'status', toRow: 2, toField: 'code' }]);

        const event = keyInCell(element, 'status', 0, { key: 'd', ctrlKey: true });

        expect(event.defaultPrevented).toBe(true);
        expect(column(mounted, 'status')).toEqual(['open', 'open', 'open', 'late']);
        expect(column(mounted, 'born').map((date) => date?.getTime() ?? null)).toEqual([
            new Date(2000, 0, 1).getTime(),
            new Date(2000, 0, 1).getTime(),
            new Date(2000, 0, 1).getTime(),
            null
        ]);
        // a copy of the date, not the same object
        expect(column(mounted, 'born')[1]).not.toBe(column(mounted, 'born')[0]);
        // readonly: left as it was
        expect(column(mounted, 'code')).toEqual(['A', 'B', 'C', 'D']);
    });

    it('expect one step of the undo history', async () => {
        const mounted = await mount();
        const { element, gridInterface, datasource } = mounted;
        gridInterface.setRanges([{ fromRow: 0, fromField: 'status', toRow: 3, toField: 'status' }]);
        keyInCell(element, 'status', 0, { key: 'd', ctrlKey: true });
        expect(column(mounted, 'status')).toEqual(['open', 'open', 'open', 'open']);

        datasource.undo();
        expect(column(mounted, 'status')).toEqual(['open', 'done', null, 'late']);
    });

    it('expect a range of one row, or the cell with the focus, to take the row above', async () => {
        const mounted = await mount();
        const { element, gridInterface } = mounted;
        gridInterface.setRanges([{ fromRow: 2, fromField: 'status', toRow: 2, toField: 'team' }]);
        keyInCell(element, 'status', 2, { key: 'd', metaKey: true });
        expect(column(mounted, 'status')).toEqual(['open', 'done', 'done', 'late']);
        expect(column(mounted, 'team')).toEqual(['x', 'x', 'x', 'y']);

        gridInterface.clearRanges();
        keyInCell(element, 'name', 3, { key: 'D', ctrlKey: true });
        expect(column(mounted, 'name')).toEqual(['Ann', 'Bob', 'Cid', 'Cid']);
    });

    it('expect nothing for the first row, which has none above', async () => {
        const mounted = await mount();
        const event = keyInCell(mounted.element, 'name', 0, { key: 'd', ctrlKey: true });

        expect(event.defaultPrevented).toBe(true);
        expect(column(mounted, 'name')).toEqual(['Ann', 'Bob', 'Cid', 'Dan']);
    });

    it('expect Ctrl+Shift+D and a readonly grid to leave the key to the browser', async () => {
        const mounted = await mount();
        expect(keyInCell(mounted.element, 'name', 1, { key: 'D', ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false);

        const readonly = await mount({ readonly: true });
        expect(keyInCell(readonly.element, 'name', 1, { key: 'd', ctrlKey: true }).defaultPrevented).toBe(false);
        expect(column(readonly, 'name')).toEqual(['Ann', 'Bob', 'Cid', 'Dan']);
    });

    it('expect group rows skipped: the first data row of the range is the source', async () => {
        const mounted = await mount();
        const { gridInterface, datasource } = mounted;
        // team x: Ann, Bob; team y: Cid, Dan - displayed [x, Ann, Bob, y, Cid, Dan]
        datasource.group([{ attribute: 'team', title: 'Team' }]);
        datasource.expandGroup();
        gridInterface.setRanges([{ fromRow: 0, fromField: 'status', toRow: 5, toField: 'status' }]);

        gridInterface.fillDown();

        expect(datasource.getAllData().map((row: any) => row.status)).toEqual(['open', 'open', 'open', 'open']);
    });

    it('expect gridInterface.fillDown() to fill the ranges, and nothing without ranges or focus', async () => {
        const mounted = await mount();
        mounted.gridInterface.fillDown();
        expect(column(mounted, 'status')).toEqual(['open', 'done', null, 'late']);

        mounted.gridInterface.setRanges([{ fromRow: 1, fromField: 'status', toRow: 3, toField: 'status' }]);
        mounted.gridInterface.fillDown();
        expect(column(mounted, 'status')).toEqual(['open', 'done', 'done', 'done']);
    });
});

describe('fill down - the fill handle', () => {
    const handles = (element: GridElement) => Array.from(element.querySelectorAll<HTMLElement>('.simple-html-grid-fill-handle'));

    it('expect one handle, in the cell at the bottom right corner of the last range', async () => {
        const { element, gridInterface } = await mount();
        expect(handles(element)).toEqual([]);

        gridInterface.setRanges([
            { fromRow: 0, fromField: 'name', toRow: 0, toField: 'status' },
            { fromRow: 2, fromField: 'born', toRow: 1, toField: 'status' }
        ]);
        expect(handles(element)).toHaveLength(1);
        const cell = handles(element)[0].closest('.simple-html-grid-col-cell') as any;
        expect([cell.$row, cell.$attribute]).toEqual([2, 'born']);
        expect(handles(element)[0].getAttribute('aria-hidden')).toEqual('true');

        // it moves with the ranges, and goes with them
        gridInterface.setRanges([{ fromRow: 3, fromField: 'team', toRow: 1, toField: 'name' }]);
        expect(handles(element)).toHaveLength(1);
        const moved = handles(element)[0].closest('.simple-html-grid-col-cell') as any;
        expect([moved.$row, moved.$attribute]).toEqual([3, 'team']);

        gridInterface.clearRanges();
        expect(handles(element)).toEqual([]);
    });

    it('expect it under the empty cell below a field, when a column next to it stacks two fields', async () => {
        // status and team stacked, born on its own: under born is an empty cell, the range goes round it
        const { element, gridInterface } = await mount({
            layout: {
                center: [
                    { fields: ['status', 'team'], width: 100 },
                    { fields: ['born'], width: 100 }
                ]
            }
        });
        gridInterface.setRanges([{ fromRow: 0, fromField: 'status', toRow: 1, toField: 'born' }]);

        expect(handles(element)).toHaveLength(1);
        const cell = handles(element)[0].closest('.simple-html-grid-col-cell') as any;
        expect(cell.$row).toEqual(1);
        expect(cell.$attribute).toBeFalsy();
        expect((cell.previousElementSibling as any).$attribute).toEqual('born');
    });

    it('expect no handle in a readonly grid', async () => {
        const { element, gridInterface } = await mount({ readonly: true });
        gridInterface.setRanges([{ fromRow: 0, fromField: 'name', toRow: 1, toField: 'status' }]);

        expect(handles(element)).toEqual([]);
    });

    it('expect the rows it was dragged over to get the rows of the range, repeated from its top', async () => {
        const mounted = await mount();
        mounted.datasource.addNewEmpty({ name: 'Eve' }, { scrollTo: false });
        mounted.datasource.addNewEmpty({ name: 'Fay' }, { scrollTo: false });

        // the range of the first two rows, dragged down over the next four
        fillRows(mounted.gridInterface, { fromRow: 0, fromField: 'status', toRow: 1, toField: 'status' }, 2, 5);

        expect(column(mounted, 'status')).toEqual(['open', 'done', 'open', 'done', 'open', 'done']);
        // undone: the new rows never had a status
        mounted.datasource.undo();
        expect(column(mounted, 'status')).toEqual(['open', 'done', null, 'late', undefined, undefined]);
    });
});
