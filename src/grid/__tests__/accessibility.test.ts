// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { type MountedGrid, mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, labelCell, menuItemsExact, openRowMenu, pointerEvent, sleep } from './interactionTestHelpers';

/**
 * What a screen reader gets of the grid: the grid pattern of WAI-ARIA (grid, row, columnheader,
 * gridcell, the indexes and counts of the rows and columns, aria-sort, aria-selected, a treegrid with
 * levels while grouped), the labels, and the keys of the keyboard that came with it.
 *
 * One row of the grid is a row element in every section of the dom, and the row and column elements
 * are reused while scrolling: aria-owns puts them together in the right order, see ariaGrid.ts.
 * `ariaRows()` reads the grid the way the browser builds its accessibility tree from that - a child
 * owned by aria-owns moves to its owner, after the owner's own children - so the tests check the
 * structure and not the attributes one by one. The real tree of Chrome is checked by hand, see
 * guides/14-accessibility.md.
 */

type AriaCell = { element: HTMLElement; role: string; colindex: number; text: string };
type AriaRow = { element: HTMLElement; rowindex: number; cells: AriaCell[] };

/** hidden for the accessibility tree: not rendered, or aria-hidden, itself or a dom ancestor */
function isHidden(element: Element): boolean {
    for (let e: Element | null = element; e; e = e.parentElement) {
        if (
            (e as HTMLElement).hidden ||
            (e as HTMLElement).style?.display === 'none' ||
            e.getAttribute('aria-hidden') === 'true'
        ) {
            return true;
        }
    }
    return false;
}

/** the children of an element in the accessibility tree: its dom children that nobody owns, then the elements it owns */
function treeChildren(element: Element, owned: Set<Element>): Element[] {
    const own = Array.from(element.children).filter((child) => !owned.has(child));
    const ids = element.getAttribute('aria-owns')?.split(' ').filter(Boolean) ?? [];
    const owns = ids.map((id) => {
        const found = document.getElementById(id);
        expect(found, `aria-owns points to ${id}`).not.toBeNull();
        return found as Element;
    });
    return [...own, ...owns].filter((child) => !isHidden(child));
}

const CELL_ROLES = ['gridcell', 'columnheader', 'rowheader'];

/** the rows of the grid (or treegrid), and the cells of each, in the order of the tree */
function ariaRows(element: GridElement): AriaRow[] {
    const grid = element.querySelector('[role="grid"], [role="treegrid"]') as HTMLElement;
    const owned = new Set<Element>();
    for (const owner of document.querySelectorAll('[aria-owns]')) {
        for (const id of owner.getAttribute('aria-owns')?.split(' ').filter(Boolean) ?? []) {
            const found = document.getElementById(id);
            if (found) {
                expect(owned.has(found), `${id} has one owner`).toBe(false);
                owned.add(found);
            }
        }
    }

    const cellsOf = (node: Element, cells: AriaCell[] = []): AriaCell[] => {
        for (const child of treeChildren(node, owned)) {
            const role = child.getAttribute('role') ?? '';
            if (CELL_ROLES.includes(role)) {
                cells.push({
                    element: child as HTMLElement,
                    role,
                    colindex: Number(child.getAttribute('aria-colindex')),
                    text: cellText(child as HTMLElement)
                });
            } else {
                expect(role, 'no row in a row').not.toEqual('row');
                cellsOf(child, cells);
            }
        }
        return cells;
    };

    const rows: AriaRow[] = [];
    const walk = (node: Element) => {
        for (const child of treeChildren(node, owned)) {
            if (child.getAttribute('role') === 'row') {
                rows.push({
                    element: child as HTMLElement,
                    rowindex: Number(child.getAttribute('aria-rowindex')),
                    cells: cellsOf(child)
                });
            } else {
                expect(CELL_ROLES, 'no cell outside a row').not.toContain(child.getAttribute('role'));
                walk(child);
            }
        }
    };
    walk(grid);
    return rows;
}

/** what a cell shows: the value of its input, the label of a column header, the row number */
function cellText(cell: HTMLElement): string {
    const input = cell.querySelector('input');
    if (input && input.type !== 'checkbox') {
        return input.value;
    }
    return cell.getAttribute('aria-label') ?? cell.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** the rules of the spec: the indexes go up in the order of the tree, and stay in the counts */
function expectInOrder(element: GridElement, rows: AriaRow[]) {
    const grid = gridElement(element);
    const rowcount = Number(grid.getAttribute('aria-rowcount'));
    const colcount = Number(grid.getAttribute('aria-colcount'));
    let lastRow = 0;
    for (const row of rows) {
        expect(row.rowindex, 'aria-rowindex goes up').toBeGreaterThan(lastRow);
        expect(row.rowindex).toBeLessThanOrEqual(rowcount);
        lastRow = row.rowindex;
        let lastCol = 0;
        for (const cell of row.cells) {
            expect(cell.colindex, `row ${row.rowindex}: aria-colindex goes up`).toBeGreaterThan(lastCol);
            expect(cell.colindex).toBeLessThanOrEqual(colcount);
            lastCol = cell.colindex;
        }
    }
}

const gridElement = (element: GridElement) => element.querySelector('[role="grid"], [role="treegrid"]') as HTMLElement;
const bodyRows = (element: GridElement) =>
    ariaRows(element).filter((row) => row.cells[0]?.colindex === 1 && row.cells[0].role === 'gridcell');
const texts = (row: AriaRow) => row.cells.map((cell) => cell.text);

const people = (count = 5) =>
    Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        firstname: `first${i + 1}`,
        lastname: `last${i + 1}`,
        city: i % 2 ? 'Oslo' : 'Bergen',
        age: 20 + i
    }));

