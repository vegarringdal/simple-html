/**
 * One field to sort on, and the direction. `datasource.sort()` takes one or a list of them, the first
 * in the list decides first. It is what `GridState.sorting` holds.
 *
 * Blank values (null, undefined, `''`) come first when ascending, last when descending.
 *
 * @sample sorting-grouping
 * @example
 * ```ts
 * import type { SortArgument } from '@simple-html/grid';
 *
 * const byAge: SortArgument = { attribute: 'age', ascending: false };
 * datasource.sort([{ attribute: 'country', ascending: true }, byAge]);
 * ```
 */
export interface SortArgument {
    /** the field to sort on */
    attribute: string;
    /** `true` for A-Z / 0-9 / oldest first, `false` for the other way round */
    ascending: boolean;
}
