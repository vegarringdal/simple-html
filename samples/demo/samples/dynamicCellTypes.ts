import type { GridConfig } from '@simple-html/grid';
import { createStage, type DemoSample, mountGrid } from '../demoUtils';

export const dynamicCellTypes: DemoSample = {
    id: 'dynamic-cell-types',
    title: 'Dynamic cell types',
    group: 'Cells',
    description:
        'With dynamicCellTypeColumn one column\'s cell type is driven per row by another column\'s value ("text" | "number" | "date" | "datetime" | "boolean"). The field itself must be a text field (the default). Each row is formatted with the datasource\'s default formatter for its type. Useful for property/value style data. Try editing a valueType cell to another type - the value cell switches (date cells get the picker, boolean a checkbox, numbers align right).',
    run(stage) {
        const ui = createStage(stage);

        const config: GridConfig = {
            panelHeight: 25,
            readonly: false,
            columns: {
                rowNo: { readonly: true },
                // the valueType of the row decides the type of its value cell
                value: { dynamicCellTypeColumn: 'valueType' }
            },
            layout: {
                center: [
                    { fields: ['rowNo'], width: 60 },
                    { fields: ['valueType'], width: 110 },
                    { fields: ['value'], width: 220 }
                ]
            }
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

        // value is not in the fields, so it is a text field - that is what dynamic types need.
        // A row is formatted with datasource.getFormatter('value', row.valueType): the default
        // formatter of that type
        mountGrid(ui.gridHost, config, rows, { fields: { rowNo: 'number' } });
    }
};
