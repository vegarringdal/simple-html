/**
 * numberformatter, replaces dot with comma
 */
export class NumberFormatterCustom {
    /**
     *
     * @param value Takes string and returns date
     */
    static fromSource(value: any): string | null | undefined {
        let returnValue = value;

        if (Number.isNaN(parseFloat(returnValue))) {
            returnValue = '';
        }

        if (returnValue === null || returnValue === undefined) {
            return returnValue;
        }

        if (returnValue.toString().includes('.')) {
            returnValue = returnValue.toString().replace('.', ',');
        }

        return returnValue.toString();
    }

    /**
     * Takes value and return string
     * @param value
     */
    static toSource(value: any): number | null | undefined {
        let returnValue: any = value;

        if (returnValue === null || returnValue === 'undefined') {
            returnValue;
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

    static toFilter(value: any): number | null | undefined {
        return NumberFormatterCustom.toSource(value);
    }

    static fromSourceDisplay(value: any): string | null | undefined {
        return parseInt(`${NumberFormatterCustom.fromSource(value)}`, 10).toFixed(2);
    }

    static fromSourceGrouping(value: any): string | null | undefined {
        return parseInt(`${NumberFormatterCustom.fromSource(value)}`, 10).toFixed(2);
    }

    static placeholder() {
        return '';
    }
}
