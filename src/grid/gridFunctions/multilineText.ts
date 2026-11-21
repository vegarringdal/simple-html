import type { Field, FieldType } from '../../datasource/field';

/**
 * Text of several lines in a cell: `FieldConfig.multiline`, or a value with a line break.
 *
 * The cells are `<input type="text">`s, and the value of a text input can not hold a line break: the
 * browser strips them (the value sanitization algorithm of the Text state, "Strip newlines from the
 * value"). A value with a line break shown in the input and written back from it would lose them, so
 * a multiline cell is a readonly input that shows the first line, and it is edited in an editor over
 * the cell, a textarea (textEditor.ts).
 */

/**
 * a line break: CR LF, a CR on its own (old Mac), or a LF
 */
const LINE_BREAK = /\r\n|\r|\n/;

/**
 * the most the tooltip of a multiline cell shows of its text: lines, then characters. The tooltip is
 * at most 260px wide, more would cover the grid
 */
const TOOLTIP_MAX_LINES = 15;
const TOOLTIP_MAX_LENGTH = 600;

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
 */
export function isMultilineCell(field: Field, cellType: FieldType, text: string): boolean {
    return cellType === 'text' && (field.multiline || hasLineBreak(text));
}

/**
 * The text for a tooltip: the line breaks as LF (the tooltip shows a line per LF), cut after
 * {@link TOOLTIP_MAX_LINES} lines and {@link TOOLTIP_MAX_LENGTH} characters, with `…` where it is cut
 */
export function tooltipText(text: string): string {
    const lines = normalizeLineBreaks(text).split('\n');
    let shown = lines.slice(0, TOOLTIP_MAX_LINES).join('\n');
    let cut = lines.length > TOOLTIP_MAX_LINES;
    // by code points: a cut between the two halves of an emoji would show half of it
    const characters = Array.from(shown);
    if (characters.length > TOOLTIP_MAX_LENGTH) {
        shown = characters.slice(0, TOOLTIP_MAX_LENGTH).join('');
        cut = true;
    }
    return cut ? `${shown}…` : shown;
}
