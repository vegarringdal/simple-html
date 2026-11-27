/**
 * One level of grouping: the field to group on and its title. `datasource.group()` takes a list of
 * them, the first is the outer group. It is what `GridState.grouping` holds.
 *
 * @sample sorting-grouping
 * @example
 * ```ts
 * import type { GroupArgument } from '@simple-html/grid';
 *
 * const grouping: GroupArgument[] = [
 *     { attribute: 'country', title: 'Country' },
 *     { attribute: 'company', title: 'Company' } // inside each country
 * ];
 * datasource.group(grouping);
 * ```
 */
export interface GroupArgument {
    /**
     * shown in the group rows (`'Country: Norway'`, its first letter made upper case) and in the
     * grouping panel above the grid. The grid uses the column's label when the user groups by dragging
     * a column to the panel
     */
    title: string;
    /** the field to group on */
    attribute: string;
}
