import type { FilterOperator } from '../../datasource/filterExpression';
import type { Grid } from '../grid';
import type { MenuEntry } from '../gridMenus';
import { gridText } from './gridText';

/**
 * The operator picker of the filter editor: a menu of the operators of the condition's field under
 * the picker's button, the one in use with a ✓. A menu of the grid (showMenu, as `openMenu()` opens
 * it): one at a time, the keyboard as in the other menus - opened from the keyboard the focus is on its
 * first item, Enter picks. It is put in the editor's dialog: a menu outside a modal dialog can not be
 * used, see popoverParent
 * @param button the picker, the menu opens under it
 * @param current the operator picked, undefined for none. One that is not in `operators` (a v5 filter,
 * CONTAINS on a number) has no ✓
 * @param operators what the menu offers, in order: the field's (editorOperators)
 * @param callback gets the picked operator, after the menu has closed
 */
export function contextMenuOperator(
    ctx: Grid,
    button: HTMLElement,
    current: FilterOperator | undefined,
    operators: readonly FilterOperator[],
    callback: (operator: FilterOperator) => void
) {
    const entries: MenuEntry[] = [
        { type: 'section', id: 'filterEditor.operatorMenu', label: gridText(ctx, 'filterEditor.operatorMenu') },
        ...operators.map(
            (operator): MenuEntry => ({
                id: `filterEditor.operator.${operator}`,
                label: gridText(ctx, `filterEditor.operator.${operator}`),
                selected: () => operator === current,
                action: () => callback(operator)
            })
        )
    ];

    ctx.gridInterface.openMenu(button, entries);
}
