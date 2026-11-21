import { type Entity, type GroupRow, isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import { cellTextOf } from './cellText';
import { getColumnLabel } from './getColumnLabel';
import { getFont } from './getFont';
import { hasLineBreak, textLines } from './multilineText';
import { layoutColumns } from './rowHeights';

/**
 * Column widths fitted to the content, like Excel's AutoFit: `gridInterface.fitColumns()`, the header
 * menu's "Fit column width" and a double click on a column's resize handle.
 */

/** the narrowest a column gets, as a resize with the mouse */
export const MIN_COLUMN_WIDTH = 25;

/** the widest fitColumns() makes a column: a long text would push the other columns far away */
export const MAX_FIT_WIDTH = 750;

/** the width of a column added to the layout (the column chooser): resetColumnWidths() of one that was not in it */
export const DEFAULT_COLUMN_WIDTH = 100;

/**
 * How many texts of a field are measured: the longest ones, by their number of characters. Measuring
 * a text takes the browser about 5µs (canvas `measureText`), every text of 100 000 rows half a second
 * for one field. Counting characters takes no time, and the widest text is one of the longest
 */
const MEASURED_TEXTS = 20;

/**
 * the room a cell's input needs besides its text: its padding (3px each side), its margin (1px), the
 * column's border (1px), and a little air
 */
const CELL_ROOM = 12;

/** a multiline cell's input has room for the marker at its right: padding 16px instead of 3px */
const MARKER_ROOM = 13;

/** a checkbox cell: the checkbox and the room around it */
const CHECKBOX_WIDTH = 24;

/**
 * the room a header label needs besides its text: the label is centered and the sort icon (15px, the
 * sort number and 3px from the edge) is at its right, so the same room on both sides
 */
const LABEL_ROOM = 50;

/**
 * Fits the width of the columns to their content: each column as wide as the widest text of its fields
 * - every line of a multiline text - and its header label, at least {@link MIN_COLUMN_WIDTH} and at most
 * {@link MAX_FIT_WIDTH} px. Then rebuilds the grid. A column with nothing to measure keeps its width.
 *
 * The text is what a cell shows: formatted, with `numberOverride`. Measured with the font of the grid
 * (the header labels with theirs) on a canvas - the {@link MEASURED_TEXTS} longest texts of each field.
 * @param fields the columns that show one of these fields, every column when left out
 * @param rows only the text of these rows, and not the header label: a column fitted to cells. Left
 * out: the rows the filter lets through (`getDataRows()`, the rows of collapsed groups too) and the
 * header label
 */
export function fitColumns(ctx: Grid, fields?: readonly string[], rows?: readonly (Entity | GroupRow | null | undefined)[]) {
    const config = ctx.gridInterface.__getGridConfig();
    const columns = layoutColumns(config).filter((column) => !fields || column.fields.some((field) => fields.includes(field)));
    if (!columns.length) {
        return;
    }

    const measured = rows ?? ctx.gridInterface.getDatasource().getDataRows();
    const measureCell = textMeasurer(fontOf(ctx, ctx.element));
    if (!measureCell) {
        return;
    }
    // the label of the first column found: they all have the same font
    const labelCell = ctx.element.querySelector('.simple-html-grid-col-cell[type="label"]');
    const measureLabel = !rows && labelCell ? textMeasurer(fontOf(ctx, labelCell)) : null;

    // a field can be in more than one column (pinned as a copy): measured once
    const widths = new Map<string, number>();
    const widthOf = (field: string) => {
        let width = widths.get(field);
        if (width === undefined) {
            width = contentWidth(ctx, field, measured, measureCell);
            if (measureLabel) {
                width = Math.max(width, measureLabel(getColumnLabel(ctx, field)) + LABEL_ROOM);
            }
            widths.set(field, width);
        }
        return width;
    };

    for (const column of columns) {
        const width = Math.max(...column.fields.map(widthOf));
        if (width > 0) {
            column.width = Math.min(Math.max(Math.ceil(width), MIN_COLUMN_WIDTH), MAX_FIT_WIDTH);
        }
    }

    ctx.rebuild();
}

/**
 * the width the cells of a field need for these rows, 0 when they show no text (all empty)
 */
function contentWidth(
    ctx: Grid,
    field: string,
    rows: readonly (Entity | GroupRow | null | undefined)[],
    measure: (text: string) => number
): number {
    const textOf = cellTextOf(ctx, field);
    const longest = longestTexts(MEASURED_TEXTS);
    let marker = false;
    let checkbox = false;

    for (const row of rows) {
        if (!row || isGroupRow(row)) {
            continue;
        }
        const cell = textOf(row);
        if (cell.type === 'boolean') {
            checkbox = true;
        } else if (cell.multiline && hasLineBreak(cell.text)) {
            // the marker is at its right, every line can be shown in a taller row
            marker = true;
            for (const line of textLines(cell.text)) {
                longest.add(line);
            }
        } else {
            longest.add(cell.text);
        }
    }

    let width = 0;
    if (longest.texts.length) {
        width = Math.max(...longest.texts.map(measure)) + CELL_ROOM + (marker ? MARKER_ROOM : 0);
    }
    return checkbox ? Math.max(width, CHECKBOX_WIDTH) : width;
}

/**
 * Keeps the longest of the texts added, `count` at most, each once: `texts`, longest first. An empty
 * text is left out. Cheap for many texts: one that is not longer than the shortest kept is dropped
 * at once
 */
export function longestTexts(count: number) {
    const texts: string[] = [];
    return {
        texts,
        add(text: string) {
            if (text === '' || (texts.length === count && text.length <= texts[texts.length - 1].length)) {
                return;
            }
            if (texts.includes(text)) {
                return;
            }
            let at = texts.length;
            while (at > 0 && texts[at - 1].length < text.length) {
                at--;
            }
            texts.splice(at, 0, text);
            if (texts.length > count) {
                texts.pop();
            }
        }
    };
}

/**
 * The font of an element, for a canvas: its style, weight, size and family. The grid's font
 * (getFont) when the element is not in the dom, its css does not apply then
 */
function fontOf(ctx: Grid, element: Element): string {
    if (!element.isConnected) {
        return getFont(ctx);
    }
    const style = window.getComputedStyle(element);
    if (!style.fontSize || !style.fontFamily) {
        return getFont(ctx);
    }
    return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

/**
 * A function that measures the width of a text in px, in this font: one canvas for every text. null
 * when the browser gives no 2d context (getContext returns null when it can not make one)
 */
function textMeasurer(font: string): ((text: string) => number) | null {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) {
        return null;
    }
    context.font = font;
    return (text) => context.measureText(text).width;
}
