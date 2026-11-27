// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { where } from '../../datasource/filterExpression';
import type { CellRange } from '../cellRange';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import { AUTO_SCROLL_MS } from '../gridFunctions/rangeSelection';
import { type MountedGrid, mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, pointerEvent, pointerOver, sleep } from './interactionTestHelpers';

/**
 * The ranges of cells (V6 item 32): made with the mouse and the keys, shown on the cells, cleared when
 * the rows or the layout change, and the API (getRanges, setRanges, clearRanges, range-change). The
 * clipboard of the ranges is in rangeClipboard.test.ts.
 *
 * happy-dom lays nothing out: the hit test of a drag is mocked (pointerOver), and focusing is done by
 * hand - a press does not focus the input here.
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

const data = () =>
    Array.from({ length: 30 }, (_, i) => ({
        id: i,
        name: `n${i}`,
        city: `c${i}`,
        age: i,
        born: new Date(2026, 0, 1 + i),
        active: i % 2 === 0,
        notes: `note ${i}`
    }));

/**
 * name pinned left, notes pinned right, a center column with age and born stacked. The fields in the
 * order of the layout: name, city, age, born, active, notes
 */
const config = (): GridConfig => ({
    readonly: false,
    layout: {
        left: [{ fields: ['name'], width: 100 }],
        center: [
            { fields: ['city'], width: 100 },
            { fields: ['age', 'born'], width: 100 },
            { fields: ['active'], width: 100 }
        ],
        right: [{ fields: ['notes'], width: 100 }]
    }
});

const options = () => ({ key: 'id', fields: { age: 'number' as const, born: 'date' as const, active: 'boolean' as const } });

const mount = (gridConfig: GridConfig = config()) => mountGrid(gridConfig, data(), options());

/**
 * the cell element that shows a field of a displayed row, in a row element on screen
 */
function cellAt(element: GridElement, row: number, field: string): HTMLCellElement {
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
    return cell;
}

const inputAt = (element: GridElement, row: number, field: string) =>
    cellAt(element, row, field).querySelector('input') as HTMLInputElement;

/**
 * a press on a cell's input, as the browser sends it: the pointerdown. Returns the event, to see
 * whether the grid canceled it
 */
function press(element: GridElement, row: number, field: string, init: PointerEventInit = {}) {
    const event = pointerEvent('pointerdown', init);
    inputAt(element, row, field).dispatchEvent(event);
    return event;
}

/**
 * the pointer moves over a cell: the browser's hit test finds it there
 */
function moveOver(element: GridElement, row: number, field: string) {
    const target = inputAt(element, row, field);
    const hit = pointerOver(target);
    target.dispatchEvent(pointerEvent('pointermove'));
    hit.mockRestore();
}

const release = () => document.dispatchEvent(pointerEvent('pointerup'));

/** the range classes of a cell: 'in top left' ... '' for none */
function rangeClasses(cell: HTMLElement) {
    if (!cell.classList.contains('simple-html-cell-in-range')) {
        return '';
    }
    return [
        'in',
        ...['top', 'bottom', 'left', 'right'].filter((side) => cell.classList.contains(`simple-html-cell-range-${side}`))
    ].join(' ');
}

/** a key in a cell's input, by key and code */
function key(input: HTMLElement, name: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key: name, code: name, bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(event);
    return event;
}

const range = (fromRow: number, fromField: string, toRow: number, toField: string): CellRange => ({
    fromRow,
    fromField,
    toRow,
    toField
});

/**
 * grouped on active, every group expanded: a group row, its 15 rows, the next group row, its 15 rows.
 * Grouping collapses the groups
 */
function groupExpanded(datasource: MountedGrid['datasource']) {
    datasource.group([{ attribute: 'active', title: 'Active' }]);
    datasource.expandGroup();
}

/** the range-change events of a grid, their ranges */
function rangeEvents({ gridInterface }: MountedGrid) {
    const seen: CellRange[][] = [];
    gridInterface.on('range-change', ({ ranges }) => seen.push(ranges));
    return seen;
}

