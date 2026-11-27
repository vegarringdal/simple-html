import type { CellRenderer } from '../cellRendererRegistry';

/**
 * The cells of a text column with a link (`ColumnFormat.link`): a custom cell (customCell.ts) the grid
 * draws itself - the host has the focus, the keys, the editing and the menus of a custom cell - with an
 * `<a>` in it showing the cell's text (its template's, `ColumnFormat.text`).
 *
 * - **The link**: the `<a>` has the row's address (`href`, GridInterface.__getCellLink) when there is
 *   one the grid links to; a row without one - an empty field, an address that is not allowed - has the
 *   `<a>` without `href`: no link, its text only. In a new tab with `newTab` (`target="_blank"`,
 *   `rel="noopener noreferrer"`). The text is set with `textContent`, the address with `href`: no html.
 * - **A click on its text opens it**: a plain click, Ctrl/Cmd+click (a new tab, the browser's), a middle
 *   click (the browser's). Shift+click makes a range of cells and Alt+click is nothing (the browser
 *   would open a window, save the target): neither opens it. The second click of a double click does not
 *   open it again.
 * - **The cell, not the link, takes the focus**: a press on the text focuses the host (the link is out
 *   of the tab order, and a press does not focus it), so the keys are the cell's as anywhere in it. A
 *   right click opens the row menu, the focus stays where it was.
 * - **Editing**: as a custom cell - Enter, F2, a character typed, a double click beside the text open the
 *   grid's editor of one line with the value (not the template). **Alt+Enter** opens the link
 *   (openCellLink, as Google Sheets), the host has `aria-keyshortcuts="Alt+Enter"`.
 * - **A screen reader** finds the link in the cell, its name its text.
 */

/**
 * the id the link cells are mounted under (HTMLCellElement.$renderer): `''` is no id a renderer can be
 * registered under (registerCellRenderer), so it is never a column's `renderer`
 */
export const LINK_RENDERER_ID = '';

/** the class of the `<a>` of a link cell */
export const LINK_CLASS = 'simple-html-grid-cell-link';

/**
 * The link of a link cell, for a host: the `<a>` made once, its text and address set on every render.
 * The `<a>` is the host's only child
 */
export const linkRenderer: CellRenderer = (host) => {
    const link = document.createElement('a');
    link.className = LINK_CLASS;
    // the cell is the stop of Tab and the arrows, not the link in it
    link.tabIndex = -1;
    // a press and a drag on the text make ranges of cells, the link is not dragged off as a url
    link.draggable = false;
    link.addEventListener('mousedown', (event) => {
        // no focus on the link (its keys would be a control's, not the cell's), no text selection. The
        // main button focuses the cell, as a press beside the text does; a right click leaves the focus
        // where it is, the row menu opens on this cell. The middle button is the browser's
        if (event.button === 0) {
            event.preventDefault();
            // the focusing steps do nothing for the element that has the focus already
            host.focus({ preventScroll: true });
        } else if (event.button === 2) {
            event.preventDefault();
        }
    });
    link.addEventListener('click', (event) => {
        // Shift: a range of cells (rangeSelection.ts). Alt: Chrome saves the target. The second click of
        // a double click: it was opened by the first
        if (event.shiftKey || event.altKey || event.detail > 1) {
            event.preventDefault();
        }
    });
    host.appendChild(link);

    return {
        update({ row, field, text, gridInterface }) {
            link.textContent = text;
            const address = gridInterface.__getCellLink(field, row);
            if (!address) {
                // no href: no link, its text only - not focusable, no role link
                link.removeAttribute('href');
                link.removeAttribute('target');
                link.removeAttribute('rel');
                return;
            }
            link.href = address.href;
            if (address.newTab) {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            } else {
                link.removeAttribute('target');
                link.removeAttribute('rel');
            }
        }
    };
};

/**
 * Opens the link of a link cell, for Alt+Enter: a click on its `<a>`, so it opens as a click opens it -
 * in a new tab with `newTab`, with its `rel`
 * @returns false when the cell shows no link (the row has no address)
 */
export function openCellLink(host: HTMLElement): boolean {
    const link = host.querySelector<HTMLAnchorElement>(`a.${LINK_CLASS}[href]`);
    if (!link) {
        return false;
    }
    link.click();
    return true;
}

/**
 * true when an element is the link of a link cell, or in it, with an address: a press there opens it
 */
export function isCellLinkTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(`a.${LINK_CLASS}[href]`) !== null;
}
