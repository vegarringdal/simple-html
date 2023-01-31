import { FilterArgument } from '../../datasource/filterArgument';
import { Grid } from '../grid';
import { Attribute } from '../gridConfig';

/**
 * filters columns
 * used by header filters
 */
export function filterCallback(
    ctx: Grid,
    value: string | number | null | undefined,
    col: Attribute,
    filterArray?: any[],
    filterArrayAndValue?: string,
    notinArray?: boolean
) {

    const valueConverter = ctx.gridInterface.getDatasource().getValueFormater();

    switch (col.type) {
        case 'date':
            col.currentFilterValue = ctx.gridInterface
                .getDatasource()
                .getValueFormater()
                .toSource(value, col.type, col.attribute);

            break;
        case 'number':
            col.currentFilterValue =
                value === ''
                    ? null
                    : valueConverter.toSource(value, col.type, col.attribute);

            break;
        case 'boolean':
            if (value === '') {
                col.currentFilterValue = null;
            }
            if (value === 'false') {
                col.currentFilterValue = valueConverter.toSource(false, col.type, col.attribute);
            }
            if (value === 'true') {
                col.currentFilterValue = valueConverter.toSource(true, col.type, col.attribute);
            }

            break;
        default:
            col.currentFilterValue = filterArrayAndValue ? filterArrayAndValue : value;
    }

    const oldFilter = ctx.gridInterface.getDatasource().getFilter();
    let filter: FilterArgument = {
        type: 'GROUP',
        logicalOperator: 'AND',
        filterArguments: []
    };

    if (oldFilter?.logicalOperator === 'AND') {
        filter = oldFilter;
        filter.filterArguments = filter.filterArguments.filter((arg: FilterArgument) => {
            if (arg.attribute === col.attribute) {
                return false;
            } else {
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
                attributeType: (col.type as any) || 'text',
                operator: col.operator || ctx.gridInterface.getDatasource().getFilterFromType(col.type),
                value: col.currentFilterValue as any
            });
        }
    });

    if (filterArray) {
        filter.filterArguments.push({
            type: 'CONDITION',
            logicalOperator: 'NONE',
            valueType: 'VALUE',
            attribute: col.attribute,
            attributeType: (col.type as any) || 'text',
            operator: notinArray ? 'NOT_IN' : 'IN',
            value: filterArray as any
        });
    }

    // just add to beginning, duplicates get removed
    if (filterArrayAndValue) {
        filter.filterArguments.unshift({
            type: 'CONDITION',
            logicalOperator: 'NONE',
            valueType: 'VALUE',
            attribute: col.attribute,
            attributeType: (col.type as any) || 'text',
            operator: 'CONTAINS',
            value: filterArrayAndValue
        });
    }

    // remove duplicates
    const attributes: string[] = [];
    filter.filterArguments = filter.filterArguments.filter((arg: FilterArgument) => {
        if (attributes.indexOf(arg.attribute) !== -1 && arg.operator !== 'IN' && arg.operator !== 'NOT_IN') {
            return false;
        } else {
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