describe('ranges - the mouse', () => {
    it('expect a press and a drag to make a range from the cell pressed to the cell under the pointer, across the sections', async () => {
        const mounted = await mount();
        const { element, gridInterface } = mounted;
        const events = rangeEvents(mounted);

        press(element, 1, 'name');
        moveOver(element, 2, 'city');
        moveOver(element, 3, 'notes');
        release();

        expect(gridInterface.getRanges()).toEqual([range(1, 'name', 3, 'notes')]);
        // one event each time it reached another cell
        expect(events).toEqual([[range(1, 'name', 2, 'city')], [range(1, 'name', 3, 'notes')]]);
    });

    it('expect a drag inside the cell pressed to make no range: it is the text selection of the input', async () => {
        const mounted = await mount();
        const events = rangeEvents(mounted);

        press(mounted.element, 1, 'name');
        moveOver(mounted.element, 1, 'name');
        release();

        expect(mounted.gridInterface.getRanges()).toEqual([]);
        expect(events).toEqual([]);
    });

    it('expect the pointer over the empty cell under a field to be that field, as it is in a range', async () => {
        const { element, gridInterface } = await mount();

        press(element, 1, 'name');
        // name has one field, the rows two cells: the lower half of the column is an empty cell
        const empty = cellAt(element, 4, 'name').nextElementSibling as HTMLElement;
        const hit = pointerOver(empty);
        empty.dispatchEvent(pointerEvent('pointermove'));
        hit.mockRestore();
        release();

        expect(gridInterface.getRanges()).toEqual([range(1, 'name', 4, 'name')]);
    });

    it('expect the pointer back on the cell pressed to make a range of that cell, once it was a range', async () => {
        const { element, gridInterface } = await mount();

        press(element, 1, 'name');
        moveOver(element, 2, 'name');
        moveOver(element, 1, 'name');

        expect(gridInterface.getRanges()).toEqual([range(1, 'name', 1, 'name')]);
        release();
    });

    it('expect a plain press, with no move, to clear the ranges', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(0, 'name', 2, 'age')]);

        press(element, 5, 'city');
        release();

        expect(gridInterface.getRanges()).toEqual([]);
    });

    it('expect shift+press to move the end of the last range, its start and the focus staying', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(0, 'city', 0, 'city'), range(1, 'name', 2, 'age')]);
        inputAt(element, 1, 'name').focus();

        const down = press(element, 4, 'born', { shiftKey: true });
        release();

        expect(gridInterface.getRanges()).toEqual([range(0, 'city', 0, 'city'), range(1, 'name', 4, 'born')]);
        // canceled: no mousedown after it, so the focus does not move to the cell pressed
        expect(down.defaultPrevented).toBe(true);
    });

    it('expect shift+press with no range to make one from the cell with the focus', async () => {
        const { element, gridInterface } = await mount();
        inputAt(element, 2, 'city').focus();

        press(element, 5, 'active', { shiftKey: true });
        release();

        expect(gridInterface.getRanges()).toEqual([range(2, 'city', 5, 'active')]);
    });

    it('expect shift+press on the cell with the focus, with no range, to be the input own (it selects text)', async () => {
        const { element, gridInterface } = await mount();
        inputAt(element, 2, 'city').focus();

        const down = press(element, 2, 'city', { shiftKey: true });
        release();

        expect(gridInterface.getRanges()).toEqual([]);
        expect(down.defaultPrevented).toBe(false);
    });

    it('expect shift+press with no cell focused to make no range, and leave the focus to the browser', async () => {
        const { element, gridInterface } = await mount();

        const down = press(element, 2, 'city', { shiftKey: true });
        release();

        expect(gridInterface.getRanges()).toEqual([]);
        expect(down.defaultPrevented).toBe(false);
    });

    it('expect ctrl+press to add a range, and the cell with the focus to stay selected as a range of its own', async () => {
        const { element, gridInterface } = await mount();
        inputAt(element, 0, 'name').focus();

        const down = press(element, 3, 'active', { ctrlKey: true });
        release();
        expect(gridInterface.getRanges()).toEqual([range(0, 'name', 0, 'name'), range(3, 'active', 3, 'active')]);
        // the focus moves to the cell pressed: it is the active cell of the new range
        expect(down.defaultPrevented).toBe(false);

        // Cmd on a Mac
        press(element, 5, 'notes', { metaKey: true });
        release();
        expect(gridInterface.getRanges()).toHaveLength(3);
        expect(gridInterface.getRanges()[2]).toEqual(range(5, 'notes', 5, 'notes'));
    });

    it('expect ctrl+drag to add a range and move its end', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(0, 'name', 1, 'city')]);

        press(element, 4, 'age', { ctrlKey: true });
        moveOver(element, 6, 'born');
        release();

        expect(gridInterface.getRanges()).toEqual([range(0, 'name', 1, 'city'), range(4, 'age', 6, 'born')]);
    });

    it('expect the right button, a finger and a second pointer to make no range and clear none', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(0, 'name', 1, 'city')]);

        press(element, 4, 'age', { button: 2 });
        moveOver(element, 6, 'born');
        release();
        press(element, 4, 'age', { pointerType: 'touch' });
        moveOver(element, 6, 'born');
        release();
        press(element, 4, 'age', { isPrimary: false });
        release();

        expect(gridInterface.getRanges()).toEqual([range(0, 'name', 1, 'city')]);
    });

    it('expect a press on a group row, the row selector or the empty cell under a field to make nothing', async () => {
        const { element, datasource, gridInterface } = await mount();
        gridInterface.setRanges([range(1, 'name', 1, 'name')]);
        groupExpanded(datasource);
        gridInterface.setRanges([range(1, 'name', 1, 'name')]);

        // the empty cell under name (the rows have two cells, name has one field)
        const empty = cellAt(element, 1, 'name').nextElementSibling as HTMLElement;
        empty.dispatchEvent(pointerEvent('pointerdown'));
        release();
        const selector = element.querySelector(
            '.simple-html-grid-body-row-container-selector .simple-html-grid-row'
        ) as HTMLElement;
        selector.dispatchEvent(pointerEvent('pointerdown'));
        release();

        expect(gridInterface.getRanges()).toEqual([range(1, 'name', 1, 'name')]);
    });

    it('expect the pointer over a group row, or outside the cells, not to move the end of the range', async () => {
        const { element, datasource, gridInterface } = await mount();
        groupExpanded(datasource);
        const groupRow = datasource.getRows().findIndex((row, i) => i > 0 && '__group' in row);

        press(element, 1, 'name');
        moveOver(element, 2, 'city');
        const groupCell = element.querySelectorAll('.simple-html-grid-body-row-container-group .simple-html-grid-row')[groupRow];
        const hit = pointerOver(groupCell);
        document.dispatchEvent(pointerEvent('pointermove'));
        hit.mockRestore();
        const nothing = pointerOver(null);
        document.dispatchEvent(pointerEvent('pointermove'));
        nothing.mockRestore();
        release();

        expect(gridInterface.getRanges()).toEqual([range(1, 'name', 2, 'city')]);
    });

    it('expect the row pressed to be the current row after a drag, a shift+drag to keep the current row', async () => {
        const { element, datasource } = await mount();
        datasource.setRowAsCurrentEntity(0);

        press(element, 3, 'city');
        moveOver(element, 5, 'age');
        release();
        expect(datasource.currentEntity).toBe(datasource.getRow(3));

        inputAt(element, 3, 'city').focus();
        press(element, 7, 'age', { shiftKey: true });
        moveOver(element, 8, 'age');
        release();
        expect(datasource.currentEntity).toBe(datasource.getRow(3));
    });

    it('expect the text selection the press started in the input to be collapsed once it is a range', async () => {
        const { element } = await mount();
        const input = inputAt(element, 1, 'name');
        input.focus();
        input.value = 'n1 longer';
        // what the browser selects while the pointer drags out of the input, from where it was pressed
        input.setSelectionRange(1, 9, 'forward');

        press(element, 1, 'name');
        moveOver(element, 2, 'name');
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect([input.selectionStart, input.selectionEnd]).toEqual([1, 1]);
        release();
    });

    it('expect a drag below the rows to scroll them down, and the range to follow to the row at the edge', async () => {
        const { element, gridInterface } = await mount();
        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        const rowHeight = gridInterface.__getGridConfig().__rowHeight;

        press(element, 1, 'name');
        moveOver(element, 2, 'name');
        // below the rows (they end at 600 here, every element is 0-600 high): the hit test is made just
        // inside them, where the cell of row 12 is
        const edge = pointerOver(inputAt(element, 12, 'name'));
        document.dispatchEvent(pointerEvent('pointermove', { clientX: 50, clientY: 700 }));
        expect(scroller.scrollTop).toBe(rowHeight);
        await sleep(AUTO_SCROLL_MS + 30);
        expect(gridInterface.getRanges()).toEqual([range(1, 'name', 12, 'name')]);
        // it goes on while the pointer stays out there
        expect(scroller.scrollTop).toBeGreaterThanOrEqual(rowHeight * 2);
        edge.mockRestore();
        release();

        const stopped = scroller.scrollTop;
        await sleep(AUTO_SCROLL_MS * 2);
        expect(scroller.scrollTop).toBe(stopped);
    });

    it('expect the focus moving to another cell to clear the ranges, and to the start of the last range to keep them', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(1, 'name', 3, 'city')]);

        inputAt(element, 1, 'name').focus();
        expect(gridInterface.getRanges()).toHaveLength(1);

        // a checkbox cell too
        inputAt(element, 4, 'active').focus();
        expect(gridInterface.getRanges()).toEqual([]);

        gridInterface.setRanges([range(1, 'name', 3, 'city')]);
        inputAt(element, 2, 'city').focus();
        expect(gridInterface.getRanges()).toEqual([]);
    });

    it('expect typing in a cell to clear the ranges', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(1, 'name', 3, 'city')]);
        const input = inputAt(element, 1, 'name');
        input.focus();

        input.value = 'typed';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(gridInterface.getRanges()).toEqual([]);
    });

    it('expect shift+click not to make the row current, and ctrl/cmd+click on a checkbox not to check it', async () => {
        const { element, datasource } = await mount();
        datasource.setRowAsCurrentEntity(0);

        inputAt(element, 3, 'city').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
        await sleep(10);
        expect(datasource.currentEntity).toBe(datasource.getRow(0));

        for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey']) {
            const click = new MouseEvent('click', { bubbles: true, cancelable: true, [modifier]: true });
            inputAt(element, 4, 'active').dispatchEvent(click);
            expect(click.defaultPrevented).toBe(true);
        }
        const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
        inputAt(element, 4, 'active').dispatchEvent(plain);
        expect(plain.defaultPrevented).toBe(false);
    });
});

