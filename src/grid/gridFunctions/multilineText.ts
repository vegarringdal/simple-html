import type { Field, FieldType } from '../../datasource/field';
import type { Grid } from '../grid';
import type { ColumnConfig } from '../gridConfig';
import { gridText } from './gridText';

/**
 * Text of several lines in a cell: `FieldConfig.multiline`, or a value with a line break.
 *
 * The cells are `<input type="text">`s, and the value of a text input can not hold a line break: the
 * browser strips them (the value sanitization algorithm of the Text state, "Strip newlines from the
 * value"). A value with a line break shown in the input and written back from it would lose them, so
 * a multiline cell is a readonly input that shows the first line, and it is edited in an editor over
 * the cell, a textarea (textEditor.ts). In a row made taller (`gridInterface.fitRows()`, see
 * rowHeights.ts) the cell shows the lines that fit under the input.
 */

/**
 * a line break: CR LF, a CR on its own (old Mac), or a LF
 */
const LINE_BREAK = /\r\n|\r|\n/;

/**
 * the lines of the tooltip of a multiline cell, when `GridConfig.multilineTooltipLines` is not set
 */
export const TOOLTIP_LINES = 5;

/**
 * the most characters of a line the tooltip shows: the tooltip is at most 260px wide and wraps a long
 * line, more would make it cover the grid
 */
export const TOOLTIP_LINE_LENGTH = 100;

/**
 * true when the text has a line break: CR LF, CR or LF
 */
export function hasLineBreak(text: string): boolean {
    return LINE_BREAK.test(text);
}

/**
 * the text up to its first line break, all of it when it has none
 */
export function firstLine(text: string): string {
    return text.split(LINE_BREAK, 1)[0];
}

/**
 * The lines of a text, split at every line break (CR LF, CR, LF). The empty lines at its end are left
 * out - they show nothing - the empty lines between the others are kept. At least one line: `''` is
 * `['']`
 */
export function textLines(text: string): string[] {
    const lines = text.split(LINE_BREAK);
    let end = lines.length;
    while (end > 1 && lines[end - 1] === '') {
        end--;
    }
    return end === lines.length ? lines : lines.slice(0, end);
}

/**
 * Every line break of the text as LF: what a textarea gives as its value (the "API value" of the
 * textarea element is "normalized so that line breaks use U+000A LINE FEED (LF) characters"). The
 * editor stores what it saves this way also where the dom does not do it (happy-dom)
 */
export function normalizeLineBreaks(text: string): string {
    return text.replace(/\r\n?/g, '\n');
}

/**
 * True when a cell is edited in the text editor and shows its first line: a text cell whose field is
 * multiline, or whose text has a line break. Not a cell of another type, also when its field is text
 * (`dynamicCellTypeColumn`)
 * @param field the cell's field
 * @param cellType the type the cell is shown as, see getCellType
 * @param text the cell's value, formatted
 * @param column the cell's column: its format can make it multiline or not (multilineOf)
 */
export function isMultilineCell(field: Field, cellType: FieldType, text: string, column?: ColumnConfig): boolean {
    return cellType === 'text' && (multilineOf(field, column) || hasLineBreak(text));
}

/**
 * true when a field's cells are text of several lines by their settings: the user's
 * (`ColumnFormat.multiline`, the grid config dialog), else the field's `multiline`. A value with a line
 * break is shown as several lines also without, see isMultilineCell
 * @param column the column of the field, its format has the user's
 */
export function multilineOf(field: Field, column: ColumnConfig | undefined): boolean {
    return column?.format?.multiline ?? field.multiline === true;
}

/**
 * The text for a tooltip: its lines (see textLines), joined with LF - the tooltip shows a line per LF.
 *
 * - the first `maxLines` lines, then a line from `moreLines` with how many are left out. When one line
 *   is left over it is shown instead: it takes no more room than the line that would count it
 * - a line longer than {@link TOOLTIP_LINE_LENGTH} characters is cut, with `…` where it is cut
 *
 * @param maxLines how many lines are shown, a whole number of 1 or more
 * @param moreLines the line after them, from the number of lines left out
 */
export function tooltipText(text: string, maxLines: number, moreLines: (count: number) => string): string {
    const lines = textLines(text);
    const shown = lines.length > maxLines + 1 ? lines.slice(0, maxLines) : lines;
    const cut = shown.map((line) => {
        // by code points: a cut between the two halves of an emoji would show half of it
        const characters = Array.from(line);
        return characters.length > TOOLTIP_LINE_LENGTH ? `${characters.slice(0, TOOLTIP_LINE_LENGTH).join('')}…` : line;
    });
    if (shown.length < lines.length) {
        cut.push(moreLines(lines.length - shown.length));
    }
    return cut.join('\n');
}

/**
 * The tooltip text of a multiline cell's text: {@link tooltipText} with the grid's
 * `multilineTooltipLines` and its text `cell.multiline.moreLines`
 */
export function gridTooltipText(ctx: Grid, text: string): string {
    return tooltipText(text, ctx.gridInterface.__getGridConfig().multilineTooltipLines, (count) =>
        gridText(ctx, 'cell.multiline.moreLines', { count })
    );
}
