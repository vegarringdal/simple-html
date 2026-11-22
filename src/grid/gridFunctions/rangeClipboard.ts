import { type Entity, isGroupRow } from '../../datasource/entity';
import type { CellRange } from '../cellRange';
import { buildCsv, csvField, parseTsv } from '../csv';
import type { Grid } from '../grid';
import { type CellPoint, isMoreThanOneCell, rangeBlock, rangeRect } from './cellRanges';
import { getCellType } from './getCellType';
import { getColumnLabel } from './getColumnLabel';
import { getLayoutFields } from './getLayoutFields';
import { cellText } from './gridCsv';
import type { HTMLCellElement } from './HTMLCellElement';
import { writeCellValue } from './lookupColumn';
import { focusedCell, hasSelectedText, pointOf } from './rangeSelection';

/**
 * The clipboard of the cell ranges, like a spreadsheet's: copy a range as tab separated text, paste
 * tab separated text into the cells, clear the cells. See guides/17-selection-and-clipboard.md.
 *
 * - **Copy** (Ctrl/Cmd+C, the `copy` event): with ranges of more than one cell, every range as one table
 *   (rangesClipboard), with a header line of the column labels (`copyHeaders`); else the cell with the
 *   focus, its value only. Not when text is selected in the cell's input: then it is the input's own
 *   copy of that text. The text of each cell is the text the cell shows (cellText in gridCsv.ts)
 * - **Paste** (Ctrl/Cmd+V, the `paste` event): the text is read as tab separated cells (parseTsv), a
 *   first line of the grid's column labels left out (a copy's header, withoutHeader). One
 *   value with ranges of more than one cell is written into every cell of the ranges; a block of cells
 *   from the top left cell of the last range, or the cell with the focus, down and right. One value
 *   with no range is the input's own paste - unless the input can not take it (see inputTakes)
 * - **Clear** (Delete / Backspace in a cell, rangeDeleteKey): every cell of the ranges, when they are
 *   more than one cell
 *
 * What is written skips the cells that can not be edited (the grid's `readonly`, the column's, the
 * `isReadonly` hook), adds no rows, and is written in one run of code: one step of the undo history.
 *
 * The events are on the document, not on the grid: the focus can be on a checkbox, and the browser
 * sends the copy and paste of a focused checkbox to the body (it has no text). Each grid only takes
 * them when the focus is in one of its own cells, and leaves one that a listener before it canceled
 * (the row menu's copy, a listener of the page) alone.
 */

/**
 * Listens to copy and paste on the document, for the cells of this grid. Called when the grid is put
 * in the dom (createDom, Grid.attach); the listeners are removed when it leaves it (disconnectElement)
 * - a listener left on the document would keep the grid alive
 */
export function addClipboardListeners(ctx: Grid) {
    ctx.clipboardListenersAbort?.abort();
    ctx.clipboardListenersAbort = new AbortController();
    const signal = ctx.clipboardListenersAbort.signal;
    document.addEventListener('copy', (event) => copyEvent(ctx, event), { signal });
    document.addEventListener('paste', (event) => pasteEvent(ctx, event), { signal });
}

/**
 * Copy in a body cell: the last range, or the focused cell - see the top of this file
 */
function copyEvent(ctx: Grid, event: ClipboardEvent) {
    const focused = focusedCell(ctx);
    if (event.defaultPrevented || !event.clipboardData || !focused || hasSelectedText(focused.input)) {
        return;
    }
    const ranges = ctx.gridInterface.getRanges();
    const point = pointOf(focused.cell);
    const { text, html } = isMoreThanOneCell(ranges) ? rangesClipboard(ctx, ranges) : cellClipboardText(ctx, point);
    event.preventDefault();
    event.clipboardData.setData('text/plain', text);
    event.clipboardData.setData('text/html', html);
}

/**
 * Paste in a body cell of an editable grid: see the top of this file
 */
function pasteEvent(ctx: Grid, event: ClipboardEvent) {
    const focused = focusedCell(ctx);
    if (event.defaultPrevented || !focused || ctx.gridInterface.__getGridConfig().readonly) {
        return;
    }
    const block = withoutHeader(ctx, parseTsv(event.clipboardData?.getData('text/plain') ?? ''));
    if (!block.length) {
        return;
    }
    const oneValue = block.length === 1 && block[0].length === 1;
    if (oneValue && !isMoreThanOneCell(ctx.gridInterface.getRanges()) && inputTakes(ctx, focused, block[0][0])) {
        return;
    }
    event.preventDefault();
    pasteBlock(ctx, block, pointOf(focused.cell));
}

