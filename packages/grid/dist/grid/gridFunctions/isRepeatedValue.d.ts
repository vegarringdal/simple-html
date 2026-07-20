import type { Grid } from '../grid';
/**
 * True when this cell shows the same thing as the row directly above it, and should be
 * dimmed.
 *
 * The comparison is on the **displayed** value, not the raw one. This is a visual feature -
 * if a value formater makes two different source values render as the same text, they look
 * repeated to the user and should dim. Comparing the raw values would leave a column of
 * identical looking text undimmed.
 *
 * The row above is looked up in the displayed collection, which is what makes grouping work
 * for free: a group header sits between two groups, so the first data row of every group
 * always reads at full strength again.
 *
 * Row indexes are absolute in the displayed collection, not in the recycled dom rows, so
 * this stays correct while scrolling.
 */
export declare function isRepeatedValue(ctx: Grid, row: number, attribute: string): boolean;
//# sourceMappingURL=isRepeatedValue.d.ts.map