describe('ranges - the keyboard', () => {
    it('expect Alt+Shift+arrows to start a range at the cell and move its end, the stacked fields one each', async () => {
        const { element, gridInterface } = await mount();
        const input = inputAt(element, 2, 'city');
        input.focus();

        key(input, 'ArrowDown', { altKey: true, shiftKey: true });
        expect(gridInterface.getRanges()).toEqual([range(2, 'city', 3, 'city')]);
        key(input, 'ArrowRight', { altKey: true, shiftKey: true });
        key(input, 'ArrowRight', { altKey: true, shiftKey: true });
        // age, then born: the field under it in the same column
        expect(gridInterface.getRanges()).toEqual([range(2, 'city', 3, 'born')]);
        key(input, 'ArrowUp', { altKey: true, shiftKey: true });
        key(input, 'ArrowUp', { altKey: true, shiftKey: true });
        key(input, 'ArrowLeft', { altKey: true, shiftKey: true });
        expect(gridInterface.getRanges()).toEqual([range(2, 'city', 1, 'age')]);
    });

    it('expect Alt+Shift+arrows to prevent the key, so the cell navigation and the browser do nothing', async () => {
        const { element } = await mount();
        const input = inputAt(element, 2, 'city');
        input.focus();

        const event = key(input, 'ArrowDown', { altKey: true, shiftKey: true });
        await sleep(150);

        expect(event.defaultPrevented).toBe(true);
        // Alt+ArrowDown alone would have moved the focus to the row below
        expect(document.activeElement).toBe(input);
    });

    it('expect the end to stop at the edges of the grid', async () => {
        const { element, gridInterface } = await mount();
        const input = inputAt(element, 0, 'name');
        input.focus();

        key(input, 'ArrowUp', { altKey: true, shiftKey: true });
        key(input, 'ArrowLeft', { altKey: true, shiftKey: true });
        expect(gridInterface.getRanges()).toEqual([range(0, 'name', 0, 'name')]);

        gridInterface.setRanges([range(0, 'name', 29, 'notes')]);
        key(input, 'ArrowDown', { altKey: true, shiftKey: true });
        key(input, 'ArrowRight', { altKey: true, shiftKey: true });
        expect(gridInterface.getRanges()).toEqual([range(0, 'name', 29, 'notes')]);
    });

    it('expect Alt+Shift+arrows to skip the group rows', async () => {
        const { element, datasource, gridInterface } = await mount();
        groupExpanded(datasource);
        // the rows: a group row, its 15 rows, the next group row, its rows
        const secondGroup = datasource.getRows().findIndex((row, i) => i > 0 && '__group' in row);
        gridInterface.setRanges([range(secondGroup - 1, 'name', secondGroup - 1, 'name')]);
        const input = inputAt(element, 1, 'name');
        input.focus();
        gridInterface.setRanges([range(secondGroup - 1, 'name', secondGroup - 1, 'name')]);

        key(input, 'ArrowDown', { altKey: true, shiftKey: true });

        expect(gridInterface.getRanges()[0].toRow).toBe(secondGroup + 1);
    });

    it('expect Alt+Shift+arrows to scroll the end of the range into view', async () => {
        const { element, gridInterface } = await mount();
        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        const rowHeight = gridInterface.__getGridConfig().__rowHeight;
        const input = inputAt(element, 0, 'name');
        input.focus();
        // the viewport is 600px here: row 13 ends below it
        gridInterface.setRanges([range(0, 'name', 12, 'name')]);

        key(input, 'ArrowDown', { altKey: true, shiftKey: true });

        expect(scroller.scrollTop).toBe(14 * rowHeight - 600);
    });

    it('expect Alt+Shift+arrows to collapse the text selected in the cell', async () => {
        const { element } = await mount();
        const input = inputAt(element, 2, 'city');
        input.focus();
        input.setSelectionRange(0, 2);

        key(input, 'ArrowDown', { altKey: true, shiftKey: true });

        expect(input.selectionStart).toBe(input.selectionEnd);
    });

    it('expect Esc to clear the ranges and prevent the key - and to do nothing without ranges, or with a menu open', async () => {
        const { element, gridInterface } = await mount();
        const input = inputAt(element, 2, 'city');
        input.focus();

        expect(key(input, 'Escape').defaultPrevented).toBe(false);

        gridInterface.setRanges([range(2, 'city', 4, 'age')]);
        gridInterface.openMenu({ x: 10, y: 10 }, [{ id: 'my.item', label: 'Item', action: () => undefined }]);
        key(input, 'Escape');
        // the menu took that Esc (the document listener closed it), the ranges stay
        expect(gridInterface.getRanges()).toHaveLength(1);

        const clearing = key(input, 'Escape');
        expect(clearing.defaultPrevented).toBe(true);
        expect(gridInterface.getRanges()).toEqual([]);
    });

    it('expect plain arrows and Shift+arrows to be the input own: no range', async () => {
        const { element, gridInterface } = await mount();
        const input = inputAt(element, 2, 'city');
        input.focus();

        const shift = key(input, 'ArrowRight', { shiftKey: true });
        const plain = key(input, 'ArrowDown');

        expect(gridInterface.getRanges()).toEqual([]);
        expect(shift.defaultPrevented).toBe(false);
        expect(plain.defaultPrevented).toBe(false);
    });
});

