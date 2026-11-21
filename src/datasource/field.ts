import type { Formatter } from './formatter';
import type { ValidationRule, ValidationRuleObject } from './validator';

/**
 * The type of a field. It decides how the datasource sorts, groups and filters the field, which
 * formatter it gets by default, and how the grid shows and edits it.
 *
 * | type | value | sorts / filters | default formatter |
 * | --- | --- | --- | --- |
 * | `'text'` | string | as text | `'text'`, {@link TextFormatter} |
 * | `'number'` | number | as numbers | `'numberDot'`, {@link NumberFormatterDot} |
 * | `'boolean'` | boolean | true / false | `'boolean'`, {@link BooleanFormatter} |
 * | `'date'` | `Date` | on the day, the time of day is ignored | `'dateYYYYMMDD'`, {@link DateFormatterYYYYMMDD} |
 * | `'datetime'` | `Date` | on the full timestamp | `'datetimeYYYYMMDD'`, {@link DateFormatterYYYYMMDDTHHMMSS} |
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
 * It is plain JSON: the formatter and the validators are named by their ids (see
 * {@link registerFormatter} and {@link registerValidator}), so the fields can be stored, e.g. in a
 * backend.
 *
 * @sample custom-formatter
 * @sample validation
 * @example
 * ```ts
 * import { Datasource } from '@simple-html/grid';
 *
 * const datasource = new Datasource({
 *     fields: {
 *         born: 'date',
 *         age: { type: 'number', label: 'Age (years)', validate: ['required', { id: 'min', value: 0 }] },
 *         price: { type: 'number', formatter: 'numberComma' }, // a built-in formatter, by its id
 *         company: { label: 'Company name', validate: ['required'] } // a text field with a label
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
     * the id of the field's formatter: a built-in one (`'numberComma'`, `'dateDDMMYYYY'` ...) or one
     * registered with {@link registerFormatter}. Default the datasource's formatter for the field's
     * type (see `DatasourceOptions.formatters`). An id that is not registered throws when the
     * datasource is made
     */
    formatter?: string;

    /**
     * the field's validation rules, checked when the field is edited and by `datasource.validate()`:
     * the id of a validator (`'required'`), or the id with options and a message
     * (`{ id: 'min', value: 0, message: 'at least {value}' }`), see {@link ValidationRule}. The
     * built-ins are `required`, `min`, `max`, `minLength`, `maxLength` and `pattern`, register your
     * own with {@link registerValidator}. An id that is not registered throws when the datasource is
     * made. A field with `'required'` gets the grid's required stripes while it is empty.
     *
     * @sample validation
     */
    validate?: ValidationRule[];
}

/**
 * A field as the datasource resolved it: every default filled in. Returned by `datasource.getField()`.
 *
 * @example
 * ```ts
 * const { type, label, formatter, validate } = datasource.getField('born');
 * formatter.format(new Date(2026, 10, 20)); // '2026-11-20' for a date field with the default formatter
 * const required = validate.some((rule) => rule.id === 'required');
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
    /**
     * the field's validation rules, each written out as an object: `'required'` is `{ id: 'required' }`.
     * `[]` when the field has none. The datasource's own list, do not change it
     */
    validate: readonly ValidationRuleObject[];
}
