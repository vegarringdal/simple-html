// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { where } from '../../datasource/filterExpression';
import type { CellRange } from '../cellRange';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import type { GridHooks } from '../gridHooks';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuItem, openRowMenu, sleep } from './interactionTestHelpers';

/**
 * The clipboard of the cell ranges (V6 item 33): copy as tab separated text (and an html table),
 * paste tab separated text into the cells, Delete clears the ranges - and the row menu's Copy / Paste
 * / Clear range. The ranges themselves are in ranges.test.ts.
 *
 * happy-dom has ClipboardEvent and DataTransfer: the events are made as the browser sends them, at the
 * element with the focus (a checkbox's go to the body, as in Chrome).
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
    Array.from({ length: 8 }, (_, i) => ({
        id: i,
        name: `n${i}`,
        city: `c${i}`,
        age: i * 10,
        born: new Date(2026, 0, 1 + i),
        active: i % 2 === 0,
        notes: `note ${i}`
    }));

/**
 * name pinned left, notes pinned right, age and born stacked: the fields in the order of the layout are
 * name, city, age, born, active, notes
 */
const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    layout: {
        left: [{ fields: ['name'], width: 100 }],
        center: [
            { fields: ['city'], width: 100 },
            { fields: ['age', 'born'], width: 100 },
            { fields: ['active'], width: 100 }
        ],
        right: [{ fields: ['notes'], width: 100 }]
    },
    ...more
});

const options = () => ({
    key: 'id',
    fields: {
        age: { type: 'number' as const, validate: [{ id: 'max', value: 100 }] },
        born: 'date' as const,
        active: 'boolean' as const,
        notes: { multiline: true }
    }
});

const mount = (more: Partial<GridConfig> = {}, hooks: GridHooks = {}) => mountGrid(config(more), data(), options(), hooks);

/** the cell element that shows a field of a displayed row */
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

/** the input of a cell, focused: the copy and paste events go to it */
function focusCell(element: GridElement, row: number, field: string) {
    const input = cellAt(element, row, field).querySelector('input') as HTMLInputElement;
    input.focus();
    return input;
}

/**
 * a copy event as the browser sends it on Ctrl+C: at the element with the focus (the body for a
 * checkbox). Returns what was put on the clipboard, and whether the grid took it
 */
function copy(target: EventTarget = document.activeElement ?? document.body) {
    const clipboardData = new DataTransfer();
    const event = new ClipboardEvent('copy', { clipboardData, bubbles: true, cancelable: true, composed: true });
    target.dispatchEvent(event);
    return { text: clipboardData.getData('text/plain'), html: clipboardData.getData('text/html'), taken: event.defaultPrevented };
}

/** a paste event on Ctrl+V, with this text on the clipboard. Returns whether the grid took it */
function paste(text: string, target: EventTarget = document.activeElement ?? document.body) {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    const event = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true, composed: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
}

/** a key in an input */
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

/** the values of a field in rows, by displayed row */
const values = (datasource: { getRow(row: number): any }, field: string, rows: number[]) =>
    rows.map((row) => datasource.getRow(row)[field]);

