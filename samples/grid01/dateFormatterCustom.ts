import { DateFormatterDDMMYYYY, type Formatter } from '@simple-html/grid';

/**
 * the weekday in front of the date, the user can type it or leave it out
 */
const withoutWeekday = (text: string) => text.replace(/^[A-Za-z]+ /, '');

/**
 * custom date formatter sample: DD.MM.YYYY with the day of the week in front, `Fri 05.01.2024`.
 * Built from DateFormatterDDMMYYYY: format adds the weekday, parse takes it off again.
 */
export const DateFormatterCustom: Formatter = {
    ...DateFormatterDDMMYYYY,
    format(value: unknown): string {
        const text = DateFormatterDDMMYYYY.format(value);
        if (text === '' || !(value instanceof Date)) {
            return text;
        }
        return `${value.toDateString().slice(0, 3)} ${text}`;
    },
    parse(text: string): unknown {
        return DateFormatterDDMMYYYY.parse(withoutWeekday(text));
    },
    parseFilter(text: string): unknown {
        return DateFormatterDDMMYYYY.parseFilter(withoutWeekday(text));
    },
    placeholder: 'Day DD.MM.YYYY'
};
