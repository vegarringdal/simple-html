/**
 * A range of cells: the rectangle between two cells, both included. The user makes ranges with the
 * mouse and the keyboard (see guides/17-selection-and-clipboard.md); `gridInterface.getRanges()` gives
 * them, `setRanges()` sets them.
 *
 * - **Rows** are indexes in the displayed rows (`datasource.getRows()`), 0 based - the `row` of the
 *   grid events. A group row in between is part of the rectangle, but it has no cells: copy, paste
 *   and clear skip it.
 * - **Fields** are field names. The fields between them are the ones between them in the layout, in
 *   the order of `gridInterface.getLayoutFields()`: pinned left, center, pinned right, and a column of
 *   stacked fields is a field each, top to bottom - the order of the CSV export and of
 *   `aria-colindex`.
 * - **`from` is where the range starts** (the anchor): the cell the mouse was pressed in, or the cell
 *   with the focus when it was made with the keyboard. **`to` is the opposite corner**, it can be
 *   above or left of `from`. The last range's `from` is the active cell: where the focus is.
 *
 * Plain JSON: it can be stored or sent. The indexes of the rows are only good for the rows as they
 * are displayed now - the grid clears the ranges when the displayed rows change (filter, sort, group,
 * expand, collapse, rows added or removed) and when the layout changes.
 *
 * @example
 * ```ts
 * import type { CellRange } from '@simple-html/grid';
 *
 * // the first three rows, from the name to the age (and every field between them in the layout)
 * const range: CellRange = { fromRow: 0, fromField: 'name', toRow: 2, toField: 'age' };
 * gridInterface.setRanges([range]);
 * ```
 */
export interface CellRange {
    /** the row the range starts at: an index in the displayed rows, 0 based */
    fromRow: number;
    /** the field the range starts at */
    fromField: string;
    /** the row of the opposite corner, above `fromRow` too */
    toRow: number;
    /** the field of the opposite corner, left of `fromField` too */
    toField: string;
}
