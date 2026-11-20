import type { DataContainer } from './dataContainer';
import type { FieldConfig, FieldType } from './field';
import type { Formatter } from './formatter';
import type { SelectionMode } from './selectionMode';

/**
 * Options for `new Datasource(options)`. All of them are optional, `new Datasource()` works.
 *
 * - `key` - the field that identifies a row. Selection follows the key, so it survives replacing
 *   the data with fresh rows from the server.
 * - `fields` - the schema: the type, label and formatter of each field. A field that is not listed
 *   is `'text'`, labelled with its name. Sorting, grouping, filtering and the grid all read the
 *   type from here. See {@link FieldConfig} and {@link FieldType}.
 * - `formatters` - the default formatter per type, for the fields without a formatter of their own.
 *   The types left out keep the built-in default (see {@link FieldType}).
 * - `selectionMode` - `'multiple'` (default), `'single'` or `'none'`.
 * - `container` - share the data with another datasource: both show the same rows, each with its
 *   own filter, sort, grouping and selection. Give the key to the container
 *   (`new DataContainer('id')`); a `key` that is not the container's throws.
 *
 * @example
 * ```ts
 * import { DataContainer, Datasource, DateFormatterDDMMYYYY, NumberFormatterComma } from '@simple-html/grid';
 *
 * const datasource = new Datasource({
 *     key: 'id',
 *     fields: {
 *         id: 'number',
 *         name: { label: 'Name' },
 *         born: { type: 'date', label: 'Born' },
 *         salary: { type: 'number', formatter: NumberFormatterComma },
 *         active: 'boolean'
 *     },
 *     formatters: {
 *         date: DateFormatterDDMMYYYY // every date field without a formatter of its own
 *     },
 *     selectionMode: 'single'
 * });
 *
 * // a second datasource on the same rows
 * const container = new DataContainer('id');
 * const left = new Datasource({ container, fields: { born: 'date' } });
 * const right = new Datasource({ container, fields: { born: 'date' } });
 * ```
 */
export interface DatasourceOptions {
    /**
     * the field that identifies a row, e.g. `'id'`. Rows without it get a generated key.
     */
    key?: string;

    /**
     * the fields: `{ born: 'date', age: { type: 'number', label: 'Age' } }`
     */
    fields?: Record<string, FieldType | FieldConfig>;

    /**
     * the default formatter for each type, used by the fields that have no formatter of their own
     */
    formatters?: Partial<Record<FieldType, Formatter>>;

    /**
     * how rows can be selected, default `'multiple'`
     */
    selectionMode?: SelectionMode;

    /**
     * the data container to use, to share the rows with another datasource. Default a new one.
     */
    container?: DataContainer;
}