describe('clipboard - copy', () => {
    it('expect the range as tab separated text, a line per row ended with CRLF, as the cells show it', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(1, 'name', 2, 'active')]);
        focusCell(element, 1, 'name');

        const { text, taken } = copy();

        expect(taken).toBe(true);
        // the header line first: the column labels (copyHeaders), so Word and Excel show them
        expect(text).toBe('Name\tCity\tAge\tBorn\tActive\r\nn1\tc1\t10\t2026-01-02\tfalse\r\nn2\tc2\t20\t2026-01-03\ttrue\r\n');
    });

    it('expect no header line with copyHeaders: false', async () => {
        const { element, gridInterface } = await mount({ copyHeaders: false });
        gridInterface.setRanges([range(1, 'name', 2, 'city')]);
        focusCell(element, 1, 'name');

        const { text, html } = copy();

        expect(text).toBe('n1\tc1\r\nn2\tc2\r\n');
        expect(html).not.toContain('<th');
    });

    it('expect an html table of the same cells with a header row, escaped, a line break kept in the cell', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.getRow(1).name = '<b>&"x"</b>';
        datasource.getRow(2).name = 'two\nlines';
        gridInterface.setRanges([range(1, 'name', 2, 'city')]);
        focusCell(element, 1, 'name');

        const { html } = copy();

        const td = '<td style="border:1px solid #999;padding:2px 4px">';
        const th = '<th style="border:1px solid #999;padding:2px 4px">';
        expect(html).toBe(
            `<table style="border-collapse:collapse"><thead><tr>${th}Name</th>${th}City</th></tr></thead><tbody>` +
                `<tr>${td}&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;</td>${td}c1</td></tr>` +
                `<tr>${td}two<br style="mso-data-placement:same-cell">lines</td>${td}c2</td></tr></tbody></table>`
        );
    });

    it('expect a value with a tab, a line break or a quote in quotes, as Excel writes it', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.getRow(1).name = 'a\tb';
        datasource.getRow(1).city = 'say "hi"';
        datasource.getRow(2).name = 'two\r\nlines';
        gridInterface.setRanges([range(1, 'name', 2, 'city')]);
        focusCell(element, 1, 'name');

        expect(copy().text).toBe('Name\tCity\r\n"a\tb"\t"say ""hi"""\r\n"two\r\nlines"\tc2\r\n');
    });

    it('expect the range drawn upwards and leftwards to be copied top to bottom, left to right', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(2, 'city', 1, 'name')]);
        focusCell(element, 2, 'city');

        expect(copy().text).toBe('Name\tCity\r\nn1\tc1\r\nn2\tc2\r\n');
    });

    it('expect several ranges copied as one table: their rows x their fields, a cell in no range empty', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(0, 'name', 0, 'name'), range(3, 'city', 4, 'city')]);
        focusCell(element, 3, 'city');

        expect(copy().text).toBe('Name\tCity\r\nn0\t\r\n\tc3\r\n\tc4\r\n');
    });

    it('expect two ranges side by side to be one wide table, one above the other one long table', async () => {
        const { element, gridInterface } = await mount();
        // name and age, rows 1-2: city between them is in no range, so it is not copied
        gridInterface.setRanges([range(1, 'name', 2, 'name'), range(1, 'age', 2, 'age')]);
        focusCell(element, 1, 'age');
        expect(copy().text).toBe('Name\tAge\r\nn1\t10\r\nn2\t20\r\n');

        gridInterface.setRanges([range(0, 'city', 1, 'city'), range(4, 'city', 4, 'city')]);
        focusCell(element, 4, 'city');
        expect(copy().text).toBe('City\r\nc0\r\nc1\r\nc4\r\n');
    });

    it('expect no group row in what is copied', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.group([{ attribute: 'active', title: 'Active' }]);
        datasource.expandGroup();
        // group row 0, rows 1-4, group row 5, rows 6-9
        gridInterface.setRanges([range(3, 'city', 6, 'city')]);
        focusCell(element, 3, 'city');

        // the header, rows 3, 4 and 6, and the empty text after the last line end
        expect(copy().text.split('\r\n')).toHaveLength(5);
    });

    it('expect one cell with no text selected: its value as the cell shows it, quoted when it has to be, no line end', async () => {
        const { element, datasource } = await mount();
        focusCell(element, 2, 'born');
        // a value: no header line
        expect(copy()).toEqual({
            text: '2026-01-03',
            html: '<table style="border-collapse:collapse"><tbody><tr><td style="border:1px solid #999;padding:2px 4px">2026-01-03</td></tr></tbody></table>',
            taken: true
        });

        datasource.getRow(3).notes = 'two\nlines';
        await sleep(30);
        focusCell(element, 3, 'notes');
        expect(copy().text).toBe('"two\nlines"');
    });

    it('expect a range of one cell to copy the cell with the focus, as no range does', async () => {
        const { element, gridInterface } = await mount();
        // focused first: focusing a cell that is not the start of the last range clears the ranges
        focusCell(element, 2, 'city');
        gridInterface.setRanges([range(5, 'name', 5, 'name')]);

        expect(copy().text).toBe('c2');
    });

    it('expect text selected in the input to be the input own copy, also with a range', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(1, 'name', 2, 'city')]);
        const input = focusCell(element, 1, 'name');
        input.setSelectionRange(0, 1);

        const { text, taken } = copy();

        expect(taken).toBe(false);
        expect(text).toBe('');
    });

    it('expect a checkbox with the focus: the copy goes to the body, the grid takes it', async () => {
        const { element, gridInterface } = await mount();
        focusCell(element, 2, 'active');
        expect(copy(document.body).text).toBe('true');

        gridInterface.setRanges([range(1, 'active', 2, 'active')]);
        expect(copy(document.body).text).toBe('Active\r\nfalse\r\ntrue\r\n');
    });

    it('expect a copy in a readonly grid too', async () => {
        const { element, gridInterface } = await mount({ readonly: true });
        gridInterface.setRanges([range(0, 'name', 1, 'name')]);
        focusCell(element, 0, 'name');

        expect(copy().text).toBe('Name\r\nn0\r\nn1\r\n');
    });

    it('expect nothing taken when the focus is not in a cell of the grid: a header filter, another input', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(0, 'name', 1, 'name')]);
        const filter = element.querySelector('input.simple-html-grid-cell-filter-input') as HTMLInputElement;
        filter.focus();
        expect(copy().taken).toBe(false);

        const outside = document.createElement('input');
        document.body.appendChild(outside);
        outside.focus();
        expect(copy().taken).toBe(false);
    });

    it('expect a copy or a paste another listener canceled first to be left alone', async () => {
        const { element, datasource, gridInterface } = await mount();
        focusCell(element, 1, 'name');
        gridInterface.setRanges([range(1, 'name', 2, 'city')]);
        const mine = (event: ClipboardEvent) => {
            event.clipboardData?.setData('text/plain', 'mine');
            event.preventDefault();
        };
        document.addEventListener('copy', mine, true);
        document.addEventListener('paste', mine, true);

        expect(copy().text).toBe('mine');
        paste('a\tb\r\nc\td');
        expect(datasource.getRow(1).name).toBe('n1');

        document.removeEventListener('copy', mine, true);
        document.removeEventListener('paste', mine, true);
    });

    it('expect each of two grids to take only the copy of its own cells', async () => {
        const first = await mount();
        const second = await mount();
        first.gridInterface.setRanges([range(0, 'name', 1, 'name')]);
        focusCell(second.element, 3, 'city');

        expect(copy().text).toBe('c3');
    });
});

