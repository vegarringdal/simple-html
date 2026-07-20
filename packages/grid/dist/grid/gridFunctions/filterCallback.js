/**
 * filters columns
 * used by header filters
 */
export function filterCallback(ctx, value, col, filterArray, filterArrayAndValue, notinArray) {
    const valueConverter = ctx.gridInterface.getDatasource().getValueFormater();
    switch (col.type) {
        case 'date':
            col.currentFilterValue = ctx.gridInterface
                .getDatasource()
                .getValueFormater()
                .toFilter(value, col.type, col.attribute, true);
            break;
        case 'number':
            col.currentFilterValue = value === '' ? null : valueConverter.toFilter(value, col.type, col.attribute, true);
            break;
        case 'boolean':
            if (value === '') {
                col.currentFilterValue = null;
            }
            if (value === 'false') {
                col.currentFilterValue = valueConverter.toFilter(false, col.type, col.attribute, true);
            }
            if (value === 'true') {
                col.currentFilterValue = valueConverter.toFilter(true, col.type, col.attribute, true);
            }
            break;
        default:
            col.currentFilterValue = filterArrayAndValue ? filterArrayAndValue : value;
    }
    const oldFilter = ctx.gridInterface.getDatasource().getFilter();
    let filter = {
        type: 'GROUP',
        logicalOperator: 'AND',
        filterArguments: []
    };
    if (oldFilter?.logicalOperator === 'AND') {
        filter = oldFilter;
        filter.filterArguments = filter.filterArguments.filter((arg) => {
            if (arg.attribute === col.attribute) {
                return false;
            }
            else {
                return true;
            }
        });
    }
    const keys = Object.keys(ctx.gridInterface.__getGridConfig().__attributes);
    const columns = keys.map((e) => ctx.gridInterface.__getGridConfig().__attributes[e]);
    columns.forEach((col) => {
        if (col.currentFilterValue !== null && col.currentFilterValue !== undefined && col.currentFilterValue !== '') {
            filter.filterArguments.push({
                type: 'CONDITION',
                logicalOperator: 'NONE',
                valueType: 'VALUE',
                attribute: col.attribute,
                attributeType: col.type || 'text',
                operator: col.operator || ctx.gridInterface.getDatasource().getFilterFromType(col.type),
                value: col.currentFilterValue
            });
        }
    });
    if (filterArray) {
        filter.filterArguments.push({
            type: 'CONDITION',
            logicalOperator: 'NONE',
            valueType: 'VALUE',
            attribute: col.attribute,
            attributeType: col.type || 'text',
            operator: notinArray ? 'NOT_IN' : 'IN',
            value: filterArray
        });
    }
    // just add to beginning, duplicates get removed
    if (filterArrayAndValue) {
        filter.filterArguments.unshift({
            type: 'CONDITION',
            logicalOperator: 'NONE',
            valueType: 'VALUE',
            attribute: col.attribute,
            attributeType: col.type || 'text',
            operator: 'CONTAINS',
            value: filterArrayAndValue
        });
    }
    // remove duplicates
    const attributes = [];
    filter.filterArguments = filter.filterArguments.filter((arg) => {
        if (attributes.indexOf(arg.attribute) !== -1 && arg.operator !== 'IN' && arg.operator !== 'NOT_IN') {
            return false;
        }
        else {
            attributes.push(arg.attribute);
            return true;
        }
    });
    if (filterArray && !filterArrayAndValue) {
        // we need to clear the value so it does not show
        col.currentFilterValue = '';
    }
    ctx.gridInterface.getDatasource().filter(filter);
}
//# sourceMappingURL=filterCallback.js.map