/** a pinned column on each side, and a column of two fields in the middle */
const pinnedConfig = (): GridConfig => ({
    layout: {
        left: [{ fields: ['firstname'], width: 100 }],
        center: [
            { fields: ['lastname', 'city'], width: 100 },
            { fields: ['age'], width: 100 }
        ],
        right: [{ fields: ['id'], width: 100 }]
    },
    columns: { firstname: { label: 'First name' } }
});

const fields = { fields: { id: 'number' as const, age: 'number' as const } };

/** 20 columns of 100px: more than the 1000px wide stub viewport shows, the middle is virtual */
const wideConfig = (): GridConfig => ({
    layout: { center: Array.from({ length: 20 }, (_, i) => ({ fields: [`f${i}`], width: 100 })) }
});
const wideData = () =>
    Array.from({ length: 3 }, (_, row) => Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, `r${row}c${i}`])));

const scroll = (element: GridElement, className: string, to: { top?: number; left?: number }) => {
    const scroller = element.querySelector(`.${className}`) as HTMLElement;
    if (to.top !== undefined) {
        scroller.scrollTop = to.top;
    }
    if (to.left !== undefined) {
        scroller.scrollLeft = to.left;
    }
    scroller.dispatchEvent(new Event('scroll'));
};

const keydown = (target: Element, key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', {
        key,
        code: key === ' ' ? 'Space' : key,
        bubbles: true,
        cancelable: true,
        ...init
    });
    target.dispatchEvent(event);
    return event;
};

/** the body cell input of a field in a displayed row */
const cellInput = (element: GridElement, field: string, row: number) =>
    Array.from(element.querySelectorAll<HTMLInputElement>(`input[data-attribute="${field}"]`)).find(
        (input) => (input.closest('.simple-html-grid-col-cell') as any).$row === row
    ) as HTMLInputElement;

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.useRealTimers();
});

describe('accessibility - the grid', () => {
    it('expect one grid element, named by the text grid.label, and no role on the simple-html-grid element', async () => {
        const { element } = await mountGrid();

        const grids = element.querySelectorAll('[role="grid"], [role="treegrid"]');
        expect(grids.length).toBe(1);
        expect(grids[0].getAttribute('aria-label')).toEqual('Grid');
        // it was role="table", around the grid: a table with a grid in it
        expect(element.hasAttribute('role')).toBe(false);
    });

    it('expect aria-colcount to be the row numbers and every field, aria-rowcount the header rows and the rows', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(), fields);
        const grid = gridElement(element);

        expect(grid.getAttribute('aria-colcount')).toEqual('6');
        // labels and filters
        expect(grid.getAttribute('aria-rowcount')).toEqual('7');
    });

    it('expect the header rows to count only when shown', async () => {
        const { element, gridInterface } = await mountGrid(pinnedConfig(), people(), fields);

        gridInterface.updateConfig({ hideFilter: true });
        expect(gridElement(element).getAttribute('aria-rowcount')).toEqual('6');
        expect(ariaRows(element)[1].rowindex).toBe(2);

        gridInterface.updateConfig({ hideLabels: true, hideFilter: true });
        expect(gridElement(element).getAttribute('aria-rowcount')).toEqual('5');
        expect(ariaRows(element)[0].rowindex).toBe(1);
        // the corner heads the row numbers in the first header row: with none, it is hidden
        expect(element.querySelector('[aria-label="row selector"]')?.getAttribute('aria-hidden')).toEqual('true');

        gridInterface.updateConfig({ hideLabels: true, hideFilter: false });
        // the filter row is the first one, the corner is in it
        expect(ariaRows(element)[0].cells[0].text).toEqual('row selector');
    });

    it('expect two grids on a page to have ids of their own: aria-owns points into its own grid', async () => {
        const first = await mountGrid();
        const second = await mountGrid();

        const ids = Array.from(document.querySelectorAll('[id]'), (e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(bodyRows(second.element).map((row) => row.cells[1].text)).toEqual(
            bodyRows(first.element).map((row) => row.cells[1].text)
        );
    });
});

