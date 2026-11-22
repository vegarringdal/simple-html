// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CellRange } from '../cellRange';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { ctrlRanges, shiftRangeStart, shiftRanges } from '../gridFunctions/cellRanges';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import { LONG_PRESS } from '../gridFunctions/longPress';
import type { GridHooks } from '../gridHooks';
import { type GridMenus, MENU_IDS, type MenuContext, type MenuEntry } from '../gridMenus';
import {
    mountGrid,
    selectorRowOf,
    simpleConfig,
    simpleData,
    simpleFields,
    stubCanvas,
    stubElementSizes
} from './gridTestHelpers';
import {
    columnNumberCell,
    menuEntry,
    menuTreeIds,
    openColumnMenu,
    openMenus,
    pointerEvent,
    touchAt
} from './interactionTestHelpers';

/**
 * Multi-select with a finger, which has no Shift and no Ctrl:
 * - a tap on a row number toggles the row as Ctrl+click does ('multiple' mode), a tap on a column
 *   number toggles the column; the mouse and the pen are unchanged (lastPress.ts)
 * - the row numbers have the row menu, without a cell (contextmenuRowNumber)
 * - Select › in the row menu (the rows, the ranges of cells, Clear selection) and in the column menu
 *   (the columns): the finger's Shift and Ctrl, for every input
 * - the model of Shift+click and Ctrl+click on a cell (cellRanges.ts), the mouse and the menu share it
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
    vi.useRealTimers();
});

const editable = (more: Partial<GridConfig> = {}): GridConfig => ({ ...simpleConfig(), readonly: false, ...more });

const mount = (more: Partial<GridConfig> = {}, hooks: GridHooks = {}) =>
    mountGrid(editable(more), simpleData(), simpleFields(), hooks);

/** the row number cell (the gridcell with the listeners) of a displayed row */
const numberCell = (element: GridElement, row: number) => selectorRowOf(element, row)?.firstElementChild as HTMLElement;

/** the input of the cell that shows a field of a displayed row, on screen */
function cellInput(element: GridElement, row: number, field: string): HTMLInputElement {
    const cells = Array.from(element.querySelectorAll('.simple-html-grid-col-cell[type="row-cell"]')) as HTMLCellElement[];
    const cell = cells.find(
        (c) =>
            c.$row === row &&
            c.$attribute === field &&
            (c.closest('.simple-html-grid-row') as HTMLElement).style.display === 'block'
    );
    if (!cell) {
        throw new Error(`no cell on screen for row ${row}, ${field}`);
    }
    return cell.querySelector('input') as HTMLInputElement;
}

/** a click as a browser sends it today: a PointerEvent with the pointer that made it */
const clickBy = (target: Element, pointerType: string, init: PointerEventInit = {}) =>
    target.dispatchEvent(new PointerEvent('click', { bubbles: true, cancelable: true, pointerType, ...init }));

/** a tap of a finger, as Chromium sends it: pointerdown, pointerup, then a click that is a PointerEvent */
function tap(target: Element) {
    target.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'touch' }));
    target.dispatchEvent(pointerEvent('pointerup', { pointerType: 'touch' }));
    clickBy(target, 'touch');
}

/** a tap in an older browser (Safari before 18.2): the click is a MouseEvent, no pointerType */
function oldTap(target: Element) {
    target.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'touch' }));
    target.dispatchEvent(pointerEvent('pointerup', { pointerType: 'touch' }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** a click of the mouse, with the keys held */
function mouseClick(target: Element, keys: MouseEventInit = {}) {
    target.dispatchEvent(pointerEvent('pointerdown'));
    target.dispatchEvent(pointerEvent('pointerup'));
    clickBy(target, 'mouse', keys);
}

/**
 * A right click on a cell's input, as Chromium sends it: the pointer press, the mousedown - whose
 * default action moves the focus to the input - then contextmenu
 */
function rightClick(input: HTMLInputElement) {
    input.dispatchEvent(pointerEvent('pointerdown', { button: 2, buttons: 2 }));
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 2 }));
    input.focus();
    input.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
}

/** a right click on a row number: contextmenu. Returns the event, canceled when a menu opened */
function rowNumberMenu(element: GridElement, row: number) {
    const cell = numberCell(element, row);
    cell.dispatchEvent(pointerEvent('pointerdown', { button: 2, buttons: 2 }));
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    cell.dispatchEvent(event);
    return event;
}

