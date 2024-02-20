import { DataTypes } from './filterArgument';
import { Datasource } from './dataSource';

export interface ValueFormater {
    datasource: Datasource;
    /**
     * used by grid to insert in edit cells/filter
     * @param value
     */
    fromSource(value: any, type: DataTypes, attribute: string, isFilter: boolean): any;
    /**
     * value user inputs gets converted to value
     * @param value
     */
    toSource(value: any, type: DataTypes, attribute: string, isFilter: boolean): any;
    /**
     * value user inputs gets converted to value
     * @param value
     */
    toFilter(value: any, type: DataTypes, attribute: string, isFilter: boolean): any;
    /**
     * placeholder you want to be displayed
     */
    placeholder(type: DataTypes, _attribute: string, isFilter: boolean): string;
    /**
     * displayed value when cell is readonly
     * if you dont really need it, then just return the value of this.fromDate(value)
     * @param value
     */
    fromSourceDisplay(value: any, type: DataTypes, attribute: string, isFilter: boolean): any;

    /**
     * how you want values grouped
     * @param value
     * @param type
     * @param attribute
     */
    fromSourceGrouping(value: any, type: DataTypes, attribute: string, isFilter: boolean): any;
}

export interface DateAndNumberFormater {
    /**
     * used by grid to insert in edit cells/filter
     * @param value
     */
    fromSource(value: any): any;
    /**
     * value user inputs gets converted
     * @param value
     */
    toSource(value: any): any;
    /**
     * value user inputs gets converted
     * @param value
     */
    toFilter(value: any): any;
    /**
     * placeholder you want to be displayed
     */
    placeholder(): string;
    /**
     * displayed value when cell is readonly
     * if you dont really need it, then just return the value of this.fromDate(value)
     * @param value
     */
    fromSourceDisplay(value: any): any;
    /**
     * how you want values grouped
     * @param value
     */
    fromSourceGrouping(value: any): any;
}
