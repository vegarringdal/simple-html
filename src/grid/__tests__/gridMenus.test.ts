// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPopoverShown } from '../../__tests__/popoverStub';
import { where } from '../../datasource/filterExpression';
import type { GridElement } from '../gridElement';
import { SUBMENU_DELAY } from '../gridFunctions/showMenu';
import { type GridMenus, MENU_IDS, type MenuContext, type MenuEntry, type MenuItem } from '../gridMenus';
import { mountGrid, simpleConfig, simpleData, simpleFields, stubCanvas, stubElementSizes } from './gridTestHelpers';
import {
    gridOf,
    headerFilterInput,
    labelCell,
    menuEntry,
    menuItem,
    menuTreeIds,
    openFilterMenu,
    openLabelMenu,
    openMenus,
    openRowMenu,
    pointerEvent,
    sleep,
    valueCheckbox,
    valueRow
} from './interactionTestHelpers';

/**
 * Menus as data: the menus hook changes the grid's own menus, openMenu() / closeMenu() open and
 * close one of your own.
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

/**
 * the ids of what the open menu shows, in order - and its open submenus: items, submenus, sections
 * and separators carry data-menu-id, and so does the value list block
 */
function shownIds(): string[] {
    return Array.from(document.querySelectorAll('.simple-html-grid-menu [data-menu-id]')).map(
        (el) => el.getAttribute('data-menu-id') ?? ''
    );
}

function entry(id: string): HTMLElement {
    return document.querySelector(`.simple-html-grid-menu [data-menu-id="${id}"]`) as HTMLElement;
}

const menuOpen = () => document.querySelector('.simple-html-grid-menu') !== null;

/**
 * the ids of a tree of entries, a submenu before what is in it: the order of MENU_IDS
 */
const flatIds = (entries: MenuEntry[]): string[] =>
    entries.flatMap((entry) => [entry.id, ...(entry.type === 'submenu' ? flatIds(entry.entries) : [])]);

/**
 * the simple grid with the menus hook
 */
const mountMenus = (menus: GridMenus, config = simpleConfig()) => mountGrid(config, simpleData(), simpleFields(), { menus });

/**
 * an editable grid whose menus hand the defaults and the context to `seen` and show the defaults
 */
async function mountCapturing() {
    const seen: { defaults: MenuEntry[]; context: MenuContext }[] = [];
    const capture = (defaults: MenuEntry[], context: MenuContext) => {
        seen.push({ defaults, context });
        return defaults;
    };
    const mounted = await mountMenus({ row: capture, header: capture, filter: capture }, { ...simpleConfig(), readonly: false });
    return { ...mounted, seen };
}

describe('menus - the built-in ids', () => {
    it('expect the row menu defaults to be MENU_IDS.row, in order', async () => {
        const { element, seen } = await mountCapturing();

        openRowMenu(element, 'age', 0);

        expect(flatIds(seen[0].defaults)).toEqual(MENU_IDS.row);
    });

    it('expect the header menu defaults to be MENU_IDS.header, in order', async () => {
        const { element, seen } = await mountCapturing();

        openLabelMenu(element, 'age');

        expect(flatIds(seen[0].defaults)).toEqual(MENU_IDS.header);
    });

    it('expect the filter menu defaults to be MENU_IDS.filter, in order', async () => {
        const { element, seen } = await mountCapturing();

        openFilterMenu(element, 'firstname');

        expect(flatIds(seen[0].defaults)).toEqual(MENU_IDS.filter);
    });

    it('expect every id to be unique', () => {
        const all = [...MENU_IDS.row, ...MENU_IDS.header, ...MENU_IDS.filter, ...MENU_IDS.column];
        expect(new Set(all).size).toEqual(all.length);
    });

    it('expect the defaults of an editable number cell to show every row entry', async () => {
        const { element, datasource, gridInterface } = await mountGrid({ ...simpleConfig(), readonly: false });
        // undo is only shown when a selected row is marked for deletion
        datasource.getSelection().selectRowRange(0, 1);
        datasource.markForDeletion(datasource.getDataRows()[0]);
        // the range entries when there is a range of cells (marking rows clears the ranges)
        gridInterface.setRanges([{ fromRow: 0, fromField: 'firstname', toRow: 1, toField: 'age' }]);

        openRowMenu(element, 'age', 0);

        // every submenu opened in turn
        expect(menuTreeIds()).toEqual(MENU_IDS.row);
    });

    it('expect the entries that do not apply to be left out by their visible callback', async () => {
        // readonly grid (the default), text column
        const { element } = await mountGrid();

        openRowMenu(element, 'firstname', 0);

        // no editing in a readonly grid. The entries of a selection - the selected rows, the ranges of
        // cells - are listed without one, greyed out (see the next test)
        expect(menuTreeIds()).toEqual(MENU_IDS.row.filter((id) => !/^row\.(paste|clear|delete|edit)/.test(id)));
    });

    it('expect the entries of a selection greyed out without one, usable with one', async () => {
        const { element, datasource, gridInterface } = await mountGrid({ ...simpleConfig(), readonly: false });
        const disabled = (id: string) => menuEntry(id)?.getAttribute('aria-disabled') === 'true';
        const selectionEntries = [
            'row.copy.column',
            'row.copy.row',
            'row.copy.selectedColumns',
            'row.copy.range',
            'row.paste.cell',
            'row.paste.range',
            'row.clear.cell',
            'row.clear.range',
            'row.delete.rows',
            'row.size.fitRows'
        ];

        openRowMenu(element, 'firstname', 0);
        expect(selectionEntries.map(disabled)).toEqual(selectionEntries.map(() => true));
        // the cell right clicked: usable
        expect(['row.copy.cell', 'row.paste.current', 'row.clear.current', 'row.delete.row'].map(disabled)).toEqual([
            false,
            false,
            false,
            false
        ]);

        datasource.getSelection().selectRowRange(0, 1);
        gridInterface.setRanges([{ fromRow: 0, fromField: 'firstname', toRow: 1, toField: 'age' }]);
        openRowMenu(element, 'firstname', 0);
        expect(selectionEntries.map(disabled)).toEqual(selectionEntries.map(() => false));
    });

    it('expect the operators of a text column and the value list in the filter menu', async () => {
        const { element } = await mountGrid();

        openFilterMenu(element, 'firstname');

        // not the operators of a number, nor its range block
        const numberOnly = [
            'filter.operator.lessThan',
            'filter.operator.lessThanOrEqualTo',
            'filter.operator.greaterThan',
            'filter.operator.greaterThanOrEqualTo',
            'filter.operator.between',
            'filter.range'
        ];
        expect(menuTreeIds()).toEqual(MENU_IDS.filter.filter((id) => !numberOnly.includes(id)));
    });

    it('expect the range operators of a number column and its range block, without the value list', async () => {
        const { element } = await mountGrid();

        openFilterMenu(element, 'age');

        // not the operators of a text, Match case and the value list
        const textOnly = [
            'filter.operator.contains',
            'filter.operator.doesNotContain',
            'filter.operator.beginWith',
            'filter.operator.endWith',
            'filter.matchCase',
            'filter.values'
        ];
        expect(menuTreeIds()).toEqual(MENU_IDS.filter.filter((id) => !textOnly.includes(id)));
    });

    it('expect pin left and unpin to follow where the column is', async () => {
        const config = simpleConfig();
        config.layout.left = [{ fields: ['firstname'], width: 100 }];
        config.layout.center = [{ fields: ['age'], width: 100 }];
        const { element } = await mountGrid(config);

        openLabelMenu(element, 'firstname');
        expect(menuTreeIds()).not.toContain('header.column.pinLeft');
        expect(menuTreeIds()).toContain('header.column.unpin');

        openLabelMenu(element, 'age');
        expect(menuTreeIds()).toContain('header.column.pinLeft');
        expect(menuTreeIds()).not.toContain('header.column.unpin');
    });
});

