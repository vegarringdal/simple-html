import type { Datasource } from './dataSource';
import type { DataTypes } from './filterArgument';

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

    /**
     * optional: does the date format of this attribute include time?
     * Return false and date filters on the attribute match on the calendar day only, time ignored
     * on both the row value and the filter value. Return true, or leave the method out, and
     * date filters compare with time.
     * The default value formater answers from its date formater's `includesTime`.
     * @param attribute
     */
    dateIncludesTime?(attribute: string): boolean;
}

export interface DateAndNumberFormater {
    /**
     * optional, date formaters only: true if the format includes time.
     * false makes date filters match on the calendar day only. Left out, filters compare with time.
     * See `ValueFormater.dateIncludesTime`
     */
    includesTime?: boolean;
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
