// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPopoverShown } from '../../__tests__/popoverStub';
import type { GridElement } from '../gridElement';
import { type GridMenus, MENU_IDS, type MenuContext, type MenuEntry, type MenuItem } from '../gridMenus';
import { mountGrid, simpleConfig, simpleData, simpleFields, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, headerFilterInput, menuItem, openFilterMenu, openLabelMenu, openRowMenu, sleep } from './interactionTestHelpers';

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
 * the ids of what the open menu shows, in order: items, sections and separators carry data-menu-id,
 * and so does the value list block
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

        expect(seen[0].defaults.map((e) => e.id)).toEqual(MENU_IDS.row);
    });

    it('expect the header menu defaults to be MENU_IDS.header, in order', async () => {
        const { element, seen } = await mountCapturing();

        openLabelMenu(element, 'age');

        expect(seen[0].defaults.map((e) => e.id)).toEqual(MENU_IDS.header);
    });

    it('expect the filter menu defaults to be MENU_IDS.filter, in order', async () => {
        const { element, seen } = await mountCapturing();

        openFilterMenu(element, 'firstname');

        expect(seen[0].defaults.map((e) => e.id)).toEqual(MENU_IDS.filter);
    });

    it('expect every id to be unique', () => {
        const all = [...MENU_IDS.row, ...MENU_IDS.header, ...MENU_IDS.filter];
        expect(new Set(all).size).toEqual(all.length);
    });

    it('expect the defaults of an editable number cell to show every row entry', async () => {
        const { element, datasource } = await mountGrid({ ...simpleConfig(), readonly: false });
        // undo is only shown when a selected row is marked for deletion
        datasource.getSelection().selectRowRange(0, 1);
        datasource.markForDeletion(datasource.getDataRows()[0]);

        openRowMenu(element, 'age', 0);

        expect(shownIds()).toEqual(MENU_IDS.row);
    });

    it('expect the entries that do not apply to be left out by their visible callback', async () => {
        // readonly grid (the default), text column
        const { element } = await mountGrid();

        openRowMenu(element, 'firstname', 0);

        expect(shownIds()).toEqual(MENU_IDS.row.filter((id) => !/^row\.(paste|clear|delete|summary)/.test(id)));
    });

    it('expect the operators of a text column and the value list in the filter menu', async () => {
        const { element } = await mountGrid();

        openFilterMenu(element, 'firstname');

        expect(shownIds()).toEqual(
            MENU_IDS.filter.filter(
                (id) => id !== 'filter.operator.greaterThanOrEqualTo' && id !== 'filter.operator.lessThanOrEqualTo'
            )
        );
    });

    it('expect the range operators of a number column, without the value list', async () => {
        const { element } = await mountGrid();

        openFilterMenu(element, 'age');

        expect(shownIds()).toEqual(
            MENU_IDS.filter.filter(
                (id) => id !== 'filter.operator.notEqualTo' && id !== 'filter.operator.contains' && id !== 'filter.values'
            )
        );
    });

    it('expect pin left and unpin to follow where the column is', async () => {
        const config = simpleConfig();
        config.layout.left = [{ fields: ['firstname'], width: 100 }];
        config.layout.center = [{ fields: ['age'], width: 100 }];
        const { element } = await mountGrid(config);

        openLabelMenu(element, 'firstname');
        expect(shownIds()).not.toContain('header.column.pinLeft');
        expect(shownIds()).toContain('header.column.unpin');

        openLabelMenu(element, 'age');
        expect(shownIds()).toContain('header.column.pinLeft');
        expect(shownIds()).not.toContain('header.column.unpin');
    });
});