/**
 * true when the input's own paste can take one value: a text input that can be typed in, and the
 * value has no line break. The grid writes it itself into a checkbox, a multiline cell (its input is
 * readonly, see multilineText.ts), a column with `allowPasteClearOnly` (it can not be typed in, but
 * pasted into), a value with a line break (an input has no line breaks, the browser would make them
 * spaces) and a custom cell with the focus on its host (customCell.ts, no input)
 */
function inputTakes(ctx: Grid, { cell, input }: { cell: HTMLCellElement; input: HTMLInputElement | null }, value: string) {
    // the host of a custom cell is no input: the grid writes the value
    if (!input) {
        return false;
    }
    const pasteClearOnly = !!ctx.gridInterface.__getGridConfig().columns[cell.$attribute ?? '']?.allowPasteClearOnly;
    return input.type !== 'checkbox' && !input.readOnly && !pasteClearOnly && !/[\r\n]/.test(value);
}

/**
 * Delete and Backspace in a body cell, called by its keydown: clears the cells of the ranges when they
 * are more than one cell and no text is selected in the input - else the keys are the input's own.
 * Only in an editable grid
 * @returns true when it cleared them: the cell's own handling of the key is skipped
 */
export function rangeDeleteKey(ctx: Grid, event: KeyboardEvent): boolean {
    const clearKey = event.key === 'Delete' || event.key === 'Backspace';
    const modifier = event.ctrlKey || event.metaKey || event.altKey;
    if (
        !clearKey ||
        modifier ||
        ctx.gridInterface.__getGridConfig().readonly ||
        !isMoreThanOneCell(ctx.gridInterface.getRanges()) ||
        hasSelectedText(event.target)
    ) {
        return false;
    }
    event.preventDefault();
    clearRangeCells(ctx);
    return true;
}

/**
 * The texts of cells, as the cells show them: a row of texts for each row
 */
function cellTexts(ctx: Grid, rows: Entity[], fields: string[]): string[][] {
    const textOf = fields.map((field) => cellText(ctx.gridInterface, field, true));
    return rows.map((row) => textOf.map((text) => text(row)));
}

/**
 * A table of cells for the clipboard - every copy of more than one cell: tab separated text (a line
 * per row ended with CRLF, as Excel copies it; a value with a tab, a line break or a quote in quotes,
 * csv.ts) and an html table of the same cells, for the programs that read the clipboard's html (Word,
 * Excel, Google Docs). Both start with a header line of the column labels, unless `copyHeaders` is
 * false
 * @param fields the copied fields, a text of each row for each
 * @param texts the texts of the cells, as the cells show them
 */
export function clipboardTable(ctx: Grid, fields: string[], texts: string[][]): { text: string; html: string } {
    const header = ctx.gridInterface.__getGridConfig().copyHeaders ? fields.map((field) => getColumnLabel(ctx, field)) : null;
    return { text: buildCsv(header, texts, { separator: '\t', bom: false }), html: htmlTable(header, texts) };
}

/**
 * Rows of the grid for the clipboard, in these fields: the row menu's Column / Row copies
 */
export function rowsClipboard(ctx: Grid, rows: Entity[], fields: string[]): { text: string; html: string } {
    return clipboardTable(ctx, fields, cellTexts(ctx, rows, fields));
}

/**
 * Columns for the clipboard, the column menu's Copy column / Copy selected columns: every displayed
 * data row (`datasource.getRows()` without the group rows - the rows of a collapsed group are not
 * displayed) in these fields, as the row menu's copies: a table, with the header line (`copyHeaders`)
 */
export function columnsClipboard(ctx: Grid, fields: string[]): { text: string; html: string } {
    const rows = ctx.gridInterface
        .getDatasource()
        .getRows()
        .filter((row): row is Entity => !isGroupRow(row));
    return rowsClipboard(ctx, rows, fields);
}

/**
 * The labels of fields for the clipboard, the column menu's header name copies: one line, a tab
 * between them, no line end - a label with a tab, a line break or a quote in quotes, as in the header
 * line of a copy. Text only: names, not a table
 */
export function labelsClipboard(ctx: Grid, fields: string[]): string {
    return fields.map((field) => csvField(getColumnLabel(ctx, field), '\t')).join('\t');
}

/**
 * The ranges for the clipboard, as one table: the data rows of every range, in the order of the
 * displayed rows, and the fields of every range, in the layout's order. A cell that is in none of the
 * ranges is empty - so two ranges side by side are one wide table, two ranges one above the other one
 * long table, and ranges that cross leave the cells they do not cover empty
 */
