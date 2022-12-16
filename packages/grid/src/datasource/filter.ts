import { FilterArgument } from './filterArgument';
import { FilterComparisonOperator } from "./filterComparisonOperator";
import { Entity } from "./Entity";
import { objectFilter } from './objectFilter';
import { Datasource } from './dataSource';

export class Filter {
    private currentFilter: FilterArgument;

    constructor() {
        this.currentFilter = null;
    }

    public getFilter(): FilterArgument {
        return this.currentFilter;
    }

    public setFilter(filter: FilterArgument) {
        this.currentFilter = filter;
    }

    public getFilterFromType(type: string): FilterComparisonOperator {
        switch (type) {
            case 'date':
            case 'number':
                return 'GREATER_THAN_OR_EQUAL_TO';
            case 'bool':
                return 'EQUAL';
            default:
                return 'EQUAL';
        }
    }

    public filter(objArray: Entity[], ObjFilter: FilterArgument, ds: Datasource) {
        this.currentFilter = ObjFilter;

        const emptyFilter = Array.isArray(ObjFilter) && ObjFilter.length === 0;

        if (!ObjFilter || emptyFilter) {
            return objArray.slice();
        }

        if (
            ObjFilter?.type === 'GROUP' &&
            Array.isArray(ObjFilter?.filterArguments) &&
            ObjFilter?.filterArguments?.length === 0
        ) {
            return objArray.slice();
        }

        const resultArray = objArray.filter((rowData) => {
            // lets have true as default, so all that should not be there we set false..
            if (ObjFilter.logicalOperator === 'AND') {
                return this.andStatement(rowData, ObjFilter, ds);
            } else {
                return this.orStatement(rowData, ObjFilter, ds);
            }
        });

        return resultArray;
    }

    private orStatement(rowData: Entity, ObjFilter: FilterArgument, ds: Datasource): boolean {
        if (Array.isArray(ObjFilter.filterArguments)) {
            for (let i = 0; i < ObjFilter.filterArguments.length; i++) {
                const filter = ObjFilter.filterArguments[i];
                if (filter.logicalOperator === 'AND') {
                    const result = this.andStatement(rowData, filter, ds);
                    if (result) {
                        return true;
                    }
                }
                if (filter.logicalOperator === 'OR') {
                    const result = this.orStatement(rowData, filter, ds);
                    if (result) {
                        return true;
                    }
                }
                if (filter.logicalOperator === 'NONE' || filter.logicalOperator === null || filter.logicalOperator == undefined) {
                    let value = filter.value;
                    if (filter.valueType === 'ATTRIBUTE') {
                        if (typeof filter.value === 'string') {
                            value = rowData[filter.value];
                        } else {
                            console.error('filtervalue needs to be string if you are comparing attributes');
                        }
                    }
                    let result = false;
                    if (filter.operator === 'IN' || filter.operator === 'NOT_IN') {
                        let values = filter.value as any;
                        if (!Array.isArray(filter.value)) {
                            if (typeof filter.value !== 'string') {
                                return false;
                            }
                            values = (filter.value as string).toUpperCase().split('\n');
                            filter.value = values;
                        }

                        let data;
                        if (filter.attributeType === 'date' && rowData) {
                            data = ds.getDateFormater().fromDate(rowData[filter.attribute]);
                        } else {
                            if (filter.attributeType === 'number' && rowData) {
                                data = ds.getNumberFormater().fromNumber(rowData[filter.attribute]);
                            } else {
                                if (rowData && rowData[filter.attribute] !== null && rowData[filter.attribute] !== undefined) {
                                    data = rowData && rowData[filter.attribute];
                                    if (data && data.toUpperCase) {
                                        data = data.toUpperCase();
                                    }
                                }
                            }
                        }
                        let temp;
                        if (data === null || data === undefined || data === '' || data === 0) {
                            temp = values.indexOf('NULL');
                        } else {
                            temp = values.indexOf(data);
                        }

                        if (temp !== -1 && filter.operator === 'IN') {
                            result = true;
                        }

                        if (temp === -1 && filter.operator === 'NOT_IN') {
                            result = true;
                        }
                    } else {
                        result = objectFilter(rowData, {
                            value: value,
                            operator: filter.operator,
                            attribute: filter.attribute,
                            type: filter.attributeType
                        });
                    }

                    // noo need to check all
                    if (result) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private andStatement(rowData: Entity, ObjFilter: FilterArgument, ds: Datasource): boolean {
        if (Array.isArray(ObjFilter.filterArguments)) {
            for (let i = 0; i < ObjFilter.filterArguments.length; i++) {
                const filter = ObjFilter.filterArguments[i];
                if (filter.logicalOperator === 'AND') {
                    const result = this.andStatement(rowData, filter, ds);
                    if (!result) {
                        return false;
                    }
                }
                if (filter.logicalOperator === 'OR') {
                    const result = this.orStatement(rowData, filter, ds);
                    if (!result) {
                        return false;
                    }
                }
                if (filter.logicalOperator === 'NONE' || filter.logicalOperator === null || filter.logicalOperator == undefined) {
                    let value = filter.value;
                    if (filter.valueType === 'ATTRIBUTE') {
                        if (typeof filter.value === 'string') {
                            value = rowData[filter.value];
                        } else {
                            console.error('filtervalue needs to be string if you are comparing attributes');
                        }
                    }
                    let result = false;
                    if (filter.operator === 'IN' || filter.operator === 'NOT_IN') {
                        let values = filter.value as any;
                        if (!Array.isArray(filter.value)) {
                            if (typeof filter.value !== 'string') {
                                return false;
                            }
                            values = (filter.value as string).toUpperCase().split('\n');
                            filter.value = values;
                        }

                        let data;
                        if (filter.attributeType === 'date' && rowData) {
                            data = ds.getDateFormater().fromDate(rowData[filter.attribute]);
                        } else {
                            if (filter.attributeType === 'number' && rowData) {
                                data = ds.getNumberFormater().fromNumber(rowData[filter.attribute]);
                            } else {
                                if (rowData && rowData[filter.attribute] !== null && rowData[filter.attribute] !== undefined) {
                                    data = rowData && rowData[filter.attribute];
                                    if (data && data.toUpperCase) {
                                        data = data.toUpperCase();
                                    }
                                }
                            }
                        }

                        let temp;
                        if (data === null || data === undefined || data === '' || data === 0) {
                            temp = values.indexOf('NULL');
                        } else {
                            temp = values.indexOf(data);
                        }
                        if (temp !== -1 && filter.operator === 'IN') {
                            result = true;
                        }

                        if (temp === -1 && filter.operator === 'NOT_IN') {
                            result = true;
                        }
                    } else {
                        result = objectFilter(rowData, {
                            value: value,
                            operator: filter.operator,
                            attribute: filter.attribute,
                            type: filter.attributeType
                        });
                    }
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
