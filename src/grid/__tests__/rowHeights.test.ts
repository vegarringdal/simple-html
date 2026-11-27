// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { type Entity, isGroupRow } from '../../datasource/entity';
import { where } from '../../datasource/filterExpression';
import { registerCellRenderer } from '../cellRendererRegistry';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { cellHeightOf, columnCellLines, lastLineMiddle, linesUnderTop, rowHeightOf } from '../gridFunctions/rowHeights';
import { GridInterface } from '../gridInterface';
import { displayedRowOf, mountGrid, shownRowElements, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuEntry, menuTreeIds, openRowMenu } from './interactionTestHelpers';

/**
 * Rows taller than a line: `fitRows()` makes a row as high as its multiline cells need,
 * `resetRowHeights()` takes it back, and the row menu's "Size:" entries do the same. The heights are
 * kept by the row's key, the scroll state places the rows, and in a taller row a multiline cell shows
 * its lines under its input. A row's first line is `cellHeight` (22), each line more a line of text,
 * `multilineLineHeight` (15). See rowHeights.ts.
 */

/** a line of the layout's row: `cellHeight`, the input */
const LINE = 22;
/** a line of text more: the default `multilineLineHeight` */
const TEXT = 15;

const TWENTY_FIVE = Array.from({ length: 25 }, (_, i) => `line ${i + 1}`).join('\n');

const data = () => [
    { id: 1, name: 'a', notes: 'n1\nn2\nn3', company: 'Acme', active: true, address: 'one line' },
    { id: 2, name: 'b', notes: 'one line', company: 'Globex', active: false, address: 'Street 1\n0155 Oslo' },
    { id: 3, name: 'c', notes: '', company: 'Initech', active: true, address: '' },
    { id: 4, name: 'd', notes: TWENTY_FIVE, company: 'Hooli', active: false, address: '' },
    // empty lines at the end show nothing: one line
    { id: 5, name: 'e', notes: 'x\n\n\n', company: 'Wonka', active: true, address: '' }
];

/** @param key the key field, null for none: the datasource generates the keys */
const fields = (key: string | null = 'id'): DatasourceOptions => ({
    key: key ?? undefined,
    fields: { id: 'number', active: 'boolean', notes: { multiline: true, label: 'Notes' } }
});

// notes, company and active in the middle, name pinned left, address (no option) pinned right
const config = (
    center: GridConfig['layout']['center'] = [
        { fields: ['notes'], width: 150 },
        { fields: ['company'], width: 100 },
        { fields: ['active'], width: 60 }
    ]
): GridConfig => ({
    readonly: false,
    layout: {
        left: [{ fields: ['name'], width: 80 }],
        center,
        right: [{ fields: ['address'], width: 120 }]
    }
});

const heights = (gridInterface: GridInterface<any>) => [...gridInterface.__getScrollState().scrollHeights];
const tops = (gridInterface: GridInterface<any>) => [...gridInterface.__getScrollState().scrollTops];

/** the input of a cell of a row on screen */
const input = (element: HTMLElement, colType: string, row: number, column: number, cellNo = 0) =>
    element.querySelector(`input.cellpos-${colType}-${row}-${column}-${cellNo}`) as HTMLInputElement;
/** its cell element */
const cellOf = (element: HTMLElement, colType: string, row: number, column: number, cellNo = 0) =>
    input(element, colType, row, column, cellNo).closest('.simple-html-grid-col-cell') as HTMLElement;
/** the lines a multiline cell shows under its input, null when none */
const linesUnder = (cell: HTMLElement) => cell.querySelector('.simple-html-grid-cell-lines')?.textContent ?? null;

/** the y of a row element's translate3d */
const topOf = (rowElement: HTMLElement) => Number(/translate3d\([-\d.]+px, ([-\d.]+)px/.exec(rowElement.style.transform)?.[1]);

/**
 * every section's row elements on screen, as [displayed row, top, height]: the sections must agree
 */
function sectionRows(element: GridElement, section: string) {
    return shownRowElements(element, section).map((rowElement) => [
        displayedRowOf(rowElement),
        topOf(rowElement),
        rowElement.style.height
    ]);
}

/** a keydown on an element */
function press(target: Element, key: string, init: KeyboardEventInit = {}) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true, ...init }));
}

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

