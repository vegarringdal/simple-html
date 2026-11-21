// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { isGroupRow } from '../../datasource/entity';
import { where } from '../../datasource/filterExpression';
import type { FindResult } from '../findResult';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { FIND_DELAY_MS } from '../gridFunctions/findBar';
import { findMatches, matchAtOrAfter } from '../gridFunctions/findMatches';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import { GridInterface } from '../gridInterface';
import { registerLookup } from '../lookup';
import { type MountedGrid, mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, sleep } from './interactionTestHelpers';

/**
 * Find in the grid (V6 item 42): Ctrl+F opens a find bar over the grid's top right corner; the cells
 * that show the text are marked, the current match more, Enter / F3 go to the next one. The model is
 * findMatches.ts, the bar and the cells findBar.ts.
 *
 * happy-dom lays nothing out: every element is 600px high and 1000px wide (stubElementSizes), a row is
 * 22px - about 15 rows are rendered, from the top. A scroll is set by hand and its event sent by hand.
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

const NOTE = 'first line\nsecond line with Banana';

/**
 * 60 rows: ACME in the names of rows 2, 5 and 50, a date, a number with a decimal comma, a checkbox,
 * notes of two lines in row 7
 */
const data = () =>
    Array.from({ length: 60 }, (_, i) => ({
        id: i,
        name: [2, 5, 50].includes(i) ? `Acme ${i}` : `name ${i}`,
        city: i === 5 ? 'ACME town' : `city ${i}`,
        age: i,
        born: new Date(2026, 0, 1 + (i % 28)),
        active: i % 2 === 0,
        balance: i + 0.5,
        notes: i === 7 ? NOTE : `note ${i}`
    }));

/**
 * name pinned left, notes pinned right; age and born stacked in a center column. The fields in the
 * order of the layout: name, city, age, born, active, balance, notes
 */
const config = (options: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    layout: {
        left: [{ fields: ['name'], width: 100 }],
        center: [
            { fields: ['city'], width: 100 },
            { fields: ['age', 'born'], width: 100 },
            { fields: ['active'], width: 100 },
            { fields: ['balance'], width: 100 }
        ],
        right: [{ fields: ['notes'], width: 100 }]
    },
    ...options
});

const options = () => ({
    key: 'id',
    fields: {
        id: 'number' as const,
        age: 'number' as const,
        born: 'date' as const,
        active: 'boolean' as const,
        balance: { type: 'number' as const, formatter: 'numberComma' },
        notes: { multiline: true }
    }
});

const mount = (gridConfig: GridConfig = config(), rows = data()) => mountGrid(gridConfig, rows, options());

/** the cells of the matches, as [row, field] */
const cellsOf = (mounted: MountedGrid, text: string) =>
    findMatches({ gridInterface: mounted.gridInterface }, text).map((match) => [match.row, match.field]);

/**
 * the cell element that shows a field of a displayed row, in a row element on screen
 */
function cellAt(element: GridElement, row: number, field: string): HTMLCellElement {
    const cells = Array.from(element.querySelectorAll('.simple-html-grid-col-cell[type="row-cell"]')) as HTMLCellElement[];
    const cell = cells.find(
        (c) =>
            c.$row === row &&
            c.$attribute === field &&
            (c.closest('.simple-html-grid-row') as HTMLElement).style.display === 'block' &&
            (c.parentElement as HTMLElement).style.display !== 'none'
    );
    if (!cell) {
        throw new Error(`no cell on screen for row ${row}, ${field}`);
    }
    return cell;
}

const inputAt = (element: GridElement, row: number, field: string) =>
    cellAt(element, row, field).querySelector('input') as HTMLInputElement;

/** the rows and fields of the cells on screen with a class, sorted */
function marked(element: GridElement, className: string): string[] {
    return (Array.from(element.querySelectorAll(`.${className}`)) as HTMLCellElement[])
        .filter(
            (cell) =>
                (cell.closest('.simple-html-grid-row') as HTMLElement).style.display === 'block' &&
                (cell.parentElement as HTMLElement).style.display !== 'none'
        )
        .map((cell) => `${cell.$row}:${cell.$attribute}`)
        .sort();
}

const matchesOnScreen = (element: GridElement) => marked(element, 'simple-html-cell-find-match');
const currentOnScreen = (element: GridElement) => marked(element, 'simple-html-cell-find-current');

