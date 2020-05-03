import { IEntity, OperatorObject, FilterOperator } from './interfaces';
import { objectFilter } from './objectFilter';

export class ArrayFilter {
    private lastFilter: OperatorObject;
    public operators: any = {
        EQUAL: 1,
        LESS_THAN_OR_EQUAL_TO: 2,
        GREATER_THAN_OR_EQUAL_TO: 3,
        LESS_THAN: 4,
        GREATER_THAN: 5,
        CONTAINS: 6,
        NOT_EQUAL_TO: 7,
        DOES_NOT_CONTAIN: 8,
        BEGIN_WITH: 9,
        END_WITH: 10
    };

    constructor() {
        this.lastFilter = null;
    }

    public getLastFilter(): OperatorObject {
        return this.lastFilter;
    }

    public setLastFilter(filter: OperatorObject) {
        this.lastFilter = filter;
    }

    public getFilterFromType(type: string): FilterOperator {
        switch (type) {
            case 'date':
            case 'number':
                return 'GREATER_THAN';
            case 'bool':
                return 'EQUAL';
            default:
                return 'BEGIN_WITH';
        }
    }

    public runQueryOn(objArray: IEntity[], ObjFilter: OperatorObject) {
        this.lastFilter = ObjFilter;

        if (!ObjFilter) {
            return objArray.slice();
        }

        const resultArray = objArray.filter((rowData) => {
            // lets have true as default, so all that should not be there we set false..
            if (ObjFilter.groupType === 'AND') {
                return this.andStatement(rowData, ObjFilter);
            } else {
                return this.orStatement(rowData, ObjFilter);
            }
        });

        return resultArray;
    }

    private orStatement(rowData: IEntity, ObjFilter: OperatorObject): boolean {
        if (Array.isArray(ObjFilter.operatorObject)) {
            for (let i = 0; i < ObjFilter.operatorObject.length; i++) {
                const filter = ObjFilter.operatorObject[i];
                if (filter.groupType === 'AND') {
                    return this.andStatement(rowData, filter);
                }
                if (filter.groupType === 'OR') {
                    return this.orStatement(rowData, filter);
                }
                if (filter.groupType === 'NONE') {
                    let value = filter.value;
                    if (filter.valueType === 'ATTRIBUTE') {
                        value = rowData[filter.value];
                    }

                    const result = objectFilter(rowData, {
                        value: value,
                        operator: this.operators[filter.operator],
                        attribute: filter.attribute,
                        type: filter.attributeType
                    });
                    // noo need to check all
                    if (result) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private andStatement(rowData: IEntity, ObjFilter: OperatorObject): boolean {
        if (Array.isArray(ObjFilter.operatorObject)) {
            for (let i = 0; i < ObjFilter.operatorObject.length; i++) {
                const filter = ObjFilter.operatorObject[i];
                if (filter.groupType === 'AND') {
                    return this.andStatement(rowData, filter);
                }
                if (filter.groupType === 'OR') {
                    return this.orStatement(rowData, filter);
                }
                if (filter.groupType === 'NONE') {
                    let value = filter.value;
                    if (filter.valueType === 'ATTRIBUTE') {
                        value = rowData[filter.value];
                    }

                    const result = objectFilter(rowData, {
                        value: value,
                        operator: this.operators[filter.operator],
                        attribute: filter.attribute,
                        type: filter.attributeType
                    });
                    // noo need to check all
                    if (!result) {
                        return false;
                    }
                }
            }
        }

        return true;
    }
}
