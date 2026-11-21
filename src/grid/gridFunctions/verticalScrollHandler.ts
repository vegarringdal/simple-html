import type { Grid } from '../grid';
import { updateAriaGrid, updateAriaRow } from './ariaGrid';
import { asPx } from './asPx';
import { assignPool } from './assignPool';
import type { ColType, RowCache } from './colType';
import { firstIndexAtOrAfter } from './firstIndexAtOrAfter';
import {
    GROUP_COLTYPE,
    LEFT_PINNED_COLTYPE,
    MIDDLE_PINNED_COLTYPE,
    RIGHT_PINNED_COLTYPE,
    SELECTOR_COLTYPE
} from './GROUP_COLTYPE';
import { getElementByClassName } from './getElementByClassName';
import { hideAllRows } from './hideAllRows';
import { renderRowColumns } from './pinnedSection';
import { removeContextMenu } from './removeContextMenu';
import { renderCell } from './renderCell';

/**
 * How far, in px, the rows can scroll from where they were last rendered and still be rendered on
 * the scroll event, see verticalScrollHandler
 */
const LARGE_SCROLL_TOP = 500;

/**
 * Renders the rows for a scroll position: which row each row element shows (the row elements are a
 * pool reused while scrolling, see assignPool), and the rows themselves, in every section.
 *
 * The rows on screen are every row that starts inside the viewport, and the one before the first of
 * them (partly on screen).
 *
 * Only the row elements that got another row (or were hidden) are rendered, unless `renderAll`: the
 * others show their row already, and a change of its values renders itself (the datasource's
 * `rows-changed` event, see renderChangedRows). A row element that keeps its row is not touched at all.
 *
 * A jump of more than {@link LARGE_SCROLL_TOP} from where the rows were last rendered - the
 * scrollbar dragged, a click in its track - is not rendered: every row element would get another
 * row and render all its cells, on every scroll event of a drag. The rows are hidden instead, and
 * it returns false: the scroll listener renders them when the scrolling stops, see
 * addScrollEventListeners. A caller that wants the rows rendered now sets `ctx.lastScrollTop` to the
 * position first, see triggerScrollEvent.
 *
 * @param scrollTop the scroll position of the rows
 * @param renderAll render every row element on screen, also one that keeps its row: for
 * `gridInterface.refresh()` (triggerScrollEvent) and the first render. Default `false`, a scroll
 * @returns true when the rows were rendered, false when they were hidden for a large jump
 */
export function verticalScrollHandler(ctx: Grid, scrollTop: number, renderAll = false) {
    if (ctx.gridInterface.__getGridConfig().autoRemoveContextMenuOnScrollEvent) {
        removeContextMenu(ctx);
    }

    const largeScroll = Math.abs(ctx.lastScrollTop - scrollTop) > LARGE_SCROLL_TOP;
    ctx.lastScrollTop = scrollTop;
    if (largeScroll) {
        hideAllRows(ctx);
        return false;
    }

    const rowTops = ctx.gridInterface.__getScrollState().scrollTops;
    const viewportHeight = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller').clientHeight;

    // the first row that starts at the top of the viewport or below it - at 0 that is the second row,
    // the first one is the row before it - and the first row that starts at its bottom or below it
    const topRow = firstIndexAtOrAfter(rowTops, scrollTop || 0.1);
    const belowRow = firstIndexAtOrAfter(rowTops, scrollTop + viewportHeight, topRow);

    // the n-th row element of every section shows the same row
    const rows = assignPool(
        ctx.containerGroupRowCache.map((entry) => entry.row),
        Math.max(topRow - 1, 0),
        belowRow
    );

    const sections: [RowCache[], ColType][] = [
        [ctx.containerGroupRowCache, GROUP_COLTYPE],
        [ctx.containerSelectorRowCache, SELECTOR_COLTYPE],
        [ctx.containerLeftRowCache, LEFT_PINNED_COLTYPE],
        [ctx.containerMiddleRowCache, MIDDLE_PINNED_COLTYPE],
        [ctx.containerRightRowCache, RIGHT_PINNED_COLTYPE]
    ];
    for (const [rowCache, colType] of sections) {
        rowCache.forEach((entry, i) => {
            const moved = entry.row !== rows[i];
            entry.row = rows[i];
            renderRow(ctx, entry, colType, renderAll || moved);
        });
    }

    // the rows in the order of the rows, the counts: see ariaGrid.ts
    updateAriaGrid(ctx);

    return true;
}

/**
 * Renders a row element of a section for the row it shows (`entry.row`), hidden when it shows none:
 * its place, height and classes (even/odd, selected), and its cells - the cell of the group row or of
 * the row selector, or the column elements of a pinned section
 * @param render false when the row element kept its row: a shown one is left as it is, it is up to
 * date. A hidden one (a large jump hid it) is rendered
 */
function renderRow(ctx: Grid, entry: RowCache, colType: ColType, render: boolean) {
    const rowElement = ctx.rows.get(entry.id);

    if (entry.row === -1) {
        if (rowElement) {
            rowElement.style.display = 'none';
        }
        return;
    }

    const { scrollTops, scrollHeights } = ctx.gridInterface.__getScrollState();
    entry.top = scrollTops[entry.row];
    if (!rowElement || (!render && rowElement.style.display === 'block')) {
        return;
    }

    // the row selector's row element is the row for a screen reader, see ariaGrid.ts
    if (colType === SELECTOR_COLTYPE) {
        updateAriaRow(ctx, rowElement, entry.row);
    }

    rowElement.classList.remove('simple-html-grid-row-even');
    rowElement.classList.remove('simple-html-grid-row-odd');
    rowElement.classList.remove('simple-html-grid-selected-row-odd');
    rowElement.classList.remove('simple-html-grid-selected-row-even');
    const even = entry.row % 2 === 0;
    if (ctx.gridInterface.getDatasource().getSelection().isSelected(entry.row)) {
        rowElement.classList.add(even ? 'simple-html-grid-selected-row-even' : 'simple-html-grid-selected-row-odd');
    } else {
        rowElement.classList.add(even ? 'simple-html-grid-row-even' : 'simple-html-grid-row-odd');
    }

    rowElement.style.display = 'block';
    rowElement.style.transform = `translate3d(0px, ${entry.top}px, 0px)`;
    rowElement.style.height = asPx(scrollHeights[entry.row]);

    if (colType === GROUP_COLTYPE || colType === SELECTOR_COLTYPE) {
        renderCell(ctx, rowElement, entry.row, 0, 0, colType);
    } else {
        renderRowColumns(ctx, entry, colType, true);
    }
}