/** a key, as the browser sends it: bubbles, can be canceled */
function key(target: EventTarget, name: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key: name, code: name, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

/** Ctrl+F on an element, which has the focus first: a key goes to the element with the focus */
function ctrlF(target: HTMLElement, init: KeyboardEventInit = {}) {
    target.focus();
    return key(target, 'f', { code: 'KeyF', ctrlKey: true, ...init });
}

const bar = (element: GridElement) => element.querySelector('.simple-html-grid-find') as HTMLElement;
const findInput = (element: GridElement) => bar(element).querySelector('input') as HTMLInputElement;
const findCount = (element: GridElement) => bar(element).querySelector('[role="status"]')?.textContent?.trim();
const findButtons = (element: GridElement) => Array.from(bar(element).querySelectorAll('button'));
/** the "Filter rows" toggle of the bar */
const filterButton = (element: GridElement) => bar(element).querySelector('.simple-html-grid-find-filter') as HTMLButtonElement;

/** types into the find input as a user does: the value, an input event */
function typeFind(element: GridElement, text: string) {
    const input = findInput(element);
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** waits until the search after the typing (or a change of the data) has run */
const afterDelay = () => sleep(FIND_DELAY_MS + 30);

/** the find-change events of a grid */
function findEvents({ gridInterface }: MountedGrid) {
    const seen: FindResult[] = [];
    gridInterface.on('find-change', (result) => seen.push(result));
    return seen;
}

const scroller = (element: GridElement) => element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;

describe('find - which cells match', () => {
    it('expect the text the cells show, formatted: a date as its formatter writes it, a number with its decimal comma', async () => {
        const mounted = await mount();

        // born of row 14 is 2026-01-15, and so is the one of row 42 (i % 28)
        expect(cellsOf(mounted, '2026-01-15')).toEqual([
            [14, 'born'],
            [42, 'born']
        ]);
        // 12.5 is shown as 12,5: found by the comma, not by a dot
        expect(cellsOf(mounted, '12,5')).toEqual([[12, 'balance']]);
        expect(cellsOf(mounted, '12.5')).toEqual([]);
    });

    it('expect any case to match, and an empty text to match nothing', async () => {
        const mounted = await mount();

        expect(cellsOf(mounted, 'acme')).toEqual(cellsOf(mounted, 'ACME'));
        expect(cellsOf(mounted, 'aCmE')).toHaveLength(4);
        expect(cellsOf(mounted, '')).toEqual([]);
    });

    it('expect the rows top to bottom, and in a row the fields in the order of the layout: pinned left, center, pinned right', async () => {
        const mounted = await mount();

        // row 5 has it in its name (pinned left) and its city (center)
        expect(cellsOf(mounted, 'acme')).toEqual([
            [2, 'name'],
            [5, 'name'],
            [5, 'city'],
            [50, 'name']
        ]);
        // 7 in row 7: the name, the city, the age and the notes (pinned right) - stacked age before born
        expect(cellsOf(mounted, ' 7').filter(([row]) => row === 7)).toEqual([
            [7, 'name'],
            [7, 'city']
        ]);
        expect(cellsOf(mounted, '7').filter(([row]) => row === 7)).toEqual([
            [7, 'name'],
            [7, 'city'],
            [7, 'age'],
            [7, 'balance']
        ]);
    });

    it('expect no checkbox, and every line of a cell of several lines', async () => {
        const mounted = await mount();

        // the checkbox shows no text: "true" is in no cell
        expect(cellsOf(mounted, 'true')).toEqual([]);
        // the second line of the notes of row 7
        expect(cellsOf(mounted, 'banana')).toEqual([[7, 'notes']]);
    });

    it("expect the column's numberOverride: a 0 shown blank is not found", async () => {
        const mounted = await mount(config({ columns: { age: { numberOverride: 'ZERO_TO_BLANK' } } }));

        // row 0's age 0 is shown blank; 10, 20 ... still have a 0
        expect(cellsOf(mounted, '0').some(([row, field]) => row === 0 && field === 'age')).toBe(false);
        expect(cellsOf(mounted, '0').some(([row, field]) => row === 10 && field === 'age')).toBe(true);
    });

    it('expect the displayed rows only: after the filter, not the rows of a collapsed group, no group row', async () => {
        const mounted = await mount();
        mounted.datasource.filter(where('age', 'LESS_THAN', 10));
        expect(cellsOf(mounted, 'acme')).toEqual([
            [2, 'name'],
            [5, 'name'],
            [5, 'city']
        ]);

        // grouped on active, every group collapsed: only the group rows are displayed
        mounted.datasource.group([{ attribute: 'active', title: 'Active' }]);
        expect(cellsOf(mounted, 'acme')).toEqual([]);
        expect(cellsOf(mounted, 'Active')).toEqual([]);

        // expanded: the group row is row 0, Acme 2 is the second row of the first group
        mounted.datasource.expandGroup();
        const rows = mounted.datasource.getRows();
        expect(cellsOf(mounted, 'acme').map(([row]) => rows[row as number])).toEqual(
            mounted.datasource
                .getDataRows()
                .filter((row) => /acme/i.test(`${row.name} ${row.city}`))
                .flatMap((row) =>
                    // row 5 twice: its name and its city
                    row.id === 5 ? [row, row] : [row]
                )
        );
    });
});

describe('find - the match at or after a cell', () => {
    it('expect the anchor itself while it matches, else the next one after it, wrapping to the first', async () => {
        const mounted = await mount();
        const matches = findMatches({ gridInterface: mounted.gridInterface }, 'acme');
        const rows = mounted.datasource.getRows();
        const fields = mounted.gridInterface.getLayoutFields();
        const at = (row: number, field: string) => matchAtOrAfter(matches, rows, fields, { entity: rows[row], field, row });

        expect(at(5, 'city')).toBe(2);
        // the age of row 5 is after its city: the next match is row 50
        expect(at(5, 'age')).toBe(3);
        expect(at(3, 'name')).toBe(1);
        // after the last one: the first
        expect(at(55, 'name')).toBe(0);
        expect(matchAtOrAfter(matches, rows, fields, null)).toBe(0);
        expect(matchAtOrAfter([], rows, fields, null)).toBe(-1);
    });

    it('expect the row of the anchor looked up again, and the row it was at when it is not displayed any more', async () => {
        const mounted = await mount();
        const all = mounted.datasource.getRows();
        const row40 = all[40];

        // sorted the other way: row 40 is displayed as row 19, after Acme 50 (row 9) and before Acme 5 (54)
        mounted.datasource.sort([{ attribute: 'age', ascending: false }]);
        let matches = findMatches({ gridInterface: mounted.gridInterface }, 'acme');
        let rows = mounted.datasource.getRows();
        const fields = mounted.gridInterface.getLayoutFields();
        expect(matches[matchAtOrAfter(matches, rows, fields, { entity: row40, field: 'name', row: 40 })].row).toBe(54);

        // filtered out: from the row it was at. Ages 29 to 0 are left: Acme 5 is row 24, Acme 2 row 27 -
        // after row 40 none, the first; after row 25 Acme 2
        mounted.datasource.filter(where('age', 'LESS_THAN', 30));
        matches = findMatches({ gridInterface: mounted.gridInterface }, 'acme');
        rows = mounted.datasource.getRows();
        expect(matches.map((match) => match.row)).toEqual([24, 24, 27]);
        expect(matchAtOrAfter(matches, rows, fields, { entity: row40, field: 'name', row: 40 })).toBe(0);
        expect(matchAtOrAfter(matches, rows, fields, { entity: row40, field: 'name', row: 25 })).toBe(2);
    });
});

describe('find - the API', () => {
    it('expect find() to open the bar with the text, mark the cells and return the count', async () => {
        const mounted = await mount();
        const { element, gridInterface } = mounted;

        expect(gridInterface.find('acme')).toBe(4);

        expect(bar(element).hidden).toBe(false);
        expect(findInput(element).value).toBe('acme');
        expect(findCount(element)).toBe('1 of 4');
        expect(matchesOnScreen(element)).toEqual(['2:name', '5:city', '5:name']);
        expect(currentOnScreen(element)).toEqual(['2:name']);
        expect(gridInterface.getFind()).toEqual({
            open: true,
            text: 'acme',
            filterRows: false,
            count: 4,
            position: 1,
            current: { row: 2, field: 'name' }
        });
    });

    it('expect findNext() and findPrevious() to move the current match, wrapping at the ends', async () => {
        const { gridInterface } = await mount();
        gridInterface.find('acme');

        expect(gridInterface.findNext()).toEqual({ row: 5, field: 'name' });
        expect(gridInterface.findNext()).toEqual({ row: 5, field: 'city' });
        expect(gridInterface.findNext()).toEqual({ row: 50, field: 'name' });
        expect(gridInterface.findNext()).toEqual({ row: 2, field: 'name' });
        expect(gridInterface.findPrevious()).toEqual({ row: 50, field: 'name' });
        expect(gridInterface.getFind().position).toBe(4);
    });

    it('expect closeFind() to hide the bar and the marks, and to keep the text', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.find('acme');

        gridInterface.closeFind();

        expect(bar(element).hidden).toBe(true);
        expect(matchesOnScreen(element)).toEqual([]);
        expect(currentOnScreen(element)).toEqual([]);
        expect(gridInterface.getFind()).toEqual({
            open: false,
            text: 'acme',
            filterRows: false,
            count: 0,
            position: 0,
            current: null
        });
        expect(gridInterface.findNext()).toBeNull();
    });

    it("expect '' to find nothing, and anything but a string to throw", async () => {
        const { element, gridInterface } = await mount();

        expect(gridInterface.find('')).toBe(0);
        expect(findCount(element)).toBe('');
        expect(gridInterface.find('zzz')).toBe(0);
        expect(findCount(element)).toBe('No matches');
        expect(gridInterface.findNext()).toBeNull();
        expect(() => gridInterface.find(42 as unknown as string)).toThrow(TypeError);
    });

    it('expect find() to start at the cell with the focus, and to keep the current match while it matches', async () => {
        const { element, gridInterface } = await mount();
        inputAt(element, 4, 'city').focus();

        gridInterface.find('acme');
        expect(gridInterface.getFind().current).toEqual({ row: 5, field: 'name' });

        // a longer text that the current match still has
        gridInterface.find('acme 5');
        expect(gridInterface.getFind()).toMatchObject({ count: 2, current: { row: 5, field: 'name' } });
        // one it does not: the next one after it
        gridInterface.find('acme 50');
        expect(gridInterface.getFind()).toMatchObject({ count: 1, current: { row: 50, field: 'name' } });
    });

    it('expect find-change with what getFind() gives, only when it changed', async () => {
        const mounted = await mount();
        const events = findEvents(mounted);

        mounted.gridInterface.find('acme');
        mounted.gridInterface.find('acme');
        mounted.gridInterface.findNext();
        mounted.gridInterface.closeFind();
        mounted.gridInterface.closeFind();

        expect(events).toEqual([
            { open: true, text: 'acme', filterRows: false, count: 4, position: 1, current: { row: 2, field: 'name' } },
            { open: true, text: 'acme', filterRows: false, count: 4, position: 2, current: { row: 5, field: 'name' } },
            { open: false, text: 'acme', filterRows: false, count: 0, position: 0, current: null }
        ]);
    });

    it('expect openFind() to put the focus in the input with its text selected', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.find('acme');
        gridInterface.closeFind();

        gridInterface.openFind();

        const input = findInput(element);
        expect(document.activeElement).toBe(input);
        expect([input.selectionStart, input.selectionEnd]).toEqual([0, 4]);
        expect(gridInterface.getFind().count).toBe(4);
    });

    it('expect nothing while the grid is not on the page', async () => {
        const mounted = await mount();
        mounted.element.remove();

        expect(mounted.gridInterface.find('acme')).toBe(0);
        expect(mounted.gridInterface.findNext()).toBeNull();
        expect(mounted.gridInterface.getFind().open).toBe(false);
    });

    it('expect the bar closed when the grid leaves the page', async () => {
        const mounted = await mount();
        mounted.gridInterface.find('acme');
        const events = findEvents(mounted);

        mounted.element.remove();

        expect(bar(mounted.element).hidden).toBe(true);
        expect(events.at(-1)?.open).toBe(false);
    });
});

