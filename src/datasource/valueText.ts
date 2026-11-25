/**
 * A value of a text field as text, the one way the text formatter, the text filter (objectFilter.ts),
 * the sort and the grouping read it: `''` for null and undefined, a date as the grid's default date
 * formats write it - `2026-11-25` at midnight, `2026-11-25T14:30:00` with a time of day (local) - and
 * anything else as `String()` does (`36`, `true`).
 *
 * A text field holds another type in a column with `dynamicCellTypeColumn` (another field of the row
 * names the type): its cells show the date as `2026-11-25`, and the filter finds it by that text - not
 * by JavaScript's `Thu May 17 1990 00:00:00 GMT+0200`. A database that keeps such a column as text holds
 * the same ISO text, so `toSqlWhere()` selects the same rows.
 *
 * No imports: the sql entry bundles objectFilter.ts and this file.
 */
export function valueText(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            return '';
        }
        const pad = (number: number, length = 2) => String(number).padStart(length, '0');
        const day = `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
        const midnight = value.getHours() === 0 && value.getMinutes() === 0 && value.getSeconds() === 0;
        return midnight ? day : `${day}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
    }
    return String(value);
}
