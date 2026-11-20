import type { GridConfig } from '@simple-html/grid';
import { createStage, type DemoSample, mountGrid } from '../demoUtils';

export const columnLayout: DemoSample = {
    id: 'column-layout',
    title: 'Column layout',
    group: 'Getting started',
    description:
        'Columns can be pinned left/right, and one column can stack several attributes as rows. Try scrolling horizontally - pinned columns stay put. The RS column shows row state (N=new, M=modified, D=deleted).',
    code: `
// the types and labels of the fields are on the datasource
const datasource = new Datasource({
    fields: {
        age: 'number',
        balance: 'number',
        date1: { type: 'date', label: 'date' },
        isActive: { type: 'boolean', label: 'active' },
        favoriteFruit: { label: 'fruit' }
    }
});

const gridConfig: GridConfig = {
    panelHeight: 25,
    columnsPinnedLeft: [
        { rows: ['company'], width: 170 }
    ],
    columnsCenter: [
        { rows: ['__rowState'], width: 20 }, // N = new, M = modified, D = deleted
        { rows: ['country'], width: 120 },
        // one column can stack several attributes
        { rows: ['phone', 'date1'], width: 220 },
        { rows: ['age'], width: 70 },
        { rows: ['favoriteFruit'], width: 120 },
        { rows: ['isActive'], width: 80 }
    ],
    columnsPinnedRight: [
        { rows: ['balance'], width: 110 }
    ],
    attributes: [
        { attribute: '__rowState', label: 'RS', readonly: true },
        { attribute: 'company' },
        { attribute: 'country' },
        { attribute: 'phone' },
        { attribute: 'date1' },
        { attribute: 'age' },
        { attribute: 'favoriteFruit' },
        { attribute: 'isActive' },
        { attribute: 'balance' }
    ]
};
`,
    run(stage) {
        const ui = createStage(stage);
        const config: GridConfig = {
            panelHeight: 25,
            columnsPinnedLeft: [{ rows: ['company'], width: 170 }],
            columnsCenter: [
                { rows: ['__rowState'], width: 20 },
                { rows: ['country'], width: 120 },
                { rows: ['phone', 'date1'], width: 220 },
                { rows: ['age'], width: 70 },
                { rows: ['favoriteFruit'], width: 120 },
                { rows: ['isActive'], width: 80 }
            ],
            columnsPinnedRight: [{ rows: ['balance'], width: 110 }],
            attributes: [
                { attribute: '__rowState', label: 'RS', readonly: true },
                { attribute: 'company' },
                { attribute: 'country' },
                { attribute: 'phone' },
                { attribute: 'date1' },
                { attribute: 'age' },
                { attribute: 'favoriteFruit' },
                { attribute: 'isActive' },
                { attribute: 'balance' }
            ]
        };
        mountGrid(ui.gridHost, config);
    }
};