describe('find - scrolling to a match', () => {
    it('expect a match below the rows on screen to be scrolled to the middle of the view, and marked when it is rendered', async () => {
        const { element, gridInterface } = await mount();
        const rowHeight = gridInterface.__getGridConfig().__rowHeight;

        gridInterface.find('acme 50');

        // its top at the middle of the 600px view, less half a row
        expect(scroller(element).scrollTop).toBe(Math.round(50 * rowHeight - (600 - rowHeight) / 2));
        expect(currentOnScreen(element)).toEqual(['50:name']);

        // and back up to row 2: in view at the top
        gridInterface.find('acme 2');
        expect(scroller(element).scrollTop).toBe(0);
        expect(currentOnScreen(element)).toEqual(['2:name']);
    });

    it('expect a match in a middle column out of view to scroll the columns, one in a pinned column not', async () => {
        // the middle columns are 1600px wide in a view of 1000px: balance starts at 1200
        const wide = config();
        wide.layout.center = wide.layout.center?.map((column) => ({ ...column, width: 400 }));
        const { element, gridInterface } = await mount(wide);
        const middle = element.querySelector('.simple-html-grid-middle-scroller') as HTMLElement;

        gridInterface.find('12,5');
        expect(middle.scrollLeft).toBe(1200 - 300);
        expect(currentOnScreen(element)).toEqual(['12:balance']);

        // the notes are pinned right: on screen whatever the scroll
        gridInterface.find('note 3');
        expect(middle.scrollLeft).toBe(900);
    });

    it('expect a middle column wider than the view to be scrolled to its start, where its text is', async () => {
        const wide = config();
        wide.layout.center = wide.layout.center?.map((column) => ({ ...column, width: 1200 }));
        const { element, gridInterface } = await mount(wide);
        const middle = element.querySelector('.simple-html-grid-middle-scroller') as HTMLElement;

        // balance is the fourth middle column: it starts at 3600
        gridInterface.find('12,5');

        expect(middle.scrollLeft).toBe(3600);
    });

    it('expect the classes to follow the rows and fields when the cells are reused while scrolling', async () => {
        const { element, gridInterface } = await mount();
        const rowHeight = gridInterface.__getGridConfig().__rowHeight;
        gridInterface.find('acme');
        const acme2 = cellAt(element, 2, 'name');

        const scrollTo = (rows: number) => {
            scroller(element).scrollTop = rowHeight * rows;
            scroller(element).dispatchEvent(new Event('scroll'));
        };

        // the rows from 9: the cell element that showed Acme 2 shows another row now, no match
        scrollTo(10);
        expect([2, 5].includes(acme2.$row)).toBe(false);
        expect(acme2.classList.contains('simple-html-cell-find-current')).toBe(false);
        expect(acme2.classList.contains('simple-html-cell-find-match')).toBe(false);
        expect(matchesOnScreen(element)).toEqual([]);

        // a step at a time: a jump of more than 500px is rendered when the scrolling stops
        scrollTo(20);
        scrollTo(30);
        scrollTo(40);
        expect(matchesOnScreen(element)).toEqual(['50:name']);
        expect(currentOnScreen(element)).toEqual([]);

        scrollTo(30);
        scrollTo(20);
        scrollTo(10);
        scrollTo(0);
        expect(matchesOnScreen(element)).toEqual(['2:name', '5:city', '5:name']);
        expect(currentOnScreen(element)).toEqual(['2:name']);
    });
});

