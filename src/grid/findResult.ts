/**
 * What Find (Ctrl+F in the grid, `gridInterface.find()`) has found: the text, how many cells show it
 * and which of them is the current one. `gridInterface.getFind()` gives it, and the `find-change` event
 * sends it each time it changes. See guides/19-find.md.
 *
 * - **A match** is a cell whose text - as the cell shows it, through the field's formatter - holds the
 *   text searched for, in any case. The cells are the fields of the layout in the displayed rows (after
 *   the filter, sorted): not the rows of a collapsed group, not a group row, not a checkbox.
 * - **The order** is the rows top to bottom, and in a row the fields in the order of
 *   `gridInterface.getLayoutFields()`: pinned left, center, pinned right.
 *
 * Plain JSON. The row of `current` is an index in the displayed rows as they are now, as the `row` of
 * the grid events.
 *
 * @example
 * ```ts
 * gridInterface.on('find-change', ({ open, count, position, current }) => {
 *     if (open && current) {
 *         console.log(`match ${position} of ${count}: row ${current.row}, ${current.field}`);
 *     }
 * });
 * ```
 */
export interface FindResult {
    /** the find bar is open: Ctrl+F, `find()` or `openFind()` opened it. The matches show while it is */
    open: boolean;
    /** the text searched for, as it was typed. It is kept when the bar closes, Ctrl+F shows it again */
    text: string;
    /** how many cells show the text. 0 for an empty text, and while the bar is closed */
    count: number;
    /** which match is the current one, 1 to `count` - 0 when there is none */
    position: number;
    /**
     * the cell of the current match: its row, an index in the displayed rows (`datasource.getRows()`, 0
     * based), and its field. `null` when there is no match
     */
    current: {
        /** the row of the cell: an index in the displayed rows, 0 based */
        row: number;
        /** the field of the cell */
        field: string;
    } | null;
}
