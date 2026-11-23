import type { Entity } from './entity';
import type { FieldType } from './field';

/**
 * @internal
 * A calculated field: a field of every row whose value is computed from the row each time it is read -
 * the grid's calculated columns (`GridState.calculatedColumns`, calculatedColumns.ts) give the
 * datasource one each (`datasource.__setCalculatedField()`).
 *
 * **How the value is provided**: the rows are proxies (EntityHandler), and the proxy answers a read of a
 * calculated field with `value(row)` - nothing is stored on the row. So:
 * - **it is never an edit**: the row is not edited or dirty by it, `getChanges()`, `JSON.stringify(row)`
 *   and `Object.keys(row)` do not have it - it is not sent to a server. Setting it does nothing
 * - **it is always the value of the row as it is now**: after an edit, undo / redo, `upsert()`, live
 *   data, `resetData()` - there is nothing to compute again or to forget
 * - **everything that reads a field reads it**: the filter, the sort, the grouping, the aggregates, and
 *   in the grid the cells, copy, the exports, Find, the detail form
 *
 * A field of the rows of the same name is hidden by it: the grid refuses such a name.
 */
export interface CalculatedField {
    /** the type of its values: how the datasource sorts, filters and groups it, its default formatter */
    type: FieldType;
    /** its label, as `FieldConfig.label` */
    label: string;
    /**
     * its value in a row. Never throws: a row where it can not be computed gives null. Reads the row
     * through the proxy, so it can read other calculated fields
     * @param row the row, the proxy
     */
    value: (row: Entity) => unknown;
    /**
     * the fields of the rows its value is computed from - the fields of the calculated fields it reads
     * too: a value set on one of them changes it (the change count, `rows-changed`)
     */
    uses: readonly string[];
    /** true when its value changes with the day as well (TODAY()): an aggregate of it is kept a day at most */
    daily: boolean;
}