describe('find - the keys', () => {
    it('expect Ctrl+F and Cmd+F in the grid to open the bar, the focus in its input - and the key canceled', async () => {
        const { element, gridInterface } = await mount();

        const event = ctrlF(inputAt(element, 3, 'city'));

        expect(event.defaultPrevented).toBe(true);
        expect(bar(element).hidden).toBe(false);
        expect(document.activeElement).toBe(findInput(element));
        expect(gridInterface.getFind().open).toBe(true);

        gridInterface.closeFind();
        headerFilterInput(element, 'city').focus();
        const cmd = key(headerFilterInput(element, 'city'), 'f', { code: 'KeyF', metaKey: true });
        expect(cmd.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(findInput(element));
    });

    it("expect Ctrl+F outside the grid to be the browser's, and Ctrl+Shift+F, Ctrl+Alt+F not to open it", async () => {
        const { element, gridInterface } = await mount();
        const outside = document.createElement('input');
        document.body.appendChild(outside);

        expect(ctrlF(outside).defaultPrevented).toBe(false);
        expect(ctrlF(inputAt(element, 3, 'city'), { shiftKey: true }).defaultPrevented).toBe(false);
        expect(ctrlF(inputAt(element, 3, 'city'), { altKey: true }).defaultPrevented).toBe(false);
        expect(gridInterface.getFind().open).toBe(false);
    });

    it('expect Ctrl+F by the place of the key on a layout without Latin letters, by the letter on one with them', async () => {
        const { element, gridInterface } = await mount();

        // a Russian layout: the key of F types а
        key(inputAt(element, 3, 'city'), 'а', { code: 'KeyF', ctrlKey: true });
        expect(gridInterface.getFind().open).toBe(true);
        gridInterface.closeFind();

        // Dvorak: the key at the place of F types u, F is elsewhere
        expect(key(inputAt(element, 3, 'city'), 'u', { code: 'KeyF', ctrlKey: true }).defaultPrevented).toBe(false);
        expect(key(inputAt(element, 3, 'city'), 'f', { code: 'KeyY', ctrlKey: true }).defaultPrevented).toBe(true);
    });

    it('expect a key the page canceled already to be left alone', async () => {
        const { element, gridInterface } = await mount();
        const input = inputAt(element, 3, 'city');
        input.addEventListener('keydown', (event) => event.preventDefault());

        ctrlF(input);

        expect(gridInterface.getFind().open).toBe(false);
    });

    it('expect typing to find when the typing stops, and the count as a status', async () => {
        const mounted = await mount();
        const { element } = mounted;
        const events = findEvents(mounted);
        ctrlF(inputAt(element, 0, 'city'));

        typeFind(element, 'a');
        typeFind(element, 'ac');
        typeFind(element, 'acm');
        // not yet: the search waits for the typing to stop
        expect(matchesOnScreen(element)).toEqual([]);

        await afterDelay();
        expect(matchesOnScreen(element)).toEqual(['2:name', '5:city', '5:name']);
        expect(findCount(element)).toBe('1 of 4');
        // the empty text of the open, then the text once
        expect(events.map(({ text, count }) => `${text}:${count}`)).toEqual([':0', 'acm:4']);

        typeFind(element, 'acmex');
        await afterDelay();
        expect(findCount(element)).toBe('No matches');

        // an empty text: no matches at once
        typeFind(element, '');
        expect(findCount(element)).toBe('');
        expect(matchesOnScreen(element)).toEqual([]);
    });

    it('expect Enter and F3 the next match, Shift+Enter and Shift+F3 the previous - the focus stays in the input', async () => {
        const { element, gridInterface } = await mount();
        ctrlF(inputAt(element, 0, 'city'));
        typeFind(element, 'acme');
        const input = findInput(element);

        // Enter before the search ran: it runs, and shows the first match
        expect(key(input, 'Enter').defaultPrevented).toBe(true);
        expect(gridInterface.getFind().position).toBe(1);

        key(input, 'Enter');
        expect(gridInterface.getFind().position).toBe(2);
        key(input, 'F3');
        expect(gridInterface.getFind().position).toBe(3);
        key(input, 'Enter', { shiftKey: true });
        expect(gridInterface.getFind().position).toBe(2);
        key(input, 'F3', { shiftKey: true });
        expect(gridInterface.getFind().position).toBe(1);
        // wrapping: before the first, the last
        key(input, 'Enter', { shiftKey: true });
        expect(gridInterface.getFind()).toMatchObject({ position: 4, current: { row: 50, field: 'name' } });
        expect(currentOnScreen(element)).toEqual(['50:name']);
        expect(document.activeElement).toBe(input);
        expect(findCount(element)).toBe('4 of 4');
    });

    it('expect F3 in a cell while the bar is open to go on, and to be left alone while it is closed', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.find('acme');

        expect(key(inputAt(element, 10, 'city'), 'F3').defaultPrevented).toBe(true);
        expect(gridInterface.getFind().position).toBe(2);

        gridInterface.closeFind();
        expect(key(inputAt(element, 10, 'city'), 'F3').defaultPrevented).toBe(false);
    });

    it("expect Esc to close the bar - the focus to the current match's cell, its row the current row", async () => {
        const { element, datasource } = await mount();
        ctrlF(inputAt(element, 0, 'city'));
        typeFind(element, 'acme');
        key(findInput(element), 'Enter');
        key(findInput(element), 'Enter');

        const esc = key(findInput(element), 'Escape');

        expect(esc.defaultPrevented).toBe(true);
        expect(bar(element).hidden).toBe(true);
        expect(document.activeElement).toBe(inputAt(element, 5, 'name'));
        expect(datasource.currentEntity).toBe(datasource.getRow(5));
        expect(matchesOnScreen(element)).toEqual([]);
    });

    it('expect Esc without a match to put the focus back in the cell it came from, or the header filter', async () => {
        const { element, gridInterface } = await mount();
        ctrlF(inputAt(element, 3, 'city'));
        typeFind(element, 'nothing like it');
        await afterDelay();

        key(findInput(element), 'Escape');
        expect(document.activeElement).toBe(inputAt(element, 3, 'city'));

        ctrlF(headerFilterInput(element, 'age'));
        key(findInput(element), 'Escape');
        expect(document.activeElement).toBe(headerFilterInput(element, 'age'));
        expect(gridInterface.getFind().open).toBe(false);
    });

    it('expect the cell Ctrl+F came from to be scrolled back to when it is out of view', async () => {
        const { element, gridInterface } = await mount();
        ctrlF(inputAt(element, 3, 'city'));
        gridInterface.find('acme 50');
        gridInterface.find('acme 50 and more');
        expect(scroller(element).scrollTop).toBeGreaterThan(0);

        key(findInput(element), 'Escape');

        expect(scroller(element).scrollTop).toBe(0);
        expect(document.activeElement).toBe(inputAt(element, 3, 'city'));
    });

    it('expect Ctrl+F from another cell while the bar is open to be where Esc goes back to', async () => {
        const { element } = await mount();
        ctrlF(inputAt(element, 3, 'city'));
        typeFind(element, 'nothing like it');
        await afterDelay();

        ctrlF(inputAt(element, 6, 'name'));
        key(findInput(element), 'Escape');

        expect(document.activeElement).toBe(inputAt(element, 6, 'name'));
    });

    it('expect Esc on a button of the bar to close it too', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.find('acme');
        const close = findButtons(element)[3];
        close.focus();

        key(close, 'Escape');

        expect(gridInterface.getFind().open).toBe(false);
        expect(document.activeElement).toBe(inputAt(element, 2, 'name'));
    });
});