describe('fitRows - the heights', () => {
    it('expect a row as many lines high as its multiline cell has, the rows under it moved down', async () => {
        const { gridInterface, datasource } = await mountGrid(config(), data(), fields());
        const [a] = datasource.getDataRows();

        gridInterface.fitRows(a);

        // its first line 22, its two other lines 15 each: 52, not 3 x 22
        expect(heights(gridInterface)).toEqual([LINE + 2 * TEXT, LINE, LINE, LINE, LINE]);
        expect(heights(gridInterface)[0]).toEqual(52);
        expect(tops(gridInterface)).toEqual([0, 52, 74, 96, 118]);
        expect(gridInterface.__getScrollState().scrollHeight).toEqual(140);
        expect(gridInterface.__hasRowHeight(a)).toBe(true);
    });

    it('expect fitRows() to fit every row: the tallest column, at most 20 lines, empty lines at the end left out', async () => {
        const { gridInterface, datasource } = await mountGrid(config(), data(), fields());

        gridInterface.fitRows();

        // b: its address has 2 lines, no option needed. d: 25 lines, 20 at most. e: 'x' and empty lines
        expect(heights(gridInterface)).toEqual([LINE + 2 * TEXT, LINE + TEXT, LINE, LINE + 19 * TEXT, LINE]);
        expect(heights(gridInterface)).toEqual([52, 37, 22, 307, 22]);
        // a row that needs one line has no height of its own
        expect(gridInterface.__hasRowHeight(datasource.getDataRows()[2])).toBe(false);
        expect(gridInterface.__hasRowHeight(datasource.getDataRows()[4])).toBe(false);
    });

    it('expect the fields of a column with stacked fields added up, an empty cell under them a line', async () => {
        const { gridInterface } = await mountGrid(
            config([
                { fields: ['notes', 'company'], width: 150 },
                { fields: ['active'], width: 60 }
            ]),
            data(),
            fields()
        );
        // two cells high: a row of the layout is 44px
        expect(heights(gridInterface)).toEqual([44, 44, 44, 44, 44]);

        gridInterface.fitRows();

        // a: notes 3 + company 1. b: address 2 + the empty cell under it 1. d: 25 + 1, at most 20. The
        // two lines of the layout's row are 22 each, every line more a text line
        expect(heights(gridInterface)).toEqual([2 * LINE + 2 * TEXT, 2 * LINE + TEXT, 2 * LINE, 2 * LINE + 18 * TEXT, 2 * LINE]);
        expect(heights(gridInterface)).toEqual([74, 59, 44, 314, 44]);
    });

    it('expect resetRowHeights() of a row and of every row', async () => {
        const { gridInterface, datasource } = await mountGrid(config(), data(), fields());
        const [a, b] = datasource.getDataRows();
        gridInterface.fitRows();

        gridInterface.resetRowHeights(a);
        expect(heights(gridInterface)).toEqual([LINE, LINE + TEXT, LINE, LINE + 19 * TEXT, LINE]);
        expect(gridInterface.__hasRowHeight(a)).toBe(false);

        gridInterface.resetRowHeights([b]);
        expect(heights(gridInterface)).toEqual([LINE, LINE, LINE, LINE + 19 * TEXT, LINE]);

        gridInterface.resetRowHeights();
        expect(heights(gridInterface)).toEqual([LINE, LINE, LINE, LINE, LINE]);
        expect(gridInterface.__hasRowHeight()).toBe(false);
    });

    it('expect the height to follow the row by its key: sorted, filtered, new data with the same keys', async () => {
        const { gridInterface, datasource } = await mountGrid(config(), data(), fields());
        gridInterface.fitRows(datasource.getDataRows()[0]);

        datasource.sort([{ attribute: 'name', ascending: false }]);
        expect(heights(gridInterface)).toEqual([LINE, LINE, LINE, LINE, LINE + 2 * TEXT]);

        datasource.filter(where('name', 'NOT_EQUAL_TO', 'a'));
        expect(heights(gridInterface)).toEqual([LINE, LINE, LINE, LINE]);
        datasource.filter(null);
        expect(heights(gridInterface)).toEqual([LINE, LINE, LINE, LINE, LINE + 2 * TEXT]);

        // a reload: new objects, the same keys
        datasource.setData(data());
        expect(heights(gridInterface)).toEqual([LINE, LINE, LINE, LINE, LINE + 2 * TEXT]);
    });

    it('expect a datasource without a key field to keep the height by the key it generated', async () => {
        const { gridInterface, datasource } = await mountGrid(config(), data(), fields(null));
        gridInterface.fitRows(datasource.getDataRows()[0]);

        datasource.sort([{ attribute: 'name', ascending: false }]);
        expect(heights(gridInterface)).toEqual([LINE, LINE, LINE, LINE, LINE + 2 * TEXT]);

        // new rows are new keys
        datasource.setData(data());
        expect(heights(gridInterface)).toEqual([LINE, LINE, LINE, LINE, LINE]);
    });

    it('expect fitRows() to fit the rows the filter lets through, and to drop the heights of rows that are gone', async () => {
        const { gridInterface, datasource } = await mountGrid(config(), data(), fields());
        const [a, , , d] = datasource.getDataRows();
        gridInterface.fitRows(a);

        datasource.filter(where('name', 'NOT_EQUAL_TO', 'd'));
        gridInterface.fitRows();
        datasource.filter(null);
        expect(gridInterface.__hasRowHeight(d)).toBe(false);

        // a is gone from the data: its height is not kept by a full fit
        datasource.setData(data().slice(1));
        expect(gridInterface.__hasRowHeight(a)).toBe(true);
        gridInterface.fitRows();
        expect(gridInterface.__hasRowHeight(a)).toBe(false);
    });

    it('expect group rows to be skipped, the data rows of a grouped grid fitted', async () => {
        const { gridInterface, datasource } = await mountGrid(config(), data(), fields());
        datasource.group([{ attribute: 'name', title: 'Name' }]);
        datasource.expandGroup();

        gridInterface.fitRows(datasource.getRows() as Entity[]);

        const displayed = datasource.getRows();
        expect(heights(gridInterface)).toEqual(
            displayed.map((row) =>
                isGroupRow(row)
                    ? LINE
                    : row.name === 'a'
                      ? LINE + 2 * TEXT
                      : row.name === 'b'
                        ? LINE + TEXT
                        : row.name === 'd'
                          ? LINE + 19 * TEXT
                          : LINE
            )
        );
    });

    it('expect a TypeError for what is no row', async () => {
        const { gridInterface } = await mountGrid(config(), data(), fields());
        expect(() => gridInterface.fitRows('a' as any)).toThrow(/rows is a row or an array of rows/);
        expect(() => gridInterface.resetRowHeights(5 as any)).toThrow(TypeError);
        // an object of your own is no row of the datasource: skipped
        gridInterface.fitRows([{ notes: 'a\nb' } as any]);
        expect(gridInterface.__hasRowHeight()).toBe(false);
    });

    it('expect it to work before the grid is on the page, and the lines to follow cellHeight and multilineLineHeight', () => {
        const datasource = new Datasource(fields());
        datasource.setData(data());
        const gridInterface = new GridInterface(config(), datasource);

        gridInterface.fitRows(datasource.getDataRows()[0]);
        expect(heights(gridInterface)[0]).toEqual(LINE + 2 * TEXT);

        // the row keeps its lines: its first line is the new cellHeight, the text lines stay 15
        gridInterface.updateConfig({ cellHeight: 30 });
        expect(heights(gridInterface)).toEqual([60, 30, 30, 30, 30]);

        gridInterface.updateConfig({ multilineLineHeight: 20 });
        expect(heights(gridInterface)).toEqual([70, 30, 30, 30, 30]);

        // undefined: back to the defaults
        gridInterface.updateConfig({ cellHeight: undefined, multilineLineHeight: undefined });
        expect(heights(gridInterface)).toEqual([52, 22, 22, 22, 22]);
    });

    it('expect a TypeError for multilineLineHeight that is not a whole number of 1 or more', async () => {
        const { gridInterface } = await mountGrid(config(), data(), fields());
        for (const height of [0, -1, 15.5, Number.NaN, Number.POSITIVE_INFINITY, '15']) {
            expect(() => gridInterface.updateConfig({ multilineLineHeight: height as any }), String(height)).toThrow(
                /multilineLineHeight is .*, it is a whole number of px, 1 or more/
            );
            expect(
                () => new GridInterface({ ...config(), multilineLineHeight: height as any }, new Datasource()),
                String(height)
            ).toThrow(TypeError);
        }
        // the grid kept the default
        expect(gridInterface.__getGridConfig().multilineLineHeight).toEqual(15);
    });

    it('expect the px of a row, a cell, the lines under the first and the middle of the last line', () => {
        const sizes = { cellHeight: 22, multilineLineHeight: 15, __rowHeight: 22, __columnCells: 1 };
        // a row: the layout's lines are 22 each, every line more 15. Fewer lines: the layout's row
        expect(rowHeightOf(sizes, 1)).toEqual(22);
        expect(rowHeightOf(sizes, 3)).toEqual(52);
        expect(rowHeightOf(sizes, 0)).toEqual(22);
        expect(rowHeightOf({ ...sizes, __rowHeight: 44, __columnCells: 2 }, 4)).toEqual(74);
        // a cell: its first line 22, every other one 15
        expect(cellHeightOf(sizes, 1)).toEqual(22);
        expect(cellHeightOf(sizes, 3)).toEqual(52);
        // the second line's middle a text line under the middle of the first (11 + 15 = 26, 18.5 + 7.5):
        // the lines start at 18.5, a whole px half a px up
        expect(linesUnderTop(sizes)).toEqual(19);
        expect(linesUnderTop({ cellHeight: 22, multilineLineHeight: 16 })).toEqual(19);
        expect(linesUnderTop({ cellHeight: 30, multilineLineHeight: 19 })).toEqual(25);
        // the middle of the last line: the input's middle, a text line further per line
        expect(lastLineMiddle(sizes, 1)).toEqual(11);
        expect(lastLineMiddle(sizes, 3)).toEqual(41);
        expect(lastLineMiddle({ cellHeight: 30, multilineLineHeight: 19 }, 2)).toEqual(34);
    });

    it('expect the lines of each cell of a column: one each, the lines wanted from the top, the rest to the last', () => {
        expect(columnCellLines([1], 1)).toEqual([1]);
        expect(columnCellLines([3], 5)).toEqual([5]);
        expect(columnCellLines([3, 1], 5)).toEqual([3, 2]);
        expect(columnCellLines([1, 3], 5)).toEqual([1, 4]);
        // fewer lines than wanted: the top cells first, every cell at least one
        expect(columnCellLines([6, 1], 4)).toEqual([3, 1]);
        expect(columnCellLines([2, 2, 2], 3)).toEqual([1, 1, 1]);
    });
});