describe('menus - rendered as before', () => {
    it('expect a section header with a solid line, a separator as a dashed line', async () => {
        const { element, gridInterface } = await mountGrid();

        gridInterface.openMenu({ x: 0, y: 0 }, [
            { type: 'section', id: 'test.section', label: 'Pick:' },
            { id: 'test.a', label: 'A', action: () => {} }
        ]);

        const section = entry('test.section');
        expect(section.className).toEqual('simple-html-grid-menu-section');
        expect(section.textContent?.trim()).toEqual('Pick:');
        expect((section.nextElementSibling as HTMLElement).className).toEqual('hr-solid');

        openLabelMenu(element, 'age');
        expect(entry('header.column.chooserSeparator').className).toEqual('hr-dashed');
    });

    it('expect the hint in italics after the label', async () => {
        const { element } = await mountGrid({ ...simpleConfig(), readonly: false });

        openRowMenu(element, 'age', 0);

        // greyed out without selected rows: the class of a disabled item too
        const paste = menuEntry('row.paste.cell');
        expect(paste.className).toEqual('simple-html-grid-menu-item simple-html-grid-menu-item-disabled');
        expect(paste.textContent?.replace(/\s+/g, ' ').trim()).toEqual('Paste cell (selected rows)');
        expect(paste.querySelector('i')?.textContent).toEqual('(selected rows)');
    });

    it('expect the operator in use to be shown selected', async () => {
        const { element } = await mountGrid();

        openFilterMenu(element, 'age');

        // the default of a number column, in the operator submenu: a ✓ (css), aria-checked
        const current = menuEntry('filter.operator.greaterThanOrEqualTo');
        expect(current.classList).toContain('simple-html-grid-menu-item-selected');
        expect(current.getAttribute('aria-checked')).toEqual('true');
        expect(entry('filter.operator.equal').classList).not.toContain('simple-html-grid-menu-item-selected');
        expect(entry('filter.operator.equal').getAttribute('aria-checked')).toEqual('false');
    });

    it('expect the menu on the body, in the grid style, shown as a manual popover', async () => {
        const { element } = await mountGrid();

        openRowMenu(element, 'age', 0);

        const menu = document.querySelector('.simple-html-grid-menu')?.parentElement as HTMLElement;
        expect(menu.parentElement).toBe(document.body);
        expect(menu.className).toEqual('simple-html-grid simple-html-grid-reset simple-html-grid-popover');
        // the top layer, without the browser's light dismiss: the grid closes it, see addMenuListeners
        expect(menu.getAttribute('popover')).toEqual('manual');
        expect(isPopoverShown(menu)).toBe(true);
        // position: absolute is in the css now (.simple-html-grid-popover)
        expect(menu.style.position).toEqual('');
        expect(menu.style.minWidth).toEqual('130px');
    });

    it('expect an item not to take the focus on mousedown', async () => {
        const { element } = await mountGrid();
        openRowMenu(element, 'age', 0);

        const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        menuEntry('row.copy.cell').dispatchEvent(down);

        // the focus stays on the cell, and goes back there from a dialog an item opens
        expect(down.defaultPrevented).toBe(true);
    });
});

describe('menus - the menus hook', () => {
    it('expect a built-in entry in a submenu to be hidden, the submenu changed with map', async () => {
        const menus: GridMenus = {
            row: (defaults) =>
                defaults.map((e) =>
                    e.type === 'submenu' && e.id === 'row.copy'
                        ? { ...e, entries: e.entries.filter((inner) => inner.id !== 'row.copy.cell') }
                        : e
                )
        };
        const { element } = await mountMenus(menus);

        openRowMenu(element, 'firstname', 0);

        expect(menuTreeIds()).not.toContain('row.copy.cell');
        expect(menuTreeIds()).toContain('row.copy.column');
        expect(menuItem('Cell Value')).toBeUndefined();
    });

    it('expect a filter on the id prefix to hide a submenu with what is in it', async () => {
        const menus: GridMenus = { row: (defaults) => defaults.filter((e) => !e.id.startsWith('row.copy')) };
        const { element } = await mountMenus(menus);

        openRowMenu(element, 'firstname', 0);

        expect(menuTreeIds().filter((id) => id.startsWith('row.copy'))).toEqual([]);
        expect(menuTreeIds()).toContain('row.filter.replace');
    });

    it('expect an entry of your own in a submenu to get the context', async () => {
        const action = vi.fn();
        const menus: GridMenus = {
            header: (defaults) =>
                defaults.map((e) =>
                    e.type === 'submenu' && e.id === 'header.size'
                        ? { ...e, entries: [...e.entries, { id: 'test.wide', label: 'Wide', action }] }
                        : e
                )
        };
        const { element } = await mountMenus(menus);

        openLabelMenu(element, 'age');
        expect(menuTreeIds().filter((id) => id.startsWith('header.size') || id.startsWith('test'))).toEqual([
            'header.size',
            'header.size.column',
            'header.size.all',
            'header.size.resetColumn',
            'header.size.resetAll',
            'test.wide'
        ]);
        menuEntry('test.wide').click();

        expect(action.mock.calls[0][0].field).toEqual('age');
        expect(menuOpen()).toBe(false);
    });

    it('expect the entries to be shown in the order returned', async () => {
        const menus: GridMenus = {
            filter: (defaults) => [
                ...defaults.filter((e) => e.id === 'filter.values'),
                ...defaults.filter((e) => e.id === 'filter.filter')
            ]
        };
        const { element } = await mountMenus(menus);

        openFilterMenu(element, 'firstname');

        expect(shownIds()).toEqual(['filter.values', 'filter.filter']);
        // the value list still works where it was moved to
        expect(menuItem('Apply')).toBeDefined();
    });

    it('expect a label to be changed and the entry to keep its action', async () => {
        const menus: GridMenus = {
            header: (defaults) => defaults.map((e) => (e.id === 'header.column.hide' ? { ...e, label: 'Take away' } : e))
        };
        const { element, gridInterface } = await mountMenus(menus);

        openLabelMenu(element, 'age');
        menuItem('Take away').click();

        expect(gridInterface.getLayoutFields()).toEqual(['firstname', 'lastname']);
    });

    it('expect a custom entry in the row menu to get the context of the cell', async () => {
        const action = vi.fn();
        const menus: GridMenus = { row: (defaults) => [...defaults, { id: 'test.custom', label: 'Custom', action }] };
        const { element, gridInterface, datasource } = await mountMenus(menus);
        const input = element.querySelectorAll('input[data-attribute="age"]')[2] as HTMLElement;

        openRowMenu(element, 'age', 2);
        menuItem('Custom').click();

        expect(action).toHaveBeenCalledTimes(1);
        const context: MenuContext = action.mock.calls[0][0];
        expect(context.menu).toEqual('row');
        expect(context.field).toEqual('age');
        expect(context.rowIndex).toEqual(2);
        expect(context.row).toBe(datasource.getRows()[2]);
        expect(context.cell?.contains(input)).toBe(true);
        expect(context.gridInterface).toBe(gridInterface);
        expect(context.datasource).toBe(datasource);
        // clicking an item closes the menu
        expect(menuOpen()).toBe(false);
    });

    it('expect the menus function to get the same context the entries get', async () => {
        let given: MenuContext | null = null;
        const action = vi.fn();
        const menus: GridMenus = {
            header: (defaults, context) => {
                given = context;
                return [{ id: 'test.custom', label: 'Custom', action }, ...defaults];
            }
        };
        const { element, datasource } = await mountMenus(menus);

        openLabelMenu(element, 'lastname');
        menuItem('Custom').click();

        expect(action.mock.calls[0][0]).toBe(given);
        const context = action.mock.calls[0][0] as MenuContext;
        expect(context.menu).toEqual('header');
        expect(context.field).toEqual('lastname');
        expect(context.rowIndex).toEqual(0);
        // the first displayed row
        expect(context.row).toBe(datasource.getRows()[0]);
    });

    it('expect the filter menu context to name the column', async () => {
        const action = vi.fn();
        const menus: GridMenus = { filter: (defaults) => [...defaults, { id: 'test.custom', label: 'Custom', action }] };
        const { element } = await mountMenus(menus);

        openFilterMenu(element, 'firstname');
        menuItem('Custom').click();

        const context = action.mock.calls[0][0] as MenuContext;
        expect(context.menu).toEqual('filter');
        expect(context.field).toEqual('firstname');
        expect(context.cell?.contains(headerFilterInput(element, 'firstname'))).toBe(true);
    });

    it('expect the header and filter menu contexts to have the first row displayed when they open, after a filter too', async () => {
        const rows: unknown[] = [];
        const menus: GridMenus = {
            header: (defaults, context) => {
                rows.push(context.row);
                return defaults;
            },
            filter: (defaults, context) => {
                rows.push(context.row);
                return defaults;
            }
        };
        const { element, datasource } = await mountMenus(menus);

        // the header is not rendered again for a filter: the menus got the row it was rendered with
        datasource.filter(where('firstname', 'EQUAL', 'first3'));
        openLabelMenu(element, 'lastname');
        openFilterMenu(element, 'lastname');

        expect(rows).toEqual([datasource.getRow(0), datasource.getRow(0)]);
        expect((datasource.getRow(0) as { firstname: string }).firstname).toEqual('first3');
    });

    it('expect visible: false to leave an entry out, called with the context', async () => {
        const visible = vi.fn((context: MenuContext) => context.field === 'age');
        const custom: MenuItem = { id: 'test.custom', label: 'Custom', action: () => {}, visible };
        const { element } = await mountMenus({ row: (defaults) => [...defaults, custom] });

        openRowMenu(element, 'firstname', 0);
        expect(shownIds()).not.toContain('test.custom');
        expect(visible.mock.calls[0][0].field).toEqual('firstname');

        openRowMenu(element, 'age', 0);
        expect(shownIds()).toContain('test.custom');
    });

    it('expect a disabled entry to be shown greyed out, and clicking it to do nothing', async () => {
        const action = vi.fn();
        const menus: GridMenus = {
            row: (defaults) => [...defaults, { id: 'test.custom', label: 'Custom', action, disabled: () => true }]
        };
        const { element } = await mountMenus(menus);

        openRowMenu(element, 'firstname', 0);
        const custom = entry('test.custom');
        expect(custom.classList).toContain('simple-html-grid-menu-item-disabled');
        expect(custom.getAttribute('aria-disabled')).toEqual('true');

        custom.click();

        expect(action).not.toHaveBeenCalled();
        expect(menuOpen()).toBe(true);
    });

    it('expect an entry that is not disabled to have no aria-disabled', async () => {
        const menus: GridMenus = {
            row: (defaults) => [...defaults, { id: 'test.custom', label: 'Custom', action: () => {}, disabled: () => false }]
        };
        const { element } = await mountMenus(menus);

        openRowMenu(element, 'firstname', 0);

        expect(entry('test.custom').classList).not.toContain('simple-html-grid-menu-item-disabled');
        expect(entry('test.custom').hasAttribute('aria-disabled')).toBe(false);
    });

    it('expect a built-in entry to keep working when the list is rebuilt around it', async () => {
        const menus: GridMenus = {
            // the replace entry out of its submenu, under a section of its own
            row: (defaults) => [
                { type: 'section', id: 'test.section', label: 'First:' },
                ...defaults.flatMap((e) => (e.type === 'submenu' ? e.entries : [e])).filter((e) => e.id === 'row.filter.replace')
            ]
        };
        const { element, datasource } = await mountMenus(menus);

        openRowMenu(element, 'firstname', 1);
        expect(shownIds()).toEqual(['test.section', 'row.filter.replace']);
        menuItem('Replace filter').click();

        expect(datasource.getDataRows().map((row) => row.firstname)).toEqual(['first2']);
    });

    it('expect updateHooks() to change the menus, undefined to give back the defaults', async () => {
        const { element, gridInterface } = await mountGrid();

        gridInterface.updateHooks({ menus: { header: () => [{ id: 'test.only', label: 'Only', action: () => {} }] } });
        openLabelMenu(element, 'age');
        expect(shownIds()).toEqual(['test.only']);

        gridInterface.updateHooks({ menus: undefined });
        openLabelMenu(element, 'age');
        // a number column: Format › has the number formats, not the date formats and their lines
        const dateOnly = ['header.format.timeSeparator', 'header.format.partSeparator'];
        expect(menuTreeIds()).toEqual(
            MENU_IDS.header.filter(
                (id) => id !== 'header.column.unpin' && !id.startsWith('header.format.date.') && !dateOnly.includes(id)
            )
        );
    });

    it('expect an action that opens a menu to leave that menu open', async () => {
        const { element, gridInterface } = await mountMenus({
            row: (defaults) => [
                ...defaults,
                {
                    id: 'test.submenu',
                    label: 'More',
                    action: () =>
                        gridInterface.openMenu({ x: 10, y: 10 }, [{ id: 'test.inner', label: 'Inner', action: () => {} }])
                }
            ]
        });

        openRowMenu(element, 'firstname', 0);
        menuItem('More').click();

        expect(shownIds()).toEqual(['test.inner']);
    });
});

