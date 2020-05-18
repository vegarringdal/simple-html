import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { RowCache } from '../types';

let scrollBarTimer: any;

export function scrollEvent(
    connector: GridInterface,
    rowPositionCache: RowCache[],
    ref: SimpleHtmlGrid
) {
    return (e: any) => {
        if (
            connector.config.scrollLeft &&
            connector.config.scrollLeft !== e.target.scrollLeft &&
            connector.config.lastScrollTop == e.target.scrollTop
        ) {
            connector.config.scrollLeft = e.target.scrollLeft;
            ref.triggerEvent('horizontal-scroll');
        } else {
            connector.config.scrollLeft = e.target.scrollLeft;
            if (document.activeElement) {
                (document.activeElement as any).blur();
            }

            const scrolltop = e.target.scrollTop;
            const lastScrollTop = connector.config.lastScrollTop;
            connector.config.lastScrollTop = scrolltop;
            let isDownScroll = true;
            if (scrolltop < lastScrollTop) {
                isDownScroll = false;
            }

            let scrollbars = false;
            if (Math.abs(scrolltop - lastScrollTop) > 300) {
                scrollbars = true;
            }

            if (scrollbars || scrollBarTimer) {
                /**
                 * Scrollbar scrolling
                 */
                if (scrollBarTimer) {
                    clearTimeout(scrollBarTimer);
                }
                scrollBarTimer = setTimeout(() => {
                    scrollBarTimer = null;
                    let newTopPosition = scrolltop;
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
                    for (let i = 0; i < rowPositionCache.length; i++) {
                        const newRow = currentRow + i;
                        if (newRow > connector.displayedDataset.length - 1) {
                            rowFound--;
                            rowPositionCache[i].i = rowFound;
                        } else {
                            rowPositionCache[i].i = newRow;
                        }
                        rowPositionCache[i].update = true;
                    }
                    ref.triggerEvent('vertical-scroll');
                }, 90);
            } else {
                /**
                 * Normal scrolling (not scrollbar)
                 */
                const rowHeightState: any = connector.getScrollVars.__SCROLL_HEIGHTS;
                const rowTopState: any = connector.getScrollVars.__SCROLL_TOPS;

                for (let i = 0; i < rowPositionCache.length; i++) {
                    let currentRow = rowPositionCache[i].i;
                    const currentTop = rowTopState[rowPositionCache[i].i];

                    let update = false;

                    if (!isDownScroll) {
                        if (currentTop > scrolltop + e.target.clientHeight) {
                            currentRow = currentRow - rowPositionCache.length;
                            update = true;
                        }
                    } else {
                        if (currentTop < scrolltop - rowHeightState[currentRow]) {
                            update = true;
                            currentRow = currentRow + rowPositionCache.length;
                        }
                    }

                    if (
                        update === true &&
                        currentRow >= 0 &&
                        currentRow <= connector.displayedDataset.length - 1
                    ) {
                        rowPositionCache[i].i = currentRow;
                        rowPositionCache[i].update = true;
                    }
                }

                // fix rows to high
                let rowFound = rowPositionCache[0].i;
                const currentRow = rowFound;
                for (let i = 0; i < rowPositionCache.length; i++) {
                    const newRow = currentRow + i;
                    if (newRow > connector.displayedDataset.length - 1) {
                        rowFound--;
                        rowPositionCache[i].i = rowFound;
                        rowPositionCache[i].update = true;
                    }
                }

                ref.triggerEvent('vertical-scroll');
            }
        }
    };
}