export function rangesClipboard(ctx: Grid, ranges: CellRange[]): { text: string; html: string } {
    const gridInterface = ctx.gridInterface;
    const datasource = gridInterface.getDatasource();
    const layout = getLayoutFields(gridInterface);
    const rects = ranges.map((range) => rangeRect(range, layout)).filter((rect) => rect.left >= 0);

    const rowIndexes = new Set<number>();
    const fieldIndexes = new Set<number>();
    for (const rect of rects) {
        for (let row = rect.top; row <= rect.bottom; row++) {
            const entity = datasource.getRow(row);
            if (entity && !isGroupRow(entity)) {
                rowIndexes.add(row);
            }
        }
        for (let field = rect.left; field <= rect.right; field++) {
            fieldIndexes.add(field);
        }
    }
    const rows = [...rowIndexes].sort((a, b) => a - b);
    const columns = [...fieldIndexes].sort((a, b) => a - b);
    const fields = columns.map((index) => layout[index]);
    const textOf = fields.map((field) => cellText(gridInterface, field, true));
    const inARange = (row: number, column: number) =>
        rects.some((rect) => row >= rect.top && row <= rect.bottom && column >= rect.left && column <= rect.right);

    const texts = rows.map((row) => {
        const entity = datasource.getRow(row) as Entity;
        return columns.map((column, i) => (inARange(row, column) ? textOf[i](entity) : ''));
    });
    return clipboardTable(ctx, fields, texts);
}

/**
 * A pasted block without its header: when every cell of its first line is the label of a column of
 * the grid (trimmed, any case) - a copy of the grid's cells starts with one (`copyHeaders`) - that line
 * is left out, so the labels are not written into cells. Also when it is pasted into other columns
 * than it was copied from. A first line of data that happens to be all labels is left out too
 */
export function withoutHeader(ctx: Grid, block: string[][]): string[][] {
    if (!block.length) {
        return block;
    }
    const labels = new Set(getLayoutFields(ctx.gridInterface).map((field) => getColumnLabel(ctx, field).trim().toLowerCase()));
    const first = block[0].map((text) => text.trim().toLowerCase());
    const isHeader = first.some((text) => text !== '') && first.every((text) => text === '' || labels.has(text));
    return isHeader ? block.slice(1) : block;
}

/**
 * One cell for the clipboard: its text, quoted when it has a tab, a line break or a quote - with no line
 * end, as the row menu's Copy: Cell Value
 */
function cellClipboardText(ctx: Grid, point: CellPoint): { text: string; html: string } {
    const row = ctx.gridInterface.getDatasource().getRow(point.row);
    const text = row && !isGroupRow(row) ? cellTexts(ctx, [row], [point.field])[0][0] : '';
    return { text: csvField(text, '\t'), html: htmlTable(null, [[text]]) };
}

/**
 * A table of texts as html, for the programs that read the html of the clipboard (Word, Google Docs,
 * Excel). The texts are escaped; a line break in a cell is a `<br>` that Excel keeps in the cell
 * (`mso-data-placement:same-cell`)
 */
function htmlTable(header: string[] | null, texts: string[][]): string {
    const escapeHtml = (text: string) =>
        text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    // thin borders, so Word shows the cells; a line break stays in its cell in Excel
    const style = 'border:1px solid #999;padding:2px 4px';
    const content = (text: string) => escapeHtml(text).replace(/\r\n|\r|\n/g, '<br style="mso-data-placement:same-cell">');
    const head = header
        ? `<thead><tr>${header.map((text) => `<th style="${style}">${content(text)}</th>`).join('')}</tr></thead>`
        : '';
    const body = texts
        .map((row) => `<tr>${row.map((text) => `<td style="${style}">${content(text)}</td>`).join('')}</tr>`)
        .join('');
    return `<table style="border-collapse:collapse">${head}<tbody>${body}</tbody></table>`;
}

/**
 * Writes text onto the clipboard, as plain text and html (none for `''`): for the row menu, outside a copy
 * event. The
 * listener is on the document in the capture phase, so it runs before the grid's own copy listener
 * (copyEvent, in the bubble phase), and cancels the copy: copyEvent leaves a canceled copy alone
 */
export function writeClipboard(text: string, html: string) {
    const listener = (event: ClipboardEvent) => {
        event.clipboardData?.setData('text/plain', text);
        // a value only (the row menu's Cell Value) has no html: a program reads its text
        if (html) {
            event.clipboardData?.setData('text/html', html);
        }
        event.preventDefault();
    };
    document.addEventListener('copy', listener, true);
    document.execCommand('copy');
    document.removeEventListener('copy', listener, true);
}