describe('find - the buttons', () => {
    it('expect previous, next and close to work, and a press on them to keep the focus in the input', async () => {
        const { element, gridInterface } = await mount();
        ctrlF(inputAt(element, 0, 'city'));
        typeFind(element, 'acme');
        await afterDelay();
        const [, previous, next, close] = findButtons(element);

        const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        next.dispatchEvent(press);
        expect(press.defaultPrevented).toBe(true);

        next.click();
        next.click();
        expect(gridInterface.getFind().position).toBe(3);
        previous.click();
        expect(gridInterface.getFind().position).toBe(2);
        expect(document.activeElement).toBe(findInput(element));

        close.click();
        expect(gridInterface.getFind().open).toBe(false);
        expect(document.activeElement).toBe(inputAt(element, 5, 'name'));
    });
});

describe('find - it follows the data', () => {
    it('expect a filter to find the text again, after the delay', async () => {
        const mounted = await mount();
        const { element, gridInterface, datasource } = mounted;
        gridInterface.find('acme');

        datasource.filter(where('age', 'LESS_THAN', 10));
        await afterDelay();

        expect(gridInterface.getFind()).toMatchObject({ count: 3, position: 1, current: { row: 2, field: 'name' } });
        expect(findCount(element)).toBe('1 of 3');
    });

    it('expect a sort to keep the current match, at its new row - and not to scroll', async () => {
        const { element, gridInterface, datasource } = await mount();
        gridInterface.find('acme');
        gridInterface.findNext();
        gridInterface.findNext();
        expect(gridInterface.getFind().current).toEqual({ row: 5, field: 'city' });

        datasource.sort([{ attribute: 'age', ascending: false }]);
        await afterDelay();

        // 60 rows the other way: row 5 is row 54, the matches are Acme 50 (row 9), then row 54's name and city
        expect(gridInterface.getFind()).toMatchObject({ position: 3, current: { row: 54, field: 'city' } });
        expect(scroller(element).scrollTop).toBe(0);
    });

    it('expect an edit to add a match, and the current match edited away to make the next one current', async () => {
        const { element, gridInterface, datasource } = await mount();
        gridInterface.find('acme');
        gridInterface.findNext();

        datasource.getRow(8).city = 'Acme city';
        await afterDelay();
        expect(gridInterface.getFind()).toMatchObject({ count: 5, current: { row: 5, field: 'name' } });
        expect(matchesOnScreen(element)).toContain('8:city');

        datasource.getRow(5).name = 'Globex';
        await afterDelay();
        expect(gridInterface.getFind()).toMatchObject({ count: 4, current: { row: 5, field: 'city' } });
        expect(currentOnScreen(element)).toEqual(['5:city']);
    });

    it('expect a change of the layout to find the text again: a hidden column has no matches', async () => {
        const { gridInterface } = await mount();
        gridInterface.find('acme');

        gridInterface.setState({ layout: { left: [], center: [{ fields: ['city'], width: 100 }], right: [] } });
        await afterDelay();

        expect(gridInterface.getFind()).toMatchObject({ count: 1, current: { row: 5, field: 'city' } });
    });

    it('expect nothing found again while the bar is closed', async () => {
        const mounted = await mount();
        mounted.gridInterface.find('acme');
        mounted.gridInterface.closeFind();
        const events = findEvents(mounted);

        mounted.datasource.filter(where('age', 'LESS_THAN', 10));
        await afterDelay();

        expect(events).toEqual([]);
    });
});

