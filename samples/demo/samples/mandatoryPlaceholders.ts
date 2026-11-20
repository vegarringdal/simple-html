import type { GridConfig } from '@simple-html/grid';
import { createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

export const mandatoryPlaceholders: DemoSample = {
    id: 'mandatory-placeholders',
    title: 'Mandatory & placeholders',
    group: 'Cells',
    description:
        'mandatory: true renders a striped marker on empty editable cells (it clears as soon as the cell has a value). placeHolderRow shows a placeholder in empty cells - by default only on the current row, controlled by placeHolderRowCurrentEntityOnly. placeHolderFilter overrides the placeholder in the filter row. Click around the empty rows to see the placeholders follow the current row.',
    code: `
const gridConfig: GridConfig = {
    readonly: false,
    // placeholders show on the current row only, set false for all rows
    placeHolderRowCurrentEntityOnly: true, // default
    columnsCenter: [ ... ],
    attributes: [
        {
            attribute: 'company',
            mandatory: true, // striped marker while the cell is empty
            placeHolderRow: 'company is mandatory',
            placeHolderFilter: 'search company...'
        },
        {
            attribute: 'country',
            mandatory: true,
            mandatoryOnlyIfEmpty: true
        },
        {
            attribute: 'phone',
            placeHolderRow: 'type a phone number'
        },
        {
            attribute: 'date1',
            type: 'date',
            placeHolderFilter: 'YYYY-MM-DD' // force a specific filter hint
        }
    ]
};
`,
    run(stage) {
        const ui = createStage(stage);

        const config: GridConfig = {
            panelHeight: 25,
            readonly: false,
            columnsCenter: [
                { rows: ['company'], width: 180 },
                { rows: ['country'], width: 130 },
                { rows: ['phone'], width: 160 },
                { rows: ['date1'], width: 110 }
            ],
            attributes: [
                {
                    attribute: 'company',
                    mandatory: true,
                    placeHolderRow: 'company is mandatory',
                    placeHolderFilter: 'search company...'
                },
                { attribute: 'country', mandatory: true, mandatoryOnlyIfEmpty: true },
                { attribute: 'phone', placeHolderRow: 'type a phone number' },
                { attribute: 'date1', type: 'date', label: 'date', placeHolderFilter: 'YYYY-MM-DD' }
            ]
        };

        const rows = generateRows(100);
        rows.forEach((row: any, i: number) => {
            if (i % 3 === 0) {
                row.company = '';
            }
            if (i % 4 === 0) {
                row.country = '';
            }
            if (i % 2 === 0) {
                row.phone = '';
            }
        });

        const { gridInterface } = mountGrid(ui.gridHost, config, rows);

        ui.button('Placeholders on all rows', () => {
            const current = gridInterface.saveConfig();
            current.placeHolderRowCurrentEntityOnly = false;
            gridInterface.loadConfig(current);
        });
        ui.button('Placeholders on current row only (default)', () => {
            const current = gridInterface.saveConfig();
            current.placeHolderRowCurrentEntityOnly = true;
            gridInterface.loadConfig(current);
        });
    }
};
