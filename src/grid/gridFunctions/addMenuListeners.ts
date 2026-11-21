import type { Grid } from '../grid';
import { removeContextMenu } from './removeContextMenu';

/**
 * Closes the grid's open menu on a click outside it and on Esc. The menus are `popover="manual"`
 * (see openMenuElement), so the browser does neither.
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

    document.addEventListener(
        'keydown',
        (event) => {
            // canceled: something on the page has used this Esc already
            if (event.key !== 'Escape' || event.defaultPrevented || !ctx.contextMenu?.isConnected) {
                return;
            }
            // Esc closes the menu only: the browser closes a modal dialog - the filter editor, the menu
            // of a picker in it - on an Esc that is not canceled
            event.preventDefault();
            removeContextMenu(ctx);
        },
        { signal }
    );
}
