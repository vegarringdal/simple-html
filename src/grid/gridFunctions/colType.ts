export type ColumnCache = { column: number; left: number; refID: number };
/**
 * Which section of the grid a cell is in, the `colType` of the grid events:
 *
 * - `'left-pinned'` - the columns pinned left (`GridLayout.left`)
 * - `'middle-pinned'` - the columns that scroll sideways (`GridLayout.center`)
 * - `'right-pinned'` - the columns pinned right (`GridLayout.right`)
 * - `'selector'` - the row selector at the far left, with the row numbers
 * - `'group'` - the cells of a group row
 *
 * @example
 * ```ts
 * gridInterface.on('cell-click', (data) => {
 *     if (data.colType === 'left-pinned') {
 *         console.log('a pinned column', data.attribute);
 *     }
 * });
 * ```
 */
export type ColType = 'group' | 'selector' | 'left-pinned' | 'middle-pinned' | 'right-pinned';
export type RowCache = { id: string; row: number; top: number };
