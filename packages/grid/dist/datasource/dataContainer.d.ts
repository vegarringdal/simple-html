import type { Entity } from './entity';
export declare const getNextKey: () => number;
/**
 * Datacontainer, this can be used as input for multible datasources
 */
export declare class DataContainer {
    private __collection;
    private __keyAttribute;
    private EntityHandler;
    /**
     *
     * @param UniqueKeyAttribute fo selection usage, this way it can be persistant when dealing with remote data
     */
    constructor(UniqueKeyAttribute?: string);
    /**
     * so user can override if they want
     */
    overrideEntityHandler(entityHandler: any): void;
    /**
     * so I can check
     * @internal
     */
    get type(): string;
    private getKey;
    /**
     * return collection slice
     * @returns
     */
    getDataSet(): Entity[];
    /**
     * gives you the entire collection
     * @returns array of entities
     */
    lenght(): number;
    /**
     * return entities marked for deletion
     * @returns
     */
    getMarkedForDeletion(): Entity[];
    /**
     * set data on __rowError on entities where key matches
     * @param errors key, errormsg
     */
    setErrors(errors: Map<string, string>): void;
    /**
     * for selected rows only
     * resets data, all edits are resets/tags are reset
     * new entities are removed
     */
    resetDataSelection(data: Entity[]): void;
    /**
     * resets data, all edits are resets/tags are reset
     * new entities are removed
     */
    resetData(): void;
    /**
     * returns a copy of changes
     * @returns
     */
    getChanges(): any;
    /**
     * mark data for deletion, will not show in searches/grouping
     * @param data set null if all
     * @param all remove all
     */
    markForDeletion(data: Entity | Entity[], all?: boolean): void;
    /**
     *
     */
    clearMarkedForDeletion(): void;
    /**
     * will remove from dataset, this is not the same as mark for deletion
     * @param data entity or entirty array you want to remove
     * @param all if set to true, you remove all
     * @returns returns removed
     */
    removeData(data: Entity | Entity[], all?: boolean): Entity[];
    /**
     * set data
     * @param data
     * @param add
     * @param tagAsNew
     * @returns
     */
    setData(data: any[], add?: boolean, tagAsNew?: boolean): Entity[] | undefined;
    /**
     * replaced entity wtih index
     * @param data
     * @param index
     * @param remove
     */
    replace(data: any[], index: number, remove: number): void;
}
//# sourceMappingURL=dataContainer.d.ts.map