describe('find - what a screen reader gets, the texts', () => {
    it('expect a search region with a name, a named input, the count a status and named buttons with tooltips', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.find('acme');

        expect(bar(element).getAttribute('role')).toBe('search');
        expect(bar(element).getAttribute('aria-label')).toBe('Find in the grid');
        expect(findInput(element).getAttribute('aria-label')).toBe('Find');
        expect(findInput(element).getAttribute('placeholder')).toBe('Find');
        expect(bar(element).querySelector('.simple-html-grid-find-count')?.getAttribute('role')).toBe('status');
        // in this order, which is the order of Tab: "Filter rows" first, after the input and the count
        expect(
            findButtons(element).map((button) => [
                button.type,
                button.getAttribute('aria-label'),
                button.title,
                button.getAttribute('aria-pressed')
            ])
        ).toEqual([
            ['button', 'Filter rows', 'Show only the rows with a match', 'false'],
            ['button', 'Previous match', 'Previous match (Shift+Enter)', null],
            ['button', 'Next match', 'Next match (Enter)', null],
            ['button', 'Close', 'Close (Esc)', null]
        ]);
        // the funnel is not read out: the name is
        expect(filterButton(element).querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
        expect(filterButton(element).textContent?.trim()).toBe('');
    });

    it("expect the grid's texts", async () => {
        const { element, gridInterface } = await mount(
            config({
                texts: { 'find.label': 'Søk i tabellen', 'find.placeholder': 'Søk', 'find.count': '{current} av {count}' }
            })
        );
        gridInterface.find('acme');

        expect(bar(element).getAttribute('aria-label')).toBe('Søk i tabellen');
        expect(findInput(element).placeholder).toBe('Søk');
        expect(findCount(element)).toBe('1 av 4');
    });

    it('expect the bar before the rest of the grid: Shift+Tab from its input leaves the grid', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.find('acme');

        expect(element.firstElementChild).toBe(bar(element));
    });
});

describe('find - the wheel', () => {
    it('expect the wheel to scroll the grid and leave the focus in the find bar', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.openFind();

        element.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));

        expect(scroller(element).scrollTop).toBe(100);
        expect(document.activeElement).toBe(findInput(element));
    });
});

/** the ids of the data rows shown */
const shownIds = ({ datasource }: MountedGrid) => datasource.getDataRows().map((row) => row.id);

/** the ids of the rows with a match among the rows displayed now, in their order */
const matchedIds = (mounted: MountedGrid, text: string) => [
    ...new Set(findMatches({ gridInterface: mounted.gridInterface }, text).map((match) => match.entity.id))
];

const footerCount = (element: GridElement) => element.querySelector('.footer-count')?.textContent?.trim();
const findChip = (element: GridElement) => element.querySelector('.footer-filter-find') as HTMLElement | null;

/** the parts of the footer's filter row as text: the Clear button, the chips, the connectors */
const footerParts = (element: GridElement) =>
    Array.from(element.querySelectorAll('.footer-filter > *')).map((part) => part.textContent?.replace(/\s+/g, ' ').trim());