describe('menus - openMenu() and closeMenu()', () => {
    const entries = (action = vi.fn()): MenuEntry[] => [
        { type: 'section', id: 'test.section', label: 'Pick:' },
        { id: 'test.a', label: 'A', action },
        { type: 'separator', id: 'test.separator' },
        { id: 'test.b', label: 'B', hint: 'second', action }
    ];

    it('expect the entries to be shown at the mouse', async () => {
        const { gridInterface } = await mountGrid();
        // a menu of 150 x 100 where its style puts it (the size stub makes every element 1000 wide)
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            return new DOMRect(parseFloat(this.style.left) || 0, parseFloat(this.style.top) || 0, 150, 100);
        });

        gridInterface.openMenu(new MouseEvent('click', { clientX: 40, clientY: 30 }), entries());

        expect(shownIds()).toEqual(['test.section', 'test.a', 'test.separator', 'test.b']);
        const menu = document.querySelector('.simple-html-grid-menu')?.parentElement as HTMLElement;
        expect(menu.style.left).toEqual('40px');
        expect(menu.style.top).toEqual('30px');
    });

    it('expect a position to place the menu', async () => {
        const { gridInterface } = await mountGrid();

        gridInterface.openMenu({ x: 15, y: 25 }, entries());

        const menu = document.querySelector('.simple-html-grid-menu')?.parentElement as HTMLElement;
        expect(menu.style.left).toEqual('15px');
        expect(menu.style.top).toEqual('25px');
    });

    it('expect an element to place the menu under it', async () => {
        const { gridInterface } = await mountGrid();
        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 50, 80, 20));

        gridInterface.openMenu(anchor, entries());

        const menu = document.querySelector('.simple-html-grid-menu')?.parentElement as HTMLElement;
        expect(menu.style.left).toEqual('20px');
        // under the element, 2px apart as the grid's own menus
        expect(menu.style.top).toEqual('72px');
    });

    it('expect a menu that does not fit below to open above the point, and to be moved in from the right', async () => {
        const { gridInterface } = await mountGrid();
        // the menu is 150 x 100, where its style puts it
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            const left = parseFloat(this.style.left) || 0;
            const top = parseFloat(this.style.top) || 0;
            return new DOMRect(left, top, 150, 100);
        });

        gridInterface.openMenu({ x: window.innerWidth - 50, y: window.innerHeight - 20 }, entries());

        const menu = document.querySelector('.simple-html-grid-menu')?.parentElement as HTMLElement;
        expect(menu.style.top).toEqual(`${window.innerHeight - 20 - 100}px`);
        // 4px from the window's edge
        expect(menu.style.left).toEqual(`${window.innerWidth - 150 - 4}px`);
    });

    describe('a menu taller than the room below and above the point', () => {
        /** the menu is 150 wide and `height` tall - or its max-height, which makes it scroll */
        const menuSize = (height: number) =>
            vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
                const left = parseFloat(this.style.left) || 0;
                const top = parseFloat(this.style.top) || 0;
                const max = parseFloat(this.style.maxHeight);
                return new DOMRect(left, top, 150, Number.isNaN(max) ? height : Math.min(height, max));
            });
        const shownMenu = () => document.querySelector('.simple-html-grid-menu')?.parentElement as HTMLElement;

        it('expect it next to the point, on its right, moved up just as far as it has to', async () => {
            const { gridInterface } = await mountGrid();
            const height = window.innerHeight - 100;
            menuSize(height);

            // at the middle of the window: no room for it below, none above
            gridInterface.openMenu({ x: 200, y: window.innerHeight / 2 }, entries());

            expect(shownMenu().style.left).toEqual('202px');
            expect(shownMenu().style.top).toEqual(`${window.innerHeight - 4 - height}px`);
            expect(shownMenu().style.overflowY).toEqual('');
        });

        it('expect it on the left of the point when there is no room on its right', async () => {
            const { gridInterface } = await mountGrid();
            menuSize(window.innerHeight - 100);

            gridInterface.openMenu({ x: window.innerWidth - 60, y: window.innerHeight / 2 }, entries());

            expect(shownMenu().style.left).toEqual(`${window.innerWidth - 60 - 2 - 150}px`);
        });

        it('expect one taller than the window to be as tall as the window, and scroll', async () => {
            const { gridInterface } = await mountGrid();
            menuSize(window.innerHeight * 2);

            gridInterface.openMenu({ x: 200, y: 300 }, entries());

            expect(shownMenu().style.maxHeight).toEqual(`${window.innerHeight - 8}px`);
            expect(shownMenu().style.overflowY).toEqual('auto');
            expect(shownMenu().style.top).toEqual('4px');
        });

        it('expect a menu that fits to have no max-height: the scroll box would cut its shadow', async () => {
            const { gridInterface } = await mountGrid();
            menuSize(window.innerHeight * 2);
            gridInterface.openMenu({ x: 200, y: 300 }, entries());
            menuSize(100);

            gridInterface.openMenu({ x: 200, y: 300 }, entries());

            expect(shownMenu().style.maxHeight).toEqual('');
            expect(shownMenu().style.top).toEqual('300px');
        });

        it('expect it never past the left edge of the window', async () => {
            const { gridInterface } = await mountGrid();
            menuSize(100);

            gridInterface.openMenu({ x: -50, y: 300 }, entries());

            expect(shownMenu().style.left).toEqual('4px');
        });
    });

    it('expect an item click to close the menu and call the action with a custom context', async () => {
        const action = vi.fn();
        const { gridInterface, datasource } = await mountGrid();

        gridInterface.openMenu({ x: 0, y: 0 }, entries(action));
        menuItem('B').click();

        expect(menuOpen()).toBe(false);
        const context: MenuContext = action.mock.calls[0][0];
        expect(context).toEqual({
            menu: 'custom',
            field: '',
            row: undefined,
            rowIndex: -1,
            cell: undefined,
            gridInterface,
            datasource
        });
    });

    it('expect closeMenu() to close it', async () => {
        const { gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, entries());

        gridInterface.closeMenu();

        expect(menuOpen()).toBe(false);
        expect(() => gridInterface.closeMenu()).not.toThrow();
    });

    it("expect closeMenu() to close the grid's own menus too", async () => {
        const { element, gridInterface } = await mountGrid();
        openRowMenu(element, 'age', 0);

        gridInterface.closeMenu();

        expect(menuOpen()).toBe(false);
    });

    it('expect one menu at a time: openMenu() closes the row menu, the row menu closes it', async () => {
        const { element, gridInterface } = await mountGrid();

        openRowMenu(element, 'age', 0);
        gridInterface.openMenu({ x: 0, y: 0 }, entries());
        expect(document.querySelectorAll('.simple-html-grid-menu')).toHaveLength(1);
        expect(shownIds()).toContain('test.a');

        openRowMenu(element, 'age', 0);
        expect(document.querySelectorAll('.simple-html-grid-menu')).toHaveLength(1);
        expect(shownIds()).not.toContain('test.a');
    });

    it('expect a click outside to close it, a click in it not', async () => {
        const { gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, entries());
        await sleep(0);

        entry('test.section').click();
        expect(menuOpen()).toBe(true);

        document.body.click();
        expect(menuOpen()).toBe(false);
    });

    it('expect a finger touching outside to close it at once (no click comes for a swipe), a touch in it or a mouse press not', async () => {
        const { gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, entries());
        await sleep(0);

        entry('test.section').dispatchEvent(pointerEvent('pointerdown', { pointerType: 'touch' }));
        document.body.dispatchEvent(pointerEvent('pointerdown'));
        expect(menuOpen()).toBe(true);

        document.body.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'touch' }));
        expect(menuOpen()).toBe(false);
    });

    it('expect the click that opened it not to close it', async () => {
        const { gridInterface } = await mountGrid();
        const button = document.createElement('button');
        document.body.appendChild(button);
        button.addEventListener('click', (e) => gridInterface.openMenu(e, entries()));

        // the click bubbles on to the document after the handler opened the menu
        button.click();
        expect(menuOpen()).toBe(true);

        // the next click outside does close it
        await sleep(0);
        document.body.click();
        expect(menuOpen()).toBe(false);
    });

    it('expect a scroll to close it with autoRemoveContextMenuOnScrollEvent', async () => {
        const { element, gridInterface } = await mountGrid({ ...simpleConfig(), autoRemoveContextMenuOnScrollEvent: true });
        gridInterface.openMenu({ x: 0, y: 0 }, entries());

        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        scroller.dispatchEvent(new Event('scroll'));

        expect(menuOpen()).toBe(false);
    });

    it('expect removing the grid to close it', async () => {
        const { element, gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, entries());

        element.remove();

        expect(menuOpen()).toBe(false);
    });

    it('expect a page that is scrolled to be added to the place: a menu moves with the page', async () => {
        const { gridInterface } = await mountGrid();
        window.scrollTo(30, 200);

        gridInterface.openMenu({ x: 15, y: 25 }, entries());

        const menu = document.querySelector('.simple-html-grid-menu')?.parentElement as HTMLElement;
        expect([menu.style.left, menu.style.top]).toEqual(['45px', '225px']);
        window.scrollTo(0, 0);
    });

    it('expect a menu opened from an element in a dialog to be put in the dialog', async () => {
        const { gridInterface } = await mountGrid();
        // a modal dialog makes everything outside it inert: a menu on the body could not be clicked
        const dialog = document.createElement('dialog');
        const button = document.createElement('button');
        dialog.appendChild(button);
        document.body.appendChild(dialog);
        dialog.showModal();

        gridInterface.openMenu(button, entries());

        const menu = document.querySelector('.simple-html-grid-menu')?.parentElement as HTMLElement;
        expect(menu.parentElement).toBe(dialog);
        expect(isPopoverShown(menu)).toBe(true);
    });

    it('expect a menu opened from an element in a popover of the page to be put in the popover', async () => {
        const { gridInterface } = await mountGrid();
        // a click in a menu outside a popover="auto" would close that popover
        const popover = document.createElement('div');
        popover.popover = 'auto';
        const button = document.createElement('button');
        popover.appendChild(button);
        document.body.appendChild(popover);

        button.addEventListener('click', (event) => gridInterface.openMenu(event, entries()));
        button.click();

        const menu = document.querySelector('.simple-html-grid-menu')?.parentElement as HTMLElement;
        expect(menu.parentElement).toBe(popover);
    });
});

