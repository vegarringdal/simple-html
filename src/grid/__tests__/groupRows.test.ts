// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Entity, type GroupRow, isGroupRow } from '../../datasource/entity';
import type { GridElement } from '../gridElement';
import type { GridEvents } from '../gridEvents';
import { mountGrid, selectorRowOf, simpleConfig, simpleFields, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuItemsExact, sleep } from './interactionTestHelpers';

/**
 * Group rows in the grid: the row menu, the row selector and the callbacks never treat a group
 * row as data. Where the grid does hand one out (the header focus event, the current entity),
 * the types say so - these tests pin that down.
 */

const data = () => [
    { firstname: 'a', lastname: 'group1', age: 1 },
    { firstname: 'b', lastname: 'group1', age: 2 },
    { firstname: 'c', lastname: 'group2', age: 3 }
];

/**
 * a grid grouped on lastname, all expanded. Displayed: [G:group1, a, b, G:group2, c]
 */
async function mountGrouped() {
    const mounted = await mountGrid({ ...simpleConfig(), readonly: false }, data());
    mounted.datasource.group([{ attribute: 'lastname', title: 'lastname' }]);
    mounted.datasource.expandGroup();
    return mounted;
}

/**
 * the input of a body cell, by its position class - the dom order of the recycled rows means nothing
 */
function cellInput(element: GridElement, row: number, column: number) {
    return element.querySelector(`.cellpos-middle-pinned-${row}-${column}-0`) as HTMLInputElement;
}

/**
 * the row selector cell (the row number on the left) of a displayed row
 */
function selectorCell(element: GridElement, row: number) {
    return selectorRowOf(element, row)?.firstElementChild as HTMLElement;
}

const groupRowsOf = (rows: (Entity | GroupRow)[]) => rows.filter(isGroupRow);

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

describe('group rows - row menu', () => {
    it('expect clear to only clear the selected data rows', async () => {
        const { element, datasource } = await mountGrouped();
        datasource.selectAll();

        cellInput(element, 1, 2).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        // paste and clear share the label, clear is the second one
        menuItemsExact('Clear cell (selected rows)')[0].click();

        expect(datasource.getAllData().map((row) => row.age)).toEqual([null, null, null]);
        expect(groupRowsOf(datasource.getRows()).some((row) => 'age' in row)).toBe(false);
    });

    it('expect paste to only paste into the selected data rows', async () => {
        const { element, datasource, gridInterface } = await mountGrouped();
        vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('9');
        const pasted: GridEvents['paste'][] = [];
        gridInterface.on('paste', (event) => {
            pasted.push(event);
        });
        datasource.selectAll();

        cellInput(element, 1, 2).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        menuItemsExact('Paste cell (selected rows)')[0].click();
        await sleep(0); // the clipboard is read async

        expect(datasource.getAllData().map((row) => row.age)).toEqual([9, 9, 9]);
        expect(groupRowsOf(datasource.getRows()).some((row) => 'age' in row)).toBe(false);
        expect(pasted.map((event) => event.entity.firstname)).toEqual(['a', 'b', 'c']);
    });
});

describe('group rows - row selector', () => {
    it("expect clicking a group row's selector to select the data rows of the group", async () => {
        const { element, datasource } = await mountGrouped();

        selectorCell(element, 0).dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(datasource.getSelectedRows().map((row) => row.firstname)).toEqual(['a', 'b']);
        expect(isGroupRow(datasource.currentEntity)).toBe(false);
    });
});

describe('group rows - callbacks and events', () => {
    it('expect the isReadonly and cellClass hooks to only get data rows', async () => {
        const seen: Entity[] = [];
        const { datasource } = await mountGrid({ ...simpleConfig(), readonly: false }, data(), simpleFields(), {
            isReadonly: (row) => {
                seen.push(row);
                return null;
            },
            cellClass: (row) => {
                seen.push(row);
                return null;
            }
        });

        datasource.group([{ attribute: 'lastname', title: 'lastname' }]);
        datasource.expandGroup();

        expect(seen.length).toBeGreaterThan(0);
        expect(seen.some((row) => isGroupRow(row))).toBe(false);
    });

    it('expect cell-click to send the data row', async () => {
        const { element, datasource, gridInterface } = await mountGrouped();
        const received: GridEvents['cell-click'][] = [];
        gridInterface.on('cell-click', (event) => {
            received.push(event);
        });

        cellInput(element, 1, 0).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(0); // sent in a setTimeout

        expect(received).toHaveLength(1);
        expect(received[0].rowData).toBe(datasource.getRow(1));
        expect(isGroupRow(received[0].rowData)).toBe(false);
    });

    it('expect cell-header-focus to send the first displayed row: a group row when grouped', async () => {
        const { element, datasource, gridInterface } = await mountGrouped();
        const received: GridEvents['cell-header-focus'][] = [];
        gridInterface.on('cell-header-focus', (event) => {
            received.push(event);
        });

        headerFilterInput(element, 'firstname').dispatchEvent(new FocusEvent('focus'));

        expect(received).toHaveLength(1);
        expect(received[0].rowData).toBe(datasource.getRow(0));
        expect(isGroupRow(received[0].rowData)).toBe(true);
    });

    it('expect cell-header-focus to send undefined when no rows were displayed', async () => {
        const { element, gridInterface } = await mountGrid(simpleConfig(), []);
        const received: GridEvents['cell-header-focus'][] = [];
        gridInterface.on('cell-header-focus', (event) => {
            received.push(event);
        });

        headerFilterInput(element, 'firstname').dispatchEvent(new FocusEvent('focus'));

        expect(received).toHaveLength(1);
        expect(received[0].rowData).toBeUndefined();
    });
});

describe('group rows - current entity', () => {
    it('expect alt+up from the first data row to the header filter row to make the group row above current', async () => {
        // why currentEntity is typed EntityUnion<T> | GroupRow | null: leaving the first data row
        // for the header filter row makes row 0 current, and row 0 is a group row when grouped
        const { element, datasource } = await mountGrouped();
        datasource.setRowAsCurrentEntity(1);

        cellInput(element, 1, 0).dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', altKey: true, bubbles: true }));
        await sleep(150); // the handler moves the focus in a setTimeout

        expect((document.activeElement as HTMLElement).className).toContain('filter-cellpos-middle-pinned-0-0-0');
        expect(datasource.currentEntity).toBe(datasource.getRow(0));
        expect(isGroupRow(datasource.currentEntity)).toBe(true);
    });
});
