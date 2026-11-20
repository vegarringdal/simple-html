import type { Grid } from '../grid';
import { removeContextMenu } from './removeContextMenu';

/**
 * ctx listen for click events and closes menus if open and not clicked on
 *
 * The listener is kept on ctx.clickListner so disconnectElement can remove it - a listener left on
 * the document keeps the whole grid (and its datasource) alive after the element is gone.
 */
export function addBodyClickListener(ctx: Grid) {
    // called again when the grid is re-attached, never add it twice
    if (ctx.clickListner) {
        document.removeEventListener('click', ctx.clickListner);
    }

    const clickListner = (e: any) => {
        let node = e.target;
        let keep = false;
        while (node) {
            if (node.classList?.contains('simple-html-grid-menu')) {
                keep = true;
                break;
            }
            node = node.parentNode;
        }

        if (!keep) {
            removeContextMenu(ctx);
        }
    };

    ctx.clickListner = clickListner;
    document.addEventListener('click', clickListner);
}
