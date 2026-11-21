import { html, nothing, render } from 'lit-html';
import type { Grid } from '../grid';
import type { MenuContext, MenuEntry, MenuPosition } from '../gridMenus';
import { asPx } from './asPx';
import { createElement } from './createElement';
import { removeContextMenu } from './removeContextMenu';

/**
 * Where a menu goes, in px from the window's left and top edges. `flipTop`: when the menu does not
 * fit below `top`, it is moved up so its bottom edge is at `flipTop`. `anchor`: the element it opens
 * from, null for a position - the menu is put in its dialog or popover, see {@link popoverParent}.
 */
export interface MenuPlace {
    left: number;
    top: number;
    flipTop: number;
    anchor: Element | null;
}

/**
 * The place of the grid's own menus: under the cell, around the mouse (130px wide, the mouse in the
 * middle), kept in the window.
 */
export function placeUnderCell(event: MouseEvent, cell: HTMLElement): MenuPlace {
    const rect = cell.getBoundingClientRect();
    let left = event.clientX - 65;
    if (event.clientX + 70 > window.innerWidth) {
        left = window.innerWidth - 150;
    }
    if (event.clientX - 65 < 0) {
        left = 5;
    }
    return { left, top: rect.bottom + 2, flipTop: rect.top, anchor: cell };
}

/**
 * The place of a menu opened with `gridInterface.openMenu()`: under an element, or with its top left
 * corner at the mouse / the position
 */
export function placeAt(at: MouseEvent | MenuPosition | HTMLElement): MenuPlace {
    if (at instanceof Element) {
        const rect = at.getBoundingClientRect();
        return { left: rect.left, top: rect.bottom + 2, flipTop: rect.top, anchor: at };
    }
    if ('clientX' in at) {
        // a mouse event that was not dispatched (made in code) has no target
        const anchor = at.target instanceof Element ? at.target : null;
        return { left: at.clientX, top: at.clientY, flipTop: at.clientY, anchor };
    }
    return { left: at.x, top: at.y, flipTop: at.y, anchor: null };
}

/**
 * Where the grid puts a menu in the dom: in the dialog or popover of the page `anchor` is in, else on
 * the body. Shown, a menu is in the top layer wherever it is in the dom, but for the browser it
 * belongs to its parent:
 * - a modal dialog makes everything outside it inert - it can not be clicked or focused. A menu of the
 *   filter editor, or of a grid in a modal dialog of your own, has to be inside that dialog
 * - a click in a menu outside a `popover="auto"` of yours is a click outside it, which closes it
 *
 * Not in one of the grid's own menus (a dropdown grid in a block): those are manual popovers, a menu
 * on the body is as good, and is closed on its own when the dropdown grid leaves the page.
 */
export function popoverParent(anchor: Element | null): HTMLElement {
    return anchor?.closest<HTMLElement>('dialog, [popover]:not(.simple-html-grid-popover)') ?? document.body;
}

/**
 * Puts a menu at `left` / `top`, in px from the window's left and top edges. A menu is
 * `position: absolute` in the top layer, where that is from the top left of the page: it moves with
 * the page when the page scrolls, as it did on the body
 */
export function moveMenu(menu: HTMLElement, left: number, top: number) {
    menu.style.left = asPx(left + window.scrollX);
    menu.style.top = asPx(top + window.scrollY);
}

/**
 * Opens `menu` as the grid's menu: the menu open before is closed (one at a time), and this one is
 * put in the dom ({@link popoverParent}) and shown as a popover. Place it after, with
 * {@link placeMenu} or {@link moveMenu}: its size is known once it is shown.
 *
 * The menus are `popover="manual"`: the top layer - over everything on the page, never clipped by a
 * container with `overflow: hidden`, never behind content with a higher z-index - without the
 * browser's light dismiss. `popover="auto"` would close a menu opened by a right click on the
 * pointerup that follows, where the contextmenu event comes on the button press (macOS, Linux): that
 * pointerup is outside the menu. So the grid closes its menus itself: on a click outside and on Esc
 * (addMenuListeners), on scroll (autoRemoveContextMenuOnScrollEvent), when another menu opens and
 * when the grid leaves the page.
 */
