import { GridInterface } from './gridInterface';
import { FreeGrid } from '.';

export function scrollEvent(
    connector: GridInterface,
    rowPositionCache: {
        i: number;
    }[],
    ref: FreeGrid
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
            // window.focus();
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
            if (Math.abs(scrolltop - lastScrollTop) > 100) {
                scrollbars = true;
            }

            if (scrollbars) {
                let newTopPosition = scrolltop;
                if (connector.displayedDataset.length <= rowPositionCache.length) {
                    newTopPosition = 0;
                }

                let rowTopState: any = connector.getScrollVars.__SCROLL_TOPS;

                let currentRow = 0;

                let i = 0;

                if (newTopPosition !== 0) {
                    // need to do some looping here, need to figure out where we are..
                    while (i < rowTopState.length) {
                        let checkValue = Math.floor(newTopPosition - rowTopState[i]);

                        if (checkValue < 0) {
                            currentRow = i - 1;

                            break;
                        }

                        i++;
                    }
                }

                for (let i = 0; i < rowPositionCache.length; i++) {
                    rowPositionCache[i].i = currentRow + i;
                }
                rowPositionCache.sort();
                //requestAnimationFrame(() => {
                ref.triggerEvent('vertical-scroll');
                //});
            } else {
                let rowHeightState: any = connector.getScrollVars.__SCROLL_HEIGHTS;
                let rowTopState: any = connector.getScrollVars.__SCROLL_TOPS;

                for (let i = 0; i < rowPositionCache.length; i++) {
                    let currentRow = rowPositionCache[i].i;
                    let currentTop = rowTopState[rowPositionCache[i].i];

                    let update = false;

                    if (!isDownScroll) {
                        if (currentTop > scrolltop + e.target.clientHeight) {
                            currentRow = currentRow - rowPositionCache.length;
                            update = true;
                        }
                    } else {
                        if (currentTop < scrolltop - rowHeightState[currentRow]) {
                            update = true;
                            //newTop = rowHeightState[currentRow + rowPositionCache.length];
                            currentRow = currentRow + rowPositionCache.length;
                        }
                    }

                    if (
                        update === true &&
                        currentRow >= 0 &&
                        currentRow <= connector.displayedDataset.length - 1
                    ) {
                        rowPositionCache[i].i = currentRow;
                    }
                }
                rowPositionCache.sort();
                // requestAnimationFrame(() => {
                ref.triggerEvent('vertical-scroll');
                // });
            }
            // need to call render directly so it updates right away
        }
    };
}
