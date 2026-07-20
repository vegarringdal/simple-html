import type { Datasource } from './dataSource';
import type { DataTypes } from './filterArgument';
import type { ValueFormater } from './valueFormater';
/**
 * default dateformater - YYYY-MM-DD
 */
export declare class DefaultValueFormater implements ValueFormater {
    datasource: Datasource;
    constructor(datasource: Datasource);
    /**
     * Takes value and return string
     * @param value
     */
    fromSource(value: any, type: DataTypes, _attribute: string): any;
    /**
     * will to use when setting to source
     * @param value Takes string and returns date
     */
    toSource(value: any, type: DataTypes, _attribute: string): any;
    /**
     * will be used in filters, you might want other logic here
     * @param value
     * @param type
     * @param attribute
     * @returns
     */
    toFilter(value: any, type: DataTypes, _attribute: string): any;
    fromSourceDisplay(value: any, type: DataTypes, attribute: string): any;
    fromSourceGrouping(value: any, type: DataTypes, attribute: string): any;
    placeholder(type: DataTypes, _attribute: string): string;
}
//# sourceMappingURL=defaultValueFormater.d.ts.map