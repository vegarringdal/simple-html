import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { RowCache } from '../types';
import { updateRowCache } from './updateRowCache';

import { SimpleHtmlGridBody } from './simple-html-grid-body';

let scrollBarTimer: any;
let configLastScrollLeft: any;

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

            const scrollLeft = e.target.scrollLeft;
            const lastScrollLeft = configLastScrollLeft;
            configLastScrollLeft = scrollLeft;

            let scrollbars = false;
            if (Math.abs(scrollLeft - lastScrollLeft) > 2000) {
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
                    ref.resetColCache();
                    scrollBarTimer = null;
                    const node = ref.getElementsByTagName(
                        'simple-html-grid-body'
                    )[0] as SimpleHtmlGridBody;
                    node.rows.forEach((row) => {
                        row.horizontalScollEvent();
                    });
                    ref.colCache.forEach((e) => (e.update = false));
                }, 70);
            } else {
                /**
                 * Normal scrolling (not scrollbar)
                 */

                const node = ref.getElementsByTagName(
                    'simple-html-grid-body'
                )[0] as SimpleHtmlGridBody;
                const clientWidth = node?.clientWidth;
                const scrollLeft = node?.scrollLeft;
                const newColCache: any[] = [];
                connector.config.groups.forEach((group, i) => {
                    if (group.__left < clientWidth + scrollLeft && group.__left >= scrollLeft) {
                        newColCache.push({ i, update: true });
                    }
                });

                ref.colCache.forEach((e) => (e.found = false));
                const ok = newColCache.map((e) => e.i);
                if (newColCache > ref.colCache) {
                    while (newColCache.length !== ref.colCache.length) {
                        ref.colCache.push({ i: -1, update: true, found: false });
                    }
                }
                ref.colCache.forEach((e) => {
                    if (ok.indexOf(e.i) !== -1) {
                        e.found = true;
                        e.update = false;
                        ok.splice(ok.indexOf(e.i), 1);
                    } else {
                        e.found = false;
                        e.update = true;
                    }
                });
                if (ok.length) {
                    ref.colCache.forEach((e) => {
                        if (e.update && ok.length) {
                            e.i = ok.pop();
                            e.found = true;
                        }
                    });
                }

                let l = ref.colCache.length;
                for (let i = 0; i < l; i++) {
                    if (ref.colCache[i].found === false) {
                        ref.colCache.splice(i, 1);
                        i--;
                        l--;
                    }
                }

                // console.log(ref.colCache.map((e) => e.i).join(','));
                scrollBarTimer = null;

                node.rows.forEach((row) => {
                    row.horizontalScollEvent();
                });
                ref.colCache.forEach((e) => (e.update = false));
            }

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