describe('fitRows - every section', () => {
    it('expect the row elements of every section at the same tops and heights', async () => {
        const { element, gridInterface } = await mountGrid(config(), data(), fields());

        gridInterface.fitRows();

        const expected = [
            [0, 0, '52px'],
            [1, 52, '37px'],
            [2, 89, '22px'],
            [3, 111, '307px'],
            [4, 418, '22px']
        ];
        for (const section of ['selector', 'pinned-left', 'pinned-middle', 'pinned-right']) {
            expect(sectionRows(element, section), section).toEqual(expected);
        }
    });

    it('expect the group rows and the data rows in line when grouped', async () => {
        const { element, gridInterface, datasource } = await mountGrid(config(), data(), fields());
        datasource.group([{ attribute: 'name', title: 'Name' }]);
        datasource.expandGroup();

        gridInterface.fitRows();

        const middle = sectionRows(element, 'pinned-middle');
        expect(sectionRows(element, 'selector')).toEqual(middle);
        expect(sectionRows(element, 'pinned-left')).toEqual(middle);
        expect(sectionRows(element, 'pinned-right')).toEqual(middle);
        // the group section shows the group rows, between the data rows
        const groupRows = sectionRows(element, 'group');
        // a: 52, b: 37, c: 22, d: 307 - the group row of e is at 506, in the viewport (600)
        expect(groupRows.map(([row]) => row)).toEqual([0, 2, 4, 6, 8]);
        expect(groupRows.map(([, top]) => top)).toEqual([0, 74, 133, 177, 506]);
        expect(groupRows.map(([row, top]) => [row, top])).toEqual(
            groupRows.map(([row]) => [row, tops(gridInterface)[row as number]])
        );
    });
});

