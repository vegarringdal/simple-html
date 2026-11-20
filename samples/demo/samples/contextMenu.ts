import { isGroupRow, type MenuEntry } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, FRUITS, mountGrid } from '../demoUtils';

export const contextMenu: DemoSample = {
    id: 'context-menu',
    title: 'Menus',
    group: 'Editing',
    description:
        'The right click menus are lists of entries with ids (MENU_IDS lists them): menus in the config hides, reorders or adds entries. Here the row menu drops "Row (selected rows/col)" and gets a "Fruit:" part of its own on the fruit column. openMenu() opens a menu of your own: click a cell in the fruit column to pick a value.',
    code: `
const gridConfig: GridConfig = {
    readonly: false,
    layout: { center: [ ... ] },
    menus: {
        // called every time the row menu opens: the grid's own entries in, the entries to show out
        row: (defaults, context) => {
            // the row menu is opened on a cell, a data row. isGroupRow() tells TypeScript
            const row = isGroupRow(context.row) ? undefined : context.row;
            return [
                // hide a built-in entry by its id - MENU_IDS lists them all
                ...defaults.filter((entry) => entry.id !== 'row.copy.selectedColumns'),
                // and add your own
                { type: 'section', id: 'demo.fruit', label: 'Fruit:', visible: () => context.field === 'favoriteFruit' },
                {
                    id: 'demo.fruit.clear',
                    label: 'Clear fruit',
                    hint: 'this row',
                    visible: () => context.field === 'favoriteFruit',
                    disabled: () => !row?.favoriteFruit, // greyed out when there is nothing to clear
                    action: () => {
                        if (row) {
                            row.favoriteFruit = null;
                            context.gridInterface.refresh();
                        }
                    }
                }
            ];
        }
    }
};

const gridInterface = createGrid(container, { config: gridConfig, datasource });

// a menu of your own: a value picker on the fruit column
gridInterface.on('cell-click', (data) => {
    if (data.attribute === 'favoriteFruit') {
        const pick = (fruit: string) => {
            data.rowData.favoriteFruit = fruit;
            gridInterface.refresh(); // render the cells again
        };
        gridInterface.openMenu(data.originalEvent, [
            { type: 'section', id: 'fruit', label: 'Pick a fruit:' },
            { id: 'fruit.apple', label: 'Apple', action: () => pick('Apple') },
            { id: 'fruit.banana', label: 'Banana', action: () => pick('Banana') },
            { id: 'fruit.cherry', label: 'Cherry', action: () => pick('Cherry') }
        ]);
    }
});
`,
    run(stage) {
        const ui = createStage(stage);
        const config = baseGridConfig();
        config.menus = {
            row: (defaults, context) => {
                // the row menu is opened on a cell, a data row. isGroupRow() tells TypeScript
                const row = isGroupRow(context.row) ? undefined : context.row;
                return [
                    // hide a built-in entry by its id - MENU_IDS lists them all
                    ...defaults.filter((entry) => entry.id !== 'row.copy.selectedColumns'),
                    // and add your own
                    { type: 'section', id: 'demo.fruit', label: 'Fruit:', visible: () => context.field === 'favoriteFruit' },
                    {
                        id: 'demo.fruit.clear',
                        label: 'Clear fruit',
                        hint: 'this row',
                        visible: () => context.field === 'favoriteFruit',
                        disabled: () => !row?.favoriteFruit,
                        action: () => {
                            if (row) {
                                row.favoriteFruit = null;
                                context.gridInterface.refresh();
                                ui.log(`cleared the fruit of ${row.company}`);
                            }
                        }
                    }
                ];
            }
        };
        const { gridInterface } = mountGrid(ui.gridHost, config);

        gridInterface.on('cell-click', (data) => {
            if (data.attribute === 'favoriteFruit') {
                const pick = (fruit: string) => {
                    data.rowData.favoriteFruit = fruit;
                    gridInterface.refresh();
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
