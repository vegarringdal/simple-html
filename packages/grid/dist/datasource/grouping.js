/**
 * This takes care the generating the flat array the grid can use for grouping
 *
 */
export class Grouping {
    currentGroups;
    groupingConfig;
    expandedGroupIDs;
    constructor() {
        this.groupingConfig = [];
        this.expandedGroupIDs = new Set([]);
    }
    reset() {
        this.currentGroups = [];
        this.groupingConfig = [];
        this.expandedGroupIDs = new Set([]);
    }
    group(arrayToGroup, groupingConfig, keepExpanded, ds) {
        // if grouping
        if (groupingConfig.length > 0) {
            // temp holder for groups as we create them
            if (!keepExpanded) {
                this.expandedGroupIDs = new Set([]);
            }
            // variable to hold our groups
            const groups = [];
            groupingConfig.forEach((groupBy, groupNo) => {
                if (groupNo === 0) {
                    // create main group and add to groups array
                    const mainGroup = this.createMainGrouping(arrayToGroup, groupBy.attribute, groupNo, groupBy.title, ds);
                    groups.push(mainGroup);
                }
                else {
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
            }
            else {
                return this.expandOneOrAll(null, this.expandedGroupIDs);
            }
        }
        else {
            // set all rows to 0 grouping
            arrayToGroup.forEach((row) => {
                row.__groupLvl = 0;
            });
            // clear prev grouping
            this.groupingConfig = [];
            return arrayToGroup;
        }
    }
    getExpanded() {
        return Array.from(this.expandedGroupIDs);
    }
    setExpanded(x) {
        this.expandedGroupIDs = new Set(x);
    }
    getGrouping() {
        return this.groupingConfig;
    }
    setGrouping(groupingConfig) {
        this.groupingConfig = groupingConfig;
    }
    toUppercase(text) {
        if (text) {
            return text[0].toUpperCase() + text.substring(1, text.length);
        }
        else {
            return text;
        }
    }
    expandOneOrAll(id, array) {
        let all = !id; // if no id, then all
        if (!id) {
            if (array) {
                all = false;
            }
        }
        if (!array) {
            array = new Set([]);
        }
        const collection = [];
        const mainGroups = this.currentGroups[0];
        // loop children
        const traverseSubGroups = (group) => {
            group.__groupChildren.forEach((subGroup) => {
                collection.push(subGroup);
                switch (true) {
                    case all:
                    case subGroup.__groupID === id:
                    case array.has(subGroup.__groupID):
                    case subGroup.__groupID !== id && subGroup.__groupExpanded: //if already expanded
                        if (subGroup.__groupChildren) {
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
        mainGroups.forEach((group) => {
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
    collapseOneOrAll(id) {
        const all = !id; // if no id, then all
        id = id === undefined ? null : id;
        const collection = [];
        const mainGroups = this.currentGroups[0];
        // loop children
        const traverseSubGroup = (group) => {
            group.__groupChildren.forEach((subGroup) => {
                switch (true) {
                    case all:
                        if (subGroup.__groupChildren) {
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
                        if (subGroup.__groupChildren && subGroup.__groupExpanded) {
                            traverseSubGroup(subGroup);
                        }
                        break;
                }
            });
        };
        // loop main groups
        mainGroups.forEach((group) => {
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
    createMainGrouping(array, groupBy, groupNo, title, ds) {
        const tempGroupArray = [];
        let curGroup = {};
        let lastGroupID = null;
        // first level, here we use array
        array.forEach((element) => {
            let groupID = element[groupBy];
            groupID = typeof groupID === 'boolean' ? groupID.toString() : groupID;
            groupID =
                typeof groupID?.toLocaleDateString === 'function'
                    ? ds.getValueFormater().fromSourceGrouping(groupID, 'date', groupBy, false)
                    : typeof groupID?.toFixed === 'function'
                        ? ds.getValueFormater().fromSourceGrouping(groupID, 'number', groupBy, false)
                        : groupID;
            groupID = groupID || ' blank';
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
            }
            else {
                curGroup.__groupChildren.push(element);
                curGroup.__groupTotal++;
            }
        });
        return tempGroupArray;
    }
    groupChildren(childGroupArray, groupBy, groupNo, title, ds) {
        const tempGroupArray = [];
        let curGroup = {};
        // loop groups
        childGroupArray.forEach((element) => {
            let tempValue = null;
            // loop children
            const rebuiltChildrenArray = [];
            element.__groupChildren.forEach((child) => {
                let groupID = child[groupBy];
                groupID =
                    typeof groupID?.toLocaleDateString === 'function'
                        ? ds.getValueFormater().fromSourceGrouping(groupID, 'date', groupBy, false)
                        : typeof groupID?.toFixed === 'function'
                            ? ds.getValueFormater().fromSourceGrouping(groupID, 'number', groupBy, false)
                            : groupID;
                groupID = groupID || ' blank';
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
                }
                else {
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
//# sourceMappingURL=grouping.js.map