describe('menus - Esc', () => {
    const entries = (): MenuEntry[] => [{ id: 'test.a', label: 'A', action: () => {} }];
    const esc = () => new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

    it('expect Esc to close the menu, and to be canceled so nothing else closes on it', async () => {
        const { gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, entries());

        const event = esc();
        document.body.dispatchEvent(event);

        expect(menuOpen()).toBe(false);
        // a modal dialog behind the menu - the filter editor - stays open
        expect(event.defaultPrevented).toBe(true);
    });

    it("expect Esc to close the grid's own menus", async () => {
        const { element } = await mountGrid();
        openFilterMenu(element, 'firstname');

        headerFilterInput(element, 'firstname').dispatchEvent(esc());

        expect(menuOpen()).toBe(false);
    });

    it('expect Esc with no menu open, another key, or an Esc used already, to change nothing', async () => {
        const { gridInterface } = await mountGrid();
        const none = esc();
        document.body.dispatchEvent(none);
        expect(none.defaultPrevented).toBe(false);

        gridInterface.openMenu({ x: 0, y: 0 }, entries());
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(menuOpen()).toBe(true);

        const used = esc();
        used.preventDefault();
        document.body.dispatchEvent(used);
        expect(menuOpen()).toBe(true);
    });

    it('expect the focus to go back to the cell when the menu closes with the focus in it', async () => {
        const { element } = await mountGrid();
        const cell = headerFilterInput(element, 'firstname');
        cell.focus();
        openFilterMenu(element, 'firstname');
        // the search field of the value list
        const search = document.querySelector('.simple-html-grid-menu input') as HTMLInputElement;
        search.focus();
        expect(document.activeElement).toBe(search);

        document.body.dispatchEvent(esc());

        expect(menuOpen()).toBe(false);
        expect(document.activeElement).toBe(cell);
    });

    it('expect the focus to be left where it is when it was not in the menu', async () => {
        const { element, gridInterface } = await mountGrid();
        const cell = headerFilterInput(element, 'firstname');
        cell.focus();
        gridInterface.openMenu({ x: 0, y: 0 }, entries());
        const other = headerFilterInput(element, 'age');
        other.focus();

        gridInterface.closeMenu();

        expect(document.activeElement).toBe(other);
    });

    it('expect the listeners on the document to be removed with the grid', async () => {
        const { element, gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, entries());
        const menu = document.querySelector('.simple-html-grid-menu')?.parentElement as HTMLElement;
        element.remove();
        // put back on the page by hand: no grid listens anymore
        document.body.appendChild(menu);

        document.body.dispatchEvent(esc());
        document.body.click();

        expect(menu.isConnected).toBe(true);
    });

    it('expect nothing to happen while the grid is not on the page', async () => {
        const { element, gridInterface } = await mountGrid();
        element.remove();

        gridInterface.openMenu({ x: 0, y: 0 }, entries());

        expect(menuOpen()).toBe(false);
    });
});

describe('menus - a block of your own (a dropdown grid)', () => {
    /**
     * a second grid, placed as the samples do, opened as a block under a cell of the first
     */
    async function openDropdown() {
        const main = await mountGrid();
        const dropdownGrid = await mountGrid({ layout: { center: [{ fields: ['company'], width: 100 }] } }, [
            { company: 'ACME' },
            { company: 'GLOBEX' }
        ]);
        const dropdown: GridElement = dropdownGrid.element;
        dropdown.remove(); // made by mountGrid on the body, openMenu() puts it in the menu
        const cell = main.element.querySelector('input[data-attribute="age"]') as HTMLElement;

        main.gridInterface.openMenu(cell, [{ type: 'block', id: 'test.dropdown', element: dropdown }]);
        await sleep(0);
        return { main, dropdown, dropdownGrid };
    }

    it('expect the element to be shown in the menu, and its grid to work there', async () => {
        const { dropdown, dropdownGrid } = await openDropdown();

        expect(dropdown.parentElement?.className).toEqual('simple-html-grid-menu');
        expect(dropdown.isConnected).toBe(true);
        expect(dropdownGrid.gridInterface.getLayoutFields()).toEqual(['company']);
        expect(dropdown.querySelectorAll('input[data-attribute="company"]').length).toBeGreaterThan(0);
    });

    it('expect a click in the element not to close the menu', async () => {
        const { dropdown } = await openDropdown();

        (dropdown.querySelector('input[data-attribute="company"]') as HTMLElement).click();

        expect(dropdown.isConnected).toBe(true);
    });

    it('expect a click outside to close it, and disconnect the dropdown grid', async () => {
        const { dropdown, dropdownGrid } = await openDropdown();

        document.body.click();

        expect(dropdown.isConnected).toBe(false);
        expect(dropdownGrid.gridInterface.__isConnected()).toBe(false);
    });

    it('expect closeMenu() to close it, as the samples do after a pick', async () => {
        const { main, dropdown } = await openDropdown();

        main.gridInterface.closeMenu();

        expect(dropdown.isConnected).toBe(false);
    });

    it("expect the dropdown grid's own menu to open on the body, over it, and to leave it open", async () => {
        const { main, dropdown } = await openDropdown();
        const outer = dropdown.parentElement?.parentElement as HTMLElement;

        openRowMenu(dropdown, 'company', 0);

        // a manual popover too, shown after it: over it in the top layer
        const inner = Array.from(document.querySelectorAll('.simple-html-grid-popover')).find((menu) => menu !== outer);
        expect(inner?.parentElement).toBe(document.body);
        expect(isPopoverShown(inner ?? null)).toBe(true);
        expect(isPopoverShown(outer)).toBe(true);
        expect(dropdown.isConnected).toBe(true);

        // the dropdown grid leaves the page with the outer menu, and closes its own
        main.gridInterface.closeMenu();
        expect(inner?.isConnected).toBe(false);
    });

    it("expect the grid's own menus to close it", async () => {
        const { main, dropdown } = await openDropdown();

        openRowMenu(main.element, 'firstname', 0);

        expect(dropdown.isConnected).toBe(false);
        expect(shownIds()).toContain('row.copy');
    });
});

