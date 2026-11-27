import { type Entity, isGroupRow } from '../../datasource/entity';
import type { CellRange } from '../cellRange';
import type { ParsedGridConfig } from '../gridConfig';
import type { GridInterface } from '../gridInterface';
import type { ColType } from './colType';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { getLayoutFields } from './getLayoutFields';

/**
 * The model of the cell ranges (CellRange, gridInterface.getRanges()): plain functions on the ranges,
 * the layout and the displayed rows. No dom - the grid's side is rangeSelection.ts (mouse, keys, the
 * classes of the cells) and rangeClipboard.ts (copy, paste, clear).
 *
 * A range is a rectangle in (displayed row, field index): the index of a field in the order of
 * getLayoutFields() - pinned left, center, pinned right, the stacked fields of a column top to bottom.
 * A stacked field is a column of its own here, as in the CSV export and `aria-colindex`.
 */

/**
 * A cell of a range: a displayed row (0 based) and a field
 */
export interface CellPoint {
    row: number;
    field: string;
}

/**
 * A range in indexes, both ends included: rows top to bottom, fields left to right in the order of
 * getLayoutFields()
 */
export interface RangeRect {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

/**
 * The columns of the layout left to right, across the sections, for the cells next to a cell (see
 * rangeEdges): `start` is the index of the column's first field, `count` how many it stacks.
 * `sectionStart` is where each section's columns start in `columns`, `cells` how many cells a row has
 * in a column - as many as the column with the most fields
 */
export interface RangeLayout {
    fields: string[];
    columns: { start: number; count: number }[];
    sectionStart: Record<typeof LEFT_PINNED_COLTYPE | typeof MIDDLE_PINNED_COLTYPE | typeof RIGHT_PINNED_COLTYPE, number>;
    cells: number;
}

/**
 * What the grid needs to show the ranges, made when they are set (rangeState): their rectangles and
 * the layout they were made in. `key` is that layout's fields (layoutKey): the ranges are cleared when
 * it changes, so the rest stays right while there are ranges
 */
export interface RangeState {
    rects: RangeRect[];
    layout: RangeLayout;
    key: string;
}

/**
 * The fields of the layout and how they are arranged - pinned left, center, pinned right, the fields of
 * each column - as text: equal when the ranges mean the same cells. The widths are left out, a resized
 * column changes nothing
 */
export function layoutKey(config: ParsedGridConfig): string {
    const { left, center, right } = config.layout;
    const fieldsOf = (columns: { fields: string[] }[]) => columns.map((column) => column.fields);
    return JSON.stringify([fieldsOf(left), fieldsOf(center), fieldsOf(right)]);
}

/**
 * The layout as RangeLayout, see there
 */
export function rangeLayout(config: ParsedGridConfig): RangeLayout {
    const { left, center, right } = config.layout;
    const fields: string[] = [];
    const columns: RangeLayout['columns'] = [];
    for (const column of [...left, ...center, ...right]) {
        columns.push({ start: fields.length, count: column.fields.length });
        fields.push(...column.fields);
    }
    return {
        fields,
        columns,
        sectionStart: {
            [LEFT_PINNED_COLTYPE]: 0,
            [MIDDLE_PINNED_COLTYPE]: left.length,
            [RIGHT_PINNED_COLTYPE]: left.length + center.length
        },
        cells: Math.max(1, ...columns.map((column) => column.count))
    };
}

/**
 * The rectangle of a range, in indexes
 * @param fields the fields of the layout, getLayoutFields()
 */
export function rangeRect(range: CellRange, fields: string[]): RangeRect {
    const from = fields.indexOf(range.fromField);
    const to = fields.indexOf(range.toField);
    return {
        top: Math.min(range.fromRow, range.toRow),
        bottom: Math.max(range.fromRow, range.toRow),
        left: Math.min(from, to),
        right: Math.max(from, to)
    };
}

/**
 * What the grid needs to show the ranges, see RangeState. null without ranges
 */
export function rangeState(config: ParsedGridConfig, ranges: CellRange[]): RangeState | null {
    if (!ranges.length) {
        return null;
    }
    const layout = rangeLayout(config);
    return { rects: ranges.map((range) => rangeRect(range, layout.fields)), layout, key: layoutKey(config) };
}

/**
 * true when the cell is in one of the ranges: a data row - a group row has no cells - and the field
 * index inside a rectangle
 * @param fieldIndex the index of the field in getLayoutFields(), -1 for none
 */
export function inRanges(gridInterface: GridInterface<any>, state: RangeState, row: number, fieldIndex: number): boolean {
    if (fieldIndex < 0 || !state.rects.some((rect) => contains(rect, row, fieldIndex))) {
        return false;
    }
    const entity = gridInterface.getDatasource().getRow(row);
    return entity !== undefined && !isGroupRow(entity);
}

function contains(rect: RangeRect, row: number, fieldIndex: number) {
    return row >= rect.top && row <= rect.bottom && fieldIndex >= rect.left && fieldIndex <= rect.right;
}

/**
 * Where a cell of the grid is in the ranges, for its classes (see showCellRange in rangeSelection.ts):
 * `null` when it is in none, else which of its sides are an edge of the ranges - the cell on that side
 * is not in a range.
 *
 * The sides are the ones on screen. In a column of stacked fields the cell above a field is the field
 * above it, above the first field it is the last cell of the row above; the cell left of it is the cell
 * with the same number in the column to the left. A column with fewer fields than the tallest one has
 * empty cells under its last field: they go with that field, so a range over it is a rectangle on
 * screen too, without holes.
 *
 * @param colType the section of the cell
 * @param column the column in its section
 * @param celno the cell in the column, from the top
 */
export function rangeEdges(
    gridInterface: GridInterface<any>,
    state: RangeState,
    row: number,
    colType: ColType,
    column: number,
    celno: number
): { top: boolean; bottom: boolean; left: boolean; right: boolean } | null {
    const { columns, sectionStart, cells } = state.layout;
    const start = sectionStart[colType as keyof RangeLayout['sectionStart']];
    const index = start === undefined ? -1 : start + column;

    // the field a cell of a column goes with: its own, the last one for an empty cell under it. -1 for
    // no column
    const fieldAt = (columnIndex: number, cell: number) => {
        const col = columns[columnIndex];
        return col ? col.start + Math.min(cell, col.count - 1) : -1;
    };
    const isIn = (r: number, columnIndex: number, cell: number) => inRanges(gridInterface, state, r, fieldAt(columnIndex, cell));

    if (!isIn(row, index, celno)) {
        return null;
    }
    const above = celno > 0 ? isIn(row, index, celno - 1) : isIn(row - 1, index, cells - 1);
    const below = celno < cells - 1 ? isIn(row, index, celno + 1) : isIn(row + 1, index, 0);
    return {
        top: !above,
        bottom: !below,
        left: !isIn(row, index - 1, celno),
        right: !isIn(row, index + 1, celno)
    };
}

/**
 * The cells of a range: its data rows top to bottom (group rows are left out, they have no cells) and
 * its fields left to right
 */
export function rangeBlock(gridInterface: GridInterface<any>, range: CellRange): { rows: Entity[]; fields: string[] } {
    const fields = getLayoutFields(gridInterface);
    const rect = rangeRect(range, fields);
    const datasource = gridInterface.getDatasource();
    const rows: Entity[] = [];
    for (let row = rect.top; row <= rect.bottom; row++) {
        const entity = datasource.getRow(row);
        if (entity && !isGroupRow(entity)) {
            rows.push(entity);
        }
    }
    return { rows, fields: rect.left < 0 ? [] : fields.slice(rect.left, rect.right + 1) };
}

/**
 * true when the two are the same cell
 */
export function samePoint(a: CellPoint, b: CellPoint) {
    return a.row === b.row && a.field === b.field;
}

/**
 * a range of one cell
 */
export function oneCell(point: CellPoint): CellRange {
    return { fromRow: point.row, fromField: point.field, toRow: point.row, toField: point.field };
}

/**
 * Where a Shift+click on a cell makes its range from: where the last range starts, else the active
 * cell (the one with the focus) - null when there is neither, or it is the active cell clicked with no
 * range: Shift does not make a range then. For the mouse (rangeSelection.ts) and the row menu's
 * Select › Range from the active cell to here (contextmenuRow.ts)
 * @param active the active cell, null when no cell has the focus
 * @param point the cell clicked
 */
export function shiftRangeStart(ranges: CellRange[], active: CellPoint | null, point: CellPoint): CellPoint | null {
    const last = ranges.at(-1);
    if (last) {
        return { row: last.fromRow, field: last.fromField };
    }
    return active && !samePoint(active, point) ? active : null;
}

/**
 * The ranges after a Shift+click on a cell: the last range from where it starts to the cell clicked -
 * with no range from the active cell, see {@link shiftRangeStart}. null when Shift makes no range
 */
export function shiftRanges(ranges: CellRange[], active: CellPoint | null, point: CellPoint): CellRange[] | null {
    const from = shiftRangeStart(ranges, active, point);
    if (!from) {
        return null;
    }
    const others = ranges.length ? ranges.slice(0, -1) : [];
    return [...others, { fromRow: from.row, fromField: from.field, toRow: point.row, toField: point.field }];
}

/**
 * The ranges after a Ctrl+click (Cmd+click) on a cell: another range, of the cell clicked. With no
 * range yet the active cell stays selected, a range of its own, as Excel keeps it
 */
export function ctrlRanges(ranges: CellRange[], active: CellPoint | null, point: CellPoint): CellRange[] {
    const others = ranges.length ? ranges : active && !samePoint(active, point) ? [oneCell(active)] : [];
    return [...others, oneCell(point)];
}

/**
 * true for a range of one cell
 */
export function isOneCell(range: CellRange) {
    return range.fromRow === range.toRow && range.fromField === range.toField;
}

/**
 * true when the ranges are more than one cell: several ranges, or one of more than one cell. Copy,
 * paste and Delete work on the ranges then; on one cell they are the input's own
 */
export function isMoreThanOneCell(ranges: CellRange[]) {
    return ranges.length > 1 || (ranges.length === 1 && !isOneCell(ranges[0]));
}

/**
 * true when the two lists have the same ranges, in the same order
 */
export function sameRanges(a: CellRange[], b: CellRange[]) {
    return (
        a.length === b.length &&
        a.every(
            (range, i) =>
                range.fromRow === b[i].fromRow &&
                range.toRow === b[i].toRow &&
                range.fromField === b[i].fromField &&
                range.toField === b[i].toField
        )
    );
}

/**
 * The ranges given to setRanges() are checked: plain JavaScript, or ranges stored as JSON, would else
 * show something else than asked without a word.
 * @throws a `TypeError` naming the range and what is wrong with it
 */
export function assertRanges(gridInterface: GridInterface<any>, ranges: unknown): asserts ranges is CellRange[] {
    if (!Array.isArray(ranges)) {
        throw new TypeError(
            `setRanges() takes a list of ranges, e.g. setRanges([{ fromRow: 0, fromField: 'name', toRow: 2, toField: 'age' }]), got ${String(ranges)}`
        );
    }
    const fields = getLayoutFields(gridInterface);
    const rowCount = gridInterface.getDatasource().length();
    ranges.forEach((range: Partial<CellRange> | null, i) => {
        const where = `setRanges(): range ${i}`;
        if (typeof range !== 'object' || range === null) {
            throw new TypeError(`${where} is not an object { fromRow, fromField, toRow, toField }`);
        }
        for (const key of ['fromRow', 'toRow'] as const) {
            const row = range[key];
            if (!Number.isInteger(row) || (row as number) < 0 || (row as number) >= rowCount) {
                throw new TypeError(
                    `${where}: ${key} is the index of a displayed row, 0 to ${rowCount - 1}, got ${JSON.stringify(row)}`
                );
            }
        }
        for (const key of ['fromField', 'toField'] as const) {
            const field = range[key];
            if (typeof field !== 'string' || !fields.includes(field)) {
                throw new TypeError(
                    `${where}: ${key} is a field of the layout (${fields.join(', ')}), got ${JSON.stringify(field)}`
                );
            }
        }
    });
}
