/**
 * default number format, uses dot
 * this will convert comma to dot
 */
export class NumberFormaterDot {
    /**
     *
     * @param value Takes string and returns date
     */
    static fromSource(value) {
        let returnValue = value;
        if (Number.isNaN(parseFloat(returnValue))) {
            returnValue = '';
        }
        if (returnValue === null || returnValue === undefined) {
            return returnValue;
        }
        if (returnValue.toString().includes(',')) {
            returnValue = returnValue.toString().replace(',', '.');
        }
        return returnValue.toString();
    }
    /**
     * Takes value and return string
     * @param value
     */
    static toSource(value) {
        let returnValue = value;
        if (returnValue === null || returnValue === 'undefined' || returnValue === undefined) {
            return null;
        }
        if (typeof returnValue === 'number') {
            return returnValue;
        }
        if (returnValue.includes(',') && !returnValue.includes('.')) {
            returnValue = returnValue.replace(',', '.');
        }
        if (Number.isNaN(parseFloat(returnValue))) {
            return 0;
        }
        if (returnValue === '0') {
            return 0;
        }
        return parseFloat(returnValue);
    }
    static toFilter(value) {
        return NumberFormaterDot.toSource(value);
    }
    static fromSourceDisplay(value) {
        return NumberFormaterDot.fromSource(value);
    }
    static fromSourceGrouping(value) {
        return NumberFormaterDot.fromSourceDisplay(value);
    }
    static placeholder() {
        return '';
    }
}
//# sourceMappingURL=numberFormaterDot.js.map