describe('menus - the value list block', () => {
    it('expect it to be hidden or moved as one entry', async () => {
        const menus: GridMenus = { filter: (defaults) => defaults.filter((e) => e.id !== 'filter.values') };
        const { element } = await mountMenus(menus);

        openFilterMenu(element, 'firstname');

        expect(document.querySelector('.simple-html-grid-value-row')).toBeNull();
        expect(document.querySelector('[data-menu-id="filter.values"]')).toBeNull();
        expect(menuItem('Apply')).toBeUndefined();
        expect(menuItem('Clear Filter')).toBeDefined();
    });

    it('expect checking values to render the block again, not the rest of the menu', async () => {
        const { element } = await mountGrid();
        openFilterMenu(element, 'firstname');
        const clear = entry('filter.filter.clear');

        valueRow('first1').click();

        expect(valueCheckbox('first1').checked).toBe(false);
        // the same element: the menu was not rendered again
        expect(entry('filter.filter.clear')).toBe(clear);
        expect(menuOpen()).toBe(true);
    });
});

describe('menus - the column chooser', () => {
    /** opens the column chooser from the header menu */
    async function openChooser() {
        const mounted = await mountGrid();
        openLabelMenu(mounted.element, 'age');
        menuItem('Column chooser').click();
        const chooser = document
            .querySelector('.simple-html-label-button-menu-bottom')
            ?.closest('.simple-html-grid') as HTMLElement;
        return { ...mounted, chooser };
    }

    it('expect a manual popover of its own on the body, next to the menus', async () => {
        const { chooser } = await openChooser();

        expect(chooser.parentElement).toBe(document.body);
        expect(chooser.className).toEqual('simple-html-grid simple-html-grid-reset simple-html-grid-popover');
        expect(chooser.popover).toEqual('manual');
        expect(isPopoverShown(chooser)).toBe(true);
    });

    it('expect it to stay open on a click outside, another menu and Esc outside it: columns are dragged from it', async () => {
        const { element, chooser } = await openChooser();
        await sleep(0);

        document.body.click();
        openRowMenu(element, 'age', 0);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

        expect(chooser.isConnected).toBe(true);
        // that Esc closed the row menu
        expect(shownIds()).toEqual([]);
    });

    it('expect Esc in its search field to close it, and the focus to go back', async () => {
        const { element } = await mountGrid();
        // where the focus was before the header menu: an item does not take it
        const cell = headerFilterInput(element, 'age');
        cell.focus();
        openLabelMenu(element, 'age');
        menuItem('Column chooser').click();
        const chooser = gridOf(element).columnChooserMenu as HTMLElement;
        const search = chooser.querySelector('input') as HTMLInputElement;
        search.focus();

        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        search.dispatchEvent(esc);

        expect(chooser.isConnected).toBe(false);
        expect(esc.defaultPrevented).toBe(true);
        expect(gridOf(element).columnChooserMenu).toBeNull();
        expect(document.activeElement).toBe(cell);
    });

    it('expect its fields to let a finger scroll the list (pan-y): a held field drags, see columnDragDrop.test.ts', async () => {
        const { chooser } = await openChooser();
        const fields = Array.from(
            chooser.querySelectorAll<HTMLElement>('.simple-html-grid-menu-sub .simple-html-grid-menu-item')
        );

        expect(fields.length).toBeGreaterThan(0);
        expect(fields.every((field) => field.style.touchAction === 'pan-y')).toBe(true);
    });

    it('expect its Close button to close it', async () => {
        const { element, chooser } = await openChooser();

        menuItem('Close').click();

        expect(chooser.isConnected).toBe(false);
        expect(gridOf(element).columnChooserMenu).toBeNull();
    });

    it('expect one at a time, and removing the grid to close it', async () => {
        const { element, chooser } = await openChooser();
        openLabelMenu(element, 'age');
        menuItem('Column chooser').click();

        expect(chooser.isConnected).toBe(false);
        const second = gridOf(element).columnChooserMenu as HTMLElement;
        expect(second.isConnected).toBe(true);

        element.remove();
        expect(second.isConnected).toBe(false);
    });
});

describe('menus - the default menus, short', () => {
    it('expect the row menu: the edit entries and a line, then a submenu per part', async () => {
        const { element, datasource, gridInterface } = await mountGrid({ ...simpleConfig(), readonly: false });
        datasource.getSelection().selectRowRange(0, 1);
        datasource.markForDeletion(datasource.getDataRows()[0]);
        gridInterface.setRanges([{ fromRow: 0, fromField: 'firstname', toRow: 1, toField: 'age' }]);

        openRowMenu(element, 'age', 0);

        // no submenu open: what the menu itself shows, 10 rows - 35 before the submenus
        expect(shownIds()).toEqual([
            'row.edit',
            'row.select',
            'row.copy',
            'row.paste',
            'row.clear',
            'row.delete',
            'row.filter',
            'row.view',
            'row.size',
            'row.export'
        ]);
    });

    it('expect the row menu of a readonly text cell to be its submenus only', async () => {
        const { element } = await mountGrid();

        openRowMenu(element, 'firstname', 0);

        expect(shownIds()).toEqual(['row.select', 'row.copy', 'row.filter', 'row.view', 'row.size', 'row.export']);
    });

    it('expect the header menu: pin, hide, remove sorting, the column chooser, then the submenus', async () => {
        const { element } = await mountGrid();

        openLabelMenu(element, 'age');

        expect(shownIds()).toEqual([
            'header.column.pin',
            'header.column.hide',
            'header.column.removeSorting',
            'header.column.chooserSeparator',
            'header.column.chooser',
            'header.size',
            'header.format',
            'header.settings',
            'header.aggregate',
            'header.grouping'
        ]);
    });

    it('expect the filter menu: the Filter submenu, then the value list', async () => {
        const { element } = await mountGrid();

        openFilterMenu(element, 'firstname');

        expect(shownIds()).toEqual(['filter.filter', 'filter.values']);
        expect(entry('filter.filter').textContent?.trim()).toEqual('Filter');
        expect(entry('filter.filter').getAttribute('aria-haspopup')).toEqual('menu');
    });

    it('expect in Filter: the operator and blank submenus, clear, clear all, a line, the filter editor', async () => {
        const { element } = await mountGrid();
        openFilterMenu(element, 'firstname');

        entry('filter.filter').click();

        const submenu = openMenus()[1];
        expect(Array.from(submenu.children, (child) => child.getAttribute('data-menu-id'))).toEqual([
            'filter.operator',
            'filter.matchCase',
            'filter.filterOnType',
            'filter.filter.blank',
            'filter.filter.clear',
            'filter.filter.clearAll',
            'filter.filter.advancedSeparator',
            'filter.filter.advanced'
        ]);
        expect(submenu.getAttribute('aria-labelledby')).toEqual(entry('filter.filter').id);
        // the operator in use has its ✓ one level deeper
        entry('filter.operator').click();
        expect(openMenus()).toHaveLength(3);
        expect(openMenus()[2].querySelector('[aria-checked="true"]')?.getAttribute('data-menu-id')).toEqual(
            'filter.operator.equal'
        );
    });

    it('expect no operator submenu on a boolean column: it has none of its entries', async () => {
        const { element } = await mountGrid(
            { layout: { center: [{ fields: ['active'], width: 100 }] } },
            [{ active: true }, { active: false }],
            { fields: { active: 'boolean' } }
        );

        openFilterMenu(element, 'active');

        expect(menuTreeIds()).not.toContain('filter.operator');
        expect(menuTreeIds()).toContain('filter.filter.isBlank');
    });

    it('expect the entries of a submenu to start with its id, the pin, blank and operator submenus aside', async () => {
        const { element, seen } = await mountCapturing();
        openRowMenu(element, 'age', 0);
        openLabelMenu(element, 'age');
        openFilterMenu(element, 'firstname');

        const outOfPlace: string[] = [];
        const check = (entries: MenuEntry[]) => {
            for (const entry of entries) {
                if (entry.type !== 'submenu') {
                    continue;
                }
                const start =
                    entry.id === 'header.column.pin'
                        ? 'header.column.'
                        : entry.id === 'filter.filter.blank'
                          ? 'filter.filter.'
                          : `${entry.id}.`;
                // the operator submenu is in Filter with the id it had before, Match case and Filter as you
                // type next to it
                const inFilter = ['filter.operator', 'filter.matchCase', 'filter.filterOnType'];
                outOfPlace.push(
                    ...entry.entries
                        .map((inner) => inner.id)
                        .filter((id) => !id.startsWith(start) && !(entry.id === 'filter.filter' && inFilter.includes(id)))
                );
                check(entry.entries);
            }
        };
        for (const { defaults } of seen) {
            check(defaults);
        }
        expect(outOfPlace).toEqual([]);
    });

    it('expect a filter on the start of a section id to hide that part, with what is in it', async () => {
        const menus: GridMenus = {
            header: (defaults) => defaults.filter((e) => !e.id.startsWith('header.column')),
            filter: (defaults) => defaults.filter((e) => !e.id.startsWith('filter.filter'))
        };
        const { element } = await mountMenus(menus);

        openLabelMenu(element, 'age');
        expect(menuTreeIds().filter((id) => id.startsWith('header.column'))).toEqual([]);

        // the Filter submenu with the operator submenu in it: the value list is left
        openFilterMenu(element, 'firstname');
        expect(menuTreeIds()).toEqual(['filter.values']);
    });
});

