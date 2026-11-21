// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { mountGrid, renderedColumn, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { sleep } from './interactionTestHelpers';

/**
 * Reactive cells: the grid follows the datasource's rows-changed event and renders the changed rows
 * that are on screen in the next animation frame - a value set from code, by undo or by upsert() shows
 * without refresh(). The input the user is typing in is never rendered over. And a vertical scroll
 * renders only the rows that scroll in.
 *
 * happy-dom runs a requestAnimationFrame callback in the next task (setImmediate): frame() waits for
 * the grid's frame.
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
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['price'], width: 100 }
        ]
    },
    ...options
});

const rows = (count = 5) => Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `n${i + 1}`, price: (i + 1) * 10 }));

const fields = (): DatasourceOptions => ({ key: 'id', fields: { price: 'number' } });

const mount = (options: Partial<GridConfig> = {}, data = rows()) => mountGrid(config(options), data, fields());

/** waits for the grid's animation frame: the rows-changed microtask asks for it first */
const frame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
};

/** the input of a body cell: its field and its row in the displayed rows, 0 based */
function cellInput(element: GridElement, field: string, row: number): HTMLInputElement {
    return Array.from(element.querySelectorAll<HTMLInputElement>(`input[data-attribute="${field}"]`)).find(
        (input) => (input.closest('.simple-html-grid-col-cell') as any)?.$row === row
    ) as HTMLInputElement;
}

/** the row number cell of a displayed row: its classes show the row's state */
const selectorCell = (element: GridElement, row: number) =>
    Array.from(element.querySelectorAll('.simple-html-grid-body-row-container-selector > .simple-html-grid-row')).find(
        (rowElement) => (rowElement as any).$row === row
    )?.firstElementChild as HTMLElement;