describe('accessibility - rows and cells', () => {
    it('expect the header: the column headers with the labels, then the filters, the corner heads the row numbers', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(), fields);
        const [labels, filters] = ariaRows(element);

        expect(labels.rowindex).toBe(1);
        expect(labels.cells.map((cell) => cell.role)).toEqual(Array(6).fill('columnheader'));
        expect(texts(labels)).toEqual(['row selector', 'First name', 'Lastname', 'City', 'Age', 'Id']);
        expect(labels.cells.map((cell) => cell.colindex)).toEqual([1, 2, 3, 4, 5, 6]);

        expect(filters.rowindex).toBe(2);
        expect(filters.cells.map((cell) => cell.role)).toEqual(Array(5).fill('gridcell'));
        expect(filters.cells.map((cell) => cell.colindex)).toEqual([2, 3, 4, 5, 6]);
        expect(filters.cells.map((cell) => cell.element.querySelector('input')?.getAttribute('aria-label'))).toEqual([
            'Filter First name',
            'Filter Lastname',
            'Filter City',
            'Filter Age',
            'Filter Id'
        ]);
    });

    it('expect a body row to have its cells of every section together: row number, left, middle, right', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(), fields);
        const rows = bodyRows(element);

        expect(rows.length).toBe(5);
        expect(rows[0].rowindex).toBe(3);
        expect(texts(rows[0])).toEqual(['1', 'first1', 'last1', 'Bergen', '20', '1']);
        expect(rows[0].cells.map((cell) => cell.colindex)).toEqual([1, 2, 3, 4, 5, 6]);
        expectInOrder(element, ariaRows(element));
    });

    it('expect the input of a cell to be labelled with the column label, inside a gridcell', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(), fields);
        const input = cellInput(element, 'firstname', 0);

        // it was role="cell" on the input, labelled with the field name
        expect(input.hasAttribute('role')).toBe(false);
        expect(input.getAttribute('aria-label')).toEqual('First name');
        expect(input.closest('.simple-html-grid-col-cell')?.getAttribute('role')).toEqual('gridcell');
    });

    it('expect a checkbox cell labelled with the column label too', async () => {
        const { element } = await mountGrid(
            { layout: { center: [{ fields: ['active'], width: 100 }] }, columns: { active: { label: 'Active' } } },
            [{ active: true }],
            { fields: { active: 'boolean' } }
        );
        const checkbox = element.querySelector('input[type="checkbox"][data-attribute="active"]') as HTMLInputElement;

        expect(checkbox.getAttribute('aria-label')).toEqual('Active');
        expect(checkbox.closest('.simple-html-grid-col-cell')?.getAttribute('role')).toEqual('gridcell');
    });

    it('expect the empty cells under a column with fewer fields to be no cells', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(), fields);
        const [labels, filters, first] = ariaRows(element);

        // the tallest column has two fields: the others have an empty cell under theirs
        expect(labels.cells.length).toBe(6);
        expect(filters.cells.length).toBe(5);
        expect(first.cells.length).toBe(6);
        const empty = element.querySelectorAll('.simple-html-grid-body-row-container-pinned-left [type="row-cell"]')[1];
        expect(empty.getAttribute('role')).toEqual('none');
    });

    it('expect the column numbers under the filters and the resize handles hidden from a screen reader', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(), fields);

        const selectors = element.querySelectorAll('.simple-html-grid-header [type="selector"]');
        expect(selectors.length).toBe(4);
        for (const selector of selectors) {
            expect(selector.getAttribute('aria-hidden')).toEqual('true');
        }
        for (const handle of element.querySelectorAll('.simple-html-grid-col-resize, .simple-html-grid-col-resize-right')) {
            expect(handle.getAttribute('aria-hidden')).toEqual('true');
        }
    });

    it('expect the row elements of the other sections to be no rows', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(), fields);

        for (const section of ['group', 'pinned-left', 'pinned-middle', 'pinned-right']) {
            for (const row of element.querySelectorAll(
                `.simple-html-grid-body-row-container-${section} > .simple-html-grid-row`
            )) {
                expect(row.getAttribute('role'), section).toEqual('none');
                expect(row.hasAttribute('aria-rowindex'), section).toBe(false);
            }
        }
    });
});

describe('accessibility - scrolling', () => {
    it('expect aria-rowindex of the rows in the dom after scrolling down, in the order of the rows', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(200), fields);
        vi.useFakeTimers();

        scroll(element, 'simple-html-grid-body-scroller', { top: 2200 });
        vi.advanceTimersByTime(500);

        const rows = bodyRows(element);
        // 44px rows (a column has two fields of 22px): row 50 (0 based) is at the top, the one above
        // it is rendered too
        expect(rows[0].rowindex).toBe(2 + 49 + 1);
        expect(texts(rows[0])[0]).toEqual('50');
        expect(rows.map((row) => row.rowindex)).toEqual(rows.map((_, i) => rows[0].rowindex + i));
        expectInOrder(element, ariaRows(element));

        // the row elements are reused: the dom order is not the order of the rows, the owns order is
        const domOrder = Array.from(element.querySelectorAll('.simple-html-grid-body-row-container-selector > [role="row"]'))
            .filter((row) => !isHidden(row))
            .map((row) => Number(row.getAttribute('aria-rowindex')));
        expect(domOrder).not.toEqual([...domOrder].sort((a, b) => a - b));
    });

    it('expect aria-colindex with the middle virtual: a column scrolled away is not in a row, the cells stay in order', async () => {
        const { element } = await mountGrid(wideConfig(), wideData(), { fields: {} });
        const grid = gridElement(element);
        expect(grid.getAttribute('aria-colcount')).toEqual('21');

        const before = bodyRows(element)[0];
        expect(before.cells.length).toBeLessThan(21);
        expect(before.cells[1]).toMatchObject({ colindex: 2, text: 'r0c0' });

        scroll(element, 'simple-html-grid-middle-scroller', { left: 1000 });

        const [labels, filters, first] = ariaRows(element);
        // columns 10 and on are shown (and the one before): f9 is colindex 11
        expect(first.cells[1]).toMatchObject({ colindex: 11, text: 'r0c9' });
        expect(labels.cells[1]).toMatchObject({ colindex: 11, text: 'F9' });
        expect(filters.cells[0].colindex).toBe(11);
        // each cell shows the field of its colindex
        for (const cell of first.cells.slice(1)) {
            expect(cell.text).toEqual(`r0c${cell.colindex - 2}`);
        }
        expectInOrder(element, ariaRows(element));

        // the column elements are reused: their dom order is not the order of the columns
        const slots = Array.from(
            element.querySelectorAll('.simple-html-grid-header-row-container-pinned-middle > .simple-html-grid-col')
        )
            .filter((col) => !isHidden(col))
            .map((col) => Number(col.querySelector('[type="label"]')?.getAttribute('aria-colindex')));
        expect(slots).not.toEqual([...slots].sort((a, b) => a - b));
    });
});