/**
 * a menu of your own with submenus: one in the middle with a submenu in it, one more, lines
 */
const tree = (action = vi.fn()): MenuEntry[] => [
    { id: 'test.apple', label: 'Apple', action },
    { type: 'separator', id: 'test.line' },
    {
        type: 'submenu',
        id: 'test.more',
        label: 'More',
        entries: [
            { id: 'test.kiwi', label: 'Kiwi', action },
            { id: 'test.mango', label: 'Mango', action, disabled: () => true },
            { type: 'submenu', id: 'test.deeper', label: 'Deeper', entries: [{ id: 'test.fig', label: 'Fig', action }] }
        ]
    },
    { type: 'submenu', id: 'test.other', label: 'Other', entries: [{ id: 'test.lime', label: 'Lime', action }] },
    { id: 'test.banana', label: 'Banana', action }
];

/** a mousemove over an element, as the pointer moving onto it */
const pointerOn = (element: Element) => element.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));

describe('menus - submenus', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('expect an item with a submenu to say so, and the submenu not to be made until it opens', async () => {
        const { gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, tree());

        const more = entry('test.more');
        expect(more.className).toEqual('simple-html-grid-menu-item');
        expect(more.getAttribute('role')).toEqual('menuitem');
        expect(more.getAttribute('aria-haspopup')).toEqual('menu');
        expect(more.getAttribute('aria-expanded')).toEqual('false');
        expect(more.id).not.toEqual('');
        expect(more.textContent?.trim()).toEqual('More');
        expect(openMenus()).toHaveLength(1);
        expect(entry('test.kiwi')).toBeNull();
    });

    it('expect a click to open it: a popover of its own in the menu, labelled by its item', async () => {
        const { gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, tree());
        const more = entry('test.more');

        more.click();

        expect(openMenus()).toHaveLength(2);
        const submenu = openMenus()[1];
        expect(submenu.getAttribute('aria-labelledby')).toEqual(more.id);
        const popover = submenu.parentElement as HTMLElement;
        expect(popover.className).toEqual('simple-html-grid simple-html-grid-reset simple-html-grid-popover');
        expect(popover.getAttribute('popover')).toEqual('manual');
        expect(isPopoverShown(popover)).toBe(true);
        // in the menu's popover: it closes with it, a click in it is a click in the menu
        expect(popover.parentElement).toBe(openMenus()[0].parentElement);
        expect(more.getAttribute('aria-expanded')).toEqual('true');
        expect(shownIds()).toEqual([
            'test.apple',
            'test.line',
            'test.more',
            'test.other',
            'test.banana',
            'test.kiwi',
            'test.mango',
            'test.deeper'
        ]);

        // a second click leaves it open
        more.click();
        expect(openMenus()).toHaveLength(2);
        expect(openMenus()[1]).toBe(submenu);
    });

    it(`expect the pointer resting on it to open it after ${SUBMENU_DELAY}ms, on another item to close it`, async () => {
        const { gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, tree());
        vi.useFakeTimers();

        pointerOn(entry('test.more'));
        vi.advanceTimersByTime(SUBMENU_DELAY - 1);
        expect(openMenus()).toHaveLength(1);
        vi.advanceTimersByTime(1);
        expect(openMenus()).toHaveLength(2);
        expect(entry('test.kiwi')).not.toBeNull();

        pointerOn(entry('test.banana'));
        expect(openMenus()).toHaveLength(2);
        vi.advanceTimersByTime(SUBMENU_DELAY);
        expect(openMenus()).toHaveLength(1);
        expect(entry('test.more').getAttribute('aria-expanded')).toEqual('false');
    });

    it('expect the pointer crossing another item on its way into the open submenu not to swap it', async () => {
        const { gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, tree());
        entry('test.more').click();
        vi.useFakeTimers();

        // across Other, into the submenu of More before the delay is over
        pointerOn(entry('test.other'));
        vi.advanceTimersByTime(SUBMENU_DELAY - 50);
        openMenus()[1].parentElement?.dispatchEvent(new MouseEvent('mouseenter'));
        vi.advanceTimersByTime(SUBMENU_DELAY);

        expect(entry('test.kiwi')).not.toBeNull();
        expect(entry('test.lime')).toBeNull();
    });

    it('expect one submenu open per menu: opening another closes the first', async () => {
        const { gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, tree());

        entry('test.more').click();
        entry('test.other').click();

        expect(openMenus()).toHaveLength(2);
        expect(entry('test.kiwi')).toBeNull();
        expect(entry('test.lime')).not.toBeNull();
        expect(entry('test.more').getAttribute('aria-expanded')).toEqual('false');
        expect(entry('test.other').getAttribute('aria-expanded')).toEqual('true');
    });

    it('expect submenus in submenus, the deeper ones closed with the one they are in', async () => {
        const { gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, tree());

        entry('test.more').click();
        entry('test.deeper').click();
        expect(openMenus()).toHaveLength(3);
        expect(entry('test.fig')).not.toBeNull();

        entry('test.other').click();
        expect(openMenus()).toHaveLength(2);
        expect(entry('test.fig')).toBeNull();
    });

    it('expect a click on an item in a submenu to close the whole menu, then run its action with the context', async () => {
        const action = vi.fn();
        const { gridInterface, datasource } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, tree(action));
        entry('test.more').click();
        entry('test.deeper').click();
        const popovers = Array.from(document.querySelectorAll('.simple-html-grid-popover'));

        entry('test.fig').click();

        expect(menuOpen()).toBe(false);
        expect(popovers.every((popover) => !popover.isConnected)).toBe(true);
        expect(action).toHaveBeenCalledTimes(1);
        expect(action.mock.calls[0][0]).toMatchObject({ menu: 'custom', gridInterface, datasource });
    });

    it('expect a click on a disabled item in a submenu to leave it open, a click outside to close all', async () => {
        const action = vi.fn();
        const { gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, tree(action));
        await sleep(0);
        entry('test.more').click();

        entry('test.mango').click();
        expect(action).not.toHaveBeenCalled();
        expect(openMenus()).toHaveLength(2);

        document.body.click();
        expect(menuOpen()).toBe(false);
    });

    it('expect a submenu with nothing to show to be left out', async () => {
        const { gridInterface } = await mountGrid();

        gridInterface.openMenu({ x: 0, y: 0 }, [
            {
                type: 'submenu',
                id: 'test.hidden',
                label: 'Hidden',
                entries: [{ id: 'test.x', label: 'X', action: () => {} }],
                visible: () => false
            },
            {
                type: 'submenu',
                id: 'test.empty',
                label: 'Empty',
                entries: [{ id: 'test.y', label: 'Y', action: () => {}, visible: () => false }]
            },
            {
                type: 'submenu',
                id: 'test.lines',
                label: 'Lines',
                entries: [
                    { type: 'section', id: 'test.section', label: 'Only a header' },
                    { type: 'separator', id: 'test.separator' }
                ]
            },
            { type: 'submenu', id: 'test.none', label: 'None', entries: [] },
            {
                type: 'submenu',
                id: 'test.shown',
                label: 'Shown',
                entries: [
                    { id: 'test.z', label: 'Z', action: () => {}, visible: () => false },
                    {
                        type: 'submenu',
                        id: 'test.inner',
                        label: 'Inner',
                        entries: [{ id: 'test.w', label: 'W', action: () => {} }]
                    }
                ]
            }
        ]);

        expect(shownIds()).toEqual(['test.shown']);
        entry('test.shown').click();
        expect(shownIds()).toEqual(['test.shown', 'test.inner']);
    });

    it('expect closing the menu to stop a submenu about to open', async () => {
        const { element: grid, gridInterface } = await mountGrid();
        gridInterface.openMenu({ x: 0, y: 0 }, tree());
        vi.useFakeTimers();

        pointerOn(entry('test.more'));
        gridInterface.closeMenu();
        vi.advanceTimersByTime(SUBMENU_DELAY * 2);

        expect(menuOpen()).toBe(false);
        expect(gridOf(grid).menuTree).toBeNull();
    });

    describe('where it opens', () => {
        /**
         * The menu is 150 x 100 where its style puts it, a submenu `submenuWidth` x `submenuHeight` (or
         * its max-height), and an item is 20 high at `itemTop`
         */
        const layout = (itemTop: number, submenuHeight = 60, submenuWidth = 120) =>
            vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
                if (this.getAttribute('role') === 'menuitem') {
                    return new DOMRect(0, itemTop, 150, 20);
                }
                const left = parseFloat(this.style.left) || 0;
                const top = parseFloat(this.style.top) || 0;
                if (this.parentElement?.classList.contains('simple-html-grid-popover')) {
                    const max = parseFloat(this.style.maxHeight);
                    return new DOMRect(left, top, submenuWidth, Number.isNaN(max) ? submenuHeight : Math.min(submenuHeight, max));
                }
                return new DOMRect(left, top, 150, 100);
            });
        const submenuPopover = () => openMenus()[1].parentElement as HTMLElement;

        it('expect it on the right of the menu, its first item level with its item', async () => {
            const { gridInterface } = await mountGrid();
            layout(130);
            gridInterface.openMenu({ x: 100, y: 100 }, tree());

            entry('test.more').click();

            expect(submenuPopover().style.left).toEqual('250px');
            // its frame is 1px
            expect(submenuPopover().style.top).toEqual('129px');
            expect(submenuPopover().style.minWidth).toEqual('130px');
        });

        it('expect it on the left of the menu when there is no room on the right', async () => {
            const { gridInterface } = await mountGrid();
            layout(130);
            gridInterface.openMenu({ x: window.innerWidth - 200, y: 100 }, tree());

            entry('test.more').click();

            expect(submenuPopover().style.left).toEqual(`${window.innerWidth - 200 - 120}px`);
        });

        it('expect it over the menu, in from the right edge, when there is room on neither side', async () => {
            const { gridInterface } = await mountGrid();
            // the menu 150 wide at 50: 50px on its left, the window's width minus 200 on its right
            const width = window.innerWidth - 100;
            layout(130, 60, width);
            gridInterface.openMenu({ x: 50, y: 100 }, tree());

            entry('test.more').click();

            expect(submenuPopover().style.left).toEqual(`${window.innerWidth - 4 - width}px`);
        });

        it('expect it moved up as far as it has to near the bottom of the window', async () => {
            const { gridInterface } = await mountGrid();
            layout(window.innerHeight - 30);
            gridInterface.openMenu({ x: 100, y: 100 }, tree());

            entry('test.more').click();

            expect(submenuPopover().style.top).toEqual(`${window.innerHeight - 4 - 60}px`);
        });

        it('expect one taller than the window to be as tall as the window, and scroll', async () => {
            const { gridInterface } = await mountGrid();
            layout(130, window.innerHeight * 2);
            gridInterface.openMenu({ x: 100, y: 100 }, tree());

            entry('test.more').click();

            expect(submenuPopover().style.maxHeight).toEqual(`${window.innerHeight - 8}px`);
            expect(submenuPopover().style.overflowY).toEqual('auto');
            expect(submenuPopover().style.top).toEqual('4px');
        });
    });
});

