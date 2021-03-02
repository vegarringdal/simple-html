export interface NumberFormaterType {
    fromString(value: string): number;
    fromNumber(value: number): string;
}

export class NumberFormater {
    /**
     * Takes value and return string
     * @param value
     */
    static fromString(value: string | '' | null | undefined | 'null'): number | 'null' {
        let returnValue: any = value;

        if (returnValue === 'null') {
            return returnValue;
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
    static fromNumber(value: any): String | null | undefined | 'null' {
        let returnValue = value;

        if (returnValue === 'null') {
            return returnValue;
        }

        if (isNaN(parseFloat(returnValue))) {
            returnValue = '';
        }

        if (returnValue === null || returnValue === undefined) {
            return returnValue;
        }

        if (returnValue.toString().includes('.')) {
            returnValue = returnValue.toString().replace('.', ',');
        }

        return returnValue;
    }
}
