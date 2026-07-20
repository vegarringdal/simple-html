import type { Datasource } from './dataSource';
import type { Entity } from './entity';
import type { FilterArgument } from './filterArgument';
import type { FilterComparisonOperator } from './filterComparisonOperator';
export declare class Filter {
    private currentFilter;
    constructor();
    getFilter(): FilterArgument;
    setFilter(filter: FilterArgument): void;
    getFilterFromType(type: string): FilterComparisonOperator;
    filter(objArray: Entity[], ObjFilter: FilterArgument, ds: Datasource): Entity[];
    private orStatement;
    private andStatement;
}
//# sourceMappingURL=filter.d.ts.map