/**
 * Turns the values of a field into text and back. Every field has one: its own (`FieldConfig.formatter`),
 * or the datasource's default for the field's type (`DatasourceOptions.formatters`).
 *
 * - `format` is used for everything shown as text: the cells, the edit and filter inputs, the group
 *   headers, the footer's filter and `getFilterString()`. Booleans are the exception, the grid's
 *   checkbox shows the raw value. The header filter's value list (text fields only) shows the raw
 *   values, in upper case.
 * - `parse` turns what the user typed or pasted into the value stored in the row.
 * - `parseFilter` turns what the user typed into a filter input into the value filtered on. Left out,
 *   `parse` is used.
 *
 * The grid always calls `parse` and `parseFilter` with text. The built-in formatters are plain
 * objects, so a variant is a spread away: `{ ...NumberFormatterDot, format: (value) => ... }`.
 * Do not use `this` in a formatter's methods, the datasource may call them detached.
 *
 * @sample custom-formatter
 * @sample formatters
 * @example
 * ```ts
 * import { Datasource, type Formatter } from '@simple-html/grid';
 *
 * // money with two decimals and a space between the thousands: 12345.6 -> '12 345.60'
 * const money: Formatter = {
 *     format: (value) => (typeof value === 'number' ? value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''),
 *     parse: (text) => (text.trim() === '' ? null : Number(text.replaceAll(' ', ''))),
 *     placeholder: '0.00'
 * };
 *
 * const datasource = new Datasource({
 *     fields: {
 *         price: { type: 'number', formatter: money }
 *     }
 * });
 * ```
 */
export interface Formatter {
    /**
     * A value of the field as text. Give `''` for a blank value (null, undefined).
     * @param value the value in the row, can be anything the row holds
     */
    format(value: unknown): string;

    /**
     * Text the user typed or pasted into a cell, as the value to store in the row.
     * @param text what the user typed
     */
    parse(text: string): unknown;

    /**
     * Optional: text typed into a filter input, as the value to filter on. Left out, `parse` is used.
     * The built-in date formatters use it to make a filter boundary start at 00:00:00, where `parse`
     * keeps the current time of day.
     * @param text what the user typed
     */
    parseFilter?(text: string): unknown;

    /**
     * Optional: shown in an empty header filter input when the column has no `placeholderFilter`,
     * e.g. `'YYYY-MM-DD'`.
     */
    placeholder?: string;
}

/**
 * @internal
 * `parseFilter` if the formatter has one, else `parse`. Called on the formatter, so a formatter
 * that does use `this` still works.
 */
export function parseFilterText(formatter: Formatter, text: string): unknown {
    return formatter.parseFilter ? formatter.parseFilter(text) : formatter.parse(text);
}