/**
 * Pastes text as Ctrl+V does with ranges, for the row menu's Paste range: one value into every cell of
 * the ranges, a block from the top left cell of the last range
 */
export function pasteText(ctx: Grid, text: string) {
    const block = withoutHeader(ctx, parseTsv(text));
    if (block.length) {
        pasteBlock(ctx, block, null);
    }
}

/**
 * Writes a block of texts into the cells, in one run of code (one undo step):
 * - one value, with ranges of more than one cell: into every cell of every range
 * - one value else: into `active`, the cell with the focus - with no focus (the row menu), the top
 *   left cell of the last range
 * - a block: from the top left cell of the last range, or `active` without ranges. A row of the block
 *   per data row down from there (group rows are skipped, no rows are added past the last one), a text
 *   per field to the right (past the last field they are left out). Without ranges, the cells it went
 *   to become a range, so the user sees where it went
 *
 * Every cell is written as typing does - the text through the field's formatter (`parse`) - but empty
 * text clears the cell (null), as Delete does. Cells that can not be edited are skipped
 * @param active the cell with the focus, null for none
 */
export function pasteBlock(ctx: Grid, block: string[][], active: CellPoint | null) {
    const gridInterface = ctx.gridInterface;
    if (gridInterface.__getGridConfig().readonly) {
        return;
    }
    const datasource = gridInterface.getDatasource();
    // the cell being typed in is written too: it is rendered again, not left as it is (editedInput.ts)
    datasource.getDataContainer().__history.endTyping();

    const ranges = gridInterface.getRanges();
    const oneValue = block.length === 1 && block[0].length === 1;
    if (oneValue && isMoreThanOneCell(ranges)) {
        for (const range of ranges) {
            const { rows, fields } = rangeBlock(gridInterface, range);
            for (const row of rows) {
                for (const field of fields) {
                    writeCell(ctx, row, field, block[0][0]);
                }
            }
        }
        return;
    }

    const fields = getLayoutFields(gridInterface);
    const last = oneValue && active ? undefined : ranges.at(-1);
    const rect = last ? rangeRect(last, fields) : null;
    const top = rect ? rect.top : active?.row;
    const left = rect ? rect.left : fields.indexOf(active?.field ?? '');
    if (top === undefined || left < 0) {
        return;
    }

    let row = top;
    let bottom = top;
    for (const texts of block) {
        while (row < datasource.length() && isGroupRow(datasource.getRow(row))) {
            row++;
        }
        if (row >= datasource.length()) {
            break;
        }
        const entity = datasource.getRow(row) as Entity;
        texts.forEach((text, i) => {
            const field = fields[left + i];
            if (field !== undefined) {
                writeCell(ctx, entity, field, text);
            }
        });
        bottom = row;
        row++;
    }

    const width = Math.max(...block.map((texts) => texts.length));
    if (!ranges.length && !oneValue) {
        const right = Math.min(left + width - 1, fields.length - 1);
        gridInterface.__setRanges([{ fromRow: top, fromField: fields[left], toRow: bottom, toField: fields[right] }]);
    }
}

/**
 * Writes the text of a cell, see pasteBlock. Skipped when the cell can not be edited
 */
function writeCell(ctx: Grid, row: Entity, field: string, text: string) {
    if (ctx.gridInterface.__isCellReadonly(row, field)) {
        return;
    }
    // a lookup column (ColumnConfig.editor) takes a label, copied from it, as the value of its row
    const formatter =
        ctx.gridInterface.__getLookupColumn(field)?.formatter ??
        ctx.gridInterface.getDatasource().getFormatter(field, getCellType(ctx, field, row));
    writeCellValue(ctx.gridInterface, row, field, text === '' ? null : formatter.parse(text));
}

/**
 * Clears every cell of every range: the value is set to null, as the row menu's Clear does. In one run
 * of code, one undo step. Cells that can not be edited are skipped, and so is everything in a readonly
 * grid
 */
export function clearRangeCells(ctx: Grid) {
    const gridInterface = ctx.gridInterface;
    if (gridInterface.__getGridConfig().readonly) {
        return;
    }
    gridInterface.getDatasource().getDataContainer().__history.endTyping();
    for (const range of gridInterface.getRanges()) {
        const { rows, fields } = rangeBlock(gridInterface, range);
        for (const row of rows) {
            for (const field of fields) {
                if (!gridInterface.__isCellReadonly(row, field)) {
                    writeCellValue(gridInterface, row, field, null);
                }
            }
        }
    }
}
