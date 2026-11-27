// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { clickColumn, columnFields, columnNumber, NO_COLUMNS } from '../gridFunctions/columnSelection';
import type { GridHooks } from '../gridHooks';
import { type GridMenus, MENU_IDS, type MenuContext, type MenuEntry } from '../gridMenus';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { columnNumberCell, menuTreeIds, openColumnMenu, openMenus } from './interactionTestHelpers';

/**
 * The column numbers under the header filters: selecting columns with a click, Ctrl/Cmd+click and
 * Shift+click across the pinned sections, the API (getSelectedColumns, selectColumns, the
 * column-selection-change event), the keys on a number with the focus, and the column menu with its
 * copies. The header row of numbers a screen reader gets is in accessibility.test.ts.
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
    delete (document as any).execCommand;
});

const data = () =>
    Array.from({ length: 4 }, (_, i) => ({
        id: i,
        name: `n${i}`,
        city: i === 1 ? 'Oslo\tWest' : `c${i}`,
        age: i * 10,
        born: new Date(2026, 0, 1 + i),
        notes: `note ${i}`
    }));

/**
 * name pinned left, notes pinned right, age and born stacked in one column: the column numbers are
 * 1 name, 2 city, 3 age + born, 4 notes
 */
const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    layout: {
        left: [{ fields: ['name'], width: 100 }],
        center: [
            { fields: ['city'], width: 100 },
            { fields: ['age', 'born'], width: 100 }
        ],
        right: [{ fields: ['notes'], width: 100 }]
    },
    columns: { name: { label: 'Full "name"' } },
    ...more
});

const options = () => ({ key: 'id', fields: { age: 'number' as const, born: 'date' as const } });

const mount = (more: Partial<GridConfig> = {}, hooks: GridHooks = {}) => mountGrid(config(more), data(), options(), hooks);

/** a click on a column number, as the mouse does it: the keys held */
function clickNumber(element: GridElement, number: number, keys: MouseEventInit = {}) {
    columnNumberCell(element, number).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...keys }));
}

/** the numbers shown with the selected look */
function selectedLook(element: GridElement): number[] {
    return Array.from(element.querySelectorAll('.simple-html-grid-header [type="selector"] .simple-html-label-odd'))
        .map((number) => Number(number.textContent?.trim()))
        .sort((a, b) => a - b);
}

