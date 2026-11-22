import type { Grid } from '../grid';
import { hideTooltipIn } from './tooltip';

/**
 * Closes the grid's open menu, see openMenuElement, with its submenus: they are in its popover (see
 * showMenu). Does nothing when no menu is open.
 */
export function removeContextMenu(ctx: Grid) {
    const menu = ctx.contextMenu;
    const returnFocus = ctx.menuReturnFocus;
    // a submenu about to open or close on its timer
    clearTimeout(ctx.menuTree?.timer);
    ctx.menuTree = null;
    ctx.contextMenu = null;
    ctx.menuReturnFocus = null;
    if (menu) {
        closePopover(menu, returnFocus);
    }
}

/**
 * Takes a menu (a popover) off the page: removed from the dom, the browser hides it and takes it out
 * of the top layer as well. A tooltip shown in it goes with it.
 *
 * When the focus is in it - a search field of the menu - the focus goes back to `returnFocus`, the
 * element that had it when the menu opened (the cell or header filter it was opened from). Removing
 * the element with the focus would leave the focus on the body.
 */
export function closePopover(popover: HTMLElement, returnFocus: Element | null) {
    const hadFocus = popover.contains(document.activeElement);
    // a tooltip it shows goes with it, see hideTooltipIn
    hideTooltipIn(popover);
    popover.remove();
    if (hadFocus && returnFocus instanceof HTMLElement && returnFocus.isConnected) {
        // the cell is where it was when the menu opened, the grid must not scroll to it
        returnFocus.focus({ preventScroll: true });
    }
}
