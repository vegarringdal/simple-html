// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { rowStatusIcon } from '../gridFunctions/rowStatus';
import { MERGE_HIGHLIGHT_MS } from '../gridFunctions/showCellMerged';
import { mountGrid, selectorRowOf, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * How the grid shows live data (item 38): the flash of a cell an upsert changed
 * (GridConfig.mergeHighlight, showCellMerged.ts), and a conflict - the marker of a field in conflict
 * (showCellEdited.ts) and the arrows on the row number with the conflicts in its tooltip
 * (renderRowSelector.ts). The data part - when a merge changes a value, when it is a conflict - is
 * tested in the datasource's tests; the css animation in the real browser (scripts/browser/checks).
 *
 * happy-dom runs a requestAnimationFrame callback in the next task: frame() waits for the grid's frame.
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

const config = (options: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: { price: { label: 'Price' }, stock: { label: 'Stock' } },
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['price'], width: 100 },
            { fields: ['stock'], width: 100 }
        ]
    },
    ...options
});

const rows = () => [
    { id: 1, name: 'a', price: 10, stock: 1 },
    { id: 2, name: 'b', price: 20, stock: 2 },
    { id: 3, name: 'c', price: 30, stock: 3 }
];

const fields = (): DatasourceOptions => ({ key: 'id', fields: { id: 'number', price: 'number', stock: 'number' } });

const mount = (options: Partial<GridConfig> = {}) => mountGrid(config(options), rows(), fields());

/** waits for the grid's animation frame: the rows-changed microtask asks for it first */
const frame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
};

/** the cell element of a body cell: its field and its row in the displayed rows, 0 based */
function cellOf(element: GridElement, field: string, row: number): HTMLElement {
    const input = Array.from(element.querySelectorAll<HTMLInputElement>(`input[data-attribute="${field}"]`)).find(
        (input) => (input.closest('.simple-html-grid-col-cell') as any)?.$row === row
    ) as HTMLInputElement;
    return input.closest('.simple-html-grid-col-cell') as HTMLElement;
}

const flashes = (element: GridElement, field: string, row: number) =>
    cellOf(element, field, row).classList.contains('simple-html-cell-merged');

/** the marker of a cell, null when it has none */
const markerOf = (element: GridElement, field: string, row: number) =>
    cellOf(element, field, row).querySelector<HTMLElement>('.simple-html-cell-edited-marker');

/** what the row number shows: the icon's kind, the tooltip, the screen reader's text */
function status(element: GridElement, row: number) {
    const cell = selectorRowOf(element, row)?.firstElementChild as HTMLElement;
    const icon = cell.querySelector('.simple-html-row-status-icon');
    return {
        icon: icon ? (icon.getAttribute('class') ?? '').replace('simple-html-row-status-icon simple-html-row-status-', '') : null,
        tooltip: cell.getAttribute('data-tooltip'),
        screenReader: cell.querySelector('.simple-html-visually-hidden')?.textContent ?? null
    };
}

describe('merge highlight - the flash of a cell an upsert changed', () => {
    it('expect the class on the cells whose value it changed, not on the others', async () => {
        const { element, datasource } = await mount();
        datasource.upsert([{ id: 2, price: 21 }]);
        await frame();

        expect(flashes(element, 'price', 1)).toBe(true);
        expect(flashes(element, 'name', 1)).toBe(false);
        expect(flashes(element, 'stock', 1)).toBe(false);
        expect(flashes(element, 'price', 0)).toBe(false);
    });

    it('expect none for a value the upsert sends unchanged, or one set from code', async () => {
        const { element, datasource } = await mount();
        datasource.upsert([{ id: 2, price: 20 }]);
        datasource.getDataRows()[0].price = 11;
        await frame();

        expect(flashes(element, 'price', 1)).toBe(false);
        expect(flashes(element, 'price', 0)).toBe(false);
    });

    it('expect the class gone when the cell is rendered after the second', async () => {
        const { element, datasource, gridInterface } = await mount();
        const start = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(start);
        datasource.upsert([{ id: 2, price: 21 }]);
        await frame();
        expect(flashes(element, 'price', 1)).toBe(true);

        // rendered again in the second: it stays, the animation is not started again
        vi.spyOn(Date, 'now').mockReturnValue(start + MERGE_HIGHLIGHT_MS - 1);
        gridInterface.refresh();
        expect(flashes(element, 'price', 1)).toBe(true);
        expect(cellOf(element, 'price', 1).hasAttribute('data-merged-again')).toBe(false);

        vi.spyOn(Date, 'now').mockReturnValue(start + MERGE_HIGHLIGHT_MS);
        gridInterface.refresh();
        expect(flashes(element, 'price', 1)).toBe(false);
    });

    it('expect a new merge while it flashes to start it again: data-merged-again flips', async () => {
        const { element, datasource } = await mount();
        const start = Date.now();
        vi.spyOn(Date, 'now').mockReturnValue(start);
        datasource.upsert([{ id: 2, price: 21 }]);
        await frame();
        const cell = cellOf(element, 'price', 1);

        vi.spyOn(Date, 'now').mockReturnValue(start + 300);
        datasource.upsert([{ id: 2, price: 22 }]);
        await frame();
        expect(cell.classList.contains('simple-html-cell-merged')).toBe(true);
        expect(cell.hasAttribute('data-merged-again')).toBe(true);

        vi.spyOn(Date, 'now').mockReturnValue(start + 600);
        datasource.upsert([{ id: 2, price: 23 }]);
        await frame();
        expect(cell.hasAttribute('data-merged-again')).toBe(false);
    });

    it('expect no flash with mergeHighlight: false', async () => {
        const { element, datasource } = await mount({ mergeHighlight: false });
        datasource.upsert([{ id: 2, price: 21 }]);
        await frame();

        expect(flashes(element, 'price', 1)).toBe(false);
    });
});

