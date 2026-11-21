import { isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import { asPx } from './asPx';
import type { ColType, RowCache } from './colType';
import { LEFT_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import type { HTMLCellElement } from './HTMLCellElement';
import { renderCell } from './renderCell';

/**
 * The column sections of the grid, left to right: the left pinned columns (`GridLayout.left`), the
 * middle (`GridLayout.center`, the part that scrolls sideways) and the right pinned columns
 * (`GridLayout.right`). The scroll handlers treat the three the same way, with the parts of a
 * section this returns:
 *
 * - `columns` its columns in the layout
 * - `columnCache` which column each column element of a row (and of the header) shows, and its left.
 *   Every row element of the section has the same column elements
 * - `rowCache` which row each row element of the section shows
 * - `viewClass` the class of the element the section is seen through: its width is the width of
 *   the section on screen
 *
 * @param colType the section, anything but left or right pinned is the middle
 */
export function pinnedSection(ctx: Grid, colType: ColType) {
    const layout = ctx.gridInterface.__getGridConfig().layout;
    switch (colType) {
        case LEFT_PINNED_COLTYPE:
            return {
                columns: layout.left,
                columnCache: ctx.containerLeftColumnCache,
                rowCache: ctx.containerLeftRowCache,
                viewClass: 'simple-html-grid-body-view-pinned-left'
            };
        case RIGHT_PINNED_COLTYPE:
            return {
                columns: layout.right,
                columnCache: ctx.containerRightColumnCache,
                rowCache: ctx.containerRightRowCache,
                viewClass: 'simple-html-grid-body-view-pinned-right'
            };
        default:
            return {
                columns: layout.center,
                columnCache: ctx.containerMiddleColumnCache,
                rowCache: ctx.containerMiddleRowCache,
                viewClass: 'simple-html-grid-middle-scroller'
            };
    }
}

/**
 * Shows a column element - of a row, or of the header - at the left and with the width of the
 * column it shows. Only what changed is written
 * @param left in its section, the transform
 * @returns true when it moved: it was at the left of another column before
 */
export function placeColumn(element: HTMLElement, left: number, width: number): boolean {
    if (element.style.display !== 'block') {
        element.style.display = 'block';
    }

    const transform = `translate3d(${left}px, 0px, 0px)`;
    const moved = element.style.transform !== transform;
    if (moved) {
        element.style.transform = transform;
    }

    const widthPx = asPx(width);
    if (element.style.width !== widthPx) {
        element.style.width = widthPx;
    }

    return moved;
}

/**
 * true when the cells of a column element show this column of this row: renderCell puts what a cell
 * shows on it, see HTMLCellElement
 */
function showsColumn(columnElement: HTMLElement, row: number, column: number) {
    const cell = columnElement.firstElementChild as HTMLCellElement | null;
    return cell?.$row === row && cell?.$column === column;
}

/**
 * Renders the column elements of a row element of a section for the row it shows: an element that
 * shows no column is hidden, and all of them in a group row (the group section shows that row).
 * The others are placed at their column (see placeColumn) and their cells rendered.
 *
 * Used by both scroll handlers. verticalScrollHandler gave the row element another row, or was asked
 * to render: every cell is rendered. horizontalScrollHandler gave the column elements other columns:
 * only the cells that do not show their column of the row yet are. Not decided by whether the column
 * element moved: one that was hidden while its row changed, or a new one, can be at the left of its
 * column without showing it
 *
 * @param entry the row element, in the row cache of its section
 * @param colType the section: left pinned, middle or right pinned
 * @param renderAll render the cells of every column element
 */
export function renderRowColumns(ctx: Grid, entry: RowCache, colType: ColType, renderAll: boolean) {
    const { columns, columnCache } = pinnedSection(ctx, colType);
    const groupRow = isGroupRow(ctx.gridInterface.getDatasource().getRow(entry.row));

    columnCache.forEach((cached, i) => {
        const columnElement = ctx.columns.get(`${entry.id}:${i}`);
        if (!columnElement) {
            return;
        }

        if (cached.column === -1 || groupRow) {
            if (columnElement.style.display !== 'none') {
                columnElement.style.display = 'none';
            }
            return;
        }

        placeColumn(columnElement, cached.left, columns[cached.column].width);
        if (renderAll || !showsColumn(columnElement, entry.row, cached.column)) {
            for (let cellNo = 0; cellNo < columnElement.children.length; cellNo++) {
                renderCell(ctx, columnElement.children[cellNo] as HTMLElement, entry.row, cached.column, cellNo, colType);
            }
        }
    });
}
