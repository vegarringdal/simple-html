import type { GridConfig } from '@simple-html/grid';
import { createStage, type DemoSample, mountGrid } from '../demoUtils';

export const dynamicCellTypes: DemoSample = {
    id: 'dynamic-cell-types',
    title: 'Dynamic cell types',
    group: 'Cells',
    description:
        'With dynamicCellTypeColumn one column\'s cell type is driven per row by another column\'s value ("text" | "number" | "date" | "boolean"). The attribute itself must have type: "text". Useful for property/value style data. Try editing a valueType cell to another type - the value cell switches (date cells get the picker, boolean a checkbox, numbers align right).',
    code: `
const gridConfig: GridConfig = {
    readonly: false,
    columnsCenter: [
        { rows: ['rowNo'], width: 60 },
        { rows: ['valueType'], width: 110 },
        { rows: ['value'], width: 220 }
    ],
    attributes: [
        { attribute: 'rowNo', type: 'number', readonly: true },
        { attribute: 'valueType' },
        {
            attribute: 'value',
            type: 'text', // must be text for dynamic types to apply
            dynamicCellTypeColumn: 'valueType' // this rows column decides the type
        }
    ]
};

const rows = [
    { rowNo: 1, valueType: 'text', value: 'hello world' },
    { rowNo: 2, valueType: 'number', value: 1234.5 },
    { rowNo: 3, valueType: 'date', value: new Date(2026, 7, 15) },
    { rowNo: 4, valueType: 'boolean', value: true }
];
`,
    run(stage) {
        const ui = createStage(stage);

        const config: GridConfig = {
            panelHeight: 25,
            readonly: false,
            columnsCenter: [
                { rows: ['rowNo'], width: 60 },
                { rows: ['valueType'], width: 110 },
                { rows: ['value'], width: 220 }
            ],
            attributes: [
                { attribute: 'rowNo', type: 'number', readonly: true },
                { attribute: 'valueType' },
                { attribute: 'value', type: 'text', dynamicCellTypeColumn: 'valueType' }
            ]
        };

        const types = ['text', 'number', 'date', 'boolean'];
        const sampleValues: any[] = ['hello world', 1234.5, new Date(2026, 7, 15), true];
        const rows: any[] = [];
        for (let i = 0; i < 40; i++) {
            rows.push({
                rowNo: i + 1,
                valueType: types[i % 4],
                value: sampleValues[i % 4]
            });
        }

        mountGrid(ui.gridHost, config, rows);
    }
};
