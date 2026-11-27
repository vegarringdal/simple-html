import type { Formatter } from './formatter';
import { formatNumber, parseNumber } from './numberFormatterDot';

/**
 * Formatter for numbers with a comma as the decimal separator: `12,5`. Registered as `'numberComma'`,
 * the options name it by that id (see {@link registerFormatter}).
 *
 * - `format` - a number as text with a comma, `12.5` -> `'12,5'`. Anything that does not read as a
 *   number (null, undefined, `'abc'`) gives `''`
 * - `parse` / `parseFilter` - `'12,5'` and `'12.5'` both give 12.5. A number passes through,
 *   null and undefined give null, text that is no number (`''` too) gives 0. So emptying a number
 *   cell in the grid stores 0; the row menu's Clear stores null. A formatter whose `parse` gives null
 *   for `''` stores null
 *
 * @sample formatters
 * @example
 * ```ts
 * import { Datasource, NumberFormatterComma } from '@simple-html/grid';
 *
 * NumberFormatterComma.format(1234.5); // '1234,5'
 * NumberFormatterComma.parse('12,5'); // 12.5
 *
 * // one field, by its id
 * const datasource = new Datasource({
 *     fields: { price: { type: 'number', formatter: 'numberComma' } }
 * });
 *
 * // or every number field
 * const datasource2 = new Datasource({
 *     fields: { price: 'number', amount: 'number' },
 *     formatters: { number: 'numberComma' }
 * });
 * ```
 */
export const NumberFormatterComma = {
    /** a number as text with a comma, `''` for anything that is no number */
    format(value: unknown): string {
        return formatNumber(value, ',');
    },
    /** typed text as a number: `'12,5'` and `'12.5'` are 12.5 */
    parse(text: unknown): number | null {
        return parseNumber(text);
    }
} satisfies Formatter;
