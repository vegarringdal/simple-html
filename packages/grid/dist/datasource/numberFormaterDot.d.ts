/**
 * default number format, uses dot
 * this will convert comma to dot
 */
export declare class NumberFormaterDot {
    /**
     *
     * @param value Takes string and returns date
     */
    static fromSource(value: any): string | null | undefined;
    /**
     * Takes value and return string
     * @param value
     */
    static toSource(value: any): number | null | undefined;
    static toFilter(value: any): number | null | undefined;
    static fromSourceDisplay(value: any): string | null | undefined;
    static fromSourceGrouping(value: any): string | null | undefined;
    static placeholder(): string;
}
//# sourceMappingURL=numberFormaterDot.d.ts.map