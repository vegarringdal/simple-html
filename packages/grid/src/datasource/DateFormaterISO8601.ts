/**
 * default dateformater - YYYY-MM-DD
 */
export class DateFormaterISO8601 {
    /**
     * Takes value and return string
     * @param value
     */
    static fromSource(value: Date | string | null | undefined): string {
        let returnValue: any = value;

        if (returnValue === null || returnValue === undefined || returnValue === '') {
            return returnValue;
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
            returnValue = `${year}-${month}-${day}`;
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

        const x: any[] = returnValue.split('-');

        // 2019-01-01
        if (!x[1]) {
            // by default, use current month
            x[1] = new Date().getMonth() + 1;
        }
        if (!x[2]) {
            // by default, use current day
            x[2] = new Date().getDate();
        }

        returnValue = new Date(
            x[0],
            parseInt(x[1]) - 1,
            parseInt(x[2]),
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

    static fromSourceDisplay(value: Date | string | null | undefined): string {
        return this.fromSource(value);
    }

    static placeholder() {
        return 'YYYY-MM-DD';
    }
}