/** a key on the element with the focus */
function key(target: Element, name: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key: name, code: name, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

/**
 * document.execCommand('copy') as the browser runs it: a copy event, what its listeners put on the
 * clipboard. happy-dom has no execCommand
 */
function stubExecCommand() {
    const written: { text: string; html: string }[] = [];
    (document as any).execCommand = (command: string) => {
        if (command === 'copy') {
            const clipboardData = new DataTransfer();
            const event = new ClipboardEvent('copy', { clipboardData, bubbles: true, cancelable: true, composed: true });
            (document.activeElement ?? document.body).dispatchEvent(event);
            written.push({ text: clipboardData.getData('text/plain'), html: clipboardData.getData('text/html') });
        }
        return true;
    };
    return written;
}

/** clicks an entry of the open column menu, by its id */
function clickEntry(id: string) {
    (document.querySelector(`.simple-html-grid-menu [data-menu-id="${id}"]`) as HTMLElement).click();
}

describe('column selection - clickColumn', () => {
    const plain = { toggle: false, range: false };
    const ctrl = { toggle: true, range: false };
    const shift = { toggle: false, range: true };

    it('expect a plain click to select that column only, again too', () => {
        let selection = clickColumn(NO_COLUMNS, 3, plain);
        expect(selection.selected).toEqual([3]);
        selection = clickColumn(selection, 5, plain);
        expect(selection.selected).toEqual([5]);
        // the one selected clicked again: it stays selected, as a row number
        expect(clickColumn(selection, 5, plain).selected).toEqual([5]);
    });

    it('expect Ctrl+click to toggle one column, the others staying', () => {
        let selection = clickColumn(NO_COLUMNS, 2, plain);
        selection = clickColumn(selection, 5, ctrl);
        expect(selection.selected).toEqual([2, 5]);
        selection = clickColumn(selection, 2, ctrl);
        expect(selection.selected).toEqual([5]);
        // with nothing selected
        expect(clickColumn(NO_COLUMNS, 4, ctrl).selected).toEqual([4]);
    });

    it('expect Shift+click to select from the anchor to it, either way, and again from the same anchor', () => {
        let selection = clickColumn(NO_COLUMNS, 3, plain);
        selection = clickColumn(selection, 6, shift);
        expect(selection.selected).toEqual([3, 4, 5, 6]);
        // the anchor stays: a second Shift+click changes the range
        selection = clickColumn(selection, 1, shift);
        expect(selection.selected).toEqual([1, 2, 3]);
    });

    it('expect Shift+click after Ctrl+clicks to add the range to the columns they selected', () => {
        let selection = clickColumn(NO_COLUMNS, 1, plain);
        selection = clickColumn(selection, 4, ctrl);
        selection = clickColumn(selection, 6, shift);
        expect(selection.selected).toEqual([1, 4, 5, 6]);
        selection = clickColumn(selection, 5, shift);
        expect(selection.selected).toEqual([1, 4, 5]);
    });

    it('expect Shift+click with nothing clicked before to select that column, and to be the anchor', () => {
        const selection = clickColumn(NO_COLUMNS, 3, shift);
        expect(selection).toEqual({ selected: [3], anchor: 3, kept: [] });
        // Ctrl+Shift: the range, as Shift
        expect(clickColumn(selection, 5, { toggle: true, range: true }).selected).toEqual([3, 4, 5]);
    });

    it('expect the numbers across the sections, and the fields of a number', async () => {
        const { gridInterface } = await mount();
        const parsed = gridInterface.__getGridConfig();
        expect(columnNumber(parsed, 'left-pinned', 0)).toBe(1);
        expect(columnNumber(parsed, 'middle-pinned', 1)).toBe(3);
        expect(columnNumber(parsed, 'right-pinned', 0)).toBe(4);
        expect(columnFields(parsed, [4, 3, 9])).toEqual(['notes', 'age', 'born']);
    });
});

describe('column selection - the mouse', () => {
    it('expect a click to select the column, Ctrl and Cmd to add one, Shift the ones between across the sections', async () => {
        const { element, gridInterface } = await mount();

        clickNumber(element, 2);
        expect(gridInterface.getSelectedColumns()).toEqual([2]);
        // from the center to the right pinned column: city, age + born, notes
        clickNumber(element, 4, { shiftKey: true });
        expect(gridInterface.getSelectedColumns()).toEqual([2, 3, 4]);
        expect(gridInterface.getLayoutFields({ selectedOnly: true })).toEqual(['city', 'age', 'born', 'notes']);
        // back to the left pinned one, from the same anchor
        clickNumber(element, 1, { shiftKey: true });
        expect(gridInterface.getSelectedColumns()).toEqual([1, 2]);

        clickNumber(element, 4, { ctrlKey: true });
        expect(gridInterface.getSelectedColumns()).toEqual([1, 2, 4]);
        // Cmd on a Mac
        clickNumber(element, 1, { metaKey: true });
        expect(gridInterface.getSelectedColumns()).toEqual([2, 4]);

        clickNumber(element, 3);
        expect(gridInterface.getSelectedColumns()).toEqual([3]);
    });

    it('expect the selected numbers to have the selected look, and the number clicked the focus', async () => {
        const { element } = await mount();

        clickNumber(element, 1);
        clickNumber(element, 3, { ctrlKey: true });

        expect(selectedLook(element)).toEqual([1, 3]);
        expect(document.activeElement).toBe(columnNumberCell(element, 3));
    });

    it('expect the number with the focus to keep it when the selection changes: rendered in place', async () => {
        const { element } = await mount();
        const cell = columnNumberCell(element, 2);

        clickNumber(element, 2);
        clickNumber(element, 2, { ctrlKey: true });

        expect(columnNumberCell(element, 2)).toBe(cell);
        expect(document.activeElement).toBe(cell);
        expect(selectedLook(element)).toEqual([]);
    });
});

describe('column selection - the API and the event', () => {
    it('expect selectColumns() to replace the selection, the numbers to show it, [] to select none', async () => {
        const { element, gridInterface } = await mount();

        gridInterface.selectColumns([4, 1, 4]);
        expect(gridInterface.getSelectedColumns()).toEqual([1, 4]);
        expect(selectedLook(element)).toEqual([1, 4]);

        gridInterface.selectColumns([]);
        expect(gridInterface.getSelectedColumns()).toEqual([]);
        expect(selectedLook(element)).toEqual([]);
    });

    it('expect getSelectedColumns() to give a copy', async () => {
        const { gridInterface } = await mount();
        gridInterface.selectColumns([2]);

        gridInterface.getSelectedColumns().push(3);

        expect(gridInterface.getSelectedColumns()).toEqual([2]);
    });

    it('expect a Shift+click after selectColumns() to select from the last number given', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.selectColumns([1, 2]);

        clickNumber(element, 4, { shiftKey: true });

        expect(gridInterface.getSelectedColumns()).toEqual([2, 3, 4]);
    });

    it('expect a TypeError for a number that is no column', async () => {
        const { gridInterface } = await mount();

        for (const wrong of [[0], [5], [1.5], ['1'], null]) {
            expect(() => gridInterface.selectColumns(wrong as any)).toThrow(TypeError);
        }
        expect(() => gridInterface.selectColumns([5])).toThrow('1 to 4');
        expect(gridInterface.getSelectedColumns()).toEqual([]);
    });

    it('expect column-selection-change with the numbers and their fields, only when they changed', async () => {
        const { element, gridInterface } = await mount();
        const seen: { columns: number[]; fields: string[] }[] = [];
        gridInterface.on('column-selection-change', (data) => seen.push(data));

        clickNumber(element, 3);
        clickNumber(element, 3);
        gridInterface.selectColumns([3]);
        clickNumber(element, 4, { shiftKey: true });
        gridInterface.selectColumns([]);
        gridInterface.selectColumns([]);

        expect(seen).toEqual([
            { columns: [3], fields: ['age', 'born'] },
            { columns: [3, 4], fields: ['age', 'born', 'notes'] },
            { columns: [], fields: [] }
        ]);
    });

    it('expect the selection cleared when the fields of the layout change, with the event, and kept on a resize', async () => {
        const { gridInterface } = await mount();
        const seen: number[][] = [];
        gridInterface.on('column-selection-change', ({ columns }) => seen.push(columns));
        gridInterface.selectColumns([2, 3]);

        // a column resized: the same columns
        const state = gridInterface.getState();
        state.layout.center[0].width = 150;
        gridInterface.setState({ layout: state.layout });
        expect(gridInterface.getSelectedColumns()).toEqual([2, 3]);

        // city hidden: number 2 is age + born now
        gridInterface.setState({ layout: { ...state.layout, center: [state.layout.center[1]] } });
        expect(gridInterface.getSelectedColumns()).toEqual([]);
        expect(seen).toEqual([[2, 3], []]);
    });

    it('expect the selection kept on a filter, a sort, grouping, a refresh and a rebuild: the columns are the same', async () => {
        const { element, datasource, gridInterface } = await mount();
        gridInterface.selectColumns([1]);

        datasource.filter(where('age', 'GREATER_THAN', 0));
        datasource.sort({ attribute: 'name', ascending: false });
        datasource.group([{ attribute: 'city', title: 'City' }]);
        gridInterface.refresh();
        gridInterface.rebuild();

        expect(gridInterface.getSelectedColumns()).toEqual([1]);
        // the header made again shows it
        expect(selectedLook(element)).toEqual([1]);
    });
});

