import type { GridConfig } from '@simple-html/grid';
import { createStage, type DemoSample, mountGrid } from '../demoUtils';

export const columnLayout: DemoSample = {
    id: 'column-layout',
    title: 'Column layout',
    group: 'Getting started',
    description:
        'Columns can be pinned left/right, and one column can stack several fields. Try scrolling horizontally - pinned columns stay put. The RS column shows row state (N=new, M=modified, D=deleted). The user can move, pin, hide and resize columns: getState().layout has what they did.',
    run(stage) {
        const ui = createStage(stage);
        // the types and labels of the fields are on the datasource, mountGrid() makes it with baseFields()
        const config: GridConfig = {
            panelHeight: 25,
            // the options of a column, by field name. The fields without an entry get the defaults
            columns: {
                __rowState: { label: 'RS', readonly: true }
            },
            layout: {
                left: [{ fields: ['company'], width: 170 }],
                center: [
                    { fields: ['__rowState'], width: 20 }, // N = new, M = modified, D = deleted
                    { fields: ['country'], width: 120 },
                    // one column can stack several fields
                    { fields: ['phone', 'date1'], width: 220 },
                    { fields: ['age'], width: 70 },
                    { fields: ['favoriteFruit'], width: 120 },
                    { fields: ['isActive'], width: 80 }
                ],
                right: [{ fields: ['balance'], width: 110 }]
            }
        };
        const { gridInterface } = mountGrid(ui.gridHost, config);

        // the layout now, after the user moved, pinned or resized columns
        ui.button('Log layout', () => {
            const { left, center, right } = gridInterface.getState().layout;
            const names = (columns: { fields: string[] }[] = []) => columns.map((column) => column.fields.join('+')).join(', ');
            ui.log(`left: ${names(left)} | center: ${names(center)} | right: ${names(right)}`);
        });
    }
};