const selectedRows = (datasource: { getSelection(): { getSelectedRows(): number[] } }) =>
    datasource.getSelection().getSelectedRows();

/** greyed out: shown, `aria-disabled` */
const disabled = (id: string) => menuEntry(id)?.getAttribute('aria-disabled') === 'true';

/** the text of an entry, its hint too */
const label = (id: string) => menuEntry(id)?.textContent?.replace(/\s+/g, ' ').trim();

/** clicks an entry of the open menu, in a submenu too: the menu closes, its action runs */
const clickEntry = (id: string) => menuEntry(id).click();

/** a range of cells */
const range = (fromRow: number, fromField: string, toRow: number, toField: string): CellRange => ({
    fromRow,
    fromField,
    toRow,
    toField
});

describe('select with a finger - a tap on a row number', () => {
    it("expect a finger's taps to toggle rows as Ctrl+click in 'multiple' mode: the first selects, more add or remove", async () => {
        const { element, datasource } = await mount();
        const changes = vi.fn();
        datasource.on('selection-change', changes);

        tap(numberCell(element, 1));
        expect(selectedRows(datasource)).toEqual([1]);
        tap(numberCell(element, 3));
        expect(selectedRows(datasource)).toEqual([1, 3]);
        tap(numberCell(element, 1));
        expect(selectedRows(datasource)).toEqual([3]);
        tap(numberCell(element, 3));
        expect(selectedRows(datasource)).toEqual([]);
        expect(changes).toHaveBeenCalledTimes(4);
        // as a click: the row tapped is the current row, the number has the focus
        expect(datasource.currentEntity).toBe(datasource.getRow(3));
        expect(document.activeElement).toBe(numberCell(element, 3));
    });

    it('expect a tap in a browser whose click is a MouseEvent to toggle too: the pointer of the press is taken', async () => {
        const { element, datasource } = await mount();

        oldTap(numberCell(element, 0));
        oldTap(numberCell(element, 2));
        expect(selectedRows(datasource)).toEqual([0, 2]);
    });

    it("expect a tap in 'single' mode to select the row only, as before", async () => {
        const { element, datasource } = await mount();
        datasource.setSelectionMode('single');

        tap(numberCell(element, 1));
        tap(numberCell(element, 3));
        expect(selectedRows(datasource)).toEqual([3]);
        tap(numberCell(element, 3));
        expect(selectedRows(datasource)).toEqual([3]);
    });

    it('expect the mouse and the pen unchanged: a plain click replaces, Ctrl+click adds, Shift+click a range', async () => {
        const { element, datasource } = await mount();

        mouseClick(numberCell(element, 1));
        mouseClick(numberCell(element, 3));
        expect(selectedRows(datasource)).toEqual([3]);
        mouseClick(numberCell(element, 0), { ctrlKey: true });
        expect(selectedRows(datasource)).toEqual([0, 3]);
        mouseClick(numberCell(element, 2));
        mouseClick(numberCell(element, 4), { shiftKey: true });
        expect(selectedRows(datasource)).toEqual([2, 3, 4]);

        const pen = numberCell(element, 1);
        pen.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'pen' }));
        clickBy(pen, 'pen');
        expect(selectedRows(datasource)).toEqual([1]);
        // a click made by code or a key has no pointer: not a tap, after a tap too
        tap(numberCell(element, 3));
        clickBy(numberCell(element, 0), '');
        expect(selectedRows(datasource)).toEqual([0]);
    });

    it('expect a tap on a group row number to add the rows of the group, as Ctrl+click', async () => {
        const data = [
            { firstname: 'a', lastname: 'x', age: 1 },
            { firstname: 'b', lastname: 'x', age: 2 },
            { firstname: 'c', lastname: 'y', age: 3 }
        ];
        const { element, datasource } = await mountGrid(editable(), data, simpleFields());
        datasource.group([{ attribute: 'lastname', title: 'lastname' }]);
        datasource.expandGroup();
        // the rows: group x, a, b, group y, c
        tap(numberCell(element, 4));
        tap(numberCell(element, 0));
        expect(selectedRows(datasource)).toEqual([1, 2, 4]);
    });
});

