export interface NumberFormaterType {
    toNumber(value: any): number | null | undefined;
    fromNumber(value: any): string | null | undefined;
}

/**
 * numberformater, replaces dot with comma
 */
export class NumberFormaterComma {
    /**
     * Takes value and return string
     * @param value
     */
    static toNumber(value: any): number | null | undefined {
        let returnValue: any = value;

        if (returnValue === null || returnValue === 'undefined') {
            returnValue;
        }

        if (returnValue.includes(',') && !returnValue.includes('.')) {
            returnValue = returnValue.replace(',', '.');
        }

        if (isNaN(parseFloat(returnValue))) {
            return 0;
        }

        if (returnValue === '0') {
            return 0;
        }

        return parseFloat(returnValue);
    }

    /**
     *
     * @param value Takes string and returns date
     */
    static fromNumber(value: any): string | null | undefined {
        let returnValue = value;

        if (isNaN(parseFloat(returnValue))) {
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
}
