/**
 * default dateformater - YYYY-MM-DD
 */
export declare class DateFormaterYYYYMMDD {
    /**
     * Takes value and return string
     * @param value
     */
    static fromSource(value: Date | string | null | undefined): string;
    /**
     *
     * @param value Takes string and returns date
     */
    static toSource(value: any): Date | null | undefined;
    /**
     * will be used in filters, you might want other logic here
     * @param value
     * @returns
     */
    static toFilter(value: any): any;
    static fromSourceDisplay(value: Date | string | null | undefined): string;
    static fromSourceGrouping(value: Date | string | null | undefined): string;
    static placeholder(): string;
}
//# sourceMappingURL=DateFormaterYYYYMMDD.d.ts.map