describe('select with a finger - a tap on a column number', () => {
    it("expect a finger's taps to toggle columns as Ctrl+click, the mouse to replace as before", async () => {
        const { element, gridInterface } = await mount();
        const changes = vi.fn();
        gridInterface.on('column-selection-change', changes);

        tap(columnNumberCell(element, 1));
        tap(columnNumberCell(element, 3));
        expect(gridInterface.getSelectedColumns()).toEqual([1, 3]);
        tap(columnNumberCell(element, 1));
        expect(gridInterface.getSelectedColumns()).toEqual([3]);
        oldTap(columnNumberCell(element, 2));
        expect(gridInterface.getSelectedColumns()).toEqual([2, 3]);
        expect(changes).toHaveBeenCalledTimes(4);

        mouseClick(columnNumberCell(element, 1));
        expect(gridInterface.getSelectedColumns()).toEqual([1]);
        mouseClick(columnNumberCell(element, 3), { shiftKey: true });
        expect(gridInterface.getSelectedColumns()).toEqual([1, 2, 3]);
    });

    it("expect taps on column numbers to toggle in 'single' and 'none' mode too: the columns have no mode", async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.setSelectionMode('single');
        tap(columnNumberCell(element, 1));
        tap(columnNumberCell(element, 2));
        expect(gridInterface.getSelectedColumns()).toEqual([1, 2]);
        datasource.setSelectionMode('none');
        tap(columnNumberCell(element, 3));
        expect(gridInterface.getSelectedColumns()).toEqual([1, 2, 3]);
    });
});

describe('select with a finger - the row menu of a row number', () => {
    /** a grid whose row menu hands its defaults and context to `seen` and shows the defaults */
    async function mountCapturing(more: Partial<GridConfig> = {}) {
        const seen: { defaults: MenuEntry[]; context: MenuContext }[] = [];
        const menus: GridMenus = {
            row: (defaults, context) => {
                seen.push({ defaults, context });
                return defaults;
            }
        };
        const mounted = await mount(more, { menus });
        return { ...mounted, seen };
    }

    /**
     * not on a row number (the user: "row number context menu have too many options that does not belong
     * there"): what needs a cell, and what is not about rows
     */
    const notOnRowNumber = (id: string) =>
        ['row.paste', 'row.clear', 'row.filter', 'row.view', 'row.export'].some(
            (part) => id === part || id.startsWith(`${part}.`)
        ) ||
        [
            'row.edit.revertCell',
            'row.select.cellsSeparator',
            'row.select.rangeTo',
            'row.select.addCell',
            'row.copy.cell',
            'row.copy.column',
            'row.copy.range',
            'row.size.fitColumn'
        ].includes(id);

    it('expect a right click on a row number to open the row menu: the entries of rows, the context without a field', async () => {
        const { element, datasource, seen } = await mountCapturing();

        const event = rowNumberMenu(element, 2);

        expect(event.defaultPrevented).toBe(true);
        expect(openMenus()).toHaveLength(1);
        expect(menuTreeIds()).toEqual(MENU_IDS.row.filter((id) => !notOnRowNumber(id)));
        // Undo / Redo, Select, Copy, Delete, Size
        expect(menuTreeIds().filter((id) => !id.slice(4).includes('.'))).toEqual([
            'row.edit',
            'row.select',
            'row.copy',
            'row.delete',
            'row.size'
        ]);
        // the menus hook gets every entry: hidden ones by `visible`, it can find them by id
        expect(seen[0].defaults.map((entry) => entry.id)).toContain('row.filter');
        const { context } = seen[0];
        expect(context.menu).toEqual('row');
        expect(context.field).toEqual('');
        expect(context.row).toBe(datasource.getRow(2));
        expect(context.rowIndex).toBe(2);
        expect(context.cell).toBe(selectorRowOf(element, 2));
    });

    it('expect the entries that need a cell left out, the ones of the row and of the selection usable', async () => {
        const { element, datasource } = await mount();
        datasource.getSelection().selectRowRange(1, 2);
        // an edit of the row: its revert works, the cell's has no cell
        datasource.getRow(2).firstname = 'changed';

        rowNumberMenu(element, 2);

        const needCell = [
            'row.edit.revertCell',
            'row.select.rangeTo',
            'row.select.addCell',
            'row.copy.cell',
            'row.copy.column',
            'row.paste.current',
            'row.paste.cell',
            'row.clear.current',
            'row.clear.cell',
            'row.filter.replace',
            'row.filter.add',
            'row.size.fitColumn'
        ];
        for (const id of needCell) {
            expect(menuEntry(id), id).toBeFalsy();
        }
        const usable = [
            'row.edit.revertRow',
            'row.edit.revertRows',
            'row.select.row',
            'row.select.rowsTo',
            'row.select.allRows',
            'row.select.clear',
            'row.copy.row',
            'row.copy.selectedColumns',
            'row.delete.row',
            'row.delete.rows',
            'row.size.fitRow',
            'row.size.fitRows'
        ];
        for (const id of usable) {
            expect(disabled(id), id).toBe(false);
        }
    });

    it("expect the row's entries to work on the row of the number: Delete › Row", async () => {
        const { element, datasource } = await mount();
        datasource.getSelection().selectRowRange(1, 1);

        rowNumberMenu(element, 3);
        clickEntry('row.delete.row');
        expect(datasource.getRow(3).__rowState).toEqual('D');
        expect(datasource.getRow(1).__rowState).toBeUndefined();
    });

    it('expect a group row number to have no menu: the browser keeps its contextmenu', async () => {
        const { element, datasource } = await mount();
        datasource.group([{ attribute: 'lastname', title: 'lastname' }]);

        const event = rowNumberMenu(element, 0);
        expect(event.defaultPrevented).toBe(false);
        expect(openMenus()).toHaveLength(0);
    });

    it('expect a long press on a row number to open the row menu, the lift to be no tap', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const { element, datasource } = await mount();
        const cell = numberCell(element, 1);

        cell.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'touch', clientX: 10, clientY: 10 }));
        cell.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touchAt(cell, 10, 10)] }));
        vi.advanceTimersByTime(LONG_PRESS);

        expect(openMenus()).toHaveLength(1);
        expect(openMenus()[0].querySelector('[data-menu-id="row.select"]')).not.toBeNull();
        cell.dispatchEvent(pointerEvent('pointerup', { pointerType: 'touch', clientX: 10, clientY: 10 }));
        const end = new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [] });
        cell.dispatchEvent(end);
        // canceled: the browser sends no click, the row is not selected by the lift
        expect(end.defaultPrevented).toBe(true);
        expect(selectedRows(datasource)).toEqual([]);
    });
});