describe('ranges - shown on the cells', () => {
    it('expect the class on every cell of the range, across the sections, and the edges on its sides', async () => {
        const { element, gridInterface } = await mount();

        gridInterface.setRanges([range(1, 'name', 2, 'active')]);

        // name (left) to active (center), age and born stacked in between
        expect(rangeClasses(cellAt(element, 1, 'name'))).toBe('in top left');
        expect(rangeClasses(cellAt(element, 1, 'city'))).toBe('in top');
        expect(rangeClasses(cellAt(element, 1, 'age'))).toBe('in top');
        expect(rangeClasses(cellAt(element, 1, 'born'))).toBe('in');
        expect(rangeClasses(cellAt(element, 2, 'born'))).toBe('in bottom');
        expect(rangeClasses(cellAt(element, 1, 'active'))).toBe('in top right');
        expect(rangeClasses(cellAt(element, 2, 'name'))).toBe('in left');
        // the empty cells under the fields of one: in the range with their field, the bottom edge there
        expect(rangeClasses(cellAt(element, 2, 'name').nextElementSibling as HTMLElement)).toBe('in bottom left');
        expect(rangeClasses(cellAt(element, 2, 'active').nextElementSibling as HTMLElement)).toBe('in bottom right');
        // outside: the row above, the row below, the right pinned column
        expect(rangeClasses(cellAt(element, 0, 'name'))).toBe('');
        expect(rangeClasses(cellAt(element, 3, 'city'))).toBe('');
        expect(rangeClasses(cellAt(element, 1, 'notes'))).toBe('');
    });

    it('expect a range of the second stacked field only to be its cells, each with an edge all around', async () => {
        const { element, gridInterface } = await mount();

        gridInterface.setRanges([range(1, 'born', 2, 'born')]);

        // on screen the age of row 2 is between the two: not in the range
        expect(rangeClasses(cellAt(element, 1, 'born'))).toBe('in top bottom left right');
        expect(rangeClasses(cellAt(element, 2, 'born'))).toBe('in top bottom left right');
        expect(rangeClasses(cellAt(element, 2, 'age'))).toBe('');
    });

    it('expect two ranges side by side to be one outline', async () => {
        const { element, gridInterface } = await mount();

        gridInterface.setRanges([range(1, 'name', 1, 'name'), range(1, 'city', 1, 'city')]);

        expect(rangeClasses(cellAt(element, 1, 'name'))).toBe('in top left');
        expect(rangeClasses(cellAt(element, 1, 'name').nextElementSibling as HTMLElement)).toBe('in bottom left');
        expect(rangeClasses(cellAt(element, 1, 'city'))).toBe('in top right');
        expect(rangeClasses(cellAt(element, 1, 'city').nextElementSibling as HTMLElement)).toBe('in bottom right');
    });

    it('expect aria-selected="true" on the gridcells of a range, none on the others and on the empty cells', async () => {
        const { element, gridInterface } = await mount();

        gridInterface.setRanges([range(1, 'name', 1, 'city')]);

        expect(cellAt(element, 1, 'name').getAttribute('aria-selected')).toBe('true');
        expect(cellAt(element, 1, 'city').getAttribute('aria-selected')).toBe('true');
        expect(cellAt(element, 1, 'notes').hasAttribute('aria-selected')).toBe(false);
        expect((cellAt(element, 1, 'name').nextElementSibling as HTMLElement).hasAttribute('aria-selected')).toBe(false);

        gridInterface.clearRanges();
        expect(element.querySelectorAll('.simple-html-grid-body [aria-selected="true"][role="gridcell"]')).toHaveLength(0);
        expect(element.querySelectorAll('.simple-html-cell-in-range')).toHaveLength(0);
    });

    it('expect the classes to follow the rows when the cells are reused while scrolling', async () => {
        const { element, gridInterface } = await mount();
        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        const rowHeight = gridInterface.__getGridConfig().__rowHeight;
        gridInterface.setRanges([range(0, 'name', 5, 'notes')]);
        const firstCell = cellAt(element, 0, 'name');

        // rows 2 to 15 on screen: the one before the first that starts in the viewport, and on
        scroller.scrollTop = rowHeight * 3;
        scroller.dispatchEvent(new Event('scroll'));

        // the cell element that showed row 0 shows a row further down now, outside the range
        expect(firstCell.$row).toBeGreaterThan(5);
        expect(rangeClasses(firstCell)).toBe('');
        const shown = (Array.from(element.querySelectorAll('.simple-html-cell-in-range')) as HTMLCellElement[]).filter(
            (cell) => (cell.closest('.simple-html-grid-row') as HTMLElement).style.display === 'block'
        );
        expect(new Set(shown.map((cell) => cell.$row))).toEqual(new Set([2, 3, 4, 5]));

        scroller.scrollTop = 0;
        scroller.dispatchEvent(new Event('scroll'));
        expect(rangeClasses(cellAt(element, 0, 'name'))).toBe('in top left');
    });

    it('expect a range over a group row to leave it out, with edges at it', async () => {
        const { element, datasource, gridInterface } = await mount();
        // 6 rows: a group row and 3 rows, twice - all on screen
        datasource.filter(where('age', 'LESS_THAN', 6));
        groupExpanded(datasource);
        const secondGroup = datasource.getRows().findIndex((row, i) => i > 0 && '__group' in row);
        expect(secondGroup).toBe(4);
        gridInterface.setRanges([range(1, 'name', 6, 'name')]);

        expect(rangeClasses(cellAt(element, secondGroup - 1, 'name').nextElementSibling as HTMLElement)).toBe(
            'in bottom left right'
        );
        expect(rangeClasses(cellAt(element, secondGroup + 1, 'name'))).toBe('in top left right');
        // the group row's cells are hidden and in no range
        const groupCells = Array.from(element.querySelectorAll('.simple-html-grid-col-cell')).filter(
            (cell) => (cell as HTMLCellElement).$row === secondGroup
        );
        expect(groupCells.some((cell) => cell.classList.contains('simple-html-cell-in-range'))).toBe(false);
    });

    it('expect a change of the ranges to leave the input typed in as it is', async () => {
        const { element, gridInterface } = await mount();
        const input = inputAt(element, 1, 'city');
        input.focus();
        input.value = 'typing';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        gridInterface.setRanges([range(0, 'name', 3, 'notes')]);

        expect(input.value).toBe('typing');
        expect(rangeClasses(cellAt(element, 1, 'city'))).toBe('in');
    });
});

