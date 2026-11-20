import type { Datasource } from './dataSource';
import type { Entity, GroupEntity } from './entity';
import type { GroupArgument } from './groupArgument';
import { isBlank } from './isBlank';

/**
 * true for a group row, only group rows have __groupChildren
 */
function isGroupRow(row: Entity): row is GroupEntity {
    return !!row.__groupChildren;
}

/**
 * This takes care the generating the flat array the grid can use for grouping
 *
 */
export class Grouping {
    // built by group(), empty until then - and whenever it no longer matches groupingConfig
    private currentGroups: GroupEntity[][] = [];
    private groupingConfig: GroupArgument[];
    private expandedGroupIDs: Set<string>;

    constructor() {
        this.groupingConfig = [];
        this.expandedGroupIDs = new Set([]);
    }

    public reset() {
        this.currentGroups = [];
        this.groupingConfig = [];
        this.expandedGroupIDs = new Set([]);
    }

    public group(arrayToGroup: Entity[], groupingConfig: GroupArgument[], keepExpanded: boolean, ds: Datasource): Entity[] {
        // if grouping
        if (groupingConfig.length > 0) {
            // temp holder for groups as we create them
            if (!keepExpanded) {
                this.expandedGroupIDs = new Set([]);
            }

            // variable to hold our groups
            const groups: GroupEntity[][] = [];

            groupingConfig.forEach((groupBy, groupNo) => {
                if (groupNo === 0) {
                    // create main group and add to groups array
                    const mainGroup = this.createMainGrouping(arrayToGroup, groupBy.attribute, groupNo, groupBy.title, ds);
                    groups.push(mainGroup);
                } else {
                    // get last group created, and group children
                    const childGroupArray = groups[groups.length - 1];
                    const newSubGroup = this.groupChildren(childGroupArray, groupBy.attribute, groupNo, groupBy.title, ds);
                    groups.push(newSubGroup);
                }
            });

            // set to our class wo we have it for later
            this.currentGroups = groups;

            // set to clas so we can get it later
            this.groupingConfig = groupingConfig;

            // do we want what was expanded still to be expanded, if so just return firts grouping
            if (!keepExpanded) {
                return groups[0];
            } else {
                return this.expandOneOrAll(null, this.expandedGroupIDs);
            }
        } else {
            // set all rows to 0 grouping
            arrayToGroup.forEach((row) => {
                row.__groupLvl = 0;
            });

            // clear prev grouping
            this.groupingConfig = [];
            this.currentGroups = [];

            return arrayToGroup;
        }
    }

    public getExpanded() {
        return Array.from(this.expandedGroupIDs);
    }

    public setExpanded(x: string[]) {
        this.expandedGroupIDs = new Set(x);
    }

    public getGrouping(): GroupArgument[] {
        return this.groupingConfig;
    }

    public setGrouping(groupingConfig: GroupArgument[]) {
        this.groupingConfig = groupingConfig;
    }

    /**
     * forget the built groups, when they no longer match the grouping config
     */
    public clearGroups() {
        this.currentGroups = [];
    }

    /**
     * true once group() has built groups for the current config - expand/collapse need them
     */
    public hasGroups() {
        return this.currentGroups.length > 0;
    }

    private toUppercase(text: string) {
        if (text) {
            return text[0].toUpperCase() + text.substring(1, text.length);
        } else {
            return text;
        }
    }

    public expandOneOrAll(id?: string | null, array?: Set<string>) {
        let all = !id; // if no id, then all
        if (!id) {
            if (array) {
                all = false;
            }
        }

        if (!array) {
            array = new Set([]);
        }

        const collection: Entity[] = [];
        const mainGroups = this.currentGroups[0];

        // loop children
        const traverseSubGroups = (group: GroupEntity) => {
            group.__groupChildren.forEach((subGroup: Entity) => {
                collection.push(subGroup);
                switch (true) {
                    case all:
                    case subGroup.__groupID === id:
                    case isGroupRow(subGroup) && array.has(subGroup.__groupID):
                    case subGroup.__groupID !== id && subGroup.__groupExpanded: //if already expanded
                        if (isGroupRow(subGroup)) {
                            subGroup.__groupExpanded = true;
                            this.expandedGroupIDs.add(subGroup.__groupID);
                            traverseSubGroups(subGroup);
                        }
                        break;
                    default:
                        // need anything here ?
                        break;
                }
            });
        };

        // loop main groups
        mainGroups.forEach((group: GroupEntity) => {
            collection.push(group);
            switch (true) {
                case all:
                case group.__groupID === id:
                case array.has(group.__groupID):
                case group.__groupID !== id && group.__groupExpanded:
                    group.__groupExpanded = true;
                    this.expandedGroupIDs.add(group.__groupID);
                    if (group.__groupChildren) {
                        traverseSubGroups(group);
                    }
                    break;
                default:
                    // need anything here ?
                    break;
            }
        });

        return collection;
    }