describe('select with a finger - Select › of the row menu, the rows', () => {
    it('expect This row to toggle the row, a checkbox item with a ✓ while it is selected', async () => {
        const { element, datasource } = await mount();
        const changes = vi.fn();
        datasource.on('selection-change', changes);

        rowNumberMenu(element, 2);
        expect(menuEntry('row.select.row').getAttribute('role')).toEqual('menuitemcheckbox');
        expect(menuEntry('row.select.row').getAttribute('aria-checked')).toEqual('false');
        clickEntry('row.select.row');
        expect(selectedRows(datasource)).toEqual([2]);

        // from a cell of another row: added
        rightClick(cellInput(element, 4, 'age'));
        clickEntry('row.select.row');
        expect(selectedRows(datasource)).toEqual([2, 4]);

        rowNumberMenu(element, 2);
        expect(menuEntry('row.select.row').getAttribute('aria-checked')).toEqual('true');
        expect(label('row.select.row')).toEqual('This row');
        clickEntry('row.select.row');
        expect(selectedRows(datasource)).toEqual([4]);
        expect(changes).toHaveBeenCalledTimes(3);
    });

    it("expect This row in 'single' mode to replace the row selected, and to deselect it", async () => {
        const { element, datasource } = await mount();
        datasource.setSelectionMode('single');

        rowNumberMenu(element, 1);
        clickEntry('row.select.row');
        rowNumberMenu(element, 3);
        clickEntry('row.select.row');
        expect(selectedRows(datasource)).toEqual([3]);
        rowNumberMenu(element, 3);
        clickEntry('row.select.row');
        expect(selectedRows(datasource)).toEqual([]);
    });

    it('expect Rows from N to here to select from the anchor, N its number, either way', async () => {
        const { element, datasource } = await mount();
        const changes = vi.fn();

        // a plain click: the row clicked is the anchor
        mouseClick(numberCell(element, 1));
        datasource.on('selection-change', changes);
        rowNumberMenu(element, 3);
        expect(label('row.select.rowsTo')).toEqual('Rows from 2 to here');
        clickEntry('row.select.rowsTo');
        expect(selectedRows(datasource)).toEqual([1, 2, 3]);
        expect(changes).toHaveBeenCalledTimes(1);

        // again from the same anchor: the range changes
        rowNumberMenu(element, 0);
        expect(label('row.select.rowsTo')).toEqual('Rows from 2 to here');
        clickEntry('row.select.rowsTo');
        expect(selectedRows(datasource)).toEqual([0, 1]);
    });

    it('expect taps then Rows from N to here to add the range to the rows tapped, from the last one tapped, either way', async () => {
        const { element, datasource } = await mount();

        tap(numberCell(element, 0));
        tap(numberCell(element, 4));
        rowNumberMenu(element, 2);
        expect(label('row.select.rowsTo')).toEqual('Rows from 5 to here');
        clickEntry('row.select.rowsTo');
        // below the anchor and above it: a row above the anchor selected nothing before
        expect(selectedRows(datasource)).toEqual([0, 2, 3, 4]);
    });

    it('expect Rows from N to here greyed out without an anchor (N this row), on the anchor, and in single mode', async () => {
        const { element, datasource } = await mount();

        rowNumberMenu(element, 3);
        expect(disabled('row.select.rowsTo')).toBe(true);
        expect(label('row.select.rowsTo')).toEqual('Rows from 4 to here');

        mouseClick(numberCell(element, 1));
        rowNumberMenu(element, 1);
        expect(disabled('row.select.rowsTo')).toBe(true);
        rowNumberMenu(element, 3);
        expect(disabled('row.select.rowsTo')).toBe(false);

        datasource.setSelectionMode('single');
        rowNumberMenu(element, 3);
        expect(disabled('row.select.rowsTo')).toBe(true);
        clickEntry('row.select.rowsTo');
        expect(selectedRows(datasource)).toEqual([1]);
    });

    it('expect All rows to select every row, greyed out when they are and in single mode', async () => {
        const { element, datasource } = await mount();

        rowNumberMenu(element, 0);
        expect(disabled('row.select.allRows')).toBe(false);
        clickEntry('row.select.allRows');
        expect(selectedRows(datasource)).toEqual([0, 1, 2, 3, 4]);
        rowNumberMenu(element, 0);
        expect(disabled('row.select.allRows')).toBe(true);

        datasource.deselectAll();
        datasource.setSelectionMode('single');
        rowNumberMenu(element, 0);
        expect(disabled('row.select.allRows')).toBe(true);
    });

    it("expect the rows' entries hidden in 'none' mode, the ranges and Clear selection kept", async () => {
        const { element, datasource } = await mount();
        datasource.setSelectionMode('none');

        rightClick(cellInput(element, 1, 'age'));
        const ids = menuTreeIds();
        expect(ids.filter((id) => id.startsWith('row.select'))).toEqual([
            'row.select',
            'row.select.rangeTo',
            'row.select.addCell',
            'row.select.clearSeparator',
            'row.select.clear'
        ]);
    });

    it('expect Clear selection to clear the rows and the ranges, greyed out with neither', async () => {
        const { element, datasource, gridInterface } = await mount();
        const changes = vi.fn();
        datasource.on('selection-change', changes);

        rowNumberMenu(element, 0);
        expect(disabled('row.select.clear')).toBe(true);

        datasource.getSelection().selectRowRange(1, 2);
        changes.mockClear();
        rowNumberMenu(element, 0);
        expect(disabled('row.select.clear')).toBe(false);
        clickEntry('row.select.clear');
        expect(selectedRows(datasource)).toEqual([]);
        expect(changes).toHaveBeenCalledTimes(1);

        gridInterface.setRanges([range(0, 'firstname', 1, 'age')]);
        rowNumberMenu(element, 0);
        expect(disabled('row.select.clear')).toBe(false);
        clickEntry('row.select.clear');
        expect(gridInterface.getRanges()).toEqual([]);
        // no row was selected: no selection-change
        expect(changes).toHaveBeenCalledTimes(1);
    });

    it('expect Copy › Row usable after the rows are selected from the menu', async () => {
        const { element } = await mount();

        rowNumberMenu(element, 1);
        expect(disabled('row.copy.row')).toBe(true);
        clickEntry('row.select.row');
        rowNumberMenu(element, 1);
        expect(disabled('row.copy.row')).toBe(false);
    });
});

