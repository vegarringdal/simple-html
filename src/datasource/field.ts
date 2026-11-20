import type { Formatter } from './formatter';

/**
 * The type of a field. It decides how the datasource sorts, groups and filters the field, which
 * formatter it gets by default, and how the grid shows and edits it.
 *
 * | type | value | sorts / filters | default formatter |
 * | --- | --- | --- | --- |
 * | `'text'` | string | as text | {@link TextFormatter} |
 * | `'number'` | number | as numbers | {@link NumberFormatterDot} |
 * | `'boolean'` | boolean | true / false | {@link BooleanFormatter} |
 * | `'date'` | `Date` | on the day, the time of day is ignored | {@link DateFormatterYYYYMMDD} |
 * | `'datetime'` | `Date` | on the full timestamp | {@link DateFormatterYYYYMMDDTHHMMSS} |
 *
 * A field that is not listed in `fields` is `'text'`.
 *
 * @sample formatters
 * @example
 * ```ts
 * import { Datasource } from '@simple-html/grid';
 *
 * const datasource = new Datasource({
 *     fields: {
 *         age: 'number',
 *         born: 'date', // 1990-05-17, filters match the whole day
 *         lastLogin: 'datetime', // 2026-11-20T08:15:00
 *         active: 'boolean'
 *     }
 * });
 * ```
 */
export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'datetime';

/**
 * @internal
 * every field type, for checking a type that comes from data (the grid's `dynamicCellTypeColumn`)
 */
export const FIELD_TYPES: readonly FieldType[] = ['text', 'number', 'boolean', 'date', 'datetime'];

/**
 * @internal
 * true if the value is one of the field types
 */
export function isFieldType(value: unknown): value is FieldType {
    return FIELD_TYPES.some((type) => type === value);
}

/**
 * How one field of the datasource is described in `DatasourceOptions.fields`. All of it is
 * optional, and writing just the type (`born: 'date'`) is the same as `born: { type: 'date' }`.
 *
 * @sample custom-formatter
 * @example
 * ```ts
 * import { Datasource, NumberFormatterComma } from '@simple-html/grid';
 *
 * const datasource = new Datasource({
 *     fields: {
 *         born: 'date',
 *         age: { type: 'number', label: 'Age (years)' },
 *         price: { type: 'number', formatter: NumberFormatterComma },
 *         company: { label: 'Company name' } // a text field with a label
 *     }
 * });
 * ```
 */
export interface FieldConfig {
    /**
     * the field's type, default `'text'`
     */
    type?: FieldType;

    /**
     * the field's name for people, default the field name. The grid's column label falls back to it
     * when the column has no `label` of its own, and `getFilterString()` / `getFilterTree()` use it.
     */
    label?: string;

    /**
     * the formatter for this field, default the datasource's formatter for the field's type
     * (see `DatasourceOptions.formatters`)
     */
    formatter?: Formatter;
}

/**
 * A field as the datasource resolved it: every default filled in. Returned by `datasource.getField()`.
 *
 * @example
 * ```ts
 * const { type, label, formatter } = datasource.getField('born');
 * formatter.format(new Date(2026, 10, 20)); // '2026-11-20' for a date field with the default formatter
 * ```
 */
export interface Field {
    /** the field name, the property on the row */
    name: string;
    /** the type from `fields`, `'text'` when the field is not listed */
    type: FieldType;
    /** the label from `fields`, else the field name */
    label: string;
    /** the field's own formatter, else the datasource's default for its type */
    formatter: Formatter;
}
