import { vi } from 'vitest';
import type { GridElement } from '../gridElement';

/**
 * Helpers for the interaction tests (menus, header filters, drag/drop, key navigation).
 * Builds on gridTestHelpers.ts, which mounts the grid.
 */

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * the Grid instance behind a mounted element, the gridFunctions take this as ctx
 */
export function gridOf(element: GridElement) {
    return (element as any).grid;
}

/**
 * The open menu and its open submenus, in order: their `role="menu"` elements. A submenu's popover is
 * put in the menu's popover after the menu, so the dom order is the order they opened in
 */
export function openMenus(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('.simple-html-grid-menu[role="menu"]'));
}

/**
 * the items of a menu or submenu that open a submenu
 */
function submenuItems(menu: Element): HTMLElement[] {
    return Array.from(menu.children).filter((child) => child.getAttribute('aria-haspopup') === 'menu') as HTMLElement[];
}

/**
 * The elements of the open menu that match `selector` and `matches`, looked for as a user does: in the
 * menu, then in its submenus, each opened with a click on its item - one at a time, opening one closes
 * the one open in its menu - and in theirs.
 *
 * `all` false: stops at the first menu or submenu that has one, which stays open - its elements can be
 * clicked. `all` true: from every submenu, for counting - the ones in a submenu closed again are
 * not in the document anymore
 */
function searchMenus(selector: string, matches: (element: HTMLElement) => boolean, all: boolean): HTMLElement[] {
    const found: HTMLElement[] = [];
    const visit = (depth: number) => {
        const menu = openMenus()[depth];
        if (!menu) {
            return;
        }
        found.push(...Array.from(menu.querySelectorAll<HTMLElement>(selector)).filter(matches));
        for (const opener of submenuItems(menu)) {
            if (found.length && !all) {
                return;
            }
            opener.click();
            visit(depth + 1);
        }
    };
    visit(0);
    return found;
}

/**
 * The entry of the open menu with this `data-menu-id`, in the menu or in a submenu: the submenus on the
 * way to it are opened, as a user does (see searchMenus), so it can be clicked. null when no submenu
 * has it
 */
export function menuEntry(id: string): HTMLElement {
    return (searchMenus('[data-menu-id]', (element) => element.getAttribute('data-menu-id') === id, false)[0] ??
        null) as HTMLElement;
}

/**
 * Every entry of the open menu (the elements with a data-menu-id), its submenus opened one by one as
 * a user does: in the order of the tree - a submenu, then what is in it - as MENU_IDS lists them. An
 * entry of a submenu closed again is not in the document anymore, its text and attributes are there.
 * @param opened called each time a submenu has opened, to check what is shown then
 */
export function menuTreeEntries(opened: () => void = () => {}): HTMLElement[] {
    const entries: HTMLElement[] = [];
    const visit = (depth: number) => {
        const menu = openMenus()[depth];
        if (!menu) {
            return;
        }
        for (const element of Array.from(menu.querySelectorAll<HTMLElement>('[data-menu-id]'))) {
            entries.push(element);
            if (element.getAttribute('aria-haspopup') === 'menu') {
                element.click();
                opened();
                visit(depth + 1);
            }
        }
    };
    visit(0);
    return entries;
}

/**
 * the ids of every entry of the open menu and its submenus, see menuTreeEntries
 */
export function menuTreeIds(): string[] {
    return menuTreeEntries().map((element) => element.getAttribute('data-menu-id') ?? '');
}

/**
 * first menu entry (context menus, the column chooser's bottom button, the buttons of the value list
 * and the filter editor) whose text starts with `text`. Not shown: looked for in the submenus of the
 * open menu, which are opened on the way to it (see searchMenus)
 */
export function menuItem(text: string): HTMLElement {
    const selector = '.simple-html-grid-menu-item, .simple-html-label-button-menu-bottom, .simple-html-grid-button';
    const matches = (element: HTMLElement) => element.textContent?.trim().startsWith(text) === true;
    const shown = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(matches);
    return (shown ?? searchMenus(selector, matches, false)[0]) as HTMLElement;
}

/**
 * every menu entry whose text is exactly `text`, in the open menu and all its submenus, for counting
 * them. To click one use menuEntry(): an entry in a submenu closed again is not in the document
 */
export function menuItemsExact(text: string): HTMLElement[] {
    return searchMenus(
        '.simple-html-grid-menu-item',
        (element) => element.textContent?.replace(/\s+/g, ' ').trim() === text,
        true
    );
}

/**
 * The row of a value in the filter menu's value list - a label around its checkbox, a click on it is a
 * click on the checkbox - by the value as it is shown (upper case, "Blank" for the empty ones)
 */
export function valueRow(value: string): HTMLLabelElement {
    return Array.from(
        document.querySelectorAll<HTMLLabelElement>('.simple-html-grid-value-scroll .simple-html-grid-value-row')
    ).find((row) => row.querySelector('.simple-html-grid-value-text')?.textContent?.trim() === value) as HTMLLabelElement;
}

