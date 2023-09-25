/**
 * default dateformater - DD.MM.YYYY
 */
export class DateFormaterDDMMYYYY {
    /**
     * Takes value and return string
     * @param value
     */
    static fromSource(value: Date | string | null | undefined): string {
        let returnValue: any = value;

        if (returnValue === null || returnValue === undefined || returnValue === '') {
            return (returnValue = '');
        }

        returnValue = new Date(returnValue).toDateString();

        // clear if not valid date
        if (returnValue === 'Invalid Date') {
            returnValue = '';
        }

        if (returnValue) {
            // get our formating

            const year = new Date(value).getFullYear();
            let month = (new Date(value).getMonth() + 1).toString();
            if (month.length === 1) {
                month = '0' + month;
            }
            let day = new Date(value).getDate().toString();
            if (day.length === 1) {
                day = '0' + day;
            }
            returnValue = `${day}.${month}.${year}`;
        }

        return returnValue;
    }

    /**
     *
     * @param value Takes string and returns date
     */
    static toSource(value: any): Date | null | undefined {
        let returnValue = value;

        if (returnValue === null || returnValue === undefined) {
            return returnValue;
        }

        if (returnValue < 1) {
            return null;
        }

        if (typeof returnValue !== 'string') {
            return null;
        }

        const x: any[] = returnValue.split('.');

        // 01.01.2019
        if (!x[1]) {
            // by default, use current month
            x[1] = new Date().getMonth() + 1;
        }
        if (!x[2]) {
            // by default, use current year
            x[2] = new Date().getFullYear();
        }

        returnValue = new Date(
            x[2],
            parseInt(x[1]) - 1,
            parseInt(x[0]),
            new Date().getHours(),
            new Date().getMinutes(),
            new Date().getSeconds(),
            new Date().getMilliseconds()
        );
        if (returnValue && typeof returnValue === 'object' && returnValue.toString() === 'Invalid Date') {
            returnValue = '';
        }

        return returnValue;
    }

    /**
     * will be used in filters, you might want other logic here
     * @param value
     * @returns
     */
    static toFilter(value: any): any {
        let returnValue = value;

        if (returnValue === null || returnValue === undefined) {
            return returnValue;
        }

        if (returnValue < 1) {
            return null;
        }

        if (typeof returnValue !== 'string') {
            return null;
        }

        const x: any[] = returnValue.split('.');

        // 01.01.2019
        if (!x[1]) {
            // by default, use current month
            x[1] = new Date().getMonth() + 1;
        }
        if (!x[2]) {
            // by default, use current year
            x[2] = new Date().getFullYear();
        }

        returnValue = new Date(x[2], parseInt(x[1]) - 1, parseInt(x[0]), 0, 0, 0, 0);
        if (returnValue && typeof returnValue === 'object' && returnValue.toString() === 'Invalid Date') {
            returnValue = '';
        }

        return returnValue;
    }

    static fromSourceDisplay(value: Date | string | null | undefined): string {
        return this.fromSource(value);
    }

    static fromSourceGrouping(value: Date | string | null | undefined): string {
        return this.fromSourceDisplay(value);
    }

    static placeholder() {
        return 'DD.MM.YYYY';
    }
}
