import type { Entity } from '../../datasource/entity';
import type { EditPermissions } from '../gridConfig';

/**
 * The edit permissions, `GridConfig.edit` (see EditPermissions in gridConfig.ts): what the user may do in
 * an editable grid. The rules are here, in one place - every edit path of the grid asks the
 * GridInterface (`__isCellReadonly`, `__canChangeRow`, `__canChangeValues`, `__canDeleteRow`), which asks
 * these:
 *
 * - **change**: the values of a row that was there. A new row (`__isNew`, added and not saved yet) can
 *   be changed when `change` or `add` allows it: who may add a row may fill it in
 * - **delete**: marking a row that was there for deletion. A new row can always be taken out: it is not
 *   on the server, nothing is deleted - it is the undo of an add
 * - **add**: the grid adds no rows itself, it is for the app's add button and for the new rows above
 *
 * The grid's own `readonly` is not part of these: the GridInterface checks it with them. The undo
 * history, the reverts and taking a deletion mark off are not stopped by any of them: they put back what
 * was. Nothing here stops code of the app - a value set from code, `addNewEmpty()`, `markForDeletion()`.
 */

/** the permissions, in the order the docs name them */
export const EDIT_PERMISSIONS = ['add', 'change', 'delete'] as const satisfies readonly (keyof EditPermissions)[];

/**
 * The permissions with the defaults filled in: each is `true` unless it is `false`
 * @param edit `GridConfig.edit`, checked by assertEditPermissions
 */
export function editPermissionsOf(edit: EditPermissions | undefined): Required<EditPermissions> {
    return { add: edit?.add ?? true, change: edit?.change ?? true, delete: edit?.delete ?? true };
}

/**
 * `GridConfig.edit` is an object of `add`, `change` and `delete`, each true, false or left out.
 * TypeScript does not catch a config from plain JavaScript or JSON, and a permission that is misspelt
 * (`chnage: false`) or a text (`'false'`) would leave the user allowed without a word. Left out or
 * undefined is every permission
 * @throws a `TypeError` naming what is wrong and what it takes
 */
export function assertEditPermissions(edit: unknown) {
    if (edit === undefined) {
        return;
    }
    if (edit === null || typeof edit !== 'object' || Array.isArray(edit)) {
        throw new TypeError(
            `GridConfig: edit is ${JSON.stringify(edit)}, it is an object of what the user may do: { add, change, delete }, each true or false`
        );
    }
    const names: readonly string[] = EDIT_PERMISSIONS;
    for (const [name, value] of Object.entries(edit)) {
        if (!names.includes(name)) {
            throw new TypeError(`GridConfig: edit.${name} is not a permission, they are ${names.join(', ')}`);
        }
        if (value !== undefined && typeof value !== 'boolean') {
            throw new TypeError(`GridConfig: edit.${name} is ${JSON.stringify(value)}, it is true or false`);
        }
    }
}

/** true for a row added and not saved yet: `addNewEmpty()`, until `acceptChanges()` takes it in */
export function isNewRow(row: Entity): boolean {
    return row.__controller?.__isNew === true;
}

/** the permissions let the user change the values of the row: `change`, or `add` for a new row */
export function mayChangeRow(edit: Required<EditPermissions>, row: Entity): boolean {
    return edit.change || (edit.add && isNewRow(row));
}

/** the permissions let the user change some values: of the rows that were there, or of new rows */
export function mayChangeValues(edit: Required<EditPermissions>): boolean {
    return edit.change || edit.add;
}

/** the permissions let the user mark the row for deletion: `delete`, or the row is new */
export function mayDeleteRow(edit: Required<EditPermissions>, row: Entity): boolean {
    return edit.delete || isNewRow(row);
}
