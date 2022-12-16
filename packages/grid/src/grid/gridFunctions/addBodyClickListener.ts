import { Grid } from '../grid';
import { removeContextMenu } from './removeContextMenu';

/**
 * ctx listen for click events and closes menus if open and not clicked on
 */
export function addBodyClickListener(ctx: Grid) {
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

    document.addEventListener('click', clickListner);
}
