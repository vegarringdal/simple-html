import type { Entity } from './entity';
/**
 * @internal
 * Entity will keep track of edited properties of the row object
 */
export declare class EntityHandler {
    [key: string]: any | undefined;
    __editedProps?: Record<string, any>;
    __originalValues?: Record<string, any>;
    __currentValues?: Record<string, any>;
    __newprops?: Record<string, any>;
    __isNew?: boolean;
    __isDeleted?: boolean;
    __edited?: boolean;
    __controller?: EntityHandler;
    __KEY?: string | number;
    __KEYSTRING?: string | number;
    __group?: boolean;
    __rowState?: string;
    __groupID?: string;
    __rowError?: string;
    __groupName?: string;
    __groupLvl?: number;
    __groupTotal?: number;
    __groupChildren?: Entity[];
    __groupExpanded?: boolean;
    constructor(keyString?: string, tagAsNew?: boolean);
    get(target: any, prop: string): any;
    set(obj: any, prop: string, value: any): boolean;
}
//# sourceMappingURL=entityHandler.d.ts.map