describe('fitRows - the cells of a taller row', () => {
    it('expect a multiline cell to show its lines under the input, the text of the input on its first line', async () => {
        const { element, gridInterface } = await mountGrid(config(), data(), fields());

        gridInterface.fitRows();

        const notes = cellOf(element, 'middle-pinned', 0, 0);
        expect(notes.style.top).toEqual('0px');
        expect(notes.style.height).toEqual('52px');
        expect(input(element, 'middle-pinned', 0, 0).value).toEqual('n1');
        expect(linesUnder(notes)).toEqual('n2\nn3');
        const lines = notes.querySelector('.simple-html-grid-cell-lines') as HTMLElement;
        expect(lines.getAttribute('aria-hidden')).toEqual('true');
        // a text line apart: the middle of the second line (19 + 7.5) a text line under the middle of
        // the input's (11), as the third is under the second
        expect(lines.style.top).toEqual('19px');
        expect(lines.style.lineHeight).toEqual('15px');
        // the input fills the cell, its padding keeps its text on the first line
        expect(input(element, 'middle-pinned', 0, 0).style.paddingBottom).toEqual('30px');
        // every line is shown: the marker is there for a screen reader, without its icon
        const marker = notes.querySelector('.simple-html-grid-cell-more') as HTMLElement;
        expect(marker.querySelector('svg')).toBeNull();
        expect(input(element, 'middle-pinned', 0, 0).getAttribute('aria-describedby')).toEqual(marker.id);

        // 25 lines in 20: the first 20, the marker's icon on the last line
        const long = cellOf(element, 'middle-pinned', 3, 0);
        expect(linesUnder(long)?.split('\n')).toEqual(Array.from({ length: 19 }, (_, i) => `line ${i + 2}`));
        const longMarker = long.querySelector('.simple-html-grid-cell-more') as HTMLElement;
        expect(longMarker.querySelector('svg')).not.toBeNull();
        // its middle (10px high) on the middle of the 20th line: 11 + 19 x 15
        expect(long.style.height).toEqual('307px');
        expect(longMarker.style.top).toEqual(`${11 + 19 * TEXT - 5}px`);

        // the address pinned right, no option: its line break makes it multiline
        expect(linesUnder(cellOf(element, 'right-pinned', 1, 0))).toEqual('0155 Oslo');
    });

    it('expect the other cells to fill the row, their text on the first line, a checkbox one line at the top', async () => {
        const { element, gridInterface } = await mountGrid(config(), data(), fields());

        gridInterface.fitRows();

        const company = cellOf(element, 'middle-pinned', 0, 1);
        expect(company.style.height).toEqual('52px');
        expect(input(element, 'middle-pinned', 0, 1).style.paddingBottom).toEqual('30px');
        expect(linesUnder(company)).toBeNull();
        const checkbox = input(element, 'middle-pinned', 0, 2);
        expect(checkbox.type).toEqual('checkbox');
        expect(checkbox.style.height).toEqual('22px');
        expect(checkbox.style.bottom).toEqual('auto');
        // a row of one line: as before
        expect(cellOf(element, 'middle-pinned', 2, 1).style.height).toEqual('22px');
        expect(input(element, 'middle-pinned', 2, 1).style.paddingBottom).toEqual('');
    });

    it('expect the cells of a column with stacked fields one under the other', async () => {
        const rows = data();
        // a's notes need 3 lines and its company 1, the address of the same row 4 and the empty cell
        // under it 1: the row is 5 lines
        rows[0].address = 'l1\nl2\nl3\nl4';
        const { element, gridInterface } = await mountGrid(
            config([
                { fields: ['notes', 'company'], width: 150 },
                { fields: ['active'], width: 60 }
            ]),
            rows,
            fields()
        );

        gridInterface.fitRows();

        // 5 lines: the 2 of the layout's row and 3 text lines
        expect(heights(gridInterface)[0]).toEqual(2 * LINE + 3 * TEXT);
        const notes = cellOf(element, 'middle-pinned', 0, 0, 0);
        const company = cellOf(element, 'middle-pinned', 0, 0, 1);
        // notes 3 lines: 22 + 2 x 15
        expect([notes.style.top, notes.style.height]).toEqual(['0px', '52px']);
        // the last cell has the lines left over: 2, 22 + 15
        expect([company.style.top, company.style.height]).toEqual(['52px', '37px']);
        expect(input(element, 'middle-pinned', 0, 0, 1).style.paddingBottom).toEqual('15px');
        // the active column has one field: its empty second cell fills the row under it, 4 lines
        const activeCells = Array.from(cellOf(element, 'middle-pinned', 0, 1, 0).parentElement?.children ?? []) as HTMLElement[];
        expect(activeCells.map((cell) => [cell.style.top, cell.style.height])).toEqual([
            ['0px', '22px'],
            ['22px', '67px']
        ]);
        // the address pinned right: its 4 lines and the empty cell under it
        const address = cellOf(element, 'right-pinned', 0, 0, 0);
        expect([address.style.top, address.style.height]).toEqual(['0px', '67px']);
        expect(linesUnder(address)).toEqual('l2\nl3\nl4');
    });

    it('expect the cells to follow multilineLineHeight and cellHeight: their heights, the lines, the padding, the marker', async () => {
        const { element, gridInterface } = await mountGrid(config(), data(), fields());
        gridInterface.fitRows();

        gridInterface.updateConfig({ multilineLineHeight: 20 });

        expect(heights(gridInterface)).toEqual([62, 42, 22, 22 + 19 * 20, 22]);
        const notes = cellOf(element, 'middle-pinned', 0, 0);
        expect(notes.style.height).toEqual('62px');
        const lines = notes.querySelector('.simple-html-grid-cell-lines') as HTMLElement;
        // (22 + 20) / 2: the middle of the second line 20 under the middle of the first (11)
        expect([lines.style.top, lines.style.lineHeight]).toEqual(['21px', '20px']);
        expect(input(element, 'middle-pinned', 0, 0).style.paddingBottom).toEqual('40px');
        const longMarker = cellOf(element, 'middle-pinned', 3, 0).querySelector('.simple-html-grid-cell-more') as HTMLElement;
        expect(longMarker.style.top).toEqual(`${11 + 19 * 20 - 5}px`);

        gridInterface.updateConfig({ cellHeight: 30, multilineLineHeight: 19 });

        expect(heights(gridInterface).slice(0, 2)).toEqual([68, 49]);
        const tall = cellOf(element, 'middle-pinned', 0, 0);
        expect(tall.style.height).toEqual('68px');
        const tallLines = tall.querySelector('.simple-html-grid-cell-lines') as HTMLElement;
        // (30 + 19) / 2 = 24.5: a whole px, half a px up
        expect([tallLines.style.top, tallLines.style.lineHeight]).toEqual(['25px', '19px']);
        expect(input(element, 'middle-pinned', 0, 0).style.paddingBottom).toEqual('38px');
        // the focus button and the checkbox stay on the first line, a cell high
        expect(input(element, 'middle-pinned', 0, 2).style.height).toEqual('30px');
    });

    it('expect a custom cell of a taller row to have its content on the first line: the padding of the text lines', async () => {
        const id = 'row-heights-badge';
        registerCellRenderer(id, (host) => {
            const span = document.createElement('span');
            host.appendChild(span);
            return {
                update({ text }) {
                    span.textContent = text;
                }
            };
        });
        const { element, gridInterface } = await mountGrid(
            { ...config(), columns: { company: { renderer: id } } },
            data(),
            fields()
        );
        const host = () => element.querySelector('.simple-html-grid-cell-custom.cellpos-middle-pinned-0-1-0') as HTMLElement;
        expect(host().style.paddingBottom).toEqual('');

        gridInterface.fitRows();

        // a's notes are 3 lines: the row is 22 + 2 x 15, the host fills it, its content on the first 22px
        expect(cellOf(element, 'middle-pinned', 0, 0).style.height).toEqual('52px');
        expect(host().textContent).toEqual('Acme');
        expect(host().style.paddingBottom).toEqual('30px');
    });

    it('expect the cells back to a line each when the row element shows a row of one line again', async () => {
        const { element, gridInterface } = await mountGrid(config(), data(), fields());
        gridInterface.fitRows();

        gridInterface.resetRowHeights();

        const notes = cellOf(element, 'middle-pinned', 0, 0);
        expect([notes.style.top, notes.style.height]).toEqual(['0px', '22px']);
        expect(linesUnder(notes)).toBeNull();
        expect(input(element, 'middle-pinned', 0, 0).style.paddingBottom).toEqual('');
        expect(notes.querySelector('.simple-html-grid-cell-more svg')).not.toBeNull();
        expect(input(element, 'middle-pinned', 0, 2).style.height).toEqual('');
    });

    it('expect the editor to edit a multiline cell of a taller row, the row to keep its height until fitted again', async () => {
        const { element, gridInterface, datasource } = await mountGrid(config(), data(), fields());
        gridInterface.fitRows();

        const notes = input(element, 'middle-pinned', 0, 0);
        notes.focus();
        press(notes, 'Enter');
        const textarea = document.querySelector('.simple-html-grid-text-editor textarea') as HTMLTextAreaElement;
        expect(textarea.value).toEqual('n1\nn2\nn3');
        textarea.value = 'n1\nn2\nn3\nn4';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        press(textarea, 'Enter', { ctrlKey: true });

        expect(datasource.getDataRows()[0].notes).toEqual('n1\nn2\nn3\nn4');
        expect(heights(gridInterface)[0]).toEqual(LINE + 2 * TEXT);
        // a line more than there is room for: the marker
        expect(linesUnder(cellOf(element, 'middle-pinned', 0, 0))).toEqual('n2\nn3');
        expect(cellOf(element, 'middle-pinned', 0, 0).querySelector('.simple-html-grid-cell-more svg')).not.toBeNull();

        gridInterface.fitRows(datasource.getDataRows()[0]);
        expect(heights(gridInterface)[0]).toEqual(LINE + 3 * TEXT);
        expect(linesUnder(cellOf(element, 'middle-pinned', 0, 0))).toEqual('n2\nn3\nn4');
    });

    it('expect typing in a cell of one line of a taller row to edit it', async () => {
        const { element, gridInterface, datasource } = await mountGrid(config(), data(), fields());
        gridInterface.fitRows();

        const company = input(element, 'middle-pinned', 0, 1);
        company.focus();
        company.value = 'Acme AS';
        company.dispatchEvent(new Event('input', { bubbles: true }));

        expect(datasource.getDataRows()[0].company).toEqual('Acme AS');
    });
});

