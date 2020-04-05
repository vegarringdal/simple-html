import { IGroupingObj, IEntity } from './interfaces';

/**
 * This takes care the generating the flat array the grid can use for grouping
 *
 */
export class ArrayGrouping {
    private groups: IEntity[][];
    private grouping: IGroupingObj[];
    private expanded: Set<string>;

    constructor() {
        this.grouping = [];
        this.expanded = new Set([]);
    }

    public reset() {
        this.groups = [];
        this.grouping = [];
        this.expanded = new Set([]);
    }

    public group(arrayToGroup: IEntity[], grouping: IGroupingObj[], keepExpanded?: boolean) {
        // if grouping
        if (grouping.length > 0) {
            // temp holder for groups as we create them
            if (!keepExpanded) {
                this.expanded = new Set([]);
            }

            // variable to hold our groups
            const groups: IEntity[][] = [];

            grouping.forEach((groupBy, groupNo) => {
                if (groupNo === 0) {
                    // create main group and add to groups array
                    const mainGroup = this.createMainGrouping(arrayToGroup, groupBy.field, groupNo);
                    groups.push(mainGroup);
                } else {
                    // get last group created, and group children
                    const childGroupArray = groups[groups.length - 1];
                    const newSubGroup = this.groupChildren(childGroupArray, groupBy.field, groupNo);
                    groups.push(newSubGroup);
                }
            });

            // set to our class wo we have it for later
            this.groups = groups;

            // set to clas so we can get it later
            this.grouping = grouping;

            // do we want what was expanded still to be expanded, if so just return firts grouping
            if (!keepExpanded) {
                return groups[0];
            } else {
                return this.expandOneOrAll(null, this.expanded);
            }
        } else {
            // set all rows to 0 grouping
            arrayToGroup.forEach(row => {
                row.__groupLvl = 0;
            });

            // clear prev grouping
            this.grouping = [];

            return arrayToGroup;
        }
    }

    public getExpanded() {
        return Array.from(this.expanded);
    }

    public setExpanded(x: string[]) {
        this.expanded = new Set(x);
    }

    public getGrouping(): IGroupingObj[] {
        return this.grouping;
    }

    public setGrouping(g: IGroupingObj[]) {
        this.grouping = g;
    }

    public expandOneOrAll(id: string, array?: Set<string>) {
        let all = id ? false : true; // if no id, then all
        if (!id) {
            if (array) {
                all = false;
            }
        }

        if (!array) {
            array = new Set([]);
        }
        let subGroup: Function;
        const collection: IEntity[] = [];
        const mainGroups = this.groups[0];

        // loop children
        // g = group
        // sg = subgroup
        subGroup = (g: IEntity) => {
            g.__groupChildren.forEach((sg: IEntity) => {
                collection.push(sg);
                switch (true) {
                    case all:
                    case sg.__groupID === id:
                    case array.has(sg.__groupID):
                    case sg.__groupID !== id && sg.__groupExpanded:
                        if (sg.__groupChildren) {
                            sg.__groupExpanded = true;
                            this.expanded.add(sg.__groupID);
                            subGroup(sg);
                        }
                        break;
                    default:
                        // need anything here ?
                        break;
                }
            });
        };

        // loop main groups
        mainGroups.forEach((g: IEntity) => {
            collection.push(g);
            switch (true) {
                case all:
                case g.__groupID === id:
                case array.has(g.__groupID):
                case g.__groupID !== id && g.__groupExpanded:
                    g.__groupExpanded = true;
                    this.expanded.add(g.__groupID);
                    if (g.__groupChildren) {
                        subGroup(g);
                    }
                    break;
                default:
                    // need anything here ?
                    break;
            }
        });

        return collection;
    }

    public collapseOneOrAll(id?: string) {
        const all = id ? false : true; // if no id, then all
        id = id === undefined ? null : id;
        let subGroup: Function;
        const collection: IEntity[] = [];
        const mainGroups = this.groups[0];

        // lopp children
        subGroup = (g: IEntity) => {
            g.__groupChildren.forEach((sg: IEntity) => {
                switch (true) {
                    case all:
                        if (sg.__groupChildren) {
                            sg.__groupExpanded = false;
                            this.expanded.delete(sg.__groupID);
                            subGroup(sg);
                        }
                        break;
                    case sg.__groupID === id:
                        collection.push(sg);
                        this.expanded.delete(sg.__groupID);
                        sg.__groupExpanded = false;
                        break;
                    default:
                        collection.push(sg);
                        if (sg.__groupChildren && sg.__groupExpanded) {
                            subGroup(sg);
                        }
                        break;
                }
            });
        };

        // loop main groups
        mainGroups.forEach((g: IEntity) => {
            collection.push(g);
            switch (true) {
                case all:
                    g.__groupExpanded = false;
                    this.expanded.delete(g.__groupID);
                    if (g.__groupChildren) {
                        subGroup(g);
                    }
                    break;
                case g.__groupID === id:
                    g.__groupExpanded = false;
                    this.expanded.delete(g.__groupID);
                    break;
                default:
                    if (g.__groupChildren && g.__groupExpanded) {
                        subGroup(g);
                    }
                    break;
            }
        });

        return collection;
    }

    private createMainGrouping(array: IEntity[], groupBy: string, groupNo: number) {
        const tempGroupArray: IEntity[] = [];
        let curGroup: IEntity = {} as IEntity;
        let tempValue: string = null;

        // first level, here we use array
        array.forEach(element => {
            let gidm = element[groupBy];
            gidm = typeof gidm === 'boolean' ? gidm.toString() : gidm;
            gidm = gidm || ' blank';

            if (gidm !== tempValue) {
                curGroup = {
                    __groupName: gidm,
                    __group: true,
                    __groupID: gidm,
                    __groupLvl: groupNo,
                    __groupChildren: [element],
                    __groupTotal: 1,
                    __groupExpanded: false
                };
                element.__groupLvl = groupNo + 1;
                tempValue = gidm;
                tempGroupArray.push(curGroup);
            } else {
                element.__groupLvl = groupNo + 1;
                curGroup.__groupChildren.push(element);
                curGroup.__groupTotal++;
            }
        });

        return tempGroupArray;
    }

    private groupChildren(childGroupArray: IEntity[], groupBy: string, groupNo: number) {
        const tempGroupArray: IEntity[] = [];

        let curGroup: IEntity = {} as IEntity;

        // loop groups
        childGroupArray.forEach((element: IEntity) => {
            let tempValue: string = null;
            // loop children
            const rebuiltChildrenArray: IEntity[] = [];
            element.__groupChildren.forEach((child: IEntity) => {
                const gidm = child[groupBy] || ' blank';
                if (gidm !== tempValue) {
                    const gidc = element.__groupID;
                    curGroup = {
                        __groupName: gidm,
                        __groupID: gidc + '-' + gidm,
                        __group: true,
                        __groupLvl: groupNo,
                        __groupChildren: [child],
                        __groupTotal: 1,
                        __groupExpanded: false
                    };
                    child.__groupLvl = groupNo + 1;

                    tempValue = gidm;
                    rebuiltChildrenArray.push(curGroup);
                    tempGroupArray.push(curGroup);
                } else {
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
