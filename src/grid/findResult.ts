/**
 * What Find (Ctrl+F in the grid, `gridInterface.find()`) has found: the text, how many cells show it
 * and which of them is the current one. `gridInterface.getFind()` gives it, and the `find-change` event
 * sends it each time it changes. See guides/19-find.md.
 *
 * - **A match** is a cell whose text - as the cell shows it, through the field's formatter - holds the
 *   text searched for, in any case - as it is with "Match case" (`caseSensitive`). The cells are the
 *   fields of the layout in the displayed rows (after the filter, sorted): not the rows of a collapsed
 *   group, not a group row, not a checkbox.
 * - **The order** is the rows top to bottom, and in a row the fields in the order of
 *   `gridInterface.getLayoutFields()`: pinned left, center, pinned right.
 * - **"Filter rows"** (`filterRows`) shows only the rows with a match. The matches are the same, in
 *   fewer rows.
 *
 * Plain JSON. The row of `current` is an index in the displayed rows as they are now, as the `row` of
 * the grid events.
 *
 * @example
 * ```ts
 * gridInterface.on('find-change', ({ open, count, position, current, filterRows, caseSensitive }) => {
 *     if (open && current) {
 *         console.log(`match ${position} of ${count}: row ${current.row}, ${current.field}`);
 *     }
 *     console.log(filterRows ? 'only the rows with a match' : 'every row', caseSensitive ? '(match case)' : '');
 * });
 * ```
 */
export interface FindResult {
    /** the find bar is open: Ctrl+F, `find()` or `openFind()` opened it. The matches show while it is */
    open: boolean;
    /** the text searched for, as it was typed. It is kept when the bar closes, Ctrl+F shows it again */
    text: string;
    /**
     * "Filter rows" is on: only the rows with a match are shown - the toggle of the find bar, or
     * `find(text, { filterRows: true })`. With an empty text every row is shown. `false` while the bar
     * is closed: closing it turns it off
     */
    filterRows: boolean;
    /**
     * "Match case" is on: the text is found as it is, `Acme` does not find `ACME` - the toggle `Aa` of the
     * find bar (Alt+C), or `find(text, { caseSensitive: true })`. The matches, the count and "Filter rows"
     * follow it. It is kept when the bar closes, as the text
     */
    caseSensitive: boolean;
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