export function openMenuElement(ctx: Grid, menu: HTMLElement, anchor: Element | null) {
    removeContextMenu(ctx);
    // gets the focus back when the menu closes with the focus in it, see removeContextMenu
    const returnFocus = document.activeElement;

    // the css class undoes the browser's popover style, and hides it while it is not open
    menu.classList.add('simple-html-grid-popover');
    menu.popover = 'manual';
    menu.style.minWidth = asPx(130);
    popoverParent(anchor).appendChild(menu);
    menu.showPopover();

    ctx.contextMenu = menu;
    ctx.menuReturnFocus = returnFocus;

    // openMenu() called from a click handler: that click still bubbles up to the document, where the
    // grid closes menus on a click outside them. It must not close this one. A click is dispatched in
    // one task, the timer runs after it
    ctx.menuJustOpened = true;
    setTimeout(() => {
        ctx.menuJustOpened = false;
    });
}

/**
 * Places a menu that is shown, and keeps it in the window: above the cell/point when there is no room
 * below, moved left when it sticks out on the right
 */
export function placeMenu(menu: HTMLElement, place: MenuPlace) {
    moveMenu(menu, place.left, place.top);
    const rect = menu.getBoundingClientRect();
    const top = rect.bottom > window.innerHeight ? place.flipTop - rect.height : place.top;
    const left = rect.right > window.innerWidth ? Math.max(0, window.innerWidth - rect.width) : place.left;
    moveMenu(menu, left, top);
}

/**
 * Opens a menu of entries: renders the entries that are visible and opens it as the grid's menu, see
 * {@link openMenuElement}.
 *
 * An item click closes the menu first, then calls the item's action: an action can open another menu.
 */
export function showMenu(ctx: Grid, entries: MenuEntry[], context: MenuContext, place: MenuPlace) {
    const menu = createElement('div', 'simple-html-grid');
    menu.classList.add('simple-html-grid-reset');

    const shown = entries.filter((entry) => entry.visible?.(context) ?? true);

    const entryTemplate = (entry: MenuEntry) => {
        switch (entry.type) {
            case 'section':
                return html`<div class="simple-html-grid-menu-section" data-menu-id=${entry.id}>${entry.label}</div>
                    <hr class="hr-solid" />`;
            case 'separator':
                return html`<hr class="hr-dashed" data-menu-id=${entry.id} />`;
            case 'block':
                // lit puts the element itself in the menu
                return entry.element;
            default: {
                const disabled = entry.disabled?.(context) ?? false;
                const selected = entry.selected?.(context) ?? false;
                let classes = 'simple-html-grid-menu-item';
                if (selected) {
                    classes += ' simple-html-grid-menu-item-selected';
                }
                if (disabled) {
                    classes += ' simple-html-grid-menu-item-disabled';
                }
                // mousedown: an item does not take the focus, it stays on the cell the menu was opened
                // from - and the filter editor, opened from an item, gives it back there when it closes
                return html`<div
                    class=${classes}
                    data-menu-id=${entry.id}
                    aria-disabled=${disabled ? 'true' : nothing}
                    @mousedown=${(event: MouseEvent) => event.preventDefault()}
                    @click=${() => {
                        if (!disabled) {
                            removeContextMenu(ctx);
                            entry.action(context);
                        }
                    }}
                >
                    ${entry.label}${entry.hint ? html` <i>(${entry.hint})</i>` : nothing}
                </div>`;
            }
        }
    };

    render(html`<div class="simple-html-grid-menu">${shown.map((entry) => entryTemplate(entry))}</div>`, menu);

    openMenuElement(ctx, menu, place.anchor);
    placeMenu(menu, place);
}
