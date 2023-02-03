/**
 * default dateformater - YYYY-MM-DD
 */
export class DateFormaterYYYYMMDDTHHMMSS {
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

            let hours = new Date(value).getHours().toString();
            if (hours.length === 1) {
                hours = '0' + hours;
            }

            let minutes = new Date(value).getMinutes().toString();
            if (minutes.length === 1) {
                minutes = '0' + minutes;
            }

            let seconds = new Date(value).getSeconds().toString();
            if (seconds.length === 1) {
                seconds = '0' + seconds;
            }
            returnValue = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
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

        const dateTime = returnValue.split('T');
        const YYYYMMDD: any[] = dateTime[0].split('-');
        const HHMMSS: any[] = dateTime[1]?.split(':') || [];

        // 01.01.2019
        if (!YYYYMMDD[1]) {
            // by default, use current month
            YYYYMMDD[1] = new Date().getMonth() + 1;
        }
        if (!YYYYMMDD[2]) {
            // by default, use current day
            YYYYMMDD[2] = new Date().getDate();
        }

        if (!HHMMSS[0]) {
            // by default, use hours
            HHMMSS[0] = new Date().getHours();
        }
        if (!HHMMSS[1]) {
            // by default, use minutes
            HHMMSS[1] = new Date().getMinutes();
        }
        if (!HHMMSS[2]) {
            // by default, use seconds
            HHMMSS[2] = new Date().getSeconds();
        }

        returnValue = new Date(
            YYYYMMDD[0],
            parseInt(YYYYMMDD[1]) - 1,
            parseInt(YYYYMMDD[2]),
            parseInt(HHMMSS[0]),
            parseInt(HHMMSS[1]),
            parseInt(HHMMSS[2]),
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

        const dateTime = returnValue.split('T');
        const YYYYMMDD: any[] = dateTime[0].split('-');
        const HHMMSS: any[] = dateTime[1]?.split(':') || [];

        // 01.01.2019
        if (!YYYYMMDD[1]) {
            // by default, use current month
            YYYYMMDD[1] = new Date().getMonth() + 1;
        }
        if (!YYYYMMDD[2]) {
            // by default, use current day
            YYYYMMDD[2] = new Date().getDate();
        }

        if (!HHMMSS[0]) {
            // by default, use hours
            HHMMSS[0] = 0;
        }
        if (!HHMMSS[1]) {
            // by default, use minutes
            HHMMSS[1] = 0;
        }
        if (!HHMMSS[2]) {
            // by default, use seconds
            HHMMSS[2] = 0;
        }

        returnValue = new Date(
            YYYYMMDD[0],
            parseInt(YYYYMMDD[1]) - 1,
            parseInt(YYYYMMDD[2]),
            parseInt(HHMMSS[0]),
            parseInt(HHMMSS[1]),
            parseInt(HHMMSS[2]),
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

    static fromSourceGrouping(value: Date | string | null | undefined): string {
        return this.fromSourceDisplay(value);
    }

    static placeholder() {
        return 'YYYY-MM-DDTHH:MM:SS';
    }
}
