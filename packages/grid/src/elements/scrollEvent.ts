import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { RowCache } from '../types';
import { updateRowCache } from './updateRowCache';

import { SimpleHtmlGridBody } from './simple-html-grid-body';

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
            connector.config.lastScrollTop === e.target.scrollTop
        ) {
            connector.config.scrollLeft = e.target.scrollLeft;

            requestAnimationFrame(() => {
                scrollBarTimer = null;
                ref.resetColCache();

                const node = ref.getElementsByTagName(
                    'simple-html-grid-body'
                )[0] as SimpleHtmlGridBody;
                node.rows.forEach((row) => {
                    row.horizontalScollEvent();
                });
                ref.colCache.forEach((e) => (e.update = false));
            });

            ref.triggerEvent('horizontal-scroll');
        } else {
            connector.config.scrollLeft = e.target.scrollLeft;
            if (document.activeElement) {
                (document.activeElement as any).blur();
            }

            const scrolltop = e.target.scrollTop;
            const lastScrollTop = connector.config.lastScrollTop;
            connector.config.lastScrollTop = scrolltop;

            let scrollbars = false;
            if (Math.abs(scrolltop - lastScrollTop) > 700) {
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
                    updateRowCache(connector, rowPositionCache, ref, scrolltop);
                }, 90);
            } else {
                /**
                 * Normal scrolling (not scrollbar)
                 */
                scrollBarTimer = null;
                updateRowCache(connector, rowPositionCache, ref, scrolltop);
            }
        }
    };
}