/** types into a body cell as the user does: the focus once, then the text and an input event per key */
function typeInCell(input: HTMLInputElement, value: string) {
    if (document.activeElement !== input) {
        input.focus();
    }
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** the focus leaves the cell: change and blur as a browser sends them, then the focus moves */
function leaveCell(input: HTMLInputElement) {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
}

describe('reactive cells - a value set from code', () => {
    it('expect it to show in the next frame, without refresh()', async () => {
        const { element, datasource } = await mount();
        datasource.getDataRows()[1].name = 'changed';
        expect(renderedColumn(element, 'name')[1]).toEqual('n2');

        await frame();
        expect(renderedColumn(element, 'name')).toEqual(['n1', 'changed', 'n3', 'n4', 'n5']);
    });

    it('expect many changes in one run to be rendered in one frame', async () => {
        const { element, datasource } = await mount();
        const raf = vi.spyOn(window, 'requestAnimationFrame');
        for (const row of datasource.getDataRows()) {
            row.price = row.price + 1;
            row.name = `${row.name}!`;
        }
        await frame();
        // the grid's frame, and the one frame() waits on
        expect(raf).toHaveBeenCalledTimes(2);
        expect(renderedColumn(element, 'price')).toEqual(['11', '21', '31', '41', '51']);
        expect(renderedColumn(element, 'name')).toEqual(['n1!', 'n2!', 'n3!', 'n4!', 'n5!']);
    });

    it('expect the row state on the row number, the edited marker and the errors', async () => {
        const { element, datasource } = await mountGrid(config(), rows(), {
            key: 'id',
            fields: { price: { type: 'number', validate: [{ id: 'min', value: 0 }] } }
        });
        datasource.getDataRows()[2].price = -1;
        await frame();
        const cell = cellInput(element, 'price', 2).closest('.simple-html-grid-col-cell') as HTMLElement;
        expect(cell.classList.contains('simple-html-cell-edited')).toBe(true);
        expect(cell.getAttribute('data-tooltip')).toContain('at least 0');
        expect(selectorCell(element, 2).querySelector('.simple-html-row-status-icon')).not.toBeNull();
    });

    it('expect undo, a deletion mark and a server error to show', async () => {
        const { element, datasource } = await mount();
        const row = datasource.getDataRows()[0];
        row.name = 'changed';
        await sleep(0);
        datasource.undo();
        await frame();
        expect(renderedColumn(element, 'name')[0]).toEqual('n1');

        datasource.getDataContainer().markForDeletion(row);
        await frame();
        expect(cellInput(element, 'name', 0).closest('.simple-html-cell-deleted')).not.toBeNull();

        datasource.getDataContainer().setErrors(new Map([['2', 'taken']]));
        await frame();
        expect(selectorCell(element, 1).getAttribute('data-tooltip')).toContain('taken');
    });

    it('expect a row off screen to show its new values when it scrolls in', async () => {
        const { element, datasource } = await mount({}, rows(200));
        datasource.getDataRows()[150].name = 'far away';
        await frame();
        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        scroller.scrollTop = 140 * 22;
        scroller.dispatchEvent(new Event('scroll'));
        await sleep(200);
        expect(cellInput(element, 'name', 150).value).toEqual('far away');
    });

    it('expect the row after a changed row with dimRepeatedValues: its dimming depends on the row above', async () => {
        const data = rows();
        data[1].name = 'n1';
        const { element, datasource } = await mount({ dimRepeatedValues: true }, data);
        expect(cellInput(element, 'name', 1).getAttribute('data-repeated-value')).toEqual('true');
        datasource.getDataRows()[0].name = 'other';
        await frame();
        expect(cellInput(element, 'name', 1).getAttribute('data-repeated-value')).toEqual('false');
    });

    it('expect the frame to be cancelled when the grid is gone, and no render after', async () => {
        const { element, datasource, gridInterface } = await mount();
        const grid = (element as any).grid;
        datasource.getDataRows()[0].name = 'changed';
        await Promise.resolve();
        expect(grid.rowsFrame).not.toBeNull();
        gridInterface.destroy();
        expect(grid.rowsFrame).toBeNull();
        datasource.getDataRows()[0].name = 'again';
        await frame();
        expect(grid.rowsFrame).toBeNull();
        expect(grid.changedRows.size).toBe(0);
    });
});

describe('reactive cells - the input the user types in', () => {
    it('expect what is typed to stay, the rest of the row to render', async () => {
        const { element, datasource, gridInterface } = await mount();
        const input = cellInput(element, 'price', 1);
        // 12. is 12 for the number formatter: rendering the cell would make it 12
        typeInCell(input, '12.');
        const row = datasource.getDataRows()[1];
        expect(row.price).toBe(12);
        row.name = 'from code';
        await frame();
        expect(input.value).toEqual('12.');
        expect(document.activeElement).toBe(input);
        expect(cellInput(element, 'name', 1).value).toEqual('from code');

        // refresh() leaves it too
        gridInterface.refresh();
        expect(input.value).toEqual('12.');

        // once the focus leaves it, it shows the value
        leaveCell(input);
        await frame();
        expect(input.value).toEqual('12');
    });

    it('expect a focused cell the user has not typed in to show a new value', async () => {
        const { element, datasource } = await mount();
        const input = cellInput(element, 'price', 1);
        input.focus();
        datasource.upsert([{ id: 2, price: 99 }]);
        await frame();
        expect(input.value).toEqual('99');
    });

    it('expect an upsert to keep what is typed and make a conflict, and the server value to be the original', async () => {
        const { element, datasource } = await mount();
        const input = cellInput(element, 'price', 1);
        typeInCell(input, '12.');
        datasource.upsert([
            { id: 2, price: 99, name: 'server' },
            { id: 3, price: 31 }
        ]);
        await frame();
        expect(input.value).toEqual('12.');
        expect(cellInput(element, 'name', 1).value).toEqual('server');
        expect(cellInput(element, 'price', 2).value).toEqual('31');
        expect(datasource.getConflicts()).toMatchObject([{ field: 'price', local: 12, remote: 99 }]);
    });

    it('expect an upsert that adds rows to keep the input and its focus: the row elements stay', async () => {
        const { element, datasource } = await mount();
        const input = cellInput(element, 'price', 1);
        typeInCell(input, '12.');
        datasource.upsert([{ id: 6, name: 'n6', price: 60 }]);
        expect(input.isConnected).toBe(true);
        expect(document.activeElement).toBe(input);
        expect(input.value).toEqual('12.');
        expect(renderedColumn(element, 'name')).toEqual(['n1', 'n2', 'n3', 'n4', 'n5', 'n6']);

        // the next keystroke writes the row typed in
        typeInCell(input, '12.5');
        expect(datasource.getDataRows()[1].price).toBe(12.5);
    });

    it('expect the cell typed in to keep its row when an upsert moves the rows under it', async () => {
        const { element, datasource } = await mount();
        datasource.sort({ attribute: 'price', ascending: true });
        const input = cellInput(element, 'price', 1);
        typeInCell(input, '12.');
        // a row before it: the row element of the input shows another row now
        datasource.upsert([{ id: 6, name: 'n0', price: 0 }]);
        expect(input.value).toEqual('12.');
        typeInCell(input, '12.5');
        expect(datasource.getAllData()[1].price).toBe(12.5);

        // once the focus leaves it, every row is rendered where it is
        leaveCell(input);
        await frame();
        expect(renderedColumn(element, 'name')).toEqual(['n0', 'n1', 'n2', 'n3', 'n4', 'n5']);
        expect(renderedColumn(element, 'price')).toEqual(['0', '10', '12.5', '30', '40', '50']);
    });
});

describe('reactive cells - upsert', () => {
    it('expect the values an upsert changed to show, without a rebuild', async () => {
        const { element, datasource, gridInterface } = await mount();
        const rebuild = vi.spyOn((element as any).grid, 'rebuild');
        datasource.upsert([
            { id: 1, price: 11 },
            { id: 4, name: 'four' }
        ]);
        await frame();
        expect(renderedColumn(element, 'price')).toEqual(['11', '20', '30', '40', '50']);
        expect(renderedColumn(element, 'name')).toEqual(['n1', 'n2', 'n3', 'four', 'n5']);
        expect(rebuild).not.toHaveBeenCalled();
        expect(gridInterface.getDatasource().getChanges().modifiedEntities).toEqual([]);
    });

    it('expect rows added and removed to show, the footer to count them', async () => {
        const { element, datasource } = await mount();
        datasource.upsert([{ id: 1 }, { id: 3 }, { id: 9, name: 'n9', price: 90 }], { removeMissing: true });
        expect(renderedColumn(element, 'name')).toEqual(['n1', 'n3', 'n9']);
        expect(element.querySelector('.simple-html-grid-footer')?.textContent).toContain('3/3');
    });

    it('expect the scroll position to stay', async () => {
        const { element, datasource } = await mount({}, rows(200));
        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        scroller.scrollTop = 100 * 22;
        scroller.dispatchEvent(new Event('scroll'));
        await sleep(200);
        datasource.upsert([{ id: 300, name: 'new', price: 1 }, ...rows(200).slice(0, 199)], { removeMissing: true });
        expect(scroller.scrollTop).toBe(100 * 22);
        expect(cellInput(element, 'name', 100).value).toEqual('n101');
    });
});

describe('reactive cells - a vertical scroll renders the rows that scroll in', () => {
    it('expect a scroll of one row to render the cells of one row', async () => {
        let rendered: number[] = [];
        const { element, datasource } = await mountGrid(config(), rows(200), fields(), {
            cellClass: (row) => {
                rendered.push(row.id);
                return null;
            }
        });
        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        await sleep(0);
        rendered = [];
        scroller.scrollTop = 22;
        scroller.dispatchEvent(new Event('scroll'));
        // the row after the last one on screen, a cell per column
        const shown = new Set(rendered);
        expect(shown.size).toBe(1);
        expect(rendered).toHaveLength(2);
        expect(datasource.getDataRows()[0].id).toBe(1);
    });

    it('expect refresh() to render every row on screen', async () => {
        let rendered = 0;
        const { gridInterface } = await mountGrid(config(), rows(5), fields(), {
            cellClass: () => {
                rendered++;
                return null;
            }
        });
        rendered = 0;
        gridInterface.refresh();
        expect(rendered).toBe(5 * 2);
    });
});
