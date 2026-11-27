import { type GridMenus, isGroupRow, type MenuEntry } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, FRUITS, mountGrid } from '../demoUtils';

export const contextMenu: DemoSample = {
    id: 'context-menu',
    title: 'Menus',
    group: 'Editing',
    description:
        'The right click menus are trees of entries with ids (MENU_IDS lists them): most entries are in submenus - Copy ›, Filter › ... - that open beside their item, on hover, a click or ArrowRight. The menus hook hides, reorders or adds entries. Here the row menu drops "Row (selected rows/col)" from its Copy submenu and gets a "Fruit" submenu of its own on the fruit column. Hooks are functions, given next to the config: createGrid(host, { config, datasource, hooks: { menus } }). openMenu() opens a menu of your own: click a cell in the fruit column to pick a value. Every menu is a popover, over everything on the page; a click outside or Esc closes it. Shift+F10 (or the menu key) in a cell opens the row menu from the keyboard: the arrows, Enter, Esc.',
    run(stage) {
        const ui = createStage(stage);
        // a hook, not part of the config: the config stays plain JSON
        const menus: GridMenus = {
            // called every time the row menu opens: the grid's own entries in, the entries to show out
            row: (defaults, context) => {
                // the row menu is opened on a cell, a data row. isGroupRow() tells TypeScript
                const row = isGroupRow(context.row) ? undefined : context.row;
                return [
                    // hide a built-in entry by its id - MENU_IDS lists them all. It is in the copy
                    // submenu: change that submenu's entries
                    ...defaults.map((entry) =>
                        entry.type === 'submenu' && entry.id === 'row.copy'
                            ? { ...entry, entries: entry.entries.filter((inner) => inner.id !== 'row.copy.selectedColumns') }
                            : entry
                    ),
                    // and add your own: a submenu, shown on the fruit column only
                    {
                        type: 'submenu',
                        id: 'demo.fruit',
                        label: 'Fruit',
                        visible: () => context.field === 'favoriteFruit',
                        entries: [
                            {
                                id: 'demo.fruit.clear',
                                label: 'Clear fruit',
                                hint: 'this row',
                                disabled: () => !row?.favoriteFruit, // greyed out when there is nothing to clear
                                action: () => {
                                    if (row) {
                                        row.favoriteFruit = null;
                                        context.gridInterface.refresh();
                                        ui.log(`cleared the fruit of ${row.company}`);
                                    }
                                }
                            }
                        ]
                    }
                ];
            }
        };
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig(), undefined, undefined, { menus });

        // a menu of your own: a value picker on the fruit column
        gridInterface.on('cell-click', (data) => {
            if (data.attribute === 'favoriteFruit') {
                const pick = (fruit: string) => {
                    data.rowData.favoriteFruit = fruit;
                    gridInterface.refresh(); // render the cells again
                    ui.log(`picked: ${fruit}`);
                };
                const entries: MenuEntry[] = [{ type: 'section', id: 'fruit', label: 'Pick a fruit:' }];
                for (const fruit of FRUITS) {
                    entries.push({ id: `fruit.${fruit.toLowerCase()}`, label: fruit, action: () => pick(fruit) });
                }
                gridInterface.openMenu(data.originalEvent, entries);
            }
        });

        ui.log('click a cell in the fruit column to open the picker, right click it for the row menu');
    }
};