    /**
     * collapses the id given or all if ID is null/undefined
     * @param id string id
     */
    public collapseOneOrAll(id?: string | null) {
        const all = !id; // if no id, then all
        id = id === undefined ? null : id;

        const collection: Entity[] = [];
        const mainGroups = this.currentGroups[0];

        // loop children
        const traverseSubGroup = (group: GroupEntity) => {
            group.__groupChildren.forEach((subGroup: Entity) => {
                switch (true) {
                    case all:
                        if (isGroupRow(subGroup)) {
                            subGroup.__groupExpanded = false;
                            this.expandedGroupIDs.delete(subGroup.__groupID);
                            traverseSubGroup(subGroup);
                        }
                        break;
                    case subGroup.__groupID === id:
                        collection.push(subGroup);
                        this.expandedGroupIDs.delete(subGroup.__groupID);
                        subGroup.__groupExpanded = false;
                        break;
                    default:
                        collection.push(subGroup);
                        if (isGroupRow(subGroup) && subGroup.__groupExpanded) {
                            traverseSubGroup(subGroup);
                        }
                        break;
                }
            });
        };

        // loop main groups
        mainGroups.forEach((group: GroupEntity) => {
            collection.push(group);
            switch (true) {
                case all:
                    group.__groupExpanded = false;
                    this.expandedGroupIDs.delete(group.__groupID);
                    if (group.__groupChildren) {
                        traverseSubGroup(group);
                    }
                    break;
                case group.__groupID === id:
                    group.__groupExpanded = false;
                    this.expandedGroupIDs.delete(group.__groupID);
                    break;
                default:
                    if (group.__groupChildren && group.__groupExpanded) {
                        traverseSubGroup(group);
                    }
                    break;
            }
        });

        return collection;
    }

    /**
     * expands every group on the path down to the entity and returns the new displayed rows.
     * Used for a row added while grouped, so it shows up even if its group was collapsed.
     * @param entity data row that is part of the current groups
     */
    public expandToEntity(entity: Entity) {
        const findPath = (groups: GroupEntity[]): string[] | null => {
            for (const group of groups) {
                if (group.__groupChildren.includes(entity)) {
                    return [group.__groupID];
                }
                const path = findPath(group.__groupChildren.filter((child): child is GroupEntity => !!child.__group));
                if (path) {
                    return [group.__groupID, ...path];
                }
            }
            return null;
        };

        findPath(this.currentGroups[0] || [])?.forEach((id) => {
            this.expandedGroupIDs.add(id);
        });

        return this.expandOneOrAll(null, this.expandedGroupIDs);
    }

    /**
     * the key a row is grouped on, the same at every grouping level.
     * Groups are built from runs of equal keys in the sorted rows, so the key has to agree with
     * what the sort treats as equal (see `Sort.compareAscending`): every blank (null, undefined,
     * '', invalid Date) is the one ' blank' group, while 0 and false are real values.
     */
    private groupKey(value: any, attribute: string, ds: Datasource): any {
        if (isBlank(value)) {
            return ' blank';
        }
        if (typeof value === 'boolean') {
            return value.toString();
        }
        let key = value;
        if (typeof value?.toLocaleDateString === 'function') {
            key = ds.getValueFormatter().fromSourceGrouping(value, 'date', attribute, false);
        } else if (typeof value?.toFixed === 'function') {
            key = ds.getValueFormatter().fromSourceGrouping(value, 'number', attribute, false);
        }
        // a formatter can still format a value to nothing, NaN for example
        return key === null || key === undefined || key === '' ? ' blank' : key;
    }

    private createMainGrouping(array: Entity[], groupBy: string, groupNo: number, title: string, ds: Datasource) {
        const tempGroupArray: GroupEntity[] = [];
        // replaced by the first row, groupKey never returns null
        let curGroup = {} as GroupEntity;
        let lastGroupID: string | null = null;

        // first level, here we use array
        array.forEach((element) => {
            const groupID = this.groupKey(element[groupBy], groupBy, ds);

            if (groupID !== lastGroupID) {
                curGroup = {
                    __groupName: `${this.toUppercase(title)}: ${groupID}`,
                    __group: true,
                    __groupID: groupID,
                    __groupLvl: groupNo,
                    __groupChildren: [element],
                    __groupTotal: 1,
                    __groupExpanded: false
                };
                element.__groupLvl = groupNo + 1;
                lastGroupID = groupID;
                tempGroupArray.push(curGroup);
            } else {
                curGroup.__groupChildren.push(element);
                curGroup.__groupTotal++;
            }
        });

        return tempGroupArray;
    }

    private groupChildren(childGroupArray: GroupEntity[], groupBy: string, groupNo: number, title: string, ds: Datasource) {
        const tempGroupArray: GroupEntity[] = [];

        // replaced by the first child, groupKey never returns null
        let curGroup = {} as GroupEntity;

        // loop groups
        childGroupArray.forEach((element: GroupEntity) => {
            let tempValue: string | null = null;
            // loop children
            const rebuiltChildrenArray: Entity[] = [];
            element.__groupChildren.forEach((child: Entity) => {
                const groupID = this.groupKey(child[groupBy], groupBy, ds);

                if (groupID !== tempValue) {
                    const gidc = element.__groupID;
                    curGroup = {
                        __groupName: `${this.toUppercase(title)}: ${groupID}`,
                        __groupID: `${gidc}-${groupID}`,
                        __group: true,
                        __groupLvl: groupNo,
                        __groupChildren: [child],
                        __groupTotal: 1,
                        __groupExpanded: false
                    };
                    child.__groupLvl = groupNo + 1;

                    tempValue = groupID;
                    rebuiltChildrenArray.push(curGroup);
                    tempGroupArray.push(curGroup);
                } else {
                    // add group lvl it belongs to so we know if we parse collection
                    child.__groupLvl = groupNo + 1;
                    curGroup.__groupChildren.push(child);
                    curGroup.__groupTotal++;
                }
            });

            // replace children with new groups
            element.__groupChildren = rebuiltChildrenArray;
        });

        return tempGroupArray;
    }
}