describe('clipboard - paste', () => {
    it('expect a block from the cell with the focus, down and right, each text through the field formatter', async () => {
        const { element, datasource, gridInterface } = await mount();
        focusCell(element, 1, 'city');

        const taken = paste('Oslo\t12,5\t2026-11-20\ttrue\r\nBergen\t7\t\tfalse\r\n');

        expect(taken).toBe(true);
        expect(values(datasource, 'city', [1, 2])).toEqual(['Oslo', 'Bergen']);
        expect(values(datasource, 'age', [1, 2])).toEqual([12.5, 7]);
        expect(datasource.getRow(1).born.toDateString()).toBe(new Date(2026, 10, 20).toDateString());
        // an empty text clears the cell
        expect(datasource.getRow(2).born).toBe(null);
        expect(values(datasource, 'active', [1, 2])).toEqual([true, false]);
        // the cells pasted into are a range now: where it went
        expect(gridInterface.getRanges()).toEqual([range(1, 'city', 2, 'active')]);
    });

    it("expect a first line of the grid's column labels left out: a copy's header is not written into cells", async () => {
        const { element, datasource } = await mount();
        focusCell(element, 1, 'city');

        // labels of any of the grid's columns, any case: also pasted into other columns than copied from
        paste('Name\tAGE \r\nOslo\t12\r\n');

        expect(values(datasource, 'city', [1, 2])).toEqual(['Oslo', 'c2']);
        expect(values(datasource, 'age', [1])).toEqual([12]);
    });

    it('expect a first line that is not all labels to be pasted', async () => {
        const { element, datasource } = await mount();
        focusCell(element, 1, 'city');

        paste('City\tsomething else\r\nOslo\t12\r\n');

        expect(values(datasource, 'city', [1, 2])).toEqual(['City', 'Oslo']);
    });

    it('expect a copy pasted back into the grid to write the values, not the labels', async () => {
        const { element, datasource, gridInterface } = await mount();
        gridInterface.setRanges([range(0, 'city', 1, 'city')]);
        focusCell(element, 0, 'city');
        const { text } = copy();
        expect(text.startsWith('City\r\n')).toBe(true);

        gridInterface.clearRanges();
        focusCell(element, 3, 'city');
        paste(text);

        expect(values(datasource, 'city', [3, 4])).toEqual(['c0', 'c1']);
    });

    it('expect a block from the top left cell of the last range, the range drawn upwards too', async () => {
        const { element, datasource, gridInterface } = await mount();
        gridInterface.setRanges([range(4, 'city', 3, 'name')]);
        focusCell(element, 4, 'city');

        paste('a\tb\r\nc\td');

        expect(values(datasource, 'name', [3, 4])).toEqual(['a', 'c']);
        expect(values(datasource, 'city', [3, 4])).toEqual(['b', 'd']);
        // the range stays as it was
        expect(gridInterface.getRanges()).toEqual([range(4, 'city', 3, 'name')]);
    });

    it('expect a block larger than the range to be pasted whole, one smaller not to be repeated', async () => {
        const { element, datasource, gridInterface } = await mount();
        gridInterface.setRanges([range(1, 'name', 1, 'city')]);
        focusCell(element, 1, 'name');
        paste('a\r\nb\r\nc');
        expect(values(datasource, 'name', [1, 2, 3])).toEqual(['a', 'b', 'c']);
        expect(datasource.getRow(1).city).toBe('c1');

        gridInterface.setRanges([range(4, 'name', 6, 'name')]);
        paste('x\r\ny');
        expect(values(datasource, 'name', [4, 5, 6])).toEqual(['x', 'y', 'n6']);
    });

    it('expect one value to fill every cell of every range', async () => {
        const { element, datasource, gridInterface } = await mount();
        gridInterface.setRanges([range(0, 'name', 1, 'city'), range(5, 'notes', 6, 'notes')]);
        focusCell(element, 5, 'notes');

        expect(paste('same\r\n')).toBe(true);

        expect(values(datasource, 'name', [0, 1])).toEqual(['same', 'same']);
        expect(values(datasource, 'city', [0, 1])).toEqual(['same', 'same']);
        expect(values(datasource, 'notes', [5, 6])).toEqual(['same', 'same']);
        expect(datasource.getRow(2).name).toBe('n2');
    });

    it('expect one value with no range to be the input own paste, at its caret', async () => {
        const { element, datasource } = await mount();
        focusCell(element, 1, 'name');

        expect(paste('plain')).toBe(false);
        expect(paste('excel cell\r\n')).toBe(false);
        expect(datasource.getRow(1).name).toBe('n1');
    });

    it('expect one value the input can not take to be written by the grid: a line break, a checkbox, a multiline cell', async () => {
        const { element, datasource } = await mount();

        focusCell(element, 1, 'name');
        expect(paste('"two\nlines"')).toBe(true);
        expect(datasource.getRow(1).name).toBe('two\nlines');

        focusCell(element, 2, 'active');
        expect(paste('true', document.body)).toBe(true);
        expect(datasource.getRow(2).active).toBe(true);

        // the input of a multiline cell is readonly, the cell can be edited
        focusCell(element, 3, 'notes');
        expect(paste('new note')).toBe(true);
        expect(datasource.getRow(3).notes).toBe('new note');
    });

    it('expect one value the grid writes to go to the cell with the focus, not to a range of one cell elsewhere', async () => {
        const { element, datasource, gridInterface } = await mount();
        focusCell(element, 3, 'active');
        gridInterface.setRanges([range(5, 'name', 5, 'name')]);

        // row 3 is not active
        expect(paste('true', document.body)).toBe(true);

        expect(datasource.getRow(3).active).toBe(true);
        expect(datasource.getRow(5).name).toBe('n5');
    });

    it('expect one value into a column with allowPasteClearOnly to be written by the grid: it can not be typed in', async () => {
        const { element, datasource } = await mount({ columns: { city: { allowPasteClearOnly: true } } });
        focusCell(element, 1, 'city');

        expect(paste('pasted')).toBe(true);
        expect(datasource.getRow(1).city).toBe('pasted');
    });

    it('expect the readonly cells skipped: the column, the isReadonly hook', async () => {
        const { element, datasource } = await mount(
            { columns: { city: { readonly: true } } },
            { isReadonly: (row, field) => (field === 'name' && row.id === 2 ? true : null) }
        );
        focusCell(element, 1, 'name');

        paste('a\tb\tc\r\nd\te\tf');

        expect(values(datasource, 'name', [1, 2])).toEqual(['a', 'n2']);
        expect(values(datasource, 'city', [1, 2])).toEqual(['c1', 'c2']);
        expect(values(datasource, 'age', [1, 2])).toEqual([0, 0]);
    });

    it('expect nothing in a readonly grid: the paste is left to the input, which is readonly', async () => {
        const { element, datasource, gridInterface } = await mount({ readonly: true });
        gridInterface.setRanges([range(0, 'name', 1, 'name')]);
        focusCell(element, 0, 'name');

        expect(paste('a\r\nb')).toBe(false);
        expect(values(datasource, 'name', [0, 1])).toEqual(['n0', 'n1']);
    });

    it('expect no rows added past the last one, and the fields past the last one left out', async () => {
        const { element, datasource } = await mount();
        focusCell(element, 6, 'notes');

        paste('a\tlost\r\nb\r\nc\r\nd');

        expect(values(datasource, 'notes', [6, 7])).toEqual(['a', 'b']);
        expect(datasource.length()).toBe(8);
        expect(datasource.getAllData()).toHaveLength(8);
    });

    it('expect group rows skipped: a row of the block per data row', async () => {
        const { element, datasource } = await mount();
        datasource.filter(where('id', 'LESS_THAN', 4));
        datasource.group([{ attribute: 'active', title: 'Active' }]);
        datasource.expandGroup();
        // group row 0, rows 1-2, group row 3, rows 4-5
        focusCell(element, 2, 'city');

        paste('a\r\nb\r\nc');

        expect(values(datasource, 'city', [2, 4, 5])).toEqual(['a', 'b', 'c']);
    });

    it('expect the whole paste to be one step of the undo history', async () => {
        const { element, datasource } = await mount();
        focusCell(element, 1, 'city');
        paste('a\t1\r\nb\t2');
        await sleep(0);

        datasource.undo();

        expect(values(datasource, 'city', [1, 2])).toEqual(['c1', 'c2']);
        expect(values(datasource, 'age', [1, 2])).toEqual([10, 20]);
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect every write validated: an error on the cell pasted into', async () => {
        const { element, datasource } = await mount();
        focusCell(element, 1, 'age');

        paste('500\r\n50');

        expect(datasource.getErrors().map((error) => [error.row.id, error.field])).toEqual([[1, 'age']]);
    });

    it('expect the cells to show the pasted values, the edited marker, and the cell with the focus too', async () => {
        const { element } = await mount();
        const input = focusCell(element, 1, 'city');
        // typed in first: the paste writes the cell, so it is rendered again
        input.value = 'typed';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        paste('a\tb\r\nc\td');
        await sleep(30);

        expect(input.value).toBe('a');
        expect((cellAt(element, 2, 'city').querySelector('input') as HTMLInputElement).value).toBe('c');
        expect(cellAt(element, 2, 'city').querySelector('.simple-html-cell-edited-marker')).not.toBeNull();
    });

    it('expect an empty clipboard to do nothing', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setRanges([range(0, 'name', 1, 'name')]);
        focusCell(element, 0, 'name');

        expect(paste('')).toBe(false);
    });
});