describe('select with a finger - Select › of the row menu, the ranges of cells', () => {
    it('expect Range from the active cell to here: from the cell with the focus to the cell, as Shift+click', async () => {
        const { element, gridInterface } = await mount();
        const changes = vi.fn();
        gridInterface.on('range-change', changes);
        cellInput(element, 1, 'firstname').focus();

        // a long press: the finger moves no focus
        const target = cellInput(element, 3, 'age');
        target.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'touch' }));
        target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        expect(disabled('row.select.rangeTo')).toBe(false);
        clickEntry('row.select.rangeTo');

        expect(gridInterface.getRanges()).toEqual([range(1, 'firstname', 3, 'age')]);
        expect(changes).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(cellInput(element, 1, 'firstname'));
    });

    it('expect the active cell of a right click to be the one with the focus before it: the click moves the focus', async () => {
        const { element, gridInterface } = await mount();
        cellInput(element, 0, 'lastname').focus();

        rightClick(cellInput(element, 2, 'age'));
        expect(document.activeElement).toBe(cellInput(element, 2, 'age'));
        clickEntry('row.select.rangeTo');

        expect(gridInterface.getRanges()).toEqual([range(0, 'lastname', 2, 'age')]);
    });

    it('expect the active cell of Shift+F10 to be the cell with the focus: the menu of the cell itself', async () => {
        const { element } = await mount();
        mouseClick(cellInput(element, 0, 'lastname'));
        const input = cellInput(element, 2, 'age');
        input.focus();

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
        input.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        expect(disabled('row.select.rangeTo')).toBe(true);
    });

    it('expect Range to here from where the last range starts when there is one, greyed out when that is this cell', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(0, 'firstname', 0, 'firstname'), range(1, 'lastname', 2, 'lastname')]);

        rightClick(cellInput(element, 4, 'age'));
        clickEntry('row.select.rangeTo');
        expect(gridInterface.getRanges()).toEqual([range(0, 'firstname', 0, 'firstname'), range(1, 'lastname', 4, 'age')]);

        rightClick(cellInput(element, 1, 'lastname'));
        expect(disabled('row.select.rangeTo')).toBe(true);
    });

    it('expect Range to here greyed out with no range and no active cell, and on the active cell', async () => {
        const { element } = await mount();

        rightClick(cellInput(element, 2, 'age'));
        expect(disabled('row.select.rangeTo')).toBe(true);

        // the focus in the cell before its own right click
        cellInput(element, 3, 'age').focus();
        rightClick(cellInput(element, 3, 'age'));
        expect(disabled('row.select.rangeTo')).toBe(true);
    });

    it('expect Add this cell to the ranges: as Ctrl+click, the active cell kept as a range when there is none', async () => {
        const { element, gridInterface } = await mount();
        cellInput(element, 0, 'firstname').focus();

        rightClick(cellInput(element, 2, 'age'));
        expect(disabled('row.select.addCell')).toBe(false);
        clickEntry('row.select.addCell');
        expect(gridInterface.getRanges()).toEqual([range(0, 'firstname', 0, 'firstname'), range(2, 'age', 2, 'age')]);

        rightClick(cellInput(element, 4, 'lastname'));
        clickEntry('row.select.addCell');
        expect(gridInterface.getRanges()).toEqual([
            range(0, 'firstname', 0, 'firstname'),
            range(2, 'age', 2, 'age'),
            range(4, 'lastname', 4, 'lastname')
        ]);

        // then Shift: from the cell added last
        rightClick(cellInput(element, 3, 'age'));
        clickEntry('row.select.rangeTo');
        expect(gridInterface.getRanges().at(-1)).toEqual(range(4, 'lastname', 3, 'age'));
    });

    it('expect Add this cell greyed out when the cell is in a range already', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(0, 'firstname', 2, 'lastname')]);

        rightClick(cellInput(element, 1, 'lastname'));
        expect(disabled('row.select.addCell')).toBe(true);
        rightClick(cellInput(element, 1, 'age'));
        expect(disabled('row.select.addCell')).toBe(false);
    });

    it('expect Copy › Range usable after a range is made from the menu', async () => {
        const { element } = await mount();
        cellInput(element, 0, 'firstname').focus();

        rightClick(cellInput(element, 1, 'age'));
        expect(disabled('row.copy.range')).toBe(true);
        clickEntry('row.select.rangeTo');
        rightClick(cellInput(element, 1, 'age'));
        expect(disabled('row.copy.range')).toBe(false);
    });
});

