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
        function horizontalScroll() {
            const scrollLeft = e.target.scrollLeft;
            const lastScrollLeft = connector.config.scrollLeft;

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
                let minGroups = Math.floor(clientWidth / 50) || 22;
                if (minGroups > connector.config.groups.length) {
                    minGroups = connector.config.groups.length;
                }

                connector.config.groups.forEach((group, i) => {
                    const cellRight = group.__left + group.width;
                    const cellLeft = group.__left;
                    const rightMargin = clientWidth + scrollLeft;
                    const leftMargin = scrollLeft;

                    if (cellRight >= leftMargin && cellLeft <= rightMargin) {
                        newColCache.push({ i, update: true, found: false });
                        return;
                    }
                });

                if (newColCache.length < minGroups) {
                    while (newColCache.length < minGroups) {
                        let next = newColCache[newColCache.length - 1].i + 1;
                        if (next >= connector.config.groups.length) {
                            next = newColCache[0].i - 1;
                            newColCache.unshift({
                                i: next,
                                update: true,
                                found: false
                            });
                        } else {
                            newColCache.push({
                                i: next,
                                update: true,
                                found: false
                            });
                        }
                    }
                }

                ref.colCache = node.rows[0]?.colEls?.map((e) => e.group) || [];

                ref.colCache.forEach((e) => (e.found = false));
                const ok = newColCache.map((e) => e.i);

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
                        node.rows.forEach((row) => {
                            row.colEls[i].parentNode.removeChild(row.colEls[i]);
                            row.colEls.splice(i, 1);
                        });
                        ref.colCache.splice(i, 1);
                        i--;
                        l--;
                    }
                }

                if (ok.length) {
                    // if I get col issues I need to check this
                    /* ok.forEach((x: number) => {
                        ref.colCache.push({
                            i: x,
                            update: true,
                            found: true
                        })
                    }); */
                }

                scrollBarTimer = null;

                node.rows.forEach((row) => {
                    row.horizontalScollEvent();
                });
                ref.colCache.forEach((e) => {
                    e.update = false;
                });
            }
            connector.config.scrollLeft = e.target.scrollLeft;
            ref.triggerEvent('horizontal-scroll');
        }

        function verticalScroll() {
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

        if (connector.config.scrollLeft !== e.target.scrollLeft) {
            // requestAnimationFrame(() => {
            horizontalScroll();
            // });
        }

        if (connector.config.lastScrollTop !== e.target.scrollTop) {
            //requestAnimationFrame(() => {
            verticalScroll();
            // });
        }
    };
}