describe('accessibility - the counts follow filter, group and collapse', () => {
    it('expect aria-rowcount after filter(), group(), a collapse and an expand', async () => {
        const { element, datasource } = await mountGrid(pinnedConfig(), people(10), fields);
        const rowcount = () => Number(gridElement(element).getAttribute('aria-rowcount'));
        expect(rowcount()).toBe(12);

        datasource.filter(where('age', 'GREATER_THAN', 25));
        expect(rowcount()).toBe(2 + 4);

        datasource.filter(null);
        datasource.group([{ attribute: 'city', title: 'City' }]);
        // two group rows, collapsed
        expect(rowcount()).toBe(2 + 2);

        datasource.expandGroup();
        expect(rowcount()).toBe(2 + 2 + 10);
        expect(bodyRows(element).length).toBe(12);

        datasource.collapseGroup('Bergen');
        expect(rowcount()).toBe(2 + 2 + 5);
        expectInOrder(element, ariaRows(element));
    });
});

describe('accessibility - sorting', () => {
    const sortOf = (element: GridElement) =>
        ariaRows(element)[0]
            .cells.filter((cell) => cell.element.hasAttribute('aria-sort'))
            .map((cell) => [cell.text, cell.element.getAttribute('aria-sort')]);

    it('expect aria-sort on the sorted column only, after sort()', async () => {
        const { element, datasource } = await mountGrid(pinnedConfig(), people(), fields);
        expect(sortOf(element)).toEqual([]);

        datasource.sort({ attribute: 'age', ascending: true });
        expect(sortOf(element)).toEqual([['Age', 'ascending']]);

        datasource.sort({ attribute: 'age', ascending: false });
        expect(sortOf(element)).toEqual([['Age', 'descending']]);
    });

    it('expect aria-sort on the first sort only when sorted on more fields: a grid has one sorted header', async () => {
        const { element, datasource } = await mountGrid(pinnedConfig(), people(), fields);

        datasource.sort([
            { attribute: 'city', ascending: true },
            { attribute: 'age', ascending: false }
        ]);
        expect(sortOf(element)).toEqual([['City', 'ascending']]);
        // the number of the sort is shown, and hidden from a screen reader
        expect(element.querySelector('[data-sortno="2"]')?.getAttribute('aria-hidden')).toEqual('true');
    });

    it('expect aria-sort after a click on a header label', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(), fields);

        labelCell(element, 'firstname').dispatchEvent(pointerEvent('pointerdown'));
        labelCell(element, 'firstname').dispatchEvent(pointerEvent('pointerup'));

        expect(sortOf(element)).toEqual([['First name', 'ascending']]);
    });

    it('expect a column header focusable (not in the tab order), Enter and Space to sort, the focus to stay on it', async () => {
        const { element, datasource } = await mountGrid(pinnedConfig(), people(), fields);
        const label = labelCell(element, 'age');
        expect(label.getAttribute('tabindex')).toEqual('-1');

        label.focus();
        expect(keydown(label, 'Enter').defaultPrevented).toBe(true);
        expect(sortOf(element)).toEqual([['Age', 'ascending']]);
        // the sort rebuilt the header: a new element, with the focus
        expect(document.activeElement).toBe(labelCell(element, 'age'));

        keydown(document.activeElement as Element, ' ');
        expect(sortOf(element)).toEqual([['Age', 'descending']]);

        // shift adds to the sort
        keydown(labelCell(element, 'city'), 'Enter', { shiftKey: true });
        expect(datasource.getLastSorting().map((sort) => sort.attribute)).toEqual(['age', 'city']);
    });

    it('expect Alt+ArrowUp from a header filter to its column header, Alt+ArrowDown back', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(), fields);

        const filter = headerFilterInput(element, 'age');
        filter.focus();
        keydown(filter, 'ArrowUp', { code: 'ArrowUp', altKey: true });
        expect(document.activeElement).toBe(labelCell(element, 'age'));

        keydown(document.activeElement as Element, 'ArrowDown', { altKey: true });
        expect(document.activeElement).toBe(headerFilterInput(element, 'age'));
    });

    it('expect Alt+ArrowUp/Down through the labels of a column with two fields', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(), fields);

        // up from the filter of the first field: the label right above, of the last field
        const filter = headerFilterInput(element, 'lastname');
        keydown(filter, 'ArrowUp', { code: 'ArrowUp', altKey: true });
        expect(document.activeElement).toBe(labelCell(element, 'city'));
        keydown(document.activeElement as Element, 'ArrowUp', { altKey: true });
        expect(document.activeElement).toBe(labelCell(element, 'lastname'));
        keydown(document.activeElement as Element, 'ArrowDown', { altKey: true });
        expect(document.activeElement).toBe(labelCell(element, 'city'));
        keydown(document.activeElement as Element, 'ArrowDown', { altKey: true });
        expect(document.activeElement).toBe(headerFilterInput(element, 'lastname'));
    });
});

describe('accessibility - selection', () => {
    const selected = (element: GridElement) => bodyRows(element).map((row) => row.element.getAttribute('aria-selected'));

    it('expect aria-multiselectable and aria-selected true/false on every row with selectionMode multiple', async () => {
        const { element, datasource } = await mountGrid(pinnedConfig(), people(), fields);
        expect(gridElement(element).getAttribute('aria-multiselectable')).toEqual('true');
        expect(selected(element)).toEqual(['false', 'false', 'false', 'false', 'false']);

        datasource.select(2);
        expect(selected(element)).toEqual(['false', 'true', 'false', 'false', 'false']);

        datasource.selectAll();
        expect(selected(element)).toEqual(Array(5).fill('true'));

        datasource.deselectAll({ notify: true });
        expect(selected(element)).toEqual(Array(5).fill('false'));
    });

    it('expect a click on a row number to select the row, ctrl+click to add one', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(), fields);
        const rowNumber = (row: number) => bodyRows(element)[row].cells[0].element;

        rowNumber(0).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        rowNumber(3).dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));

        expect(selected(element)).toEqual(['true', 'false', 'false', 'true', 'false']);
    });

    it('expect no aria-multiselectable with selectionMode single, aria-selected on the rows', async () => {
        const { element, datasource } = await mountGrid(pinnedConfig(), people(), { ...fields, selectionMode: 'single' });
        expect(gridElement(element).hasAttribute('aria-multiselectable')).toBe(false);

        datasource.select(3);
        expect(selected(element)).toEqual(['false', 'false', 'true', 'false', 'false']);
    });

    it('expect no aria-selected at all with selectionMode none', async () => {
        const { element, datasource } = await mountGrid(pinnedConfig(), people(), { ...fields, selectionMode: 'none' });
        datasource.select(1);

        expect(gridElement(element).hasAttribute('aria-multiselectable')).toBe(false);
        expect(selected(element)).toEqual(Array(5).fill(null));
    });

    it('expect setSelectionMode() to show on the next render', async () => {
        const { element, datasource, gridInterface } = await mountGrid(pinnedConfig(), people(), fields);

        datasource.setSelectionMode('none');
        gridInterface.refresh();

        expect(gridElement(element).hasAttribute('aria-multiselectable')).toBe(false);
        expect(selected(element)).toEqual(Array(5).fill(null));
    });
});

