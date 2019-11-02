import { CallbackEvent } from './interfaces';
import { FreeGrid } from '.';
export function scrollEvent(
    freeGrid: FreeGrid,
    rowPositionCache: {
        i: number;
    }[]
) {
    return (e: CallbackEvent) => {
        if (freeGrid.config.scrollLeft && freeGrid.config.scrollLeft !== e.target.scrollLeft && freeGrid.config.lastScrollTop == e.target.scrollTop) {
            freeGrid.config.scrollLeft = e.target.scrollLeft;
            freeGrid.reRender();
        } else {

           // window.focus();
           freeGrid.config.scrollLeft = e.target.scrollLeft;
            if (document.activeElement) {
                (document.activeElement as any).blur();
            }
            const rowHeight = freeGrid.config.rowHeight || 25;
            const cacheLength = rowPositionCache.length;
            const collectionLength = freeGrid.viewRows.length;
            const cacheTotalHeight = rowHeight * cacheLength;
            const contentHeight = e.target.clientHeight;
            const scrolltop = e.target.scrollTop;
            const lastScrollTop = freeGrid.config.lastScrollTop;
            let isDownScroll = true;
            if (scrolltop < lastScrollTop) {
                isDownScroll = false;
            }
            let scrollbars = false;
            if (Math.abs(scrolltop - lastScrollTop) > 100) {
                scrollbars = true;
            }
            freeGrid.config.lastScrollTop = scrolltop;
            let currentRow = Math.floor(scrolltop / rowHeight);
            if (scrollbars) {
                for (let i = 0; i < cacheLength; i++) {
                    rowPositionCache[i].i = currentRow;
                    currentRow++;
                }
            } else {
                for (let i = 0; i < cacheLength; i++) {
                    const cache = rowPositionCache[i];
                    const currentTop = cache.i * rowHeight;
                    let needToUpdate = false;
                    let newTop: number;
                    if (!isDownScroll) {
                        if (currentTop > scrolltop + contentHeight) {
                            needToUpdate = true;
                            newTop = currentTop - cacheTotalHeight;
                            currentRow = (currentTop - cacheTotalHeight) / rowHeight;
                        }
                    } else {
                        if (currentTop < scrolltop - rowHeight) {
                            needToUpdate = true;
                            newTop = currentTop + cacheTotalHeight;
                            currentRow = (currentTop + cacheTotalHeight) / rowHeight;
                        }
                    }
                    if (
                        needToUpdate === true &&
                        currentRow >= 0 &&
                        currentRow <= collectionLength
                    ) {
                        rowPositionCache[i].i = newTop / rowHeight;
                    }
                }
                rowPositionCache.sort();
            }
            // need to call render directly so it updates right away
            freeGrid.render();
        }
    };
}
