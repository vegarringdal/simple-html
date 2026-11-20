import type { Formatter } from './formatter';

/**
 * Formatter for booleans, the default for `boolean` fields. The grid shows a boolean field as a
 * checkbox from the raw value, this formatter is for the places that show it as text: the filter
 * string, group headers, and a value pasted into the column.
 *
 * - `format` - `true` -> `'true'`, `false` -> `'false'`, `''` for null and undefined
 * - `parse` / `parseFilter` - `'true'` (any case, spaces around it ignored) is true, blank text,
 *   null and undefined are null, any other text is false. A boolean passes through
 *
 * @sample formatters
 * @example
 * ```ts
 * import { BooleanFormatter, Datasource } from '@simple-html/grid';
 *
 * BooleanFormatter.format(true); // 'true'
 * BooleanFormatter.parse('TRUE'); // true
 * BooleanFormatter.parse(''); // null
 *
 * // show yes/no in the filter string and group headers
 * const yesNo = { ...BooleanFormatter, format: (value: unknown) => (value === true ? 'yes' : value === false ? 'no' : '') };
 * const datasource = new Datasource({
 *     fields: { active: { type: 'boolean', formatter: yesNo } }
 * });
 * ```
 */
export const BooleanFormatter = {
    /** `'true'` / `'false'`, `''` for null and undefined */
    format(value: unknown): string {
        return value === null || value === undefined ? '' : String(value);
    },
    /** `'true'` (any case) is true, blank text is null, other text false */
    parse(text: unknown): boolean | null {
        if (typeof text === 'boolean') {
            return text;
        }
        const value = text === null || text === undefined ? '' : String(text).trim().toLowerCase();
        if (value === '') {
            return null;
        }
        return value === 'true';
    }
} satisfies Formatter;