describe('column selection - the keys on a number', () => {
    it('expect Ctrl+C and Cmd+C to copy the selected columns, every displayed row', async () => {
        const { element, gridInterface } = await mount();
        const written = stubExecCommand();
        clickNumber(element, 4);
        clickNumber(element, 1, { ctrlKey: true });

        const event = key(columnNumberCell(element, 1), 'c', { ctrlKey: true });
        key(columnNumberCell(element, 1), 'c', { metaKey: true });

        expect(event.defaultPrevented).toBe(true);
        expect(gridInterface.getSelectedColumns()).toEqual([1, 4]);
        const table = 'Full "name"\tNotes\r\nn0\tnote 0\r\nn1\tnote 1\r\nn2\tnote 2\r\nn3\tnote 3\r\n';
        // the header line of a copy quotes a label with a quote in it
        expect(written.map((copy) => copy.text)).toEqual(
            [table, table].map((text) => text.replace('Full "name"', '"Full ""name"""'))
        );
        expect(written[0].html).toContain('<th style="border:1px solid #999;padding:2px 4px">Full &quot;name&quot;</th>');
    });

    it("expect Ctrl+C with no column selected to copy the number's own column", async () => {
        const { element, gridInterface } = await mount({ copyHeaders: false });
        const written = stubExecCommand();
        clickNumber(element, 2);
        clickNumber(element, 2, { ctrlKey: true });
        expect(gridInterface.getSelectedColumns()).toEqual([]);

        key(columnNumberCell(element, 2), 'c', { ctrlKey: true });

        // a value with a tab in quotes, no header line
        expect(written.map((copy) => copy.text)).toEqual(['c0\r\n"Oslo\tWest"\r\nc2\r\nc3\r\n']);
    });

    it('expect Esc to select no column, and to be left to the menu while one is open', async () => {
        const { element, gridInterface } = await mount();
        clickNumber(element, 2);
        const cell = columnNumberCell(element, 2);

        openColumnMenu(element, 2);
        key(cell, 'Escape');
        // the menu closed, the column still selected
        expect(openMenus()).toEqual([]);
        expect(gridInterface.getSelectedColumns()).toEqual([2]);

        expect(key(cell, 'Escape').defaultPrevented).toBe(true);
        expect(gridInterface.getSelectedColumns()).toEqual([]);
        // nothing selected: the key is left alone
        expect(key(cell, 'Escape').defaultPrevented).toBe(false);
    });

    it('expect Shift+F10 on a number with the focus to open the column menu, the focus on its first item', async () => {
        const { element } = await mount();
        clickNumber(element, 3);
        const cell = columnNumberCell(element, 3);

        // the browser sends the key, then contextmenu to the element with the focus
        key(cell, 'F10', { shiftKey: true });
        cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

        expect(openMenus().length).toBe(1);
        expect(document.activeElement?.getAttribute('data-menu-id')).toEqual('column.select');
    });
});

