import type { GridConfig } from '@simple-html/grid';
import { createStage, type DemoSample, mountGrid } from '../demoUtils';

export const dynamicCellTypes: DemoSample = {
    id: 'dynamic-cell-types',
    title: 'Dynamic cell types',
    group: 'Cells',
    description:
        'With dynamicCellTypeColumn one column\'s cell type is driven per row by another column\'s value ("text" | "number" | "date" | "datetime" | "boolean"). The field itself must be a text field (the default). Each row is formatted with the datasource\'s default formatter for its type. Useful for property/value style data. Try editing a valueType cell to another type - the value cell switches (date cells get the picker, boolean a checkbox, numbers align right).',
    code: `
// value is not listed, so it is a text field - that is what dynamic types need
const datasource = new Datasource({ fields: { rowNo: 'number' } });

const gridConfig: GridConfig = {
    readonly: false,
    columnsCenter: [
        { rows: ['rowNo'], width: 60 },
        { rows: ['valueType'], width: 110 },
        { rows: ['value'], width: 220 }
    ],
    attributes: [
        { attribute: 'rowNo', readonly: true },
        { attribute: 'valueType' },
        {
            attribute: 'value',
            dynamicCellTypeColumn: 'valueType' // this rows column decides the type
        }
    ]
};

const rows = [
    { rowNo: 1, valueType: 'text', value: 'hello world' },
    { rowNo: 2, valueType: 'number', value: 1234.5 },
    { rowNo: 3, valueType: 'date', value: new Date(2026, 7, 15) },
    { rowNo: 4, valueType: 'datetime', value: new Date(2026, 7, 15, 13, 45) },
    { rowNo: 5, valueType: 'boolean', value: true }
];

// a row is formatted with datasource.getFormatter('value', row.valueType):
// the default formatter of that type
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
                { attribute: 'rowNo', readonly: true },
                { attribute: 'valueType' },
                { attribute: 'value', dynamicCellTypeColumn: 'valueType' }
            ]
        };

        const types = ['text', 'number', 'date', 'datetime', 'boolean'];
        const sampleValues: any[] = ['hello world', 1234.5, new Date(2026, 7, 15), new Date(2026, 7, 15, 13, 45), true];
        const rows: any[] = [];
        for (let i = 0; i < 40; i++) {
            rows.push({
                rowNo: i + 1,
                valueType: types[i % types.length],
                value: sampleValues[i % types.length]
            });
        }

        mountGrid(ui.gridHost, config, rows, { fields: { rowNo: 'number' } });
    }
};