describe('accessibility - grouping', () => {
    const grouped = async () => {
        const mounted = await mountGrid(pinnedConfig(), people(4), fields);
        mounted.datasource.group([{ attribute: 'city', title: 'City' }]);
        return mounted;
    };
    const toggles = (element: GridElement) =>
        Array.from(element.querySelectorAll<HTMLElement>('.simple-html-grid-body-row-container-group [role="button"]')).filter(
            (button) => !isHidden(button)
        );

    it('expect a treegrid while grouped, a grid again without', async () => {
        const { element, datasource } = await grouped();
        expect(gridElement(element).getAttribute('role')).toEqual('treegrid');

        datasource.removeGroup();
        expect(gridElement(element).getAttribute('role')).toEqual('grid');
        expect(bodyRows(element).every((row) => !row.element.hasAttribute('aria-level'))).toBe(true);
    });

    it('expect a group row with aria-level and aria-expanded, one cell over the columns', async () => {
        const { element } = await grouped();
        const [bergen, oslo] = bodyRows(element);

        expect(bergen.element.getAttribute('aria-level')).toEqual('1');
        expect(bergen.element.getAttribute('aria-expanded')).toEqual('false');
        expect(bergen.element.hasAttribute('aria-selected')).toBe(false);
        expect(bergen.cells.map((cell) => cell.colindex)).toEqual([1, 2]);
        expect(bergen.cells[1].element.getAttribute('aria-colspan')).toEqual('5');
        expect(oslo.cells[1].text).toEqual('City: Oslo (2)');
    });

    it('expect the data rows one level below the groups, without aria-expanded', async () => {
        const { element, datasource } = await grouped();
        datasource.group([
            { attribute: 'city', title: 'City' },
            { attribute: 'age', title: 'Age' }
        ]);
        datasource.expandGroup();

        const levels = bodyRows(element).map((row) => [
            row.element.getAttribute('aria-level'),
            row.element.getAttribute('aria-expanded')
        ]);
        expect(levels.slice(0, 3)).toEqual([
            ['1', 'true'],
            ['2', 'true'],
            ['3', null]
        ]);
        expectInOrder(element, ariaRows(element));
    });

    it('expect the button of a group row named like the row, with its state; the text itself hidden', async () => {
        const { element } = await grouped();
        const [button] = toggles(element);

        expect(button.getAttribute('aria-label')).toEqual('City: Bergen (2)');
        expect(button.getAttribute('aria-expanded')).toEqual('false');
        expect(button.getAttribute('tabindex')).toEqual('-1');
        expect(button.nextElementSibling?.getAttribute('aria-hidden')).toEqual('true');
    });

    it('expect Enter and Space on the button to expand and collapse, the focus to stay on its button', async () => {
        const { element, datasource } = await grouped();

        toggles(element)[0].focus();
        expect(keydown(toggles(element)[0], 'Enter').defaultPrevented).toBe(true);
        expect(datasource.getExpanded()).toEqual(['Bergen']);
        // expanding rebuilt the rows: the focus is on the new button of the same group
        expect(document.activeElement?.getAttribute('aria-label')).toEqual('City: Bergen (2)');
        expect(document.activeElement?.getAttribute('aria-expanded')).toEqual('true');
        expect(bodyRows(element)[0].element.getAttribute('aria-expanded')).toEqual('true');

        keydown(document.activeElement as Element, ' ');
        expect(datasource.getExpanded()).toEqual([]);
        expect(document.activeElement?.getAttribute('aria-expanded')).toEqual('false');
    });

    it('expect the x on a group chip in the panel to be a button with a name, Enter removes the grouping', async () => {
        const { element, datasource } = await grouped();
        const remove = element.querySelector('.simple-html-grid-panel [role="button"]') as HTMLElement;

        expect(remove.getAttribute('aria-label')).toEqual('Remove the grouping on City');
        expect(remove.getAttribute('tabindex')).toEqual('0');
        keydown(remove, 'Enter');
        expect(datasource.getGrouping()).toEqual([]);
    });
});