describe('menus - rendered as before', () => {
    it('expect a section header with a solid line, a separator as a dashed line', async () => {
        const { element } = await mountGrid();

        openLabelMenu(element, 'age');

        const section = entry('header.column');
        expect(section.className).toEqual('simple-html-grid-menu-section');
        expect(section.textContent?.trim()).toEqual('Column:');
        expect((section.nextElementSibling as HTMLElement).className).toEqual('hr-solid');
        expect(entry('header.column.chooserSeparator').className).toEqual('hr-dashed');
    });

    it('expect the hint in italics after the label', async () => {
        const { element } = await mountGrid({ ...simpleConfig(), readonly: false });

        openRowMenu(element, 'age', 0);

        const paste = entry('row.paste.cell');
        expect(paste.className).toEqual('simple-html-grid-menu-item');
        expect(paste.textContent?.replace(/\s+/g, ' ').trim()).toEqual('Cell (selected rows)');
        expect(paste.querySelector('i')?.textContent).toEqual('(selected rows)');
    });

    it('expect the operator in use to be shown selected', async () => {
        const { element } = await mountGrid();

        openFilterMenu(element, 'age');

        // the default of a number column
        expect(entry('filter.operator.greaterThanOrEqualTo').classList).toContain('simple-html-grid-menu-item-selected');
        expect(entry('filter.operator.equal').classList).not.toContain('simple-html-grid-menu-item-selected');
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
        entry('row.copy.cell').dispatchEvent(down);

        // the focus stays on the cell, and goes back there from a dialog an item opens
        expect(down.defaultPrevented).toBe(true);
    });
});

describe('menus - the menus hook', () => {
    it('expect a built-in entry to be hidden', async () => {
        const menus: GridMenus = { row: (defaults) => defaults.filter((e) => e.id !== 'row.copy.cell') };
        const { element } = await mountMenus(menus);

        openRowMenu(element, 'firstname', 0);

        expect(shownIds()).not.toContain('row.copy.cell');
        expect(shownIds()).toContain('row.copy.column');
        expect(menuItem('Cell Value')).toBeUndefined();
    });

    it('expect the entries to be shown in the order returned', async () => {
        const menus: GridMenus = {
            filter: (defaults) => [
                ...defaults.filter((e) => e.id === 'filter.values'),
                ...defaults.filter((e) => e.id === 'filter.filter.clear' || e.id === 'filter.filter')
            ]
        };
        const { element } = await mountMenus(menus);

        openFilterMenu(element, 'firstname');

        expect(shownIds()).toEqual(['filter.values', 'filter.filter', 'filter.filter.clear']);
        // the value list still works where it was moved to
        expect(menuItem('Run Search')).toBeDefined();
    });

    it('expect a label to be changed and the entry to keep its action', async () => {
        const menus: GridMenus = {
            header: (defaults) => defaults.map((e) => (e.id === 'header.column.hide' ? { ...e, label: 'Hide column' } : e))
        };
        const { element, gridInterface } = await mountMenus(menus);

        openLabelMenu(element, 'age');
        menuItem('Hide column').click();

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
            // the replace entry first, under a section of its own
            row: (defaults) => [
                { type: 'section', id: 'test.section', label: 'First:' },
                ...defaults.filter((e) => e.id === 'row.filter.replace')
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
        expect(shownIds()).toEqual(MENU_IDS.header.filter((id) => id !== 'header.column.unpin'));
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
        expect(menu.style.left).toEqual(`${window.innerWidth - 150}px`);
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
        expect(shownIds()).toContain('row.copy.cell');
    });
});

describe('menus - the value list block', () => {
    it('expect it to be hidden or moved as one entry', async () => {
        const menus: GridMenus = { filter: (defaults) => defaults.filter((e) => e.id !== 'filter.values') };
        const { element } = await mountMenus(menus);

        openFilterMenu(element, 'firstname');

        expect(document.querySelector('.simple-html-grid-menu-checkbox')).toBeNull();
        expect(menuItem('Run Search')).toBeUndefined();
        expect(menuItem('Clear Filter')).toBeDefined();
    });

    it('expect checking values to render the block again, not the rest of the menu', async () => {
        const { element } = await mountGrid();
        openFilterMenu(element, 'firstname');
        const clear = entry('filter.filter.clear');
        const label = Array.from(document.querySelectorAll('.simple-html-grid-menu-checkbox label')).find((el) =>
            el.textContent?.trim().startsWith('FIRST1')
        ) as HTMLElement;

        label.click();

        expect((label.previousElementSibling as HTMLInputElement).checked).toBe(false);
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