describe('column selection - the column menu', () => {
    /** a grid whose column menu hands its defaults and context to `seen` and shows the defaults */
    async function mountCapturing(more: Partial<GridConfig> = {}) {
        const seen: { defaults: MenuEntry[]; context: MenuContext }[] = [];
        const menus: GridMenus = {
            column: (defaults, context) => {
                seen.push({ defaults, context });
                return defaults;
            }
        };
        const mounted = await mount(more, { menus });
        return { ...mounted, seen };
    }

    const disabled = (id: string) =>
        document.querySelector(`.simple-html-grid-menu [data-menu-id="${id}"]`)?.getAttribute('aria-disabled') === 'true';

    it('expect the entries of MENU_IDS.column on a right click on a number: Select ›, then the copies flat', async () => {
        const { element, seen } = await mountCapturing();

        openColumnMenu(element, 2);

        // a submenu, then what is in it
        const flatIds = (entries: MenuEntry[]): string[] =>
            entries.flatMap((entry) => [entry.id, ...(entry.type === 'submenu' ? flatIds(entry.entries) : [])]);
        expect(flatIds(seen[0].defaults)).toEqual(MENU_IDS.column);
        expect(seen[0].defaults.filter((entry) => entry.type === 'submenu').map((entry) => entry.id)).toEqual(['column.select']);
        expect(
            Array.from(document.querySelectorAll('.simple-html-grid-menu-item'), (item) =>
                item.textContent?.replace(/\s+/g, ' ').trim()
            )
        ).toEqual([
            'Select',
            'Copy column (all rows)',
            'Copy selected columns (all rows)',
            'Copy header names',
            'Copy header name',
            'Copy selected header names'
        ]);
        expect(menuTreeIds()).toEqual(MENU_IDS.column);
    });

    it('expect the context of the column right clicked: its first field, the first row, the cell', async () => {
        const { element, datasource, seen } = await mountCapturing();

        openColumnMenu(element, 3);

        const { context } = seen[0];
        expect(context.menu).toEqual('column');
        expect(context.field).toEqual('age');
        expect(context.row).toBe(datasource.getRow(0));
        expect(context.rowIndex).toBe(0);
        expect(context.cell).toBe(columnNumberCell(element, 3));
    });

    it('expect the entries of the selected columns greyed out with none selected, usable with one', async () => {
        const { element, gridInterface } = await mount();
        const selectionEntries = ['column.copy.selectedColumns', 'column.copy.selectedHeaders'];

        openColumnMenu(element, 2);
        expect(selectionEntries.map(disabled)).toEqual([true, true]);
        expect(['column.copy.column', 'column.copy.headers', 'column.copy.header'].map(disabled)).toEqual([false, false, false]);

        gridInterface.selectColumns([4]);
        openColumnMenu(element, 2);
        expect(selectionEntries.map(disabled)).toEqual([false, false]);
    });

    it('expect a right click not to change the selection', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.selectColumns([1]);

        openColumnMenu(element, 3);

        expect(gridInterface.getSelectedColumns()).toEqual([1]);
    });

    it('expect the hook to hide, change and add entries', async () => {
        const logged: string[] = [];
        const menus: GridMenus = {
            column: (defaults, context) => [
                ...defaults.filter((entry) => !entry.id.startsWith('column.copy.selected')),
                { id: 'my.log', label: 'Log', action: () => logged.push(context.field) }
            ]
        };
        const { element } = await mount({}, { menus });

        openColumnMenu(element, 4);
        expect(menuTreeIds()).toEqual([
            'column.select',
            'column.select.column',
            'column.select.columnsTo',
            'column.select.all',
            'column.select.clear',
            'column.copy.separator',
            'column.copy.column',
            'column.copy.namesSeparator',
            'column.copy.headers',
            'column.copy.header',
            'my.log'
        ]);
        clickEntry('my.log');
        expect(logged).toEqual(['notes']);
    });
});