describe('find - filter rows', () => {
    it('expect the toggle to show only the rows with a match, and every row again when it is turned off', async () => {
        const mounted = await mount();
        const { element, gridInterface } = mounted;
        gridInterface.find('acme');

        // a press keeps the focus where it is, as the other buttons
        const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        filterButton(element).dispatchEvent(press);
        expect(press.defaultPrevented).toBe(true);
        filterButton(element).click();

        expect(filterButton(element).getAttribute('aria-pressed')).toBe('true');
        expect(shownIds(mounted)).toEqual([2, 5, 50]);
        expect(footerCount(element)).toBe('3/60');
        // the same matches, in fewer rows: Acme 5 is row 1 now
        expect(gridInterface.getFind()).toEqual({
            open: true,
            text: 'acme',
            filterRows: true,
            count: 4,
            position: 1,
            current: { row: 0, field: 'name' }
        });
        expect(matchesOnScreen(element)).toEqual(['0:name', '1:city', '1:name', '2:name']);

        filterButton(element).click();

        expect(filterButton(element).getAttribute('aria-pressed')).toBe('false');
        expect(shownIds(mounted)).toHaveLength(60);
        expect(footerCount(element)).toBe('60/60');
        expect(gridInterface.getFind()).toMatchObject({ filterRows: false, count: 4, current: { row: 2, field: 'name' } });
    });

    it('expect the rows shown to be the rows of the marked cells: the text as the cells show it', async () => {
        const mounted = await mount();
        const cases: [string, number[]][] = [
            // a date as its formatter writes it
            ['2026-01-15', [14, 42]],
            // a number with its decimal comma, not as the value is
            ['12,5', [12]],
            ['12.5', []],
            // the second line of a cell of several lines
            ['banana', [7]],
            // a checkbox shows no text
            ['true', []],
            ['acme', [2, 5, 50]]
        ];
        for (const [text, ids] of cases) {
            mounted.gridInterface.find(text, { filterRows: true });
            expect(shownIds(mounted), text).toEqual(ids);
            expect(matchedIds(mounted, text), text).toEqual(ids);
        }
        // and the rows of the matches among every row: the same
        for (const [text, ids] of cases) {
            mounted.gridInterface.find(text, { filterRows: false });
            expect(matchedIds(mounted, text), text).toEqual(ids);
        }
    });

    it("expect the column's numberOverride and the labels of a lookup, as the cells show them", async () => {
        const offices = new Datasource();
        offices.setData([
            { code: 'k0', name: 'Oslo office' },
            { code: 'k1', name: 'Bergen office' }
        ]);
        registerLookup('find-offices', { datasource: offices, valueField: 'code', labelField: 'name' });
        const rows = Array.from({ length: 6 }, (_, i) => ({ id: i, age: i * 10, office: `k${i % 2}` }));
        const mounted = await mountGrid(
            {
                readonly: false,
                layout: {
                    left: [],
                    center: [
                        { fields: ['age'], width: 100 },
                        { fields: ['office'], width: 100 }
                    ],
                    right: []
                },
                columns: {
                    age: { numberOverride: 'ZERO_TO_BLANK' },
                    office: { editor: { type: 'select', lookup: 'find-offices' } }
                }
            },
            rows,
            { key: 'id', fields: { id: 'number', age: 'number' } }
        );

        // the age 0 of row 0 is shown blank, 10 to 50 have a 0
        mounted.gridInterface.find('0', { filterRows: true });
        expect(shownIds(mounted)).toEqual([1, 2, 3, 4, 5]);
        // the label, not the value
        mounted.gridInterface.find('bergen', { filterRows: true });
        expect(shownIds(mounted)).toEqual([1, 3, 5]);
        mounted.gridInterface.find('k1', { filterRows: true });
        expect(shownIds(mounted)).toEqual([]);
    });

    it('expect it on top of the filter and of changed rows only - not part of getFilter(), getFilterString() or the state', async () => {
        const mounted = await mount();
        const { gridInterface, datasource } = mounted;
        const young = where('age', 'LESS_THAN', 10);
        datasource.filter(young);
        const filterString = datasource.getFilterString();
        const state = gridInterface.getState();

        gridInterface.find('acme', { filterRows: true });

        expect(shownIds(mounted)).toEqual([2, 5]);
        expect(datasource.getFilter()).toBe(young);
        expect(datasource.getFilterString()).toBe(filterString);
        expect(gridInterface.getState()).toEqual(state);
        expect(JSON.stringify(gridInterface.getState())).not.toContain('acme');

        // a new filter: it is applied to the rows it lets through
        datasource.filter(null);
        expect(shownIds(mounted)).toEqual([2, 5, 50]);

        datasource.getAllData()[50].age = 51;
        datasource.filterChangedOnly(true);
        expect(shownIds(mounted)).toEqual([50]);
        datasource.filterChangedOnly(false);
        expect(shownIds(mounted)).toEqual([2, 5, 50]);
    });

    it('expect it applied whenever the datasource filters - setData, upsert - and a sort to keep the rows', async () => {
        const mounted = await mount();
        const { element, gridInterface, datasource } = mounted;
        gridInterface.find('acme', { filterRows: true });

        datasource.setData(data().map((row) => (row.id === 7 ? { ...row, name: 'Acme 7' } : row)));
        expect(shownIds(mounted)).toEqual([2, 5, 7, 50]);

        datasource.upsert([
            { id: 8, city: 'Acme city' },
            { id: 50, name: 'Globex' }
        ]);
        expect(shownIds(mounted)).toEqual([2, 5, 7, 8]);

        datasource.sort([{ attribute: 'age', ascending: false }]);
        expect(shownIds(mounted)).toEqual([8, 7, 5, 2]);

        await afterDelay();
        // Acme 2, Acme 5 twice, Acme 7, Acme city
        expect(gridInterface.getFind()).toMatchObject({ filterRows: true, count: 5 });
        expect(findChip(element)?.textContent?.trim()).toBe('Find: acme');
    });

    it('expect an edit not to filter the rows again: the row edited away stays, unmarked, until they are filtered next', async () => {
        const mounted = await mount();
        const { element, gridInterface, datasource } = mounted;
        gridInterface.find('acme', { filterRows: true });

        // Acme 2, the first row shown
        datasource.getRow(0).name = 'Globex';
        await afterDelay();

        expect(shownIds(mounted)).toEqual([2, 5, 50]);
        expect(gridInterface.getFind().count).toBe(3);
        expect(matchesOnScreen(element)).toEqual(['1:city', '1:name', '2:name']);

        datasource.filter();
        expect(shownIds(mounted)).toEqual([5, 50]);
    });

    it('expect the typing to filter the rows when it stops, and an empty text to show every row at once', async () => {
        const mounted = await mount();
        const { element } = mounted;
        ctrlF(inputAt(element, 0, 'city'));

        // no text yet: every row, no chip
        filterButton(element).click();
        expect(shownIds(mounted)).toHaveLength(60);
        expect(findChip(element)).toBeNull();

        typeFind(element, 'acm');
        expect(shownIds(mounted)).toHaveLength(60);
        await afterDelay();
        expect(shownIds(mounted)).toEqual([2, 5, 50]);
        expect(findChip(element)?.textContent?.trim()).toBe('Find: acm');

        // while typing: the rows and the chip of the text before
        typeFind(element, 'acme 5');
        expect(findChip(element)?.textContent?.trim()).toBe('Find: acm');
        await afterDelay();
        expect(shownIds(mounted)).toEqual([5, 50]);
        expect(findChip(element)?.textContent?.trim()).toBe('Find: acme 5');

        typeFind(element, '');
        expect(shownIds(mounted)).toHaveLength(60);
        expect(findChip(element)).toBeNull();
        expect(filterButton(element).getAttribute('aria-pressed')).toBe('true');
    });

    it('expect a change of the columns to filter the rows again: a hidden column has no matches', async () => {
        const mounted = await mount();
        mounted.gridInterface.find('acme', { filterRows: true });

        mounted.gridInterface.setState({ layout: { left: [], center: [{ fields: ['city'], width: 100 }], right: [] } });
        await afterDelay();

        expect(shownIds(mounted)).toEqual([5]);
        expect(mounted.gridInterface.getFind()).toMatchObject({ count: 1, current: { row: 0, field: 'city' } });
    });

    it('expect the groups to keep the rows with a match, with their counts', async () => {
        const mounted = await mount();
        const { gridInterface, datasource } = mounted;
        datasource.group([{ attribute: 'active', title: 'Active' }]);
        datasource.expandGroup();

        gridInterface.find('acme', { filterRows: true });

        // Acme 2 and Acme 50 are active, Acme 5 is not
        const totals = datasource
            .getRows()
            .filter(isGroupRow)
            .map((row) => row.__groupTotal);
        expect(totals.sort()).toEqual([1, 2]);
        expect(shownIds(mounted).sort((a, b) => a - b)).toEqual([2, 5, 50]);
        expect(gridInterface.getFind().count).toBe(4);
    });

    it('expect the ranges cleared, and the current row and the selection as a filter that keeps the same rows leaves them', async () => {
        const byFind = await mount();
        const byFilter = await mount();
        for (const mounted of [byFind, byFilter]) {
            mounted.datasource.select(4);
            mounted.datasource.setRowAsCurrentEntity(3);
            mounted.gridInterface.setRanges([{ fromRow: 0, fromField: 'name', toRow: 3, toField: 'city' }]);
        }

        byFind.gridInterface.find('acme', { filterRows: true });
        byFilter.gridInterface.find('acme');
        // a find alone leaves the ranges
        expect(byFilter.gridInterface.getRanges()).toHaveLength(1);
        byFilter.datasource.filter(where('name', 'CONTAINS', 'acme'));

        const state = ({ datasource, gridInterface }: MountedGrid) => ({
            shown: datasource.getDataRows().map((row) => row.id),
            selected: datasource.getSelectedRows().map((row) => row.id),
            current: datasource.currentEntity?.id ?? null,
            ranges: gridInterface.getRanges()
        });
        expect(state(byFind)).toMatchObject({ shown: [2, 5, 50], ranges: [] });
        expect(state(byFind)).toEqual(state(byFilter));
    });
});

