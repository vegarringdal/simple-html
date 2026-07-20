import type { Datasource } from './dataSource';
import type { Entity } from './entity';
import type { GroupArgument } from './groupArgument';
/**
 * This takes care the generating the flat array the grid can use for grouping
 *
 */
export declare class Grouping {
    private currentGroups;
    private groupingConfig;
    private expandedGroupIDs;
    constructor();
    reset(): void;
    group(arrayToGroup: Entity[], groupingConfig: GroupArgument[], keepExpanded: boolean, ds: Datasource): Entity[];
    getExpanded(): string[];
    setExpanded(x: string[]): void;
    getGrouping(): GroupArgument[];
    setGrouping(groupingConfig: GroupArgument[]): void;
    private toUppercase;
    expandOneOrAll(id: string, array?: Set<string>): Entity[];
    /**
     * collapses the id given or all if ID is null/undefined
     * @param id string id
     */
    collapseOneOrAll(id?: string): Entity[];
    private createMainGrouping;
    private groupChildren;
}
//# sourceMappingURL=grouping.d.ts.map