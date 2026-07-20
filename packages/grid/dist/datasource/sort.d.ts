import type { Entity } from './entity';
import type { SortArgument } from './sortArgument';
export declare class Sort {
    private lastSorting;
    private currentSorting;
    private localeCompareCode;
    dates: string[];
    constructor();
    setDateAttribute(dates?: string[]): void;
    setLocaleCompare(code: string, options?: any): void;
    reset(defaultSortAttribute?: string): void;
    overrideSort(array: SortArgument[]): void;
    getLastSort(): SortArgument[];
    setOrderBy(param: SortArgument | SortArgument[], add?: boolean): void;
    getOrderBy(): SortArgument[];
    runOrderBy(array: Entity[]): void;
}
//# sourceMappingURL=sort.d.ts.map