import type { Grid } from '../grid';
import { removeContextMenu } from './removeContextMenu';
import { focusMenu } from './showMenu';

/**
 * Closes the grid's open menu on a click outside it and on Esc. The menus are `popover="manual"`
 * (see openMenuElement), so the browser does neither.
 *
 * And the keyboard of the menus (showMenu): whether the last input was a key or a pointer press - a
 * menu opened from the keyboard takes the focus - and ArrowDown / ArrowUp into a menu that was opened
 * with the mouse, which left the focus where it was.
 *
 * The listeners are on the document, removed with `ctx.menuListenersAbort` when the grid leaves the
 * page (disconnectElement): a listener left on the document keeps the whole grid (and its datasource)
 * alive after the element is gone.
 */
export function addMenuListeners(ctx: Grid) {
    // called again when the grid is put back in the dom, never add them twice
    ctx.menuListenersAbort?.abort();
    ctx.menuListenersAbort = new AbortController();
    const signal = ctx.menuListenersAbort.signal;

    document.addEventListener(
        'click',
        (event) => {
            // the click that opened the menu (openMenu() in a click handler), see openMenuElement
            if (ctx.menuJustOpened) {
                return;
            }
            // a click in a menu leaves it open - an item closes its menu itself
            if (event.target instanceof Element && event.target.closest('.simple-html-grid-menu')) {
                return;
            }
            removeContextMenu(ctx);
        },
        { signal }
    );

    // in the capture phase: before the element that has the focus can stop the event. Shift+F10 and
    // the menu key come as a keydown before the contextmenu event, a right click as a pointerdown
    document.addEventListener(
        'keydown',
        () => {
            ctx.keyboardUsed = true;
        },
        { capture: true, signal }
    );
    document.addEventListener(
        'pointerdown',
        () => {
            ctx.keyboardUsed = false;
        },
        { capture: true, signal }
    );

    document.addEventListener(
        'keydown',
        (event) => {
            // canceled: something on the page has used this key already - an item of the menu, Esc in
            // a submenu (it closes the submenu only)
            if (event.defaultPrevented || !ctx.contextMenu?.isConnected) {
                return;
            }
            if (event.key === 'Escape') {
                // Esc closes the menu only: the browser closes a modal dialog - the filter editor, the
                // menu of a picker in it - on an Esc that is not canceled
                event.preventDefault();
                removeContextMenu(ctx);
                return;
            }
            // a menu opened with the mouse: the focus is still on the cell. The arrows get into it
            const arrow = event.key === 'ArrowDown' || event.key === 'ArrowUp';
            if (arrow && ctx.menuTree && !ctx.contextMenu.contains(document.activeElement)) {
                event.preventDefault();
                focusMenu(ctx.menuTree, event.key === 'ArrowUp');
            }
        },
        { signal }
    );
}
