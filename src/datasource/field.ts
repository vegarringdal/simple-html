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
 *         company: { label: 'Company name', validate: ['required'] }, // a text field with a label
 *         notes: { label: 'Notes', multiline: true } // a text of several lines
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

    /**
     * a text of several lines: notes, an address. The grid shows the first line of the cell, with a
     * marker when there is more, and the whole text in its tooltip. Enter, F2, a double click or
     * typing opens an editor over the cell, a bigger textarea: Ctrl+Enter saves, Esc cancels. See the
     * editing guide.
     *
     * A text cell whose value has a line break is shown and edited like this without the option too:
     * the input of a cell can not hold a line break (the browser strips them). The option is for a
     * field of several lines whose values have none yet. Text fields only: `true` on another type
     * throws when the datasource is made. Default `false`. A grid's column can turn it on or off for its
     * cells (`ColumnFormat.multiline`, Multiline in the grid config dialog)
     *
     * @sample multiline
     */
    multiline?: boolean;

    /**
     * `true`: every filter on the field matches case - `ABC-1` does not find `abc-1`. For a column the
     * database has an index on (a project code): `"PROJECT_CODE" = :1` uses it, `LOWER("PROJECT_CODE")`
     * would not. Set in the fields only, by code - not in the grid's config, and the user can not turn it
     * off: "Match case" is on and greyed out in the header filter's menu, the filter editor and the grid
     * config dialog. A condition on the field set without `caseSensitive` (`datasource.filter()`, a saved
     * state) is kept with `caseSensitive: true`, and `toSqlWhere()` compares the column with its case
     * (`SqlColumn.caseSensitive`, which `sqlColumnsFromFields()` copies). Text fields only: `true` on another
     * type throws when the datasource is made. Default `false`
     *
     * @example
     * ```ts
     * import { Datasource } from '@simple-html/grid';
     *
     * const datasource = new Datasource({ fields: { projectCode: { caseSensitive: true } } });
     * ```
     */
    caseSensitive?: boolean;

    /**
     * `true`: the field is a long text the database holds as a LOB - an Oracle `CLOB` or `NCLOB` - that SQL
     * compares with `LIKE` only. LOB columns are not supported as such; this lets a grid filter one as plain
     * text: its filters offer Equal, Not equal, Contains, Does not contain, Begins with, Ends with and Blank
     * - no value list (`IN`), no "compare with another field" - and a formula (a calculated column, a colour
     * rule's) can not read it: `{notes}` is a problem of the formula. A template that reads it is filtered on
     * the value, not on the text it shows. `toSqlWhere()` writes each condition with `LIKE`
     * (`SqlColumn.clobType`, which `sqlColumnsFromFields()` copies). Set in the fields only, by code. Text
     * fields only: `true` on another type throws when the datasource is made. Default `false`
     *
     * @example
     * ```ts
     * import { Datasource } from '@simple-html/grid';
     *
     * const datasource = new Datasource({ fields: { notes: { clobType: true, multiline: true } } });
     * ```
     */
    clobType?: boolean;

    /**
     * `true`: no grid on the datasource lets the user edit the field - its cells, paste, fill down, the
     * detail form and the import leave it as it is, also in an editable grid. Set in the fields only, by
     * code - not in the grid's config, and the user can not turn it off: "Read only" is on and greyed out
     * in the grid config dialog. The column's own `readonly` (`ColumnConfig.readonly`) is a default the
     * user can change, this is not; the `isReadonly` hook is not asked for the field either. Code still
     * sets its values (`row.status = 'Closed'`, `setData()`, `upsert()`). Any type. Default `false`
     *
     * @example
     * ```ts
     * import { Datasource } from '@simple-html/grid';
     *
     * // the id from the database: shown, never edited
     * const datasource = new Datasource({ key: 'id', fields: { id: { type: 'number', readonly: true } } });
     * ```
     */
    readonly?: boolean;
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
    /**
     * `true` when `fields` gave the field `multiline: true`. The grid also shows a value with a line
     * break as multiline text, in any text field
     */
    multiline: boolean;
    /** `true` when `fields` gave the field `caseSensitive: true`: every filter on it matches case */
    caseSensitive: boolean;
    /** `true` when `fields` gave the field `clobType: true`: a long text filtered with `LIKE` only */
    clobType: boolean;
    /**
     * `true` when `fields` gave the field `readonly: true`: no grid lets the user edit it. A calculated
     * column of a grid is `true` too, it is computed
     */
    readonly: boolean;
}

/**
 * The operators of a field with `clobType` (FieldConfig.clobType): a text's that SQL writes with `LIKE` -
 * not `IN` / `NOT_IN`
 */
export const CLOB_OPERATORS = [
    'EQUAL',
    'NOT_EQUAL_TO',
    'CONTAINS',
    'DOES_NOT_CONTAIN',
    'BEGIN_WITH',
    'END_WITH',
    'IS_BLANK',
    'IS_NOT_BLANK'
] as const;
