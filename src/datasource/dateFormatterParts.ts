/**
 * @internal
 * The code the four built-in date formatters share. They only differ in the order of the date
 * parts and in whether they show the time.
 *
 * - `'YMD'` - `2026-11-20`, a missing month or day is the current one
 * - `'DMY'` - `20.11.2026`, a missing month or year is the current one
 */
export type DateOrder = 'YMD' | 'DMY';

/**
 * two digits, `5` -> `'05'`
 */
function pad(value: number): string {
    return String(value).padStart(2, '0');
}

/**
 * @internal
 * A date as text: `2026-11-20` / `20.11.2026`, with `T13:45:12` after it when `withTime`.
 * '' for a blank (null, undefined, '') and for anything that is not a valid date.
 *
 * A string is read with `new Date(text)`: an iso date only string (`'2019-01-01'`) is UTC midnight
 * there, so west of UTC it shows as the day before. Known, not changed.
 */
export function formatDate(value: unknown, order: DateOrder, withTime: boolean): string {
    if (value === '' || !(value instanceof Date || typeof value === 'string' || typeof value === 'number')) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const text = order === 'YMD' ? `${year}-${month}-${day}` : `${day}.${month}.${year}`;

    if (!withTime) {
        return text;
    }
    return `${text}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * @internal
 * Typed text as a date.
 *
 * - null and undefined are returned as they are, text that is no date (`'abc'`) gives `''`
 * - a `Date` passes through. A date only filter boundary (`forFilter` without `withTime`) is moved
 *   to the start of its day
 * - other values that are not text, and text that reads as a number below 1 (`''`, `'0'`), give null
 * - a date part left out is the current month, and the current day (`'YMD'`) or year (`'DMY'`)
 * - the time: the parts the text has (`withTime` only), the rest - milliseconds included - is the
 *   current time of day, so a stored date keeps a time of day. For a filter (`forFilter`) the rest
 *   is 0, so a filter boundary is a whole second
 *
 * @param withTime the text can have a time after a `T`: `2026-11-20T13:45:12`
 * @param forFilter a filter boundary: missing time parts and the milliseconds are 0, not the current time
 */
export function parseDate(text: unknown, order: DateOrder, withTime: boolean, forFilter: boolean): Date | '' | null | undefined {
    if (text === null || text === undefined) {
        return text;
    }

    if (text instanceof Date) {
        if (forFilter && !withTime) {
            return new Date(text.getFullYear(), text.getMonth(), text.getDate());
        }
        return text;
    }

    // the same as the v5 `value < 1`, which compared text as a number: '' and '0' are no date
    if (typeof text !== 'string' || Number(text) < 1) {
        return null;
    }

    const now = new Date();
    const [datePart, timePart] = withTime ? text.split('T') : [text, undefined];

    const parts: (string | number)[] = datePart.split(order === 'YMD' ? '-' : '.');
    if (!parts[1]) {
        parts[1] = now.getMonth() + 1;
    }
    if (!parts[2]) {
        parts[2] = order === 'YMD' ? now.getDate() : now.getFullYear();
    }
    const [year, month, day] = order === 'YMD' ? parts : [parts[2], parts[1], parts[0]];

    const time = timePart?.split(':') ?? [];
    const clock = (index: number, current: number) => {
        if (time[index]) {
            return parseInt(time[index], 10);
        }
        return forFilter ? 0 : current;
    };

    const date = new Date(
        Number(year),
        parseInt(String(month), 10) - 1,
        parseInt(String(day), 10),
        clock(0, now.getHours()),
        clock(1, now.getMinutes()),
        clock(2, now.getSeconds()),
        forFilter ? 0 : now.getMilliseconds()
    );

    return Number.isNaN(date.getTime()) ? '' : date;
}