describe('select with a finger - Select › of the column menu', () => {
    it('expect This column to toggle the column, a checkbox item with a ✓ while it is selected', async () => {
        const { element, gridInterface } = await mount();
        const changes = vi.fn();
        gridInterface.on('column-selection-change', changes);

        openColumnMenu(element, 2);
        expect(menuEntry('column.select.column').getAttribute('aria-checked')).toEqual('false');
        clickEntry('column.select.column');
        openColumnMenu(element, 3);
        clickEntry('column.select.column');
        expect(gridInterface.getSelectedColumns()).toEqual([2, 3]);
        openColumnMenu(element, 2);
        expect(menuEntry('column.select.column').getAttribute('aria-checked')).toEqual('true');
        clickEntry('column.select.column');
        expect(gridInterface.getSelectedColumns()).toEqual([3]);
        expect(changes).toHaveBeenCalledTimes(3);
    });

    it('expect Columns from N to here from the anchor, greyed out without one (N this column) and on it', async () => {
        const { element, gridInterface } = await mount();

        openColumnMenu(element, 3);
        expect(disabled('column.select.columnsTo')).toBe(true);
        expect(label('column.select.columnsTo')).toEqual('Columns from 3 to here');

        tap(columnNumberCell(element, 1));
        openColumnMenu(element, 1);
        expect(disabled('column.select.columnsTo')).toBe(true);
        openColumnMenu(element, 3);
        expect(label('column.select.columnsTo')).toEqual('Columns from 1 to here');
        clickEntry('column.select.columnsTo');
        expect(gridInterface.getSelectedColumns()).toEqual([1, 2, 3]);
    });

    it('expect All columns and Clear column selection, each greyed out when it can do nothing', async () => {
        const { element, gridInterface } = await mount();

        openColumnMenu(element, 1);
        expect(disabled('column.select.clear')).toBe(true);
        expect(disabled('column.select.all')).toBe(false);
        clickEntry('column.select.all');
        expect(gridInterface.getSelectedColumns()).toEqual([1, 2, 3]);

        openColumnMenu(element, 1);
        expect(disabled('column.select.all')).toBe(true);
        expect(disabled('column.select.clear')).toBe(false);
        clickEntry('column.select.clear');
        expect(gridInterface.getSelectedColumns()).toEqual([]);
    });

    it('expect Copy selected columns usable after the columns are selected from the menu', async () => {
        const { element } = await mount();

        openColumnMenu(element, 2);
        expect(disabled('column.copy.selectedColumns')).toBe(true);
        clickEntry('column.select.column');
        openColumnMenu(element, 2);
        expect(disabled('column.copy.selectedColumns')).toBe(false);
    });
});