/** a key on `target`, as the browser sends it. @returns the event: was it canceled? */
const press = (target: Element, key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
};

/** the data-menu-id of the element with the focus */
const focusedId = () => document.activeElement?.getAttribute('data-menu-id');

describe('menus - a block in use closes the submenu open beside it', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    // the filter menu's shape: a submenu, then a block with an input (the value list's search)
    async function openWithBlock() {
        const { gridInterface } = await mountGrid();
        const block = document.createElement('div');
        const input = document.createElement('input');
        block.appendChild(input);
        const entries: MenuEntry[] = [...tree(), { type: 'block', id: 'test.block', element: block }];
        gridInterface.openMenu({ x: 0, y: 0 }, entries);
        entry('test.more').click();
        expect(openMenus()).toHaveLength(2);
        return { block, input };
    }

    it('expect the focus going into the block to close it at once - typing in its search', async () => {
        const { input } = await openWithBlock();
        input.focus();
        expect(openMenus()).toHaveLength(1);
        expect(entry('test.more').getAttribute('aria-expanded')).toEqual('false');
        // the menu stays, the focus in the block
        expect(menuOpen()).toBe(true);
        expect(document.activeElement).toBe(input);
    });

    it('expect a press in the block to close it at once - a checkbox clicked', async () => {
        const { block } = await openWithBlock();
        block.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(openMenus()).toHaveLength(1);
    });

    it(`expect the pointer resting on the block to close it after ${SUBMENU_DELAY}ms, as on an item`, async () => {
        const { block } = await openWithBlock();
        vi.useFakeTimers();
        pointerOn(block);
        vi.advanceTimersByTime(SUBMENU_DELAY - 1);
        expect(openMenus()).toHaveLength(2);
        vi.advanceTimersByTime(1);
        expect(openMenus()).toHaveLength(1);

        // back on the item: it opens again
        pointerOn(entry('test.more'));
        vi.advanceTimersByTime(SUBMENU_DELAY);
        expect(openMenus()).toHaveLength(2);
    });

    it('expect the pointer crossing the block on its way into the submenu to keep it', async () => {
        const { block } = await openWithBlock();
        vi.useFakeTimers();
        pointerOn(block);
        vi.advanceTimersByTime(SUBMENU_DELAY - 50);
        openMenus()[1].parentElement?.dispatchEvent(new MouseEvent('mouseenter'));
        vi.advanceTimersByTime(SUBMENU_DELAY);
        expect(openMenus()).toHaveLength(2);
    });
});

