import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { RowCache } from '../types';
import { updateRowCache } from './updateRowCache';

import { updateColCache } from './updateColCache';

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
            let scrollDirection = 'left';
            if (connector.config.scrollLeft < e.target.scrollLeft) {
                scrollDirection = 'right';
            }

            connector.config.scrollLeft = e.target.scrollLeft;

            updateColCache(ref, connector, scrollDirection);
            /*  const node = ref.getElementsByTagName('simple-html-grid-body')[0] as SimpleHtmlGridBody;
            const width = node.clientWidth;
            const left = node.scrollLeft;

            const groups = connector.config.groups;
            ref.colCache.forEach((col) => {
                const g = groups[col.i];
                const c1 = g.__left + g.width < left;

                const c2 = g.__left > left + width;
                if (c1 && scrollDirection === 'right') {
                    const newIndex = ref.colCache[ref.colCache.length - 1].i + 1;
                    if (newIndex <= groups.length - 1) {
                        col.i = newIndex;
                        col.update = true;
                    }
                    ref.colCache.sort((a, b) => (a.i < b.i ? -1 : 1));
                }

                if (c2 && scrollDirection === 'left') {
                    const newIndex = ref.colCache[0].i - 1;
                    if (newIndex > -1) {
                        col.i = newIndex;
                        col.update = true;
                    }
                    ref.colCache.sort((a, b) => (a.i < b.i ? -1 : 1));
                }
            }); */

            /*  if (!check) {
                check = ref.colCache.map((e) => e.i).join(',');
            } */

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
