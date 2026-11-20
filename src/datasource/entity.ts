import type { EntityHandler } from './entityHandler';

/**
 * A data row: one of your objects, as the datasource hands it out. Group header rows are not
 * entities, see {@link GroupRow}.
 *
 * The row is your object wrapped in a `Proxy`. Your own fields are read and set as usual, setting one
 * is an edit (`datasource.getChanges()`). The `__` fields below are not stored on your object: the
 * proxy answers them, so `Object.keys(row)` and `JSON.stringify(row)` show your fields only.
 *
 * @example
 * ```ts
 * const row = datasource.getDataRows()[0];
 * row.name = 'Anna'; // an edit
 * row.__rowState; // 'M'
 * row.__KEY; // the key, e.g. the row's id
 * ```
 */
export interface Entity {
    /** your fields */
    [key: string]: any | undefined;
    /**
     * the object that tracks the row's edits: its original values, `__isNew`, `__isDeleted`,
     * `__edited`. Read it, do not change it - see {@link EntityHandler}
     */
    __controller?: EntityHandler;
    /**
     * the row's key: the value of the key field (`new Datasource({ key: 'id' })`), which reading and
     * setting `__KEY` go to. Without a key field a generated negative number. The selection and
     * `setErrors()` use it
     */
    __KEY?: string | number;
    /**
     * the row's state: `'N'` new (`addNewEmpty()`), `'D'` marked for deletion (a new row too), `'M'`
     * edited - a field differs from its original value. `undefined` for a row as it was set, or as
     * `acceptChanges()` left it. Read only, setting it does nothing
     */
    __rowState?: string;
    /**
     * an error message for the row, set with `datasource.getDataContainer().setErrors()`. `null` or
     * `undefined` for no error. The grid does not show it: read it in the `cellClass` hook ({@link GridHooks})
     */
    __rowError?: string | null;
    /**
     * Written by grouping: how many group levels the row sits under. Do not rely on it - it is not
     * set on every row (with one grouping level only the first row of each group gets it) and not
     * cleared when the grouping is removed. The grid shows nothing from it on a data row.
     */
    __groupLvl?: number;
    /**
     * A data row never has `__group`, only a {@link GroupRow} has it (`true`). Declared so the two
     * types stay apart: a group row can not be passed where an entity is expected, and
     * `row.__group` tells them apart. {@link isGroupRow} is the readable way to check.
     */
    __group?: never;
}

/**
 * A row of data, not a group row: the DataContainer wraps every one of them in an EntityHandler
 * proxy, so it always has its controller. An {@link Entity} with `__controller` set.
 *
 * @example
 * ```ts
 * import type { DataEntity } from '@simple-html/grid';
 *
 * const isEdited = (row: DataEntity) => row.__controller.__edited === true;
 * ```
 */
export interface DataEntity extends Entity {
    __controller: EntityHandler;
}

/**
 * A group header row. When the datasource is grouped, the displayed rows
 * (`datasource.getRows()`) mix your data rows with these headers - one per group, in front of
 * its rows. A group row is made by the datasource, it is not one of your objects: it can not be
 * selected, edited or marked for deletion, and `getDataRows()`, `getSelectedRows()` and
 * `getAllData()` never contain one. Tell the two kinds apart with {@link isGroupRow}.
 *
 * Read the fields, do not change them - expand and collapse with `datasource.expandGroup(id)` /
 * `collapseGroup(id)`.
 *
 * @sample sorting-grouping
 * @example
 * ```ts
 * import { isGroupRow } from '@simple-html/grid';
 *
 * datasource.group([{ attribute: 'country', title: 'Country' }]);
 * datasource.expandGroup();
 *
 * for (const row of datasource.getRows()) {
 *     if (isGroupRow(row)) {
 *         console.log(row.__groupName, row.__groupTotal, row.__groupExpanded ? 'open' : 'closed');
 *     } else {
 *         console.log('  ', row.name);
 *     }
 * }
 * ```
 */
export interface GroupRow {
    /** always `true`, the mark of a group row - see {@link isGroupRow} */
    __group: true;
    /**
     * id of the group, for `expandGroup(id)` / `collapseGroup(id)`: the grouped value as the field's
     * formatter shows it, `'Norway'`. On a sub group the ids of the groups above it come first, joined
     * by `-`: `'Norway-Apple'`. The group of the blank values is `' blank'`
     */
    __groupID: string;
    /** the text the grid shows: the group's title (its first letter in upper case) and the value, `'Country: Norway'` */
    __groupName: string;
    /** the grouping level, 0 for the first `group()` attribute. The grid indents the row by it */
    __groupLvl: number;
    /** number of data rows in the group, the ones in its sub groups included */
    __groupTotal: number;
    /** the rows in the group: data rows, or the group rows of the next level when grouped on more than one attribute */
    __groupChildren: (GroupRow | Entity)[];
    /** `true` when the group is expanded and its rows are displayed */
    __groupExpanded: boolean;
}

/**
 * `true` when the row is a group header row, `false` for a data row - and for `null` or
 * `undefined`, so it can be given `datasource.getRow(n)` or `datasource.currentEntity` as they
 * are. It narrows the type, a data row's own fields can be read after it.
 *
 * @sample sorting-grouping
 * @example
 * ```ts
 * import { isGroupRow } from '@simple-html/grid';
 *
 * const row = datasource.getRow(0);
 * if (isGroupRow(row)) {
 *     datasource.expandGroup(row.__groupID);
 * } else {
 *     console.log(row.name);
 * }
 *
 * // only the data rows - getDataRows() is the same, plus the rows of collapsed groups
 * const dataRows = datasource.getRows().filter((row) => !isGroupRow(row));
 * ```
 */
export function isGroupRow(row: Entity | GroupRow | null | undefined): row is GroupRow {
    return row?.__group === true;
}
