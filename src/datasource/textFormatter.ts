import type { Formatter } from './formatter';

/**
 * Formatter for text, the default for `text` fields (and so for every field not listed in `fields`).
 *
 * - `format` - the value as text, `''` for null and undefined. Anything else goes through
 *   `String()`: 0 is `'0'`, false is `'false'`
 * - `parse` / `parseFilter` - the text as it is
 *
 * @sample custom-formatter
 * @example
 * ```ts
 * import { Datasource, TextFormatter } from '@simple-html/grid';
 *
 * TextFormatter.format(null); // ''
 * TextFormatter.format(42); // '42'
 *
 * // a variant: show the text in upper case, edit and filter it as it is
 * const upperCase = { ...TextFormatter, format: (value: unknown) => TextFormatter.format(value).toUpperCase() };
 * const datasource = new Datasource({
 *     fields: { country: { formatter: upperCase } }
 * });
 * ```
 */
export const TextFormatter = {
    /** the value as text, `''` for null and undefined */
    format(value: unknown): string {
        return value === null || value === undefined ? '' : String(value);
    },
    /** the text as it is */
    parse(text: string): string {
        return text;
    }
} satisfies Formatter;