describe('column selection - the copies of the column menu', () => {
    it('expect Copy column: the column of stacked fields, every displayed row, text and an html table with the labels', async () => {
        const { element } = await mount();
        const written = stubExecCommand();

        openColumnMenu(element, 3);
        clickEntry('column.copy.column');

        expect(written[0].text).toEqual('Age\tBorn\r\n0\t2026-01-01\r\n10\t2026-01-02\r\n20\t2026-01-03\r\n30\t2026-01-04\r\n');
        expect(written[0].html).toContain('<thead><tr><th style="border:1px solid #999;padding:2px 4px">Age</th>');
        expect(written[0].html).toContain(
            '<td style="border:1px solid #999;padding:2px 4px">2026-01-04</td></tr></tbody></table>'
        );
    });

    it('expect Copy column without the header line with copyHeaders: false, only the rows the filter lets through', async () => {
        const { element, datasource } = await mount({ copyHeaders: false });
        const written = stubExecCommand();
        datasource.filter(where('age', 'GREATER_THAN', 10));

        openColumnMenu(element, 4);
        clickEntry('column.copy.column');

        expect(written[0].text).toEqual('note 2\r\nnote 3\r\n');
        expect(written[0].html).not.toContain('<thead>');
    });

    it('expect the copies to leave out the group rows, and the rows of a collapsed group', async () => {
        const { element, datasource } = await mount({ copyHeaders: false });
        const written = stubExecCommand();
        datasource.getRow(2).notes = 'note 0';
        datasource.group([{ attribute: 'notes', title: 'Notes' }]);
        datasource.expandGroup();
        datasource.collapseGroup('note 0');

        openColumnMenu(element, 1);
        clickEntry('column.copy.column');

        expect(datasource.getRows().length).toBe(5);
        expect(written[0].text).toEqual('n1\r\nn3\r\n');
    });

    it('expect Copy selected columns: the selected columns in the order of the layout', async () => {
        const { element, gridInterface } = await mount();
        const written = stubExecCommand();
        gridInterface.selectColumns([4, 2]);

        openColumnMenu(element, 1);
        clickEntry('column.copy.selectedColumns');

        expect(written[0].text.split('\r\n').slice(0, 3)).toEqual(['City\tNotes', 'c0\tnote 0', '"Oslo\tWest"\tnote 1']);
        expect(written[0].html).toContain('<th style="border:1px solid #999;padding:2px 4px">Notes</th>');
    });

    it('expect the header names as one line of text, a tab between them, no line end and no html', async () => {
        const { element, gridInterface } = await mount();
        const written = stubExecCommand();
        gridInterface.selectColumns([3, 4]);

        openColumnMenu(element, 3);
        clickEntry('column.copy.headers');
        openColumnMenu(element, 3);
        clickEntry('column.copy.header');
        openColumnMenu(element, 1);
        clickEntry('column.copy.header');
        openColumnMenu(element, 1);
        clickEntry('column.copy.selectedHeaders');

        expect(written).toEqual([
            // every field of the layout; a label with a quote in quotes, as in the header line of a copy
            { text: '"Full ""name"""\tCity\tAge\tBorn\tNotes', html: '' },
            // a column of stacked fields: each of its labels
            { text: 'Age\tBorn', html: '' },
            { text: '"Full ""name"""', html: '' },
            { text: 'Age\tBorn\tNotes', html: '' }
        ]);
    });

    it('expect the header names with copyHeaders: false too: they are what is copied', async () => {
        const { element } = await mount({ copyHeaders: false });
        const written = stubExecCommand();

        openColumnMenu(element, 2);
        clickEntry('column.copy.header');

        expect(written).toEqual([{ text: 'City', html: '' }]);
    });

    it('expect a greyed out entry to copy nothing', async () => {
        const { element } = await mount();
        const written = stubExecCommand();

        openColumnMenu(element, 2);
        clickEntry('column.copy.selectedColumns');
        clickEntry('column.copy.selectedHeaders');

        expect(written).toEqual([]);
    });
});