describe('ranges - cleared when the rows or the layout change', () => {
    const cases: [string, (mounted: MountedGrid) => void][] = [
        ['a filter', ({ datasource }) => datasource.filter(where('age', 'GREATER_THAN', 2))],
        ['a sort', ({ datasource }) => datasource.sort({ attribute: 'name', ascending: false })],
        ['grouping', ({ datasource }) => datasource.group([{ attribute: 'active', title: 'Active' }])],
        ['rows set', ({ datasource }) => datasource.setData(data())],
        ['a row added', ({ datasource }) => datasource.addNewEmpty({ name: 'new' }, { scrollTo: false })],
        ['a row removed', ({ datasource }) => datasource.removeData(datasource.getDataRows()[0])],
        ['rows marked for deletion', ({ datasource }) => datasource.markForDeletion(datasource.getDataRows()[0])],
        ['an upsert that adds a row', ({ datasource }) => datasource.upsert([{ id: 99, name: 'merged' }])],
        [
            'setState with a sort',
            ({ gridInterface }) => gridInterface.setState({ sorting: [{ attribute: 'age', ascending: false }] })
        ],
        ['resetState', ({ gridInterface }) => gridInterface.resetState()],
        [
            'a column moved',
            ({ gridInterface }) => {
                const layout = gridInterface.getState().layout;
                layout.center.reverse();
                gridInterface.setState({ layout });
            }
        ],
        [
            'a column pinned',
            ({ gridInterface }) => {
                const layout = gridInterface.getState().layout;
                layout.left = [...(layout.left ?? []), ...layout.center.splice(0, 1)];
                gridInterface.setState({ layout });
            }
        ],
        [
            'a new layout',
            ({ gridInterface }) => gridInterface.updateConfig({ layout: { center: [{ fields: ['name'], width: 100 }] } })
        ]
    ];

    it.each(cases)('expect %s to clear them and send range-change', async (_name, change) => {
        const mounted = await mount();
        mounted.gridInterface.setRanges([range(1, 'name', 3, 'city')]);
        const events = rangeEvents(mounted);

        change(mounted);

        expect(mounted.gridInterface.getRanges()).toEqual([]);
        expect(events).toEqual([[]]);
        expect(mounted.element.querySelectorAll('.simple-html-cell-in-range')).toHaveLength(0);
    });

    it('expect expand and collapse to clear them', async () => {
        const { datasource, gridInterface } = await mount();
        groupExpanded(datasource);

        gridInterface.setRanges([range(1, 'name', 3, 'city')]);
        datasource.collapseGroup();
        expect(gridInterface.getRanges()).toEqual([]);

        gridInterface.setRanges([range(0, 'name', 0, 'city')]);
        datasource.expandGroup();
        expect(gridInterface.getRanges()).toEqual([]);
    });

    const kept: [string, (mounted: MountedGrid) => void][] = [
        ['an edit', ({ datasource }) => (datasource.getDataRows()[1].name = 'edited')],
        ['an upsert that only changes values', ({ datasource }) => datasource.upsert([{ id: 1, name: 'merged' }])],
        ['the row selection', ({ datasource }) => datasource.select(2)],
        ['the current row', ({ datasource }) => datasource.setRowAsCurrentEntity(4)],
        [
            'a column resized',
            ({ gridInterface }) => {
                const layout = gridInterface.getState().layout;
                layout.center[0].width = 250;
                gridInterface.setState({ layout });
            }
        ],
        ['an option changed', ({ gridInterface }) => gridInterface.updateConfig({ readonly: true })],
        [
            'refresh() and rebuild()',
            ({ gridInterface }) => {
                gridInterface.refresh();
                gridInterface.rebuild();
            }
        ],
        ['validate()', ({ datasource }) => datasource.validate()]
    ];

    it.each(kept)('expect %s to keep them', async (_name, change) => {
        const mounted = await mount();
        mounted.gridInterface.setRanges([range(1, 'name', 3, 'city')]);

        change(mounted);
        await sleep(20);

        expect(mounted.gridInterface.getRanges()).toEqual([range(1, 'name', 3, 'city')]);
        expect(rangeClasses(cellAt(mounted.element, 1, 'name'))).toBe('in top left');
    });

    it('expect them cleared when the grid is connected again: the rows may have changed while it was away', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(1, 'name', 3, 'city')]);

        element.remove();
        document.body.appendChild(element);

        expect(gridInterface.getRanges()).toEqual([]);
    });
});