describe('select with a finger - Shift and Ctrl on a cell, the model', () => {
    const a = { row: 0, field: 'firstname' };
    const b = { row: 2, field: 'age' };

    it('expect Shift to start where the last range starts, else at the active cell - not at the cell clicked', () => {
        expect(shiftRangeStart([range(1, 'lastname', 3, 'age')], a, b)).toEqual({ row: 1, field: 'lastname' });
        expect(shiftRangeStart([], a, b)).toEqual(a);
        expect(shiftRangeStart([], null, b)).toBeNull();
        expect(shiftRangeStart([], b, b)).toBeNull();
    });

    it('expect Shift to change the last range, keeping the others; null when it makes none', () => {
        const ranges = [range(4, 'age', 4, 'age'), range(1, 'lastname', 3, 'age')];
        expect(shiftRanges(ranges, null, b)).toEqual([range(4, 'age', 4, 'age'), range(1, 'lastname', 2, 'age')]);
        expect(shiftRanges([], a, b)).toEqual([range(0, 'firstname', 2, 'age')]);
        expect(shiftRanges([], null, b)).toBeNull();
    });

    it('expect Ctrl to add a range of the cell, the active cell kept as one when there is no range', () => {
        expect(ctrlRanges([], a, b)).toEqual([range(0, 'firstname', 0, 'firstname'), range(2, 'age', 2, 'age')]);
        expect(ctrlRanges([], null, b)).toEqual([range(2, 'age', 2, 'age')]);
        expect(ctrlRanges([], b, b)).toEqual([range(2, 'age', 2, 'age')]);
        expect(ctrlRanges([range(1, 'age', 1, 'age')], a, b)).toEqual([range(1, 'age', 1, 'age'), range(2, 'age', 2, 'age')]);
    });
});
