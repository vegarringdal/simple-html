import type { Formatter } from './formatter';
import { valueText } from './valueText';

/**
 * Formatter for text, the default for `text` fields (and so for every field not listed in `fields`).
 * Registered as `'text'`, the options name it by that id (see {@link registerFormatter}).
 *
 * - `format` - the value as text, `''` for null and undefined, a date `2026-11-25` (with a time of day
 *   `2026-11-25T14:30:00`). Anything else goes through `String()`: 0 is `'0'`, false is `'false'`
 * - `parse` / `parseFilter` - the text as it is
 *
 * @sample custom-formatter
 * @example
 * ```ts
 * import { Datasource, registerFormatter, TextFormatter } from '@simple-html/grid';
 *
 * TextFormatter.format(null); // ''
 * TextFormatter.format(42); // '42'
 *
 * // a variant: show the text in upper case, edit and filter it as it is
 * const upperCase = { ...TextFormatter, format: (value: unknown) => TextFormatter.format(value).toUpperCase() };
 * registerFormatter('upperCase', upperCase);
 * const datasource = new Datasource({
 *     fields: { country: { formatter: 'upperCase' } }
 * });
 * ```
 */
export const TextFormatter = {
    /** the value as text, `''` for null and undefined */
    format(value: unknown): string {
        return valueText(value);
    },
    /** the text as it is */
    parse(text: string): string {
        return text;
    }
} satisfies Formatter;
