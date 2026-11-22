import type { Grid } from '../grid';
import type { MenuEntry } from '../gridMenus';
import { getColumnLabel } from './getColumnLabel';
import { gridText } from './gridText';
import { focusMenu } from './showMenu';

/**
 * The field picker of the filter editor: a menu under the picker's button with a search box and every
 * field of the grid's columns, by their labels, the one picked with a ✓. A menu of the grid (showMenu,
 * as `openMenu()` opens it): one at a time, closed as the others. It is put in the editor's dialog: a
 * menu outside a modal dialog can not be used, see popoverParent.
 *
 * The search box hides the fields whose label (or field name) does not have its text. Opened from the
 * keyboard the focus is in it: type, then ArrowDown to the fields, or Enter for the first one shown.
 * The fields are items of the menu: the arrows, a letter, Enter as in the other menus
 * The column settings dialog opens it too, to put a field in a template (columnSettings.ts): with the
 * fields of its row as well.
 * @param button the picker, the menu opens under it
 * @param current the field picked, undefined (or '') for none
 * @param callback gets the picked field, after the menu has closed
 * @param list the fields to list. Left out: the fields of the grid's columns
 */
export function contextMenuAttributes(
    ctx: Grid,
    button: HTMLElement,
    current: string | undefined,
    callback: (attribute: string) => void,
    list: string[] = Object.keys(ctx.gridInterface.__getGridConfig().columns)
) {
    const fields = list
        .map((field) => ({ field, label: getColumnLabel(ctx, field) }))
        .sort((a, b) => a.label.localeCompare(b.label));

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'simple-html-grid-menu-search';
    search.placeholder = gridText(ctx, 'filterEditor.fieldMenu.search');
    search.setAttribute('aria-label', gridText(ctx, 'filterEditor.fieldMenu.search'));

    /** the items of the fields, in the menu the search box is in */
    const items = () =>
        Array.from(search.parentElement?.querySelectorAll<HTMLElement>('[data-menu-id^="filterEditor.field."]') ?? []);

    search.addEventListener('input', () => {
        const text = search.value.toLowerCase();
        // the items are in the order of `fields`
        for (const [index, item] of items().entries()) {
            const { field, label } = fields[index];
            item.hidden = !(label.toLowerCase().includes(text) || field.toLowerCase().includes(text));
        }
    });
    search.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' && ctx.menuTree) {
            event.preventDefault();
            focusMenu(ctx.menuTree, false);
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            items()
                .find((item) => !item.hidden)
                ?.click();
        }
    });

    const entries: MenuEntry[] = [
        { type: 'section', id: 'filterEditor.fieldMenu', label: gridText(ctx, 'filterEditor.fieldMenu') },
        { type: 'block', id: 'filterEditor.fieldMenu.search', element: search },
        ...fields.map(
            ({ field, label }): MenuEntry => ({
                id: `filterEditor.field.${field}`,
                label,
                selected: () => field === current,
                action: () => callback(field)
            })
        )
    ];

    ctx.gridInterface.openMenu(button, entries);
    if (ctx.keyboardUsed) {
        search.focus();
    }
}
