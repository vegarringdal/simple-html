import type { DataContainer } from './dataContainer';
import type { FieldConfig, FieldType } from './field';
import type { SelectionMode } from './selectionMode';

/**
 * Options for `new Datasource(options)`. All of them are optional, `new Datasource()` works.
 *
 * - `key` - the field that identifies a row. Selection follows the key, so it survives replacing
 *   the data with fresh rows from the server, and `upsert()` merges rows from a server by it.
 * - `fields` - the schema: the type, label and formatter of each field. A field that is not listed
 *   is `'text'`, labelled with its name. Sorting, grouping, filtering and the grid all read the
 *   type from here. See {@link FieldConfig} and {@link FieldType}.
 * - `formatters` - the default formatter per type, for the fields without a formatter of their own.
 *   The types left out keep the built-in default (see {@link FieldType}).
 *
 * A formatter is named by its id, a built-in one or one registered with {@link registerFormatter}:
 * `fields` and `formatters` are plain JSON, they can be stored (in a backend, say) and given back
 * as they are. An id that is not registered throws when the datasource is made.
 * - `selectionMode` - `'multiple'` (default), `'single'` or `'none'`. A grid showing the datasource
 *   uses it, change it later with `setSelectionMode()`.
 * - `container` - share the data with another datasource, each with its own filter, sort, grouping
 *   and selection. Rows added or removed through one show in the other after its
 *   `reloadDatasource()` (or a `filter()`) - they are not kept in sync on their own. Give the key to the container
 *   (`new DataContainer('id')`); a `key` that is not the container's throws. The edits are tracked
 *   by the container, with the field types of every datasource on it (a `date` field compares on
 *   the day): a field listed by two of them must have the same type in both, the second datasource
 *   throws if not. A field listed by one only has that one's type.
 *
 * @sample formatters
 * @example
 * ```ts
 * import { DataContainer, Datasource } from '@simple-html/grid';
 *
 * const datasource = new Datasource({
 *     key: 'id',
 *     fields: {
 *         id: 'number',
 *         name: { label: 'Name' },
 *         born: { type: 'date', label: 'Born' },
 *         salary: { type: 'number', formatter: 'numberComma' },
 *         active: 'boolean'
 *     },
 *     formatters: {
 *         date: 'dateDDMMYYYY' // every date field without a formatter of its own
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
     * the field that identifies a row, e.g. `'id'`. Rows without it get a generated key. `upsert()`
     * needs it
     */
    key?: string;

    /**
     * the fields: `{ born: 'date', age: { type: 'number', label: 'Age' } }`
     */
    fields?: Record<string, FieldType | FieldConfig>;

    /**
     * the id of the default formatter for each type, used by the fields that have no formatter of
     * their own: `{ number: 'numberComma', date: 'dateDDMMYYYY' }`. See {@link registerFormatter} for
     * the ids
     *
     * @sample formatters
     */
    formatters?: Partial<Record<FieldType, string>>;

    /**
     * how rows can be selected, default `'multiple'`. A grid showing the datasource uses it
     */
    selectionMode?: SelectionMode;

    /**
     * the data container to use, to share the rows with another datasource. Default a new one.
     * A field in `fields` must have the same type as in the other datasources on the container.
     */
    container?: DataContainer;
}