/**
 * the checkbox of a value in the filter menu's value list, see valueRow
 */
export function valueCheckbox(value: string): HTMLInputElement {
    return valueRow(value)?.querySelector('input') as HTMLInputElement;
}

/**
 * the header filter input of a column, found through the attribute the grid put on its cell
 */
export function headerFilterInput(element: GridElement, attribute: string): HTMLInputElement {
    return Array.from(element.querySelectorAll('input.simple-html-grid-cell-filter-input')).find(
        (input) => (input.parentElement as any)?.$attribute === attribute
    ) as HTMLInputElement;
}

/**
 * types into a header filter the way a user does - value, then change (blur/enter)
 */
export function typeInHeaderFilter(element: GridElement, attribute: string, value: string) {
    const input = headerFilterInput(element, attribute);
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * opens the right click menu on a body cell
 */
export function openRowMenu(element: GridElement, attribute: string, rowIndex = 0) {
    const cell = element.querySelectorAll(`input[data-attribute="${attribute}"]`)[rowIndex] as HTMLElement;
    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
}

/**
 * opens the right click menu on a header filter
 */
export function openFilterMenu(element: GridElement, attribute: string) {
    headerFilterInput(element, attribute).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100 }));
}

/**
 * header label cell of a column, the element that carries the drag/drop events
 */
export function labelCell(element: GridElement, attribute: string): HTMLElement {
    return Array.from(element.querySelectorAll('.simple-html-grid-col-cell.simple-html-label')).find(
        (cell: any) => cell.$attribute === attribute && cell.getAttribute('type') === 'label'
    ) as HTMLElement;
}

/**
 * A pointer event the way a browser sends it. happy-dom's defaults are not a browser's (pointerId 0,
 * pointerType '', isPrimary false, no bubbling), so they are set here: the mouse, pointer 1, the
 * primary pointer, the left button (`button` -1 on a move, `buttons` the buttons held after it).
 * Change any of it with `init`: `{ pointerType: 'touch' }`, `{ button: 2 }`, `{ isPrimary: false }`.
 */
export function pointerEvent(
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    init: PointerEventInit = {}
): PointerEvent {
    return new PointerEvent(type, {
        bubbles: true,
        cancelable: type !== 'pointercancel',
        composed: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: type === 'pointermove' ? -1 : 0,
        buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0,
        ...init
    });
}

/**
 * What the browser's hit test finds under the pointer from now on: `document.elementFromPoint()`.
 * happy-dom lays nothing out, its elementFromPoint() is always null - and a drag asks it for the
 * drop target, the target of a captured pointer's events is the dragged cell. Restore it with
 * `mockRestore()` on the result (or vi.restoreAllMocks()).
 */
export function pointerOver(element: Element | null) {
    return vi.spyOn(document, 'elementFromPoint').mockReturnValue(element);
}

/**
 * a touch on `target` (a Touch for the `touches` of a TouchEvent)
 */
export function touchAt(target: Element, clientX: number, clientY: number) {
    return new Touch({ identifier: 1, target, clientX, clientY });
}

/**
 * drag and drop with a mouse, as the browser sends it: pointerdown on the source, then a move far
 * enough to be a drag (dragEvent captures the pointer to the source, so the move and the pointerup
 * go to the source too and bubble to the document). `target` is what is under the pointer.
 */
export function dragAndDrop(source: HTMLElement, target: HTMLElement) {
    const hitTest = pointerOver(target);
    source.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10 }));
    source.dispatchEvent(pointerEvent('pointermove', { clientX: 50, clientY: 10 }));
    source.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 10 }));
    hitTest.mockRestore();
}

/**
 * the resize handle of the header column element in slot `slot` of a section (its refID)
 */
export function resizeHandle(element: HTMLElement, slot: number, section: 'left' | 'middle' | 'right' = 'middle'): HTMLElement {
    const handle = section === 'right' ? 'simple-html-grid-col-resize-right' : 'simple-html-grid-col-resize';
    return element.querySelector(
        `.simple-html-grid-header-row-container-pinned-${section} > .simple-html-grid-col[refID="${slot}"] > .${handle}`
    ) as HTMLElement;
}

/**
 * drags the resize handle of the center header column in slot `slot` by `dx` pixels: pointerdown,
 * one move, pointerup. The handle captures the pointer, so all three go to the handle
 */
export function dragResizeHandle(element: HTMLElement, slot: number, dx: number) {
    const handle = resizeHandle(element, slot);
    handle.dispatchEvent(pointerEvent('pointerdown', { clientX: 100 }));
    handle.dispatchEvent(pointerEvent('pointermove', { clientX: 100 + dx }));
    handle.dispatchEvent(pointerEvent('pointerup', { clientX: 100 + dx }));
}

/**
 * opens the right click menu on a header label, the one with "Pin left", "Hide" ...
 */
export function openLabelMenu(element: GridElement, attribute: string) {
    const label = element.querySelector(`[data-attribute-header="${attribute}"]`) as HTMLElement;
    label.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100 }));
}