describe('fitRows - the row menu', () => {
    // the size submenu and what is in it
    const shownIds = () => menuTreeIds().filter((id) => id.startsWith('row.size'));
    const disabled = (id: string) => menuEntry(id)?.getAttribute('aria-disabled') === 'true';

    it('expect "Fit row height" and "Reset row height" on the row right clicked, greyed out when it has no height', async () => {
        const { element, gridInterface } = await mountGrid(config(), data(), fields());

        openRowMenu(element, 'company', 0);
        // nothing selected, no ranges: the fit of the selected rows listed, greyed out
        expect(shownIds()).toEqual([
            'row.size',
            'row.size.fitColumn',
            'row.size.fitRow',
            'row.size.fitRows',
            'row.size.fitAllRows',
            'row.size.resetRow',
            'row.size.resetAllRows'
        ]);
        expect(disabled('row.size.fitRows')).toBe(true);
        expect(disabled('row.size.resetRow')).toBe(true);
        expect(disabled('row.size.resetAllRows')).toBe(true);
        menuEntry('row.size.fitRow').click();
        expect(heights(gridInterface)).toEqual([LINE + 2 * TEXT, LINE, LINE, LINE, LINE]);

        openRowMenu(element, 'company', 0);
        expect(disabled('row.size.resetRow')).toBe(false);
        menuEntry('row.size.resetRow').click();
        expect(heights(gridInterface)).toEqual([LINE, LINE, LINE, LINE, LINE]);
    });

    it('expect "Fit all rows" and "Reset all row heights"', async () => {
        const { element, gridInterface } = await mountGrid(config(), data(), fields());

        openRowMenu(element, 'company', 2);
        menuEntry('row.size.fitAllRows').click();
        expect(heights(gridInterface)).toEqual([LINE + 2 * TEXT, LINE + TEXT, LINE, LINE + 19 * TEXT, LINE]);

        openRowMenu(element, 'company', 2);
        // the row right clicked has no height of its own, others have
        expect(disabled('row.size.resetRow')).toBe(true);
        menuEntry('row.size.resetAllRows').click();
        expect(heights(gridInterface)).toEqual([LINE, LINE, LINE, LINE, LINE]);
    });

    it('expect "Fit row height (selected rows)" for the selected rows and the rows of the ranges', async () => {
        const { element, gridInterface, datasource } = await mountGrid(config(), data(), fields());

        // b, select() counts from 1
        datasource.select(2);
        openRowMenu(element, 'company', 2);
        expect(shownIds()).toContain('row.size.fitRows');
        menuEntry('row.size.fitRows').click();
        expect(heights(gridInterface)).toEqual([LINE, LINE + TEXT, LINE, LINE, LINE]);

        datasource.deselectAll();
        gridInterface.setRanges([{ fromRow: 3, fromField: 'notes', toRow: 0, toField: 'company' }]);
        openRowMenu(element, 'company', 2);
        menuEntry('row.size.fitRows').click();
        expect(heights(gridInterface)).toEqual([LINE + 2 * TEXT, LINE + TEXT, LINE, LINE + 19 * TEXT, LINE]);
    });
});