describe('find - filter rows: closing turns it off', () => {
    it('expect Esc to show every row again, the focus in the cell of the current match among them', async () => {
        const mounted = await mount();
        const { element, gridInterface, datasource } = mounted;
        const events = findEvents(mounted);
        ctrlF(inputAt(element, 0, 'city'));
        typeFind(element, 'acme');
        await afterDelay();
        filterButton(element).click();
        // Acme 5's name, the second row shown
        key(findInput(element), 'Enter');
        expect(gridInterface.getFind().current).toEqual({ row: 1, field: 'name' });

        key(findInput(element), 'Escape');

        expect(shownIds(mounted)).toHaveLength(60);
        expect(document.activeElement).toBe(inputAt(element, 5, 'name'));
        expect(datasource.currentEntity).toBe(datasource.getRow(5));
        expect(events.at(-1)).toEqual({ open: false, text: 'acme', filterRows: false, count: 0, position: 0, current: null });
        expect(findChip(element)).toBeNull();

        // open again: off
        ctrlF(inputAt(element, 3, 'city'));
        expect(filterButton(element).getAttribute('aria-pressed')).toBe('false');
        expect(shownIds(mounted)).toHaveLength(60);
    });

    it('expect the close button, closeFind() and the grid leaving the page to show every row again', async () => {
        const mounted = await mount();
        const { element, gridInterface, datasource } = mounted;

        gridInterface.find('acme', { filterRows: true });
        findButtons(element)[3].click();
        expect(shownIds(mounted)).toHaveLength(60);

        gridInterface.find('acme', { filterRows: true });
        gridInterface.closeFind();
        expect(shownIds(mounted)).toHaveLength(60);
        expect(gridInterface.getFind().filterRows).toBe(false);

        gridInterface.find('acme', { filterRows: true });
        element.remove();
        expect(datasource.getDataRows()).toHaveLength(60);
        // back on the page: every row, no chip
        document.body.appendChild(element);
        expect(footerCount(element)).toBe('60/60');
        expect(findChip(element)).toBeNull();
    });

    it('expect another interface connected to the grid element to take it off the datasource of the first', async () => {
        const mounted = await mount();
        mounted.gridInterface.find('acme', { filterRows: true });

        mounted.element.connectInterface(new GridInterface(config(), new Datasource(options())));

        expect(mounted.datasource.getDataRows()).toHaveLength(60);
    });
});

describe('find - filter rows: the footer', () => {
    it("expect a chip while it hides rows, and the footer's Clear to turn it off - the bar stays open", async () => {
        const mounted = await mount();
        const { element, gridInterface, datasource } = mounted;
        const events = findEvents(mounted);
        datasource.filter(where('age', 'LESS_THAN', 10));
        gridInterface.find('acme', { filterRows: true });

        const chip = findChip(element) as HTMLElement;
        expect(chip.textContent?.trim()).toBe('Find: acme');
        expect(chip.title).toBe('Find: acme');
        // after the Clear button, ANDed with the filter's chips
        expect(footerParts(element).slice(1, 3)).toEqual(['Find: acme', 'AND']);
        expect(footerCount(element)).toBe('2/60');

        (element.querySelector('.footer-filter-clear') as HTMLButtonElement).click();

        expect(shownIds(mounted)).toHaveLength(60);
        expect(datasource.getFilter()).toBeNull();
        expect(findChip(element)).toBeNull();
        expect(filterButton(element).getAttribute('aria-pressed')).toBe('false');
        expect(gridInterface.getFind()).toMatchObject({ open: true, filterRows: false });
        expect(events.at(-1)?.filterRows).toBe(false);
        // the matches follow the rows, as for any filter
        await afterDelay();
        expect(gridInterface.getFind().count).toBe(4);
    });

    it('expect the chip after the one of changed rows only, and Clear to turn both off', async () => {
        const mounted = await mount();
        const { element, gridInterface, datasource } = mounted;
        datasource.getAllData()[5].age = 6;
        datasource.filterChangedOnly(true);

        gridInterface.find('acme', { filterRows: true });

        expect(shownIds(mounted)).toEqual([5]);
        expect(footerParts(element).slice(1)).toEqual(['Changed rows only', 'AND', 'Find: acme']);

        (element.querySelector('.footer-filter-clear') as HTMLButtonElement).click();
        expect(datasource.isChangedOnly()).toBe(false);
        expect(shownIds(mounted)).toHaveLength(60);
        expect(element.querySelector('.footer-filter')).toBeNull();
    });
});

describe('find - filter rows: the API, the texts', () => {
    it('expect find(text, { filterRows }) to turn it on and off, find(text) to leave it, and find-change to send it', async () => {
        const mounted = await mount();
        const { gridInterface } = mounted;
        const events = findEvents(mounted);

        expect(gridInterface.find('acme', { filterRows: true })).toBe(4);
        expect(gridInterface.getFind().filterRows).toBe(true);
        expect(shownIds(mounted)).toEqual([2, 5, 50]);
        // the text only: it stays on
        expect(gridInterface.find('acme 5')).toBe(2);
        expect(shownIds(mounted)).toEqual([5, 50]);
        gridInterface.find('acme 5', { filterRows: false });
        expect(shownIds(mounted)).toHaveLength(60);
        expect(events.map(({ text, filterRows, count }) => `${text}:${filterRows}:${count}`)).toEqual([
            'acme:true:4',
            'acme 5:true:2',
            'acme 5:false:2'
        ]);

        // an empty text: on, and every row
        gridInterface.find('', { filterRows: true });
        expect(gridInterface.getFind()).toMatchObject({ filterRows: true, count: 0 });
        expect(shownIds(mounted)).toHaveLength(60);

        // a boolean where the options go, from plain JavaScript
        expect(() => gridInterface.find('acme', true as unknown as { filterRows: boolean })).toThrow(TypeError);
    });

    it('expect nothing while the grid is not on the page', async () => {
        const mounted = await mount();
        mounted.element.remove();

        expect(mounted.gridInterface.find('acme', { filterRows: true })).toBe(0);
        expect(mounted.gridInterface.getFind().filterRows).toBe(false);
        expect(mounted.datasource.getDataRows()).toHaveLength(60);
    });

    it("expect the texts of the toggle and the chip from the grid's texts", async () => {
        const { element, gridInterface } = await mount(
            config({
                texts: {
                    'find.filterRows': 'Filtrer rader',
                    'find.filterRows.tooltip': 'Vis bare radene med treff',
                    'footer.findFilter': 'Søk: {text}'
                }
            })
        );

        gridInterface.find('acme', { filterRows: true });

        expect(filterButton(element).getAttribute('aria-label')).toBe('Filtrer rader');
        expect(filterButton(element).title).toBe('Vis bare radene med treff');
        expect(findChip(element)?.textContent?.trim()).toBe('Søk: acme');
    });
});
