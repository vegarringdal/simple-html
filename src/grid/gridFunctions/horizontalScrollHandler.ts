import type { Grid } from '../grid';
import { followMiddleScroll } from './aggregates';
import { updateAriaGrid } from './ariaGrid';
import { assignPool } from './assignPool';
import type { ColType } from './colType';
import { firstIndexAtOrAfter } from './firstIndexAtOrAfter';
import { MIDDLE_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { getElementByClassName } from './getElementByClassName';
import { getGroupingWidth } from './getGroupingWidth';
import { pinnedSection, placeColumn, renderRowColumns } from './pinnedSection';
import { removeContextMenu } from './removeContextMenu';
import { renderCell } from './renderCell';

/**
 * Renders the columns of a section for a scroll position: which column each column element shows
 * (the column elements are a pool reused while scrolling, see assignPool), placed at their columns in
 * the header and in every row on screen. Only the middle section scrolls sideways; the pinned ones
 * come here at 0 when a column is resized, see rebuildHeaderColumns.
 *
 * The columns on screen are every column that starts inside the section's viewport, and the one
 * before the first of them (partly on screen).
 *
 * @param scrollLeft the scroll position of the section
 * @param type the section, the middle by default
 */
export function horizontalScrollHandler(ctx: Grid, scrollLeft: number, type: ColType = MIDDLE_PINNED_COLTYPE) {
    if (ctx.gridInterface.__getGridConfig().autoRemoveContextMenuOnScrollEvent) {
        removeContextMenu(ctx);
    }

    ctx.lastScrollLeft = scrollLeft;

    // the aggregates of the middle columns in the group rows and the totals row, see aggregates.ts
    if (type === MIDDLE_PINNED_COLTYPE) {
        followMiddleScroll(ctx, scrollLeft);
    }

    const { columns, columnCache, rowCache, viewClass } = pinnedSection(ctx, type);

    // where each column starts in the section
    const columnLefts: number[] = [];
    let left = 0;
    for (const column of columns) {
        columnLefts.push(left);
        left = left + column.width;
    }

    // the first column that starts at the left edge of the viewport or right of it, and the first one
    // that starts at its right edge or right of it. The viewport is 0 wide while the grid is not
    // rendered (display: none), at 0 that finds column 0: the columns the pool has elements for then
    const viewportWidth = getElementByClassName(ctx.element, viewClass).clientWidth;
    const leftColumn = firstIndexAtOrAfter(columnLefts, scrollLeft);
    const rightColumn = firstIndexAtOrAfter(columnLefts, scrollLeft + viewportWidth, leftColumn) || columnCache.length;

    // the left pinned columns start after the grouping column, see getGroupingWidth
    const offset = getGroupingWidth(ctx, type);
    const shown = assignPool(
        columnCache.map((cached) => cached.column),
        Math.max(leftColumn - 1, 0),
        rightColumn
    );
    columnCache.forEach((cached, i) => {
        cached.column = shown[i];
        // NaN for an element that shows no column, it is hidden
        cached.left = columnLefts[cached.column] + offset;
    });

    // the header: one column element per column element of a row. Its cells show the column at its
    // left, whatever the row: rendered when it is made (rebuildHeaderColumns), again when it moves
    columnCache.forEach((cached, i) => {
        const header = ctx.columnsHeaders.get(type + i.toString());
        if (!header) {
            return;
        }
        if (cached.column === -1) {
            header.style.display = 'none';
            return;
        }
        if (placeColumn(header, cached.left, columns[cached.column].width)) {
            for (let c = 0; c < header.children.length; c++) {
                // the resize handle has no cellNo, parseInt('') is NaN like parseInt(null)
                const cellNo = parseInt(header.children[c].getAttribute('cellNo') ?? '', 10);
                renderCell(ctx, header.children[c] as HTMLElement, 0, cached.column, cellNo, type);
            }
        }
    });

    // the rows on screen. A row element verticalScrollHandler has not shown - hidden, or new and not
    // rendered yet - is left: it renders all the columns of a row when it shows it
    for (const entry of rowCache) {
        if (entry.row !== -1 && ctx.rows.get(entry.id)?.style.display === 'block') {
            renderRowColumns(ctx, entry, type, false);
        }
    }

    // the cells of the rows in the order of the columns, see ariaGrid.ts
    updateAriaGrid(ctx);
}