describe('clipboard - Delete clears the ranges', () => {
    it('expect Delete and Backspace to clear every cell of the ranges, null, the readonly ones skipped, one undo step', async () => {
        const { element, datasource, gridInterface } = await mount({ columns: { city: { readonly: true } } });
        // focused first: focusing a cell that is not the start of the last range clears the ranges
        const input = focusCell(element, 1, 'name');
        gridInterface.setRanges([range(1, 'name', 2, 'age'), range(5, 'notes', 5, 'notes')]);

        const event = key(input, 'Delete');

        expect(event.defaultPrevented).toBe(true);
        expect(values(datasource, 'name', [1, 2])).toEqual([null, null]);
        expect(values(datasource, 'age', [1, 2])).toEqual([null, null]);
        expect(values(datasource, 'city', [1, 2])).toEqual(['c1', 'c2']);
        expect(datasource.getRow(5).notes).toBe(null);
        await sleep(0);

        datasource.undo();
        expect(values(datasource, 'name', [1, 2])).toEqual(['n1', 'n2']);
        expect(datasource.getRow(5).notes).toBe('note 5');

        gridInterface.setRanges([range(3, 'name', 4, 'name')]);
        expect(key(input, 'Backspace').defaultPrevented).toBe(true);
        expect(values(datasource, 'name', [3, 4])).toEqual([null, null]);
    });

    it('expect Delete in one cell, with text selected, with a modifier or in a readonly grid to be the input own', async () => {
        const { element, datasource, gridInterface } = await mount();
        const input = focusCell(element, 1, 'name');

        expect(key(input, 'Delete').defaultPrevented).toBe(false);

        gridInterface.setRanges([range(1, 'name', 1, 'name')]);
        expect(key(input, 'Delete').defaultPrevented).toBe(false);

        gridInterface.setRanges([range(1, 'name', 2, 'name')]);
        expect(key(input, 'Delete', { ctrlKey: true }).defaultPrevented).toBe(false);
        input.setSelectionRange(0, 1);
        expect(key(input, 'Backspace').defaultPrevented).toBe(false);
        expect(values(datasource, 'name', [1, 2])).toEqual(['n1', 'n2']);

        gridInterface.updateConfig({ readonly: true });
        gridInterface.setRanges([range(1, 'name', 2, 'name')]);
        const readonlyInput = focusCell(element, 1, 'name');
        expect(key(readonlyInput, 'Delete').defaultPrevented).toBe(false);
        expect(values(datasource, 'name', [1, 2])).toEqual(['n1', 'n2']);
    });

    it('expect Delete on a checkbox to clear the ranges too', async () => {
        const { element, datasource, gridInterface } = await mount();
        gridInterface.setRanges([range(2, 'active', 3, 'active')]);
        const checkbox = focusCell(element, 2, 'active');

        expect(key(checkbox, 'Delete').defaultPrevented).toBe(true);
        expect(values(datasource, 'active', [2, 3])).toEqual([null, null]);
    });
});

