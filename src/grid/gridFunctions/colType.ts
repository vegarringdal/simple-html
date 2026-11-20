export type ColumnCache = { column: number; left: number; refID: number };
/**
 * which section of the grid a cell belongs to.
 * The same strings as the constants in GROUP_COLTYPE.ts, written out so the type documents itself.
 */
export type ColType = 'group' | 'selector' | 'left-pinned' | 'middle-pinned' | 'right-pinned';
export type RowCache = { id: string; row: number; top: number };
