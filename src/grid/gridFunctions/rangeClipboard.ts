import { type Entity, isGroupRow } from '../../datasource/entity';
import type { CellRange } from '../cellRange';
import { buildCsv, csvField, parseTsv } from '../csv';
import type { Grid } from '../grid';
import { type CellPoint, isMoreThanOneCell, rangeBlock, rangeRect } from './cellRanges';
import { getCellType } from './getCellType';
import { getLayoutFields } from './getLayoutFields';
import { cellText } from './gridCsv';
import type { HTMLCellElement } from './HTMLCellElement';
import { writeCellValue } from './lookupColumn';
import { focusedCell, hasSelectedText, pointOf } from './rangeSelection';

/**
 * The clipboard of the cell ranges, like a spreadsheet's: copy a range as tab separated text, paste
 * tab separated text into the cells, clear the cells. See guides/17-selection-and-clipboard.md.
 *
 * - **Copy** (Ctrl/Cmd+C, the `copy` event): with ranges of more than one cell, the last range; else
 *   the cell with the focus. Not when text is selected in the cell's input: then it is the input's own
 *   copy of that text. The text of each cell is the text the cell shows (cellText in gridCsv.ts)
 * - **Paste** (Ctrl/Cmd+V, the `paste` event): the text is read as tab separated cells (parseTsv). One
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
    const { text, html } = isMoreThanOneCell(ranges)
        ? rangeClipboardText(ctx, ranges[ranges.length - 1])
        : cellClipboardText(ctx, point);
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
    const block = parseTsv(event.clipboardData?.getData('text/plain') ?? '');
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
 * pasted into) and a value with a line break (an input has no line breaks, the browser would make them
 * spaces)
 */
function inputTakes(ctx: Grid, { cell, input }: { cell: HTMLCellElement; input: HTMLInputElement }, value: string) {
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
 * A range for the clipboard: tab separated text - a line per data row ended with CRLF, as Excel copies
 * it, a value with a tab, a line break or a quote in quotes (csv.ts) - and an html table of the same
 * cells
 */
export function rangeClipboardText(ctx: Grid, range: CellRange): { text: string; html: string } {
    const { rows, fields } = rangeBlock(ctx.gridInterface, range);
    const texts = cellTexts(ctx, rows, fields);
    return { text: buildCsv(null, texts, { separator: '\t', bom: false }), html: htmlTable(texts) };
}

/**
 * One cell for the clipboard: its text, quoted when it has a tab, a line break or a quote - with no line
 * end, as the row menu's Copy: Cell Value
 */
function cellClipboardText(ctx: Grid, point: CellPoint): { text: string; html: string } {
    const row = ctx.gridInterface.getDatasource().getRow(point.row);
    const text = row && !isGroupRow(row) ? cellTexts(ctx, [row], [point.field])[0][0] : '';
    return { text: csvField(text, '\t'), html: htmlTable([[text]]) };
}

/**
 * A table of texts as html, for the programs that read the html of the clipboard (Word, Google Docs,
 * Excel). The texts are escaped; a line break in a cell is a `<br>` that Excel keeps in the cell
 * (`mso-data-placement:same-cell`)
 */
function htmlTable(texts: string[][]): string {
    const escapeHtml = (text: string) =>
        text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const cell = (text: string) =>
        `<td>${escapeHtml(text).replace(/\r\n|\r|\n/g, '<br style="mso-data-placement:same-cell">')}</td>`;
    return `<table>${texts.map((row) => `<tr>${row.map(cell).join('')}</tr>`).join('')}</table>`;
}

/**
 * Writes text onto the clipboard, as plain text and html: for the row menu, outside a copy event. The
 * listener is on the document in the capture phase, so it runs before the grid's own copy listener
 * (copyEvent, in the bubble phase), and cancels the copy: copyEvent leaves a canceled copy alone
 */
export function writeClipboard(text: string, html: string) {
    const listener = (event: ClipboardEvent) => {
        event.clipboardData?.setData('text/plain', text);
        event.clipboardData?.setData('text/html', html);
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
    const block = parseTsv(text);
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
