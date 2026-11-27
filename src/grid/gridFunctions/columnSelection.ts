import type { LayoutColumn, ParsedGridConfig } from '../gridConfig';
import type { ColType } from './colType';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE } from './GROUP_COLTYPE';

/**
 * The selected columns: the row of column numbers under the header filters (renderHeaderSelector).
 * A column is its number as the header shows it, 1 based, counted across the pinned left, the center
 * and the pinned right columns of the layout - a column of stacked fields is one number. See
 * guides/17-selection-and-clipboard.md "Selecting columns".
 *
 * A click works as on the row numbers:
 * - a plain click: that column only
 * - Ctrl+click (Cmd+click): that column in or out, the others stay
 * - Shift+click (with Ctrl too): the columns from the anchor - the column clicked last without Shift -
 *   to this one, and the columns that were selected when the anchor was clicked: after a plain click
 *   none, after a Ctrl+click the ones it kept. So Shift+click again changes the range, and a range
 *   made after Ctrl+clicks adds to them
 */
export interface ColumnSelection {
    /** the selected column numbers, ascending */
    selected: number[];
    /** the column a Shift+click selects from: the last one clicked without Shift, null before any */
    anchor: number | null;
    /** the columns a Shift+click keeps: the ones selected when the anchor was clicked */
    kept: number[];
}

/** nothing selected, nothing clicked */
export const NO_COLUMNS: ColumnSelection = { selected: [], anchor: null, kept: [] };

/** the numbers ascending, each once */
function ascending(numbers: number[]): number[] {
    return Array.from(new Set(numbers)).sort((a, b) => a - b);
}

/**
 * The selection after a click on a column number, see {@link ColumnSelection}
 * @param column the number clicked
 * @param keys `toggle`: Ctrl or Cmd was held, `range`: Shift was held
 */
export function clickColumn(
    selection: ColumnSelection,
    column: number,
    keys: { toggle: boolean; range: boolean }
): ColumnSelection {
    if (keys.range && selection.anchor !== null) {
        const from = Math.min(selection.anchor, column);
        const to = Math.max(selection.anchor, column);
        const range = Array.from({ length: to - from + 1 }, (_, i) => from + i);
        return { ...selection, selected: ascending([...selection.kept, ...range]) };
    }
    if (keys.toggle) {
        const selected = selection.selected.includes(column)
            ? selection.selected.filter((number) => number !== column)
            : ascending([...selection.selected, column]);
        return { selected, anchor: column, kept: selected };
    }
    // a plain click, or Shift+click with nothing clicked before
    return { selected: [column], anchor: column, kept: [] };
}

/**
 * The columns of the layout in the order of their numbers: pinned left, center, pinned right
 */
export function numberedColumns(config: ParsedGridConfig): LayoutColumn[] {
    const { left, center, right } = config.layout;
    return [...left, ...center, ...right];
}

/**
 * The number of a column of a section, as the header shows it
 * @param column the index of the column in its section
 */
export function columnNumber(config: ParsedGridConfig, colType: ColType, column: number): number {
    const { left, center } = config.layout;
    switch (colType) {
        case LEFT_PINNED_COLTYPE:
            return column + 1;
        case MIDDLE_PINNED_COLTYPE:
            return left.length + column + 1;
        case RIGHT_PINNED_COLTYPE:
            return left.length + center.length + column + 1;
        default:
            return 0;
    }
}

/**
 * The fields of the columns with these numbers, in the order of the numbers given, top to bottom in a
 * column of stacked fields. A number that is no column gives none
 */
export function columnFields(config: ParsedGridConfig, numbers: number[]): string[] {
    const columns = numberedColumns(config);
    return numbers.flatMap((number) => columns[number - 1]?.fields ?? []);
}
