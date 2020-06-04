import { Entity, FilterArgument, FilterComparisonOperator } from './types';
import { objectFilter } from './objectFilter';

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
                return 'GREATER_THAN';
            case 'bool':
                return 'EQUAL';
            default:
                return 'BEGIN_WITH';
        }
    }

    public filter(objArray: Entity[], ObjFilter: FilterArgument) {
        this.currentFilter = ObjFilter;

        if (!ObjFilter) {
            return objArray.slice();
        }

        const resultArray = objArray.filter((rowData) => {
            // lets have true as default, so all that should not be there we set false..
            if (ObjFilter.logicalOperator === 'AND') {
                return this.andStatement(rowData, ObjFilter);
            } else {
                return this.orStatement(rowData, ObjFilter);
            }
        });

        return resultArray;
    }

    private orStatement(rowData: Entity, ObjFilter: FilterArgument): boolean {
        if (Array.isArray(ObjFilter.filterArguments)) {
            for (let i = 0; i < ObjFilter.filterArguments.length; i++) {
                const filter = ObjFilter.filterArguments[i];
                if (filter.logicalOperator === 'AND') {
                    const result = this.andStatement(rowData, filter);
                    if (result) {
                        return true;
                    }
                }
                if (filter.logicalOperator === 'OR') {
                    const result = this.orStatement(rowData, filter);
                    if (result) {
                        return true;
                    }
                }
                if (
                    filter.logicalOperator === 'NONE' ||
                    filter.logicalOperator === null ||
                    filter.logicalOperator == undefined
                ) {
                    let value = filter.value;
                    if (filter.valueType === 'ATTRIBUTE') {
                        if (typeof filter.value === 'string') {
                            value = rowData[filter.value];
                        } else {
                            console.error(
                                'filtervalue needs to be string if you are comparing attributes'
                            );
                        }
                    }
                    let result = false;
                    if (filter.operator === 'IN') {
                        let values = filter.value as any;
                        if (!Array.isArray(filter.value)) {
                            if (typeof filter.value !== 'string') {
                                return false;
                            }
                            values = (filter.value as string).split('\n');
                        }

                        for (let y = 0; y < values.length; y++) {
                            const temp = objectFilter(rowData, {
                                value: values[y],
                                operator: 'EQUAL',
                                attribute: filter.attribute,
                                type: filter.attributeType
                            });
                            if (temp) {
                                result = true;
                            }
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

    private andStatement(rowData: Entity, ObjFilter: FilterArgument): boolean {
        if (Array.isArray(ObjFilter.filterArguments)) {
            for (let i = 0; i < ObjFilter.filterArguments.length; i++) {
                const filter = ObjFilter.filterArguments[i];
                if (filter.logicalOperator === 'AND') {
                    const result = this.andStatement(rowData, filter);
                    if (!result) {
                        return false;
                    }
                }
                if (filter.logicalOperator === 'OR') {
                    const result = this.orStatement(rowData, filter);
                    if (!result) {
                        return false;
                    }
                }
                if (
                    filter.logicalOperator === 'NONE' ||
                    filter.logicalOperator === null ||
                    filter.logicalOperator == undefined
                ) {
                    let value = filter.value;
                    if (filter.valueType === 'ATTRIBUTE') {
                        if (typeof filter.value === 'string') {
                            value = rowData[filter.value];
                        } else {
                            console.error(
                                'filtervalue needs to be string if you are comparing attributes'
                            );
                        }
                    }
                    let result = false;
                    if (filter.operator === 'IN') {
                        let values = filter.value as any;
                        if (!Array.isArray(filter.value)) {
                            if (typeof filter.value !== 'string') {
                                return false;
                            }
                            values = (filter.value as string).split('\n');
                        }

                        for (let y = 0; y < values.length; y++) {
                            const temp = objectFilter(rowData, {
                                value: values[y],
                                operator: 'EQUAL',
                                attribute: filter.attribute,
                                type: filter.attributeType
                            });
                            if (temp) {
                                result = true;
                            }
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
