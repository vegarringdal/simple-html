import type { EntityHandler } from './entityHandler';

export interface Entity {
    [key: string]: any | undefined;
    __controller?: EntityHandler;
    __KEY?: string | number;
    __group?: boolean;
    __groupID?: string;
    __rowState?: string;
    __rowError?: string | null;
    __groupName?: string;
    __groupLvl?: number;
    __groupTotal?: number;
    __groupChildren?: Entity[];
    __groupExpanded?: boolean;
}

/**
 * A row of data, not a group row: the DataContainer wraps every one of them in an EntityHandler
 * proxy, so it always has its controller.
 */
export interface DataEntity extends Entity {
    __controller: EntityHandler;
}

/**
 * @internal
 * A group row, made by Grouping with all its group fields set. Its children are data rows, or the
 * group rows of the next level when grouped on more than one attribute.
 */
export interface GroupEntity extends Entity {
    __group: true;
    __groupID: string;
    __groupName: string;
    __groupLvl: number;
    __groupTotal: number;
    __groupChildren: Entity[];
    __groupExpanded: boolean;
}
