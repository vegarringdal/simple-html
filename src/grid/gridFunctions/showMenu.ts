import { html, nothing, render } from 'lit-html';
import type { Grid } from '../grid';
import type { MenuContext, MenuEntry, MenuPosition } from '../gridMenus';
import { asPx } from './asPx';
import { createElement } from './createElement';
import { removeContextMenu } from './removeContextMenu';

/**
 * Where a menu goes, in px from the window's left and top edges. `flipTop`: when the menu does not
 * fit below `top`, it is moved up so its bottom edge is at `flipTop`.
 */
export interface MenuPlace {
    left: number;
    top: number;
    flipTop: number;
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
    return { left, top: rect.bottom + 2, flipTop: rect.top };
}

/**
 * The place of a menu opened with `gridInterface.openMenu()`: under an element, or with its top left
 * corner at the mouse / the position
 */
export function placeAt(at: MouseEvent | MenuPosition | HTMLElement): MenuPlace {
    if (at instanceof Element) {
        const rect = at.getBoundingClientRect();
        return { left: rect.left, top: rect.bottom + 2, flipTop: rect.top };
    }
    if ('clientX' in at) {
        return { left: at.clientX, top: at.clientY, flipTop: at.clientY };
    }
    return { left: at.x, top: at.y, flipTop: at.y };
}

/**
 * Opens a menu: renders the entries that are visible, puts it on the body and keeps it in the window.
 * The menu open before is closed. The grid closes this one on a click outside it, on scroll (with
 * `autoRemoveContextMenuOnScrollEvent`), when another menu opens and when the grid leaves the page.
 *
 * An item click closes the menu first, then calls the item's action: an action can open another menu.
 */
export function showMenu(ctx: Grid, entries: MenuEntry[], context: MenuContext, place: MenuPlace) {
    removeContextMenu(ctx);

    const menu = createElement('div', 'simple-html-grid');
    menu.classList.add('simple-html-grid-reset');
    menu.style.position = 'absolute';
    menu.style.top = asPx(place.top);
    menu.style.left = asPx(place.left);
    menu.style.minWidth = asPx(130);

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
                return html`<div
                    class=${classes}
                    data-menu-id=${entry.id}
                    aria-disabled=${disabled ? 'true' : nothing}
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

    document.body.appendChild(menu);

    // keep it in the window: above the cell/point when there is no room below, moved left when it
    // sticks out on the right
    const rect = menu.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
        menu.style.top = asPx(place.flipTop - rect.height);
    }
    if (rect.right > window.innerWidth) {
        menu.style.left = asPx(Math.max(0, window.innerWidth - rect.width));
    }

    ctx.contextMenu = menu;

    // openMenu() called from a click handler: that click still bubbles up to the document, where the
    // grid closes menus on a click outside them. It must not close this one. A click is dispatched in
    // one task, the timer runs after it
    ctx.menuJustOpened = true;
    setTimeout(() => {
        ctx.menuJustOpened = false;
    });
}
