import type { Formatter } from './formatter';
import { formatNumber, parseNumber } from './numberFormatterDot';

/**
 * Formatter for numbers with a comma as the decimal separator: `12,5`.
 *
 * - `format` - a number as text with a comma, `12.5` -> `'12,5'`. Anything that does not read as a
 *   number (null, undefined, `'abc'`) gives `''`
 * - `parse` / `parseFilter` - `'12,5'` and `'12.5'` both give 12.5. A number passes through,
 *   null and undefined give null, text that is no number (`''` too) gives 0
 *
 * @example
 * ```ts
 * NumberFormatterComma.format(1234.5); // '1234,5'
 * NumberFormatterComma.parse('12,5'); // 12.5
 *
 * // one field
 * const datasource = new Datasource({
 *     fields: { price: { type: 'number', formatter: NumberFormatterComma } }
 * });
 *
 * // or every number field
 * const datasource2 = new Datasource({
 *     fields: { price: 'number', amount: 'number' },
 *     formatters: { number: NumberFormatterComma }
 * });
 * ```
 */
export const NumberFormatterComma = {
    format(value: unknown): string {
        return formatNumber(value, ',');
    },
    parse(text: unknown): number | null {
        return parseNumber(text);
    }
} satisfies Formatter;
