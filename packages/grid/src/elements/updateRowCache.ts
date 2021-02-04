import { GridInterface, SimpleHtmlGrid } from '..';
import { RowCache } from '../types';
import { SimpleHtmlGridBody } from './simple-html-grid-body';

export function updateRowCache(
    connector: GridInterface,
    rowPositionCache: RowCache[],
    ref: SimpleHtmlGrid,
    scrollTop: number,
    skipUpdate?: boolean
) {
    let newTopPosition = scrollTop;
    if (connector.displayedDataset.length <= rowPositionCache.length) {
        newTopPosition = 0;
    }

    const rowTopState: any = connector.getScrollVars.__SCROLL_TOPS;

    let currentRow = 0;

    let i = 0;

    if (newTopPosition !== 0) {
        // need to do some looping here, need to figure out where we are..
        while (i < rowTopState.length) {
            const checkValue = Math.floor(newTopPosition - rowTopState[i]);
            if (checkValue < 0) {
                currentRow = i - 1;
                break;
            }
            i++;
        }
    }

    let rowFound = currentRow;
    const update = [];
    for (let i = 0; i < rowPositionCache.length; i++) {
        const newRow = currentRow + i;
        if (newRow > connector.displayedDataset.length - 1) {
            rowFound--;
            update.push(rowFound);
        } else {
            update.push(newRow);
        }
        rowPositionCache[i].update = true;
    }

    for (let i = 0; i < rowPositionCache.length; i++) {
        const row = update.indexOf(rowPositionCache[i].i);
        if (row !== -1) {
            update.splice(row, 1);
            rowPositionCache[i].update = false;
        }
    }
    for (let i = 0; i < rowPositionCache.length; i++) {
        if (rowPositionCache[i].update) {
            const row = update.splice(0, 1)[0];
            rowPositionCache[i].i = row;
        } else {
            rowPositionCache[i].update = false;
        }
    }

    if (!skipUpdate) {
        const node = ref.getElementsByTagName('simple-html-grid-body')[0] as SimpleHtmlGridBody;
        node.rows.forEach((row) => {
            row.verticalScrollEvent();
        });
    }
}