describe('ranges - the API', () => {
    it('expect getRanges() and the event to give copies, with the four keys only', async () => {
        const mounted = await mount();
        const events = rangeEvents(mounted);
        const given = { ...range(1, 'name', 3, 'city'), extra: true } as CellRange;

        mounted.gridInterface.setRanges([given]);
        given.fromRow = 7;
        const got = mounted.gridInterface.getRanges();
        got[0].toRow = 9;

        expect(mounted.gridInterface.getRanges()).toEqual([range(1, 'name', 3, 'city')]);
        expect(events).toEqual([[range(1, 'name', 3, 'city')]]);
    });

    it('expect no event when nothing changed: the same ranges set again, or clearing none', async () => {
        const mounted = await mount();
        const events = rangeEvents(mounted);

        mounted.gridInterface.clearRanges();
        mounted.gridInterface.setRanges([range(1, 'name', 3, 'city')]);
        mounted.gridInterface.setRanges([range(1, 'name', 3, 'city')]);

        expect(events).toHaveLength(1);
    });

    it('expect a range from below and right to above and left to be the same cells', async () => {
        const { element, gridInterface } = await mount();

        gridInterface.setRanges([range(3, 'city', 1, 'name')]);

        expect(gridInterface.getRanges()).toEqual([range(3, 'city', 1, 'name')]);
        expect(rangeClasses(cellAt(element, 1, 'name'))).toBe('in top left');
        // the empty cell under city, the rows have two cells
        expect(rangeClasses(cellAt(element, 3, 'city'))).toBe('in right');
        expect(rangeClasses(cellAt(element, 3, 'city').nextElementSibling as HTMLElement)).toBe('in bottom right');
    });

    it.each([
        ['not a list', { fromRow: 0 }, 'takes a list of ranges'],
        ['a row out of range', [range(0, 'name', 30, 'name')], 'toRow is the index of a displayed row, 0 to 29, got 30'],
        ['a negative row', [range(-1, 'name', 0, 'name')], 'fromRow is the index of a displayed row'],
        ['a row that is no integer', [range(0.5, 'name', 0, 'name')], 'fromRow is the index of a displayed row'],
        [
            'a field not in the layout',
            [range(0, 'id', 0, 'name')],
            'fromField is a field of the layout (name, city, age, born, active, notes), got "id"'
        ],
        ['no object', [null], 'range 0 is not an object']
    ])('expect a TypeError for %s', async (_name, ranges, message) => {
        const { gridInterface } = await mount();
        expect(() => gridInterface.setRanges(ranges as any)).toThrow(TypeError);
        expect(() => gridInterface.setRanges(ranges as any)).toThrow(message);
        expect(gridInterface.getRanges()).toEqual([]);
    });

    it('expect the ranges of a grid not on the page to be kept, and shown when it is put there', async () => {
        const { element, gridInterface } = await mount();
        element.remove();
        gridInterface.setRanges([range(1, 'name', 1, 'name')]);
        expect(gridInterface.getRanges()).toEqual([range(1, 'name', 1, 'name')]);
        expect(gridOf(element).gridInterface).toBe(gridInterface);
    });
});

describe('ranges - the export of a range', () => {
    it("expect getCsv({ rows: 'range' }) to give the cells of the last range, with their labels", async () => {
        const { gridInterface } = await mount();
        gridInterface.setRanges([range(0, 'name', 0, 'name'), range(2, 'city', 3, 'age')]);

        expect(gridInterface.getCsv({ rows: 'range' })).toBe('City,Age\r\nc2,2\r\nc3,3\r\n');
        expect(gridInterface.getCsv({ rows: 'range', fields: ['name'], header: false })).toBe('n2\r\nn3\r\n');
    });

    it("expect getCsv({ rows: 'range' }) without a range to be empty, and a group row in it left out", async () => {
        const { datasource, gridInterface } = await mount();
        expect(gridInterface.getCsv({ rows: 'range' })).toBe('');

        groupExpanded(datasource);
        // the first group row and its first two rows
        gridInterface.setRanges([range(0, 'name', 2, 'name')]);
        expect(gridInterface.getCsv({ rows: 'range', header: false }).split('\r\n')).toHaveLength(3);
    });
});