describe('menus - the keyboard', () => {
    /**
     * openMenu() from the keyboard: a key first, as Enter on a button. The focus on a header filter,
     * where it goes back to
     */
    async function openByKey(entries: MenuEntry[]) {
        const mounted = await mountGrid();
        const cell = headerFilterInput(mounted.element, 'firstname');
        cell.focus();
        press(cell, 'Enter');
        mounted.gridInterface.openMenu({ x: 0, y: 0 }, entries);
        return { ...mounted, cell };
    }

    it('expect a row menu opened with Shift+F10 to take the focus, on its first item: disabled or not', async () => {
        const { element: grid } = await mountGrid({ ...simpleConfig(), readonly: false });
        const cell = grid.querySelectorAll('input[data-attribute="age"]')[0] as HTMLInputElement;
        cell.focus();

        // the browser sends contextmenu after the keydown
        press(cell, 'F10', { shiftKey: true });
        openRowMenu(grid, 'age', 0);

        // the Undo / Redo submenu first; in it, with nothing to undo, a greyed out item the keyboard
        // gets to (the ARIA menu pattern)
        expect(focusedId()).toEqual('row.edit');
        press(document.activeElement as HTMLElement, 'ArrowRight');
        expect(focusedId()).toEqual('row.edit.undo');
        expect(document.activeElement?.getAttribute('aria-disabled')).toEqual('true');
        expect((document.activeElement as HTMLElement).tabIndex).toEqual(0);

        press(document.activeElement as HTMLElement, 'Escape');
        expect(focusedId()).toEqual('row.edit');
        press(document.activeElement as HTMLElement, 'Escape');
        expect(menuOpen()).toBe(false);
        expect(document.activeElement).toBe(cell);
    });

    it('expect Shift+F10 on a column header to open the header menu: the browser sends contextmenu to the header', async () => {
        const { element: grid } = await mountGrid();
        const header = labelCell(grid, 'age');
        header.focus();

        press(header, 'F10', { shiftKey: true });
        const contextmenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        header.dispatchEvent(contextmenu);

        // not the browser's menu: the grid's, on the label in the header
        expect(contextmenu.defaultPrevented).toBe(true);
        expect(focusedId()).toEqual('header.column.pin');
        press(document.activeElement as HTMLElement, 'Escape');
        expect(document.activeElement).toBe(header);
    });

    it('expect a menu opened with the mouse to leave the focus on the cell, the arrows to get into it', async () => {
        const { element: grid } = await mountGrid();
        const cell = grid.querySelectorAll('input[data-attribute="age"]')[0] as HTMLInputElement;
        cell.focus();
        press(cell, 'a');

        // a right click: the pointer press comes before contextmenu
        cell.dispatchEvent(pointerEvent('pointerdown', { button: 2, buttons: 2 }));
        openRowMenu(grid, 'age', 0);
        expect(document.activeElement).toBe(cell);

        const down = press(cell, 'ArrowDown');
        expect(down.defaultPrevented).toBe(true);
        expect(focusedId()).toEqual('row.select');

        press(document.activeElement as HTMLElement, 'Escape');
        expect(document.activeElement).toBe(cell);

        cell.dispatchEvent(pointerEvent('pointerdown', { button: 2, buttons: 2 }));
        openRowMenu(grid, 'age', 0);
        press(cell, 'ArrowUp');
        expect(focusedId()).toEqual('row.export');
    });

    it('expect ArrowDown and ArrowUp round the items past lines and sections, Home and End, one stop of Tab', async () => {
        await openByKey([
            { type: 'section', id: 'test.section', label: 'Pick:' },
            { id: 'test.a', label: 'A', action: () => {} },
            { type: 'separator', id: 'test.line' },
            { id: 'test.b', label: 'B', action: () => {}, disabled: () => true },
            { type: 'submenu', id: 'test.more', label: 'More', entries: [{ id: 'test.c', label: 'C', action: () => {} }] },
            { id: 'test.d', label: 'D', action: () => {} }
        ]);
        expect(focusedId()).toEqual('test.a');

        const moves = ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'Home', 'End'].map((key) => {
            press(document.activeElement as HTMLElement, key);
            return focusedId();
        });

        expect(moves).toEqual(['test.b', 'test.more', 'test.d', 'test.a', 'test.d', 'test.a', 'test.d']);
        // a roving tabindex: the item the keyboard is on is the stop of Tab
        const tabIndexes = Array.from(
            openMenus()[0].querySelectorAll<HTMLElement>('[role^="menuitem"]'),
            (item) => item.tabIndex
        );
        expect(tabIndexes).toEqual([-1, -1, -1, 0]);
    });

    it('expect Enter and Space on an item to close the menu, give the focus back and run the action', async () => {
        for (const key of ['Enter', ' ']) {
            document.body.innerHTML = '';
            const action = vi.fn();
            const { cell } = await openByKey(tree(action));

            const event = press(document.activeElement as HTMLElement, key);

            expect(event.defaultPrevented).toBe(true);
            expect(menuOpen()).toBe(false);
            expect(action).toHaveBeenCalledTimes(1);
            expect(document.activeElement).toBe(cell);
        }
    });

    it('expect Enter on a disabled item to do nothing', async () => {
        const action = vi.fn();
        await openByKey([{ id: 'test.off', label: 'Off', action, disabled: () => true }]);

        press(document.activeElement as HTMLElement, 'Enter');

        expect(action).not.toHaveBeenCalled();
        expect(menuOpen()).toBe(true);
    });

    it('expect ArrowRight, Enter and Space to open a submenu on its first item, ArrowLeft and Esc to close it', async () => {
        for (const open of ['ArrowRight', 'Enter', ' ']) {
            for (const close of ['ArrowLeft', 'Escape']) {
                document.body.innerHTML = '';
                await openByKey(tree());
                press(document.activeElement as HTMLElement, 'End');
                press(document.activeElement as HTMLElement, 'ArrowUp');
                press(document.activeElement as HTMLElement, 'ArrowUp');
                expect(focusedId()).toEqual('test.more');

                press(document.activeElement as HTMLElement, open);
                expect(openMenus()).toHaveLength(2);
                expect(focusedId()).toEqual('test.kiwi');

                const event = press(document.activeElement as HTMLElement, close);
                // Esc closes the submenu only: canceled, the document's Esc leaves the menu open
                expect(event.defaultPrevented).toBe(true);
                expect(openMenus()).toHaveLength(1);
                expect(focusedId()).toEqual('test.more');
                expect(entry('test.more').getAttribute('aria-expanded')).toEqual('false');
            }
        }
    });

    it('expect Esc in the menu itself to close it, ArrowLeft and ArrowRight on an item without a submenu to do nothing', async () => {
        const { cell } = await openByKey(tree());

        expect(press(document.activeElement as HTMLElement, 'ArrowLeft').defaultPrevented).toBe(false);
        expect(press(document.activeElement as HTMLElement, 'ArrowRight').defaultPrevented).toBe(false);
        expect(menuOpen()).toBe(true);

        press(document.activeElement as HTMLElement, 'Escape');
        expect(menuOpen()).toBe(false);
        expect(document.activeElement).toBe(cell);
    });

    it('expect a submenu in a submenu from the keyboard', async () => {
        await openByKey(tree());
        press(document.activeElement as HTMLElement, 'm');
        press(document.activeElement as HTMLElement, 'ArrowRight');
        press(document.activeElement as HTMLElement, 'End');
        expect(focusedId()).toEqual('test.deeper');

        press(document.activeElement as HTMLElement, 'ArrowRight');
        expect(openMenus()).toHaveLength(3);
        expect(focusedId()).toEqual('test.fig');

        press(document.activeElement as HTMLElement, 'ArrowLeft');
        press(document.activeElement as HTMLElement, 'ArrowLeft');
        expect(openMenus()).toHaveLength(1);
        expect(focusedId()).toEqual('test.more');
    });

    it('expect moving to another item to close the submenu open in the menu', async () => {
        await openByKey(tree());
        press(document.activeElement as HTMLElement, 'm');
        // opened with the mouse, the focus stays on its item
        entry('test.more').click();
        expect(openMenus()).toHaveLength(2);

        press(document.activeElement as HTMLElement, 'ArrowDown');

        expect(openMenus()).toHaveLength(1);
        expect(focusedId()).toEqual('test.other');
    });

    it('expect the focus on an item to follow the pointer, not into a menu the mouse opened', async () => {
        await openByKey(tree());
        pointerOn(entry('test.banana'));
        expect(focusedId()).toEqual('test.banana');

        document.body.innerHTML = '';
        const { element: grid, gridInterface } = await mountGrid();
        const cell = headerFilterInput(grid, 'firstname');
        cell.focus();
        gridInterface.openMenu({ x: 0, y: 0 }, tree());
        pointerOn(entry('test.banana'));
        expect(document.activeElement).toBe(cell);
    });

    it('expect a letter to go to the next item that starts with it, round', async () => {
        await openByKey([
            { id: 'test.apple', label: 'Apple', action: () => {} },
            { id: 'test.banana', label: 'Banana', action: () => {} },
            { id: 'test.blueberry', label: 'blueberry', action: () => {} }
        ]);

        const moves = ['b', 'B', 'b', 'a', 'x'].map((key) => {
            press(document.activeElement as HTMLElement, key);
            return focusedId();
        });

        expect(moves).toEqual(['test.banana', 'test.blueberry', 'test.banana', 'test.apple', 'test.apple']);
    });

    it('expect Tab to close the menu and give the focus back', async () => {
        const { cell } = await openByKey(tree());
        press(document.activeElement as HTMLElement, 'm');
        press(document.activeElement as HTMLElement, 'ArrowRight');

        const event = press(document.activeElement as HTMLElement, 'Tab');

        expect(event.defaultPrevented).toBe(true);
        expect(menuOpen()).toBe(false);
        expect(document.activeElement).toBe(cell);
    });

    it("expect Tab to be the browser's in a menu with a block: the filter menu's value list, Apply a button", async () => {
        const { element: grid, datasource } = await mountGrid();
        const cell = headerFilterInput(grid, 'firstname');
        cell.focus();
        press(cell, 'F10', { shiftKey: true });
        openFilterMenu(grid, 'firstname');
        // the Filter submenu first: ArrowRight goes into it, Esc back out
        expect(focusedId()).toEqual('filter.filter');
        press(document.activeElement as HTMLElement, 'ArrowRight');
        expect(focusedId()).toEqual('filter.operator');
        press(document.activeElement as HTMLElement, 'Escape');
        expect(focusedId()).toEqual('filter.filter');

        expect(press(document.activeElement as HTMLElement, 'Tab').defaultPrevented).toBe(false);
        expect(menuOpen()).toBe(true);

        // uncheck a value. Apply is a button of the browser: a stop of Tab, Enter and Space click it -
        // the browser's, checked in a real browser. Enter on a checkbox applies too
        valueRow('first1').click();
        const apply = document.querySelector(
            '.simple-html-grid-value-buttons .simple-html-grid-button-primary'
        ) as HTMLButtonElement;
        expect([apply.tagName, apply.type, apply.tabIndex, apply.textContent?.trim()]).toEqual(['BUTTON', 'button', 0, 'Apply']);
        press(valueCheckbox('first2'), 'Enter');

        expect(menuOpen()).toBe(false);
        expect(datasource.getRows().map((row) => (row as { firstname?: string }).firstname)).not.toContain('first1');
    });
});

describe('menus - roles', () => {
    it('expect a menu, items, checkbox items, disabled items, separators and sections', async () => {
        const { gridInterface } = await mountGrid();

        gridInterface.openMenu({ x: 0, y: 0 }, [
            { type: 'section', id: 'test.section', label: 'Pick:' },
            { id: 'test.item', label: 'Item', action: () => {} },
            { id: 'test.on', label: 'On', action: () => {}, selected: () => true },
            { id: 'test.off', label: 'Off', action: () => {}, selected: () => false },
            { id: 'test.disabled', label: 'Disabled', action: () => {}, disabled: () => true },
            { type: 'separator', id: 'test.line' },
            { type: 'submenu', id: 'test.more', label: 'More', entries: [{ id: 'test.inner', label: 'Inner', action: () => {} }] }
        ]);

        expect(openMenus()[0].getAttribute('role')).toEqual('menu');
        const roles = Array.from(openMenus()[0].children, (child) => [
            child.getAttribute('data-menu-id'),
            child.tagName,
            child.getAttribute('role'),
            child.getAttribute('aria-checked'),
            child.getAttribute('aria-disabled')
        ]);
        expect(roles).toEqual([
            // a heading for the eye, its line too
            ['test.section', 'DIV', 'none', null, null],
            [null, 'HR', 'none', null, null],
            ['test.item', 'DIV', 'menuitem', null, null],
            ['test.on', 'DIV', 'menuitemcheckbox', 'true', null],
            ['test.off', 'DIV', 'menuitemcheckbox', 'false', null],
            ['test.disabled', 'DIV', 'menuitem', null, 'true'],
            // an hr is a separator
            ['test.line', 'HR', null, null, null],
            ['test.more', 'DIV', 'menuitem', null, null]
        ]);
        expect(entry('test.on').classList).toContain('simple-html-grid-menu-item-selected');
        expect(entry('test.off').classList).not.toContain('simple-html-grid-menu-item-selected');
    });

    it('expect the toggles of the default menus to be checkbox items: the view, the aggregates', async () => {
        const { element: grid } = await mountGrid({ ...simpleConfig(), dimRepeatedValues: true });

        openRowMenu(grid, 'age', 0);
        expect(menuEntry('row.view.dimRepeatedValues').getAttribute('aria-checked')).toEqual('true');
        expect(menuEntry('row.view.changedOnly').getAttribute('aria-checked')).toEqual('false');
        expect(menuEntry('row.view.changedOnly').getAttribute('role')).toEqual('menuitemcheckbox');

        openLabelMenu(grid, 'age');
        expect(menuEntry('header.aggregate.totalsRow').getAttribute('role')).toEqual('menuitemcheckbox');
        expect(menuEntry('header.aggregate.sum').getAttribute('aria-checked')).toEqual('false');
    });
});
