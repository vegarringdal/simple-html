import { EntityHandler } from './entityHandler';


export interface Entity {
    __controller?: EntityHandler;
    __KEY?: string | number;
    __group?: boolean;
    __groupID?: string;
    __groupName?: string;
    __groupLvl?: number;
    __groupTotal?: number;
    __groupChildren?: Entity[];
    __groupExpanded?: boolean;
}
