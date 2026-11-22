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
 * `resetRowHeights()` takes it back.
 *
 * - A row of `lines` lines: the row of the layout - `__columnCells` lines of `cellHeight` px, the
 *   inputs - and each line more a line of text, `multilineLineHeight` px (rowHeightOf). The text of a
 *   multiline cell reads as a paragraph: its first line is in the input, the lines after it are a text
 *   line apart, not a whole `cellHeight` each.
 * - The interface keeps the lines of each row by the row's key (`__KEY`, the datasource's key field,
 *   or the key the datasource generated), so they follow the row through a sort, a filter and new
 *   data with the same keys. They are not part of the grid's state. In lines, not px: the heights
 *   follow a change of `cellHeight` or `multilineLineHeight`.
 * - The heights of the rows go into the scroll state (`__dataSourceUpdated`): the scroll handlers place
 *   the rows of every section at the same tops, see verticalScrollHandler.
 * - In a taller row each column divides the row's lines between its cells, see columnCellLines and
 *   placeRowCell: a multiline cell gets the lines its text has, every other cell one line. A cell of
 *   `lines` lines is `cellHeight` px for its first line and `multilineLineHeight` px for each other
 *   (cellHeightOf). The text of every cell stays on its first line; a multiline cell shows its other
 *   lines under it (renderRowCell, linesUnderTop).
 */

/**
 * the default of `GridConfig.multilineLineHeight`: a line of text of a multiline cell after its first,
 * in px. About 1.35 times the default font size (11px, `--simple-html-grid-font-size`): the lines read as
 * a paragraph
 */
export const MULTILINE_LINE_HEIGHT = 15;

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
 * The height in px of a row of `lines` lines: the row of the layout (`__rowHeight`, `__columnCells`
 * lines of `cellHeight` px) and `multilineLineHeight` px for each line more. A row of the layout's
 * lines, or fewer, is the layout's row
 * @param lines the row's lines, see fitRowLinesOf
 */
export function rowHeightOf(
    config: Pick<ParsedGridConfig, '__rowHeight' | '__columnCells' | 'multilineLineHeight'>,
    lines: number
): number {
    return config.__rowHeight + Math.max(lines - config.__columnCells, 0) * config.multilineLineHeight;
}

/**
 * The height in px of a cell of `lines` lines in its column: `cellHeight` for its first line - the input
 * - and `multilineLineHeight` for each other line, see columnCellLines
 * @param lines 1 or more
 */
export function cellHeightOf(config: Pick<ParsedGridConfig, 'cellHeight' | 'multilineLineHeight'>, lines: number): number {
    return config.cellHeight + (lines - 1) * config.multilineLineHeight;
}

/**
 * Where the lines under the first line of a taller cell start, in px from the top of the cell: the
 * middle of the input's line (`cellHeight / 2`, the input's text is in the middle of its first
 * `cellHeight` px) and half a text line. Each line under it is `multilineLineHeight` px high, so the
 * middle of the second line is a text line under the middle of the first - as far as the third is under
 * the second. Starting at `cellHeight` would put the first line further from the second than the others.
 *
 * Rounded to a whole px, half a px up: the browser puts the text of each line on whole px, and from
 * half a px it put the second line a px closer to the first than the third is to the second (Chromium,
 * 22 / 15 and 30 / 19: 14px and 15px apart). From a whole px they are 15 and 15
 */
export function linesUnderTop(config: Pick<ParsedGridConfig, 'cellHeight' | 'multilineLineHeight'>): number {
    return Math.round((config.cellHeight + config.multilineLineHeight) / 2);
}

/**
 * The middle of a cell's last line in px from the top of the cell, for the marker of more lines: the
 * middle of the input's line, and a text line further for each line under it
 * @param lines the cell's lines, 1 or more
 */
export function lastLineMiddle(config: Pick<ParsedGridConfig, 'cellHeight' | 'multilineLineHeight'>, lines: number): number {
    return config.cellHeight / 2 + (lines - 1) * config.multilineLineHeight;
}

/**
 * Places a row cell in its column element: its top and height in the row it shows, for renderRowCell.
 * In a row of the layout's height every cell is a line, `cellNo` lines from the top - as
 * rebuildRowColumns made it. In a taller row (fitRows) the column's lines are divided between its
 * cells, see columnCellLines: each cell `cellHeight` px for its first line and `multilineLineHeight`
 * px for each other one (cellHeightOf). Only what changed is written: the cell elements are reused for
 * other rows while scrolling.
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
    // the lines more than the layout's row: the px over its height are text lines (rowHeightOf)
    const rowLines = height ? cells + Math.max(Math.round((height - config.__rowHeight) / config.multilineLineHeight), 0) : cells;

    let top = cellNo * config.cellHeight;
    let lines = 1;
    if (rowLines > cells) {
        const fields = sectionColumns(config, colType)[column]?.fields ?? [];
        const wanted: number[] = [];
        for (let y = 0; y < cells; y++) {
            const text = fields[y] ? cellTextOf(ctx, fields[y])(entity) : null;
            wanted.push(text?.multiline ? textLines(text.text).length : 1);
        }
        const all = columnCellLines(wanted, rowLines);
        top = all.slice(0, cellNo).reduce((sum, value) => sum + cellHeightOf(config, value), 0);
        lines = all[cellNo] ?? 1;
    }

    const topPx = asPx(top);
    const heightPx = asPx(cellHeightOf(config, lines));
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
