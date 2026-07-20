import type { Grid } from '../grid';
export declare const DROPDOWN_FILTER_MAX_ROWS = 100;
/**
 * helper for column excel similar filter
 * @param attribute
 * @param availableOnly
 * @param searchInput
 * @returns
 */
export declare function dropDownFilterData(ctx: Grid, attribute: string, availableOnly: boolean, searchInput: string): {
    enableAvailableOnlyOption: boolean;
    dataFilterSet: Set<unknown>;
    dataFilterSetFull: Set<unknown>;
    selectAll: boolean;
    /** true when values were dropped because of the DROPDOWN_FILTER_MAX_ROWS cap */
    truncated: boolean;
    /** rows per distinct value, only meaningful when nothing was truncated */
    counts: Map<any, number>;
};
//# sourceMappingURL=dropDownFilterData.d.ts.map