/**
 * How rows can be selected:
 *
 * - `'multiple'` - many rows: ctrl+click adds a row, shift+click a range (the default)
 * - `'single'` - one row at a time
 * - `'none'` - no selection. Clicking a row still makes it the current entity
 *
 * `selectAll()` (and a click on the grid's top left corner) selects only in `'multiple'`.
 *
 * The datasource owns it: set it with `DatasourceOptions.selectionMode` or
 * `datasource.setSelectionMode()`. A grid reads it from its datasource, it has no option of its own
 * (v5's `GridConfig.selectionMode` is removed).
 *
 * @sample selection
 * @example
 * ```ts
 * import { Datasource } from '@simple-html/grid';
 *
 * const datasource = new Datasource({ key: 'id', selectionMode: 'single' });
 * datasource.setSelectionMode('none'); // later, also while it is shown in a grid
 * ```
 */
export type SelectionMode = 'none' | 'single' | 'multiple';
