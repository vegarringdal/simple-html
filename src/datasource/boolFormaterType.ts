export interface BoolFormaterType {
    /**
     * used by grid to insert in edit cells/filter
     * @param value
     */
    fromSource(value: any): any;
    /**
     * value user inputs gets converted to date
     * @param value
     */
    toSource(value: any): any;
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
}
