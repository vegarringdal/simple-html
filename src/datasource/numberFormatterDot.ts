import type { Formatter } from './formatter';

/**
 * @internal
 * Typed text as a number, shared by the built-in number formatters: a comma is the decimal
 * separator when there is no dot (`'12,5'` is 12.5). parseFloat reads up to the first character
 * it can not use, so `'1.234,5'` is 1.234.
 *
 * - null, undefined and the text `'undefined'` give null
 * - a number passes through
 * - text that is no number, `''` included, gives 0
 */
export function parseNumber(text: unknown): number | null {
    if (text === null || text === undefined || text === 'undefined') {
        return null;
    }
    if (typeof text === 'number') {
        return text;
    }

    let value = String(text);
    if (value.includes(',') && !value.includes('.')) {
        value = value.replace(',', '.');
    }

    const result = parseFloat(value);
    return Number.isNaN(result) ? 0 : result;
}

/**
 * @internal
 * A number as text with the given decimal separator, '' for anything that does not read as a
 * number. Text that does is kept as it is, apart from the first `.` or `,` becoming `separator`.
 */
export function formatNumber(value: unknown, separator: '.' | ','): string {
    // parseFloat turns the value into text first, so a number and its text give the same answer
    if (Number.isNaN(parseFloat(String(value)))) {
        return '';
    }
    return String(value).replace(separator === '.' ? ',' : '.', separator);
}

/**
 * Formatter for numbers with a dot as the decimal separator: `12.5`. The default for `number` fields.
 * Registered as `'numberDot'`, the options name it by that id (see {@link registerFormatter}).
 *
 * - `format` - a number as text, `12.5` -> `'12.5'`. Anything that does not read as a number
 *   (null, undefined, `'abc'`) gives `''`
 * - `parse` / `parseFilter` - `'12.5'` and `'12,5'` both give 12.5. A number passes through,
 *   null and undefined give null, text that is no number (`''` too) gives 0. So emptying a number
 *   cell in the grid stores 0; the row menu's Clear stores null. A formatter whose `parse` gives null
 *   for `''` stores null
 *
 * @sample formatters
 * @example
 * ```ts
 * import { Datasource, NumberFormatterDot, registerFormatter } from '@simple-html/grid';
 *
 * NumberFormatterDot.format(1234.5); // '1234.5'
 * NumberFormatterDot.parse('12,5'); // 12.5
 *
 * // the default, set it by its id to be explicit
 * const datasource = new Datasource({
 *     fields: { price: { type: 'number', formatter: 'numberDot' } }
 * });
 *
 * // a variant: spread it, replace what you need and register it under an id of your own
 * const twoDecimals = { ...NumberFormatterDot, format: (value: unknown) => (typeof value === 'number' ? value.toFixed(2) : '') };
 * registerFormatter('twoDecimals', twoDecimals);
 * ```
 */
export const NumberFormatterDot = {
    /** a number as text with a dot, `''` for anything that is no number */
    format(value: unknown): string {
        return formatNumber(value, '.');
    },
    /** typed text as a number: `'12.5'` and `'12,5'` are 12.5 */
    parse(text: unknown): number | null {
        return parseNumber(text);
    }
} satisfies Formatter;
