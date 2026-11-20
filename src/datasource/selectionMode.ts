/**
 * How rows can be selected:
 *
 * - `'multiple'` - many rows: ctrl+click adds a row, shift+click a range (the default)
 * - `'single'` - one row at a time
 * - `'none'` - no selection. Clicking a row still makes it the current entity
 *
 * Set it in the grid config (`GridConfig.selectionMode`) when the datasource is shown in a grid: the
 * grid sets its own on the datasource, which replaces `DatasourceOptions.selectionMode`.
 *
 * @sample selection
 * @example
 * ```ts
 * import type { GridConfig } from '@simple-html/grid';
 *
 * const config: GridConfig = {
 *     selectionMode: 'single',
 *     layout: { center: [{ fields: ['name'], width: 150 }] }
 * };
 * ```
 */
export type SelectionMode = 'none' | 'single' | 'multiple';
