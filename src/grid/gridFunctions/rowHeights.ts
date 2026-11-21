import type { Entity } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { LayoutColumn, ParsedGridConfig } from '../gridConfig';
import { asPx } from './asPx';
import { cellTextOf } from './cellText';
import type { ColType } from './colType';
import { LEFT_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { textLines } from './multilineText';

/**
 * Rows taller than a line, for multiline cells (multilineText.ts): `gridInterface.fitRows()` makes a
 * data row as many lines high as its multiline cells need to show all their lines, and
 * `resetRowHeights()` takes it back. A line is `cellHeight` px.
 *
 * - The interface keeps the lines of each row by the row's key (`__KEY`, the datasource's key field,
 *   or the key the datasource generated), so they follow the row through a sort, a filter and new
 *   data with the same keys. They are not part of the grid's state.
 * - The heights of the rows go into the scroll state (`__dataSourceUpdated`): the scroll handlers place
 *   the rows of every section at the same tops, see verticalScrollHandler.
 * - In a taller row each column divides the row's lines between its cells, see columnCellLines and
 *   placeRowCell: a multiline cell gets the lines its text has, every other cell one line. The text of
 *   every cell stays on its first line; a multiline cell shows its other lines under it (renderRowCell).
 */

/**
 * the most lines fitRows() makes a row: a longer text shows its first lines, and the marker that
 * there are more
 */
export const MAX_ROW_LINES = 20;

/**
 * The columns of the layout, every section: pinned left, center, pinned right
 */
export function layoutColumns(config: Pick<ParsedGridConfig, 'layout'>): LayoutColumn[] {
    return [...config.layout.left, ...config.layout.center, ...config.layout.right];
}

/**
 * A function that gives the lines a row needs to show every line of its multiline cells: in each
 * column the lines of its fields added up - the lines of a multiline cell's text (empty lines at the
 * end left out), one for every other cell and for the empty cells under the fields of a column with
 * fewer fields than the others - and the most of the columns. At least the lines of a row of the
 * layout (`__columnCells`), at most {@link MAX_ROW_LINES}.
 *
 * Counts the line breaks of the cells' text, nothing is measured. The fields are looked up once, for
 * many rows. Reads the interface only, it works without a connected grid too.
 * @param ctx the grid, or an object with the grid's interface
 */
export function fitRowLinesOf(ctx: Pick<Grid, 'gridInterface'>): (row: Entity) => number {
    const config = ctx.gridInterface.__getGridConfig();
    const datasource = ctx.gridInterface.getDatasource();
    const cells = config.__columnCells;
    // a cell of a field that is not text is one line, its value is not formatted: only a text field is
    // multiline (dynamicCellTypeColumn too is for text fields only)
    const columns = layoutColumns(config).map((column) =>
        column.fields.map((field) => (datasource.getField(field).type === 'text' ? cellTextOf(ctx, field) : null))
    );

    return (row) => {
        let lines = cells;
        for (const fields of columns) {
            let columnLines = cells - fields.length;
            for (const textOf of fields) {
                const cell = textOf?.(row);
                columnLines += cell?.multiline ? textLines(cell.text).length : 1;
            }
            lines = Math.max(lines, columnLines);
        }
        return Math.min(lines, Math.max(MAX_ROW_LINES, cells));
    };
}

/**
 * The lines each cell of a column gets in a row of `rowLines` lines: every cell one line, then from the
 * top down each cell the lines it wants, as long as there are lines left. What is left over goes to the
 * last cell, so the column fills the row: its bottom edge is the row's.
 * @param wanted the lines each cell of the column wants, top to bottom: a multiline cell the lines of
 * its text, the others 1
 * @param rowLines the row's lines, at least as many as there are cells
 * @returns the lines of each cell: `[3, 1]` wanted in 5 lines is `[3, 2]`, `[6, 1]` in 4 is `[3, 1]`
 */
export function columnCellLines(wanted: readonly number[], rowLines: number): number[] {
    const lines = wanted.map(() => 1);
    let left = rowLines - lines.length;
    for (let i = 0; i < lines.length && left > 0; i++) {
        const more = Math.min(Math.max(wanted[i] - 1, 0), left);
        lines[i] += more;
        left -= more;
    }
    if (left > 0 && lines.length) {
        lines[lines.length - 1] += left;
    }
    return lines;
}

/**
 * Places a row cell in its column element: its top and height in the row it shows, for renderRowCell.
 * In a row of the layout's height every cell is a line, `cellNo` lines from the top - as
 * rebuildRowColumns made it. In a taller row (fitRows) the column's lines are divided between its
 * cells, see columnCellLines. Only what changed is written: the cell elements are reused for other
 * rows while scrolling.
 * @param row index in the displayed rows, its height is in the scroll state
 * @param entity the row, a data row
 * @param column the column in its section
 * @param cellNo the cell in the column, top to bottom
 * @returns the lines the cell has, 1 or more
 */
export function placeRowCell(
    ctx: Grid,
    cell: HTMLElement,
    row: number,
    entity: Entity,
    colType: ColType,
    column: number,
    cellNo: number
): number {
    const config = ctx.gridInterface.__getGridConfig();
    const cells = config.__columnCells;
    const height = ctx.gridInterface.__getScrollState().scrollHeights[row];
    const rowLines = height ? Math.round(height / config.cellHeight) : cells;

    let top = cellNo;
    let lines = 1;
    if (rowLines > cells) {
        const fields = sectionColumns(config, colType)[column]?.fields ?? [];
        const wanted: number[] = [];
        for (let y = 0; y < cells; y++) {
            const text = fields[y] ? cellTextOf(ctx, fields[y])(entity) : null;
            wanted.push(text?.multiline ? textLines(text.text).length : 1);
        }
        const all = columnCellLines(wanted, rowLines);
        top = all.slice(0, cellNo).reduce((sum, value) => sum + value, 0);
        lines = all[cellNo] ?? 1;
    }

    const topPx = asPx(top * config.cellHeight);
    const heightPx = asPx(lines * config.cellHeight);
    if (cell.style.top !== topPx) {
        cell.style.top = topPx;
    }
    if (cell.style.height !== heightPx) {
        cell.style.height = heightPx;
    }
    return lines;
}

/**
 * the columns of a section of the layout: left pinned, right pinned, or the middle
 */
function sectionColumns(config: ParsedGridConfig, colType: ColType): LayoutColumn[] {
    switch (colType) {
        case LEFT_PINNED_COLTYPE:
            return config.layout.left;
        case RIGHT_PINNED_COLTYPE:
            return config.layout.right;
        default:
            return config.layout.center;
    }
}
