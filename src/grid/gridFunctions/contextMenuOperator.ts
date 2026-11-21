import type { FilterOperator } from '../../datasource/filterExpression';
import type { Grid } from '../grid';
import type { MenuEntry } from '../gridMenus';
import { gridText } from './gridText';

/**
 * every operator, in the order of the menu
 */
const OPERATORS: FilterOperator[] = [
    'EQUAL',
    'LESS_THAN_OR_EQUAL_TO',
    'GREATER_THAN_OR_EQUAL_TO',
    'LESS_THAN',
    'GREATER_THAN',
    'CONTAINS',
    'NOT_EQUAL_TO',
    'DOES_NOT_CONTAIN',
    'BEGIN_WITH',
    'END_WITH',
    'IN',
    'NOT_IN',
    'IS_BLANK',
    'IS_NOT_BLANK'
];

/**
 * The operator picker of the filter editor: a menu of every operator under the picker's button, the
 * one in use with a ✓. A menu of the grid (showMenu, as `openMenu()` opens it): one at a time, the
 * keyboard as in the other menus - opened from the keyboard the focus is on its first item, Enter
 * picks. It is put in the editor's dialog: a menu outside a modal dialog can not be used, see
 * popoverParent
 * @param button the picker, the menu opens under it
 * @param current the operator picked, undefined for none
 * @param callback gets the picked operator, after the menu has closed
 */
export function contextMenuOperator(
    ctx: Grid,
    button: HTMLElement,
    current: FilterOperator | undefined,
    callback: (operator: FilterOperator) => void
) {
    const entries: MenuEntry[] = [
        { type: 'section', id: 'filterEditor.operatorMenu', label: gridText(ctx, 'filterEditor.operatorMenu') },
        ...OPERATORS.map(
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