describe('accessibility - Tab out of the grid (it was a keyboard trap)', () => {
    const lastCell = (element: GridElement, row: number) => cellInput(element, 'id', row);

    it('expect Tab on the last cell of the last row not canceled: the focus goes to the end of the grid, the browser goes on from there', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(3), fields);
        const input = lastCell(element, 2);
        input.focus();

        const event = keydown(input, 'Tab', { code: 'Tab' });

        expect(event.defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(element.lastElementChild);
        expect(document.activeElement?.getAttribute('tabindex')).toEqual('-1');
    });

    it('expect Tab on the last cell of another row to stay in the grid: the next row', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(3), fields);
        const input = lastCell(element, 1);
        input.focus();
        // a key is ignored while the focus of the key before is on its way (100ms)
        await sleep(150);

        const event = keydown(input, 'Tab', { code: 'Tab' });
        await sleep(150);

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(cellInput(element, 'firstname', 2));
    });

    it('expect Tab on the last cell of the last data row to go to the button of the group row after it, then out of the grid', async () => {
        const { element, datasource } = await mountGrid(pinnedConfig(), people(4), fields);
        datasource.group([{ attribute: 'city', title: 'City' }]);
        datasource.expandGroup('Bergen');
        // Bergen, its 2 rows, then Oslo collapsed: its button is a stop of Tab (it was skipped)
        const input = lastCell(element, 2);

        expect(keydown(input, 'Tab', { code: 'Tab' }).defaultPrevented).toBe(true);
        const oslo = document.activeElement as HTMLElement;
        expect(oslo.getAttribute('aria-label')).toEqual('City: Oslo (2)');

        expect(keydown(oslo, 'Tab', { code: 'Tab' }).defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(element.lastElementChild);
    });

    it('expect Shift+Tab on the first header filter not canceled: the focus goes to the start of the grid', async () => {
        const { element } = await mountGrid(pinnedConfig(), people(3), fields);
        const filter = headerFilterInput(element, 'firstname');
        filter.focus();

        const event = keydown(filter, 'Tab', { code: 'Tab', shiftKey: true });

        expect(event.defaultPrevented).toBe(false);
        // before the header in the dom: the browser goes on to what is before the grid
        const start = document.activeElement as HTMLElement;
        expect(start.getAttribute('tabindex')).toEqual('-1');
        expect(start.nextElementSibling?.classList.contains('simple-html-grid-header')).toBe(true);
    });

    it('expect Shift+Tab on the first cell of the first row to leave the grid when the filters are hidden', async () => {
        const { element } = await mountGrid({ ...pinnedConfig(), hideFilter: true }, people(3), fields);
        const input = cellInput(element, 'firstname', 0);

        expect(keydown(input, 'Tab', { code: 'Tab', shiftKey: true }).defaultPrevented).toBe(false);
    });

    it('expect Tab on the last header filter to leave the grid when there are no rows', async () => {
        const { element } = await mountGrid(pinnedConfig(), [], fields);
        const filter = headerFilterInput(element, 'id');

        expect(keydown(filter, 'Tab', { code: 'Tab' }).defaultPrevented).toBe(false);
    });

    it('expect the two elements at the ends out of the tab order and hidden from a screen reader', async () => {
        const { element } = await mountGrid();
        const ends = [element.lastElementChild, element.querySelector('.simple-html-grid-header')?.previousElementSibling];

        for (const end of ends) {
            expect(end?.getAttribute('tabindex')).toEqual('-1');
            expect(end?.getAttribute('aria-hidden')).toEqual('true');
        }
    });
});

