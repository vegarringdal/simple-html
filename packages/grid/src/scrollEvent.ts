import { GridInterface } from './gridInterface';
import { FreeGrid } from '.';

export function scrollEvent(
    connector: GridInterface,
    rowPositionCache: {
        i: number;
    }[],
    ref:FreeGrid
) {
    return (e: any) => {
        if (connector.config.scrollLeft && connector.config.scrollLeft !== e.target.scrollLeft && connector.config.lastScrollTop == e.target.scrollTop) {
            connector.config.scrollLeft = e.target.scrollLeft;
            connector.reRender();
        } else {

           // window.focus();
           connector.config.scrollLeft = e.target.scrollLeft;
            if (document.activeElement) {
                (document.activeElement as any).blur();
            }
            const rowHeight = connector.config.__rowHeight;
            const cacheLength = rowPositionCache.length;
            const collectionLength = connector.displayedDataset.length;
            const cacheTotalHeight = rowHeight * cacheLength;
            const contentHeight = e.target.clientHeight;
            const scrolltop = e.target.scrollTop;
            const lastScrollTop = connector.config.lastScrollTop;
            let isDownScroll = true;
            if (scrolltop < lastScrollTop) {
                isDownScroll = false;
            }
            let scrollbars = false;
            if (Math.abs(scrolltop - lastScrollTop) > 100) {
                scrollbars = true;
            }
            connector.config.lastScrollTop = scrolltop;
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
            ref.triggerEvent('scrolled');
        }
    };
}