describe('clipboard - the row menu', () => {
    /**
     * document.execCommand('copy') as the browser runs it: a copy event at the element with the focus,
     * what its listeners put on the clipboard. happy-dom has no execCommand
     */
    function stubExecCommand() {
        const written: { text: string; html: string }[] = [];
        (document as any).execCommand = (command: string) => {
            if (command === 'copy') {
                written.push(copy());
            }
            return true;
        };
        return written;
    }

    afterEach(() => {
        delete (document as any).execCommand;
    });

    it('expect no range entries without ranges', async () => {
        const { element } = await mount();
        openRowMenu(element, 'name', 0);
        expect(document.querySelector('[data-menu-id$=".range"]')).toBeNull();
    });

    it('expect Copy: Range to put the ranges on the clipboard, as Ctrl+C does', async () => {
        const { element, gridInterface } = await mount();
        const written = stubExecCommand();
        // the focus in a cell outside the range: the menu copies the range all the same
        focusCell(element, 4, 'notes');
        gridInterface.setRanges([range(0, 'name', 1, 'city')]);

        openRowMenu(element, 'name', 0);
        menuItem('Range').click();

        expect(written.map(({ text }) => text)).toEqual(['Name\tCity\r\nn0\tc0\r\nn1\tc1\r\n']);
    });

    it('expect Copy: Column and Row of the selected rows with the header line, values as the cells show them', async () => {
        const { element, datasource } = await mount();
        const written = stubExecCommand();
        datasource.getRow(1).name = '<b>';
        datasource.getSelection().selectRowRange(1, 2);

        openRowMenu(element, 'born', 1);
        menuItem('Column').click();
        openRowMenu(element, 'born', 1);
        menuItem('Row').click();

        expect(written[0].text).toBe('Born\r\n2026-01-02\r\n2026-01-03\r\n');
        expect(written[0].html).toContain('<thead><tr><th style="border:1px solid #999;padding:2px 4px">Born</th></tr></thead>');
        expect(written[1].text.split('\r\n')[0]).toBe('Name\tCity\tAge\tBorn\tActive\tNotes');
        // escaped: the old html table of the row menu was not
        expect(written[1].html).toContain('&lt;b&gt;');
        expect(written[1].html).not.toContain('<b>');
    });

    it('expect Copy: Cell Value to copy the value only: no header, no html', async () => {
        const { element } = await mount();
        const written = stubExecCommand();

        openRowMenu(element, 'born', 2);
        menuItem('Cell Value').click();

        expect(written).toEqual([{ text: '2026-01-03', html: '', taken: true }]);
    });

    it('expect Copy: Cell Value with a range not to be written over by the copy of the range', async () => {
        const { element, gridInterface } = await mount();
        const written = stubExecCommand();
        gridInterface.setRanges([range(0, 'name', 1, 'city')]);
        focusCell(element, 0, 'name');

        openRowMenu(element, 'city', 2);
        menuItem('Cell Value').click();

        // the value of the cell, and no html: the grid's copy listener did not write the range
        expect(written).toEqual([{ text: 'c2', html: '', taken: true }]);
    });

    it('expect Paste range to paste the clipboard as Ctrl+V does with ranges', async () => {
        const { element, datasource, gridInterface } = await mount();
        vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('a\tb\r\nc\td\r\n');
        gridInterface.setRanges([range(2, 'name', 5, 'city')]);

        openRowMenu(element, 'name', 0);
        menuItem('Paste range').click();
        await sleep(0); // the clipboard is read async

        expect(values(datasource, 'name', [2, 3])).toEqual(['a', 'c']);
        expect(values(datasource, 'city', [2, 3])).toEqual(['b', 'd']);
    });

    it('expect Clear range to clear the cells of the ranges', async () => {
        const { element, datasource, gridInterface } = await mount();
        gridInterface.setRanges([range(2, 'name', 3, 'name')]);

        openRowMenu(element, 'name', 0);
        menuItem('Clear range').click();

        expect(values(datasource, 'name', [2, 3])).toEqual([null, null]);
    });

    it('expect Paste and Clear range in an editable grid only, and shown on a readonly cell when there are ranges', async () => {
        const readonlyGrid = await mount({ readonly: true });
        readonlyGrid.gridInterface.setRanges([range(0, 'name', 1, 'name')]);
        openRowMenu(readonlyGrid.element, 'name', 0);
        expect(document.querySelector('[data-menu-id="row.copy.range"]')).not.toBeNull();
        expect(document.querySelector('[data-menu-id="row.paste.range"]')).toBeNull();
        expect(document.querySelector('[data-menu-id="row.clear.range"]')).toBeNull();
        readonlyGrid.element.remove();

        const { element, gridInterface } = await mount({ columns: { city: { readonly: true } } });
        gridInterface.setRanges([range(0, 'name', 1, 'name')]);
        openRowMenu(element, 'city', 0);
        // the cell is readonly: no Paste cell, but the sections show for the range entries
        expect(document.querySelector('[data-menu-id="row.paste.cell"]')).toBeNull();
        expect(document.querySelector('[data-menu-id="row.paste.range"]')).not.toBeNull();
        expect(document.querySelector('[data-menu-id="row.clear.range"]')).not.toBeNull();
    });
});