describe('accessibility - the group rows and the footer on the way of Tab', () => {
    const tab = (target: Element, shiftKey = false) => keydown(target, 'Tab', { code: 'Tab', shiftKey });
    const active = () => document.activeElement as HTMLElement;
    const lastCell = (element: GridElement, row: number) => cellInput(element, 'id', row);
    /** the button of a group row on screen, by its city */
    const groupButton = (element: GridElement, city: string) =>
        Array.from(element.querySelectorAll<HTMLElement>('.simple-html-grid-body-row-container-group [role="button"]')).find(
            (button) => !isHidden(button) && button.getAttribute('aria-label')?.startsWith(`City: ${city}`)
        ) as HTMLElement;

    /** Bergen (row 0), first1 and first3 (1, 2), Oslo (3), first2 and first4 (4, 5) */
    const grouped = async (config: GridConfig = pinnedConfig()) => {
        const mounted = await mountGrid(config, people(4), fields);
        mounted.datasource.group([{ attribute: 'city', title: 'City' }]);
        mounted.datasource.expandGroup();
        return mounted;
    };

    it('expect Tab from the last cell of a row to the button of the group row after it, then the first cell of the next row', async () => {
        const { element } = await grouped();

        expect(tab(lastCell(element, 2)).defaultPrevented).toBe(true);
        expect(active()).toBe(groupButton(element, 'Oslo'));

        expect(tab(active()).defaultPrevented).toBe(true);
        expect(active()).toBe(cellInput(element, 'firstname', 4));
    });

    it('expect Shift+Tab back the same way: the button, then the last cell of the row before', async () => {
        const { element } = await grouped();

        expect(tab(cellInput(element, 'firstname', 4), true).defaultPrevented).toBe(true);
        expect(active()).toBe(groupButton(element, 'Oslo'));

        expect(tab(active(), true).defaultPrevented).toBe(true);
        expect(active()).toBe(lastCell(element, 2));
    });

    it('expect the first group row between the header filters and the first row, both ways', async () => {
        const { element } = await grouped();

        expect(tab(headerFilterInput(element, 'id')).defaultPrevented).toBe(true);
        expect(active()).toBe(groupButton(element, 'Bergen'));
        expect(tab(active(), true).defaultPrevented).toBe(true);
        expect(active()).toBe(headerFilterInput(element, 'id'));

        expect(tab(cellInput(element, 'firstname', 1), true).defaultPrevented).toBe(true);
        expect(active()).toBe(groupButton(element, 'Bergen'));
    });

    it('expect collapsed groups one stop each, then out of the grid', async () => {
        const { element, datasource } = await grouped();
        datasource.collapseGroup();

        tab(groupButton(element, 'Bergen'));
        expect(active()).toBe(groupButton(element, 'Oslo'));
        tab(active(), true);
        expect(active()).toBe(groupButton(element, 'Bergen'));

        expect(tab(groupButton(element, 'Oslo')).defaultPrevented).toBe(false);
        expect(active()).toBe(element.lastElementChild);
    });

    it('expect Shift+Tab on the first group row to leave the grid when the filters are hidden', async () => {
        const { element } = await grouped({ ...pinnedConfig(), hideFilter: true });

        expect(tab(groupButton(element, 'Bergen'), true).defaultPrevented).toBe(false);
        expect(active().nextElementSibling?.classList.contains('simple-html-grid-header')).toBe(true);
    });

    it('expect Alt+ArrowDown to skip the group rows still: it moves between cells', async () => {
        const { element } = await grouped({ ...pinnedConfig(), readonly: false });
        vi.useFakeTimers();

        keydown(cellInput(element, 'firstname', 2), 'ArrowDown', { code: 'ArrowDown', altKey: true });
        vi.advanceTimersByTime(150);

        expect(active()).toBe(cellInput(element, 'firstname', 4));
    });

    it('expect the footer after the last row while the rows are filtered: Clear, the chips, then out of the grid', async () => {
        const { element, datasource } = await mountGrid(pinnedConfig(), people(5), fields);
        datasource.filter(where('age', 'GREATER_THAN', 20));
        const clear = element.querySelector('.footer-filter-clear') as HTMLElement;
        const chips = element.querySelector('.footer-filter-chips') as HTMLElement;

        expect(tab(lastCell(element, 3)).defaultPrevented).toBe(true);
        expect(active()).toBe(clear);
        // between the footer's buttons the browser's Tab
        expect(tab(clear).defaultPrevented).toBe(false);
        expect(active()).toBe(clear);
        // after the last one: the end of the grid, the browser goes on from there
        expect(tab(chips).defaultPrevented).toBe(false);
        expect(active()).toBe(element.lastElementChild);

        // back: Shift+Tab on Clear to the last cell of the last row
        expect(tab(clear, true).defaultPrevented).toBe(true);
        expect(active()).toBe(lastCell(element, 3));
        expect(tab(chips, true).defaultPrevented).toBe(false);
    });

    it('expect the footer after the last header filter when the filter leaves no rows, and back', async () => {
        const { element, datasource } = await mountGrid(pinnedConfig(), people(5), fields);
        datasource.filter(where('age', 'GREATER_THAN', 100));
        const clear = element.querySelector('.footer-filter-clear') as HTMLElement;

        expect(tab(headerFilterInput(element, 'id')).defaultPrevented).toBe(true);
        expect(active()).toBe(clear);
        expect(tab(clear, true).defaultPrevented).toBe(true);
        expect(active()).toBe(headerFilterInput(element, 'id'));
    });

    it('expect Shift+Tab from the footer to the button of the last row when it is a group row', async () => {
        const { element, datasource } = await grouped();
        datasource.collapseGroup('Oslo');
        datasource.filter(where('age', 'GREATER_THAN', 0));

        tab(element.querySelector('.footer-filter-clear') as HTMLElement, true);

        expect(active()).toBe(groupButton(element, 'Oslo'));
    });

    it('expect no stop in a footer of no height, nor without a filter: out of the grid', async () => {
        const { element, datasource } = await mountGrid({ ...pinnedConfig(), footerHeight: 0 }, people(5), fields);
        datasource.filter(where('age', 'GREATER_THAN', 20));

        expect(tab(lastCell(element, 3)).defaultPrevented).toBe(false);
        expect(active()).toBe(element.lastElementChild);
    });
});

describe('accessibility - the rest of the grid', () => {
    it('expect the focus helper out of the tab order and hidden: it was a tab stop read as "dummy cell"', async () => {
        const { element } = await mountGrid();
        const helper = element.querySelector('.simple-html-grid-body > input') as HTMLInputElement;

        expect(helper.tabIndex).toBe(-1);
        expect(helper.getAttribute('aria-hidden')).toEqual('true');
        expect(helper.hasAttribute('aria-label')).toBe(false);
    });

    it('expect the row count in the footer to be a status: read out when it changes', async () => {
        const { element, datasource } = await mountGrid(pinnedConfig(), people(), fields);
        const count = element.querySelector('.footer-count') as HTMLElement;

        expect(count.getAttribute('role')).toEqual('status');
        datasource.filter(where('age', 'GREATER_THAN', 22));
        // the same element, its text changed
        expect(element.querySelector('.footer-count')).toBe(count);
        expect(count.textContent?.trim()).toEqual('2/5');
    });

    it('expect the filter chips in the footer to be a button: Enter opens the filter editor', async () => {
        const { element, datasource } = await mountGrid(pinnedConfig(), people(), fields);
        datasource.filter(where('age', 'GREATER_THAN', 22));
        const chips = element.querySelector('.footer-filter-chips') as HTMLElement;

        expect(chips.getAttribute('role')).toEqual('button');
        expect(chips.getAttribute('tabindex')).toEqual('0');
        keydown(chips, 'Enter');
        expect(document.querySelector('dialog.filter-editor-content')?.hasAttribute('open')).toBe(true);
    });

    it('expect paste and clear in the row menu to read differently: both were "Cell (selected rows)"', async () => {
        const { element } = await mountGrid({ ...pinnedConfig(), readonly: false }, people(), fields);
        openRowMenu(element, 'age', 0);

        expect(menuItemsExact('Paste cell (selected rows)').length).toBe(1);
        expect(menuItemsExact('Clear cell (selected rows)').length).toBe(1);
        expect(menuItemsExact('Cell (selected rows)').length).toBe(0);
    });
});