describe('conflicts - the marker of the field and the row number', () => {
    /** row 1 (id 2) has its price edited, then the server changes it: a conflict */
    const inConflict = async (options: Partial<GridConfig> = {}) => {
        const mounted = await mount(options);
        mounted.datasource.getDataRows()[1].price = 25;
        mounted.datasource.upsert([{ id: 2, price: 99 }]);
        await frame();
        return mounted;
    };

    it('expect the conflict marker with the server value in its tooltip, the class on the cell', async () => {
        const { element } = await inConflict();

        const cell = cellOf(element, 'price', 1);
        expect(cell.classList.contains('simple-html-cell-conflict')).toBe(true);
        expect(cell.classList.contains('simple-html-cell-edited')).toBe(true);
        const marker = markerOf(element, 'price', 1) as HTMLElement;
        expect(marker.classList.contains('simple-html-cell-conflict-marker')).toBe(true);
        expect(marker.getAttribute('data-tooltip')).toEqual(
            "Changed on the server to 99 while you edited it\nClick to take the server's value"
        );
        // the user's value stays, and it does not flash: the merge did not change it
        expect((cell.querySelector('input') as HTMLInputElement).value).toEqual('25');
        expect(cell.classList.contains('simple-html-cell-merged')).toBe(false);
    });

    it('expect the arrows on the row number, the fields in its tooltip and for a screen reader', async () => {
        const { element, datasource } = await inConflict();
        datasource.getDataRows()[1].stock = 5;
        datasource.upsert([{ id: 2, stock: 7 }]);
        await frame();

        expect(status(element, 1)).toEqual({
            icon: 'conflict',
            tooltip: 'Edited\nChanged on the server too: Price, Stock',
            screenReader: 'Edited, Changed on the server too: Price, Stock'
        });
        expect(status(element, 0).icon).toBeNull();
    });

    it('expect a row the server removed, with changes here, on its row number', async () => {
        const { element, datasource } = await mount();
        datasource.getDataRows()[0].name = 'mine';
        datasource.upsert([rows()[1], rows()[2]], { removeMissing: true });
        await frame();

        expect(status(element, 0)).toMatchObject({
            icon: 'conflict',
            tooltip: 'Edited\nRemoved on the server, it has changes here'
        });
    });

    it('expect the marker without the edited marker too, a plain edited cell without one', async () => {
        const { element, datasource } = await inConflict({ editedMarker: false });
        datasource.getDataRows()[0].price = 12;
        await frame();

        expect(markerOf(element, 'price', 1)?.classList.contains('simple-html-cell-conflict-marker')).toBe(true);
        expect(markerOf(element, 'price', 0)).toBeNull();
    });

    it("expect a click on the marker to take the server's value, the conflict and its look to go", async () => {
        const { element, datasource } = await inConflict();
        (markerOf(element, 'price', 1) as HTMLElement).click();
        await frame();

        expect(datasource.getDataRows()[1].price).toEqual(99);
        expect(datasource.getConflicts()).toEqual([]);
        expect(cellOf(element, 'price', 1).classList.contains('simple-html-cell-conflict')).toBe(false);
        expect(markerOf(element, 'price', 1)).toBeNull();
        expect(status(element, 1).icon).toBeNull();
    });

    it("expect 'keep mine' to bring the edited marker back, the value the user's", async () => {
        const { element, datasource } = await inConflict();
        datasource.resolveConflict(datasource.getDataRows()[1], 'price', 'local');
        await frame();

        const marker = markerOf(element, 'price', 1) as HTMLElement;
        expect(marker.classList.contains('simple-html-cell-conflict-marker')).toBe(false);
        expect(marker.getAttribute('data-tooltip')).toEqual('Original value: 99\nClick to revert');
        expect(cellOf(element, 'price', 1).classList.contains('simple-html-cell-conflict')).toBe(false);
        expect(status(element, 1).icon).toEqual('edited');
    });

    it('expect no click line in a readonly grid', async () => {
        const { element } = await inConflict({ readonly: true });

        expect(markerOf(element, 'price', 1)?.getAttribute('data-tooltip')).toEqual(
            'Changed on the server to 99 while you edited it'
        );
    });
});

describe('conflicts - one icon on the row number', () => {
    it('expect a deletion mark and an error to win over a conflict, a conflict over new and edited', () => {
        expect(rowStatusIcon('edited', false, true)).toEqual('conflict');
        expect(rowStatusIcon('new', false, true)).toEqual('conflict');
        expect(rowStatusIcon(null, false, true)).toEqual('conflict');
        expect(rowStatusIcon('edited', true, true)).toEqual('error');
        expect(rowStatusIcon('deleted', true, true)).toEqual('deleted');
        expect(rowStatusIcon('edited', false, false)).toEqual('edited');
    });
});