describe('accessibility - the texts', () => {
    it("expect the labels from the grid's texts", async () => {
        const config: GridConfig = {
            ...pinnedConfig(),
            texts: {
                'grid.label': 'Personer',
                'grid.rowSelector': 'Radnummer',
                'grid.filter': 'Filtrer {label}',
                'grid.groupToggle': '{name}, {total} rader',
                'grid.removeGroup': 'Fjern gruppering på {title}'
            }
        };
        const { element, datasource }: MountedGrid = await mountGrid(config, people(4), fields);
        datasource.group([{ attribute: 'city', title: 'By' }]);

        expect(gridElement(element).getAttribute('aria-label')).toEqual('Personer');
        expect(ariaRows(element)[0].cells[0].text).toEqual('Radnummer');
        expect(headerFilterInput(element, 'age').getAttribute('aria-label')).toEqual('Filtrer Age');
        expect(
            element.querySelector('.simple-html-grid-body-row-container-group [role="button"]')?.getAttribute('aria-label')
        ).toEqual('By: Bergen, 2 rader');
        expect(element.querySelector('.simple-html-grid-panel [role="button"]')?.getAttribute('aria-label')).toEqual(
            'Fjern gruppering på By'
        );
    });
});

describe('accessibility - aggregates', () => {
    /**
     * pinnedConfig with aggregates: firstname is column 2, lastname and city (stacked) 3 and 4, age 5,
     * id 6. Bergen: ids 1 and 3, ages 20 and 22; Oslo: ids 2 and 4, ages 21 and 23
     */
    const withAggregates = async (columns: GridConfig['columns'], options: Partial<GridConfig> = {}) => {
        const mounted = await mountGrid(
            { ...pinnedConfig(), columns: { ...pinnedConfig().columns, ...columns }, ...options },
            people(4),
            fields
        );
        mounted.datasource.group([{ attribute: 'city', title: 'City' }]);
        return mounted;
    };
    const cellsOf = (row: AriaRow) => row.cells.map((cell) => [cell.role, cell.colindex, cell.text]);

    it('expect a group row: the name cell up to the first aggregate, then a gridcell per aggregate at its column', async () => {
        const { element } = await withAggregates({ age: { aggregate: 'sum' }, id: { aggregate: 'max' } });
        const [bergen] = bodyRows(element);

        expect(cellsOf(bergen)).toEqual([
            ['gridcell', 1, '1'],
            ['gridcell', 2, 'City: Bergen (2)'],
            ['gridcell', 5, 'Sum 42'],
            ['gridcell', 6, 'Max 3']
        ]);
        // columns 2, 3 and 4: the name is over the columns before the first aggregate
        expect(bergen.cells[1].element.getAttribute('aria-colspan')).toEqual('3');
        expect(bergen.element.getAttribute('aria-level')).toEqual('1');
        expectInOrder(element, ariaRows(element));
    });

    it('expect the aggregate of the first column in the name cell, its own cell hidden: the name is over it', async () => {
        const { element } = await withAggregates({ firstname: { aggregate: 'count' }, age: { aggregate: 'avg' } });
        const [bergen] = bodyRows(element);

        expect(cellsOf(bergen)).toEqual([
            ['gridcell', 1, '1'],
            ['gridcell', 2, 'City: Bergen (2) Count 2'],
            ['gridcell', 5, 'Avg 21']
        ]);
        expect(bergen.cells[1].element.getAttribute('aria-colspan')).toEqual('3');
        expectInOrder(element, ariaRows(element));
    });

    it('expect a group row without an aggregate after the name to have the name over every column', async () => {
        const { element } = await withAggregates({ firstname: { aggregate: 'count' } });
        const [bergen] = bodyRows(element);

        expect(cellsOf(bergen)).toEqual([
            ['gridcell', 1, '1'],
            ['gridcell', 2, 'City: Bergen (2) Count 2']
        ]);
        expect(bergen.cells[1].element.getAttribute('aria-colspan')).toEqual('5');
    });

    it('expect the totals row as the last row of the grid: "Total" its row header, a gridcell per aggregate', async () => {
        const { element } = await withAggregates({ age: { aggregate: 'sum' }, id: { aggregate: 'count' } }, { totalsRow: true });
        const rows = ariaRows(element);
        const totals = rows[rows.length - 1];

        expect(cellsOf(totals)).toEqual([
            ['rowheader', 1, 'Total'],
            ['gridcell', 5, 'Sum 86'],
            ['gridcell', 6, 'Count 4']
        ]);
        // 2 header rows, 2 group rows, the totals row
        expect(gridElement(element).getAttribute('aria-rowcount')).toEqual('5');
        expect(totals.rowindex).toBe(5);
        expectInOrder(element, rows);
    });

    it("expect the totals row's index and the row count to follow an expand and a filter", async () => {
        const { element, datasource } = await withAggregates({ age: { aggregate: 'sum' } }, { totalsRow: true });

        datasource.expandGroup();
        let rows = ariaRows(element);
        expect(gridElement(element).getAttribute('aria-rowcount')).toEqual('9');
        expect(rows[rows.length - 1].rowindex).toBe(9);
        expectInOrder(element, rows);

        datasource.filter(where('city', 'EQUAL', 'Oslo'));
        rows = ariaRows(element);
        expect(gridElement(element).getAttribute('aria-rowcount')).toEqual('6');
        expect(cellsOf(rows[rows.length - 1])).toEqual([
            ['rowheader', 1, 'Total'],
            ['gridcell', 5, 'Sum 44']
        ]);
        expectInOrder(element, rows);
    });

    it('expect no totals row in the grid when it is off', async () => {
        const { element } = await withAggregates({ age: { aggregate: 'sum' } });

        expect(gridElement(element).getAttribute('aria-rowcount')).toEqual('4');
        expect(ariaRows(element).some((row) => row.cells[0]?.role === 'rowheader')).toBe(false);
    });
});
