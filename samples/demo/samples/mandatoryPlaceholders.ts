import type { GridConfig } from '@simple-html/grid';
import { createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

export const mandatoryPlaceholders: DemoSample = {
    id: 'mandatory-placeholders',
    title: 'Mandatory & placeholders',
    group: 'Cells',
    description:
        'mandatory: true renders a striped marker on empty editable cells (it clears as soon as the cell has a value). placeholderRow shows a placeholder in empty cells - by default only on the current row, controlled by placeholderRowCurrentEntityOnly. placeholderFilter overrides the placeholder in the filter row. Click around the empty rows to see the placeholders follow the current row.',
    code: `
const datasource = new Datasource({ fields: { date1: { type: 'date', label: 'date' } } });

const gridConfig: GridConfig = {
    readonly: false,
    // placeholders show on the current row only, set false for all rows
    placeholderRowCurrentEntityOnly: true, // default
    columns: {
        company: {
            mandatory: true, // striped marker while the cell is empty
            placeholderRow: 'company is mandatory',
            placeholderFilter: 'search company...'
        },
        country: {
            mandatory: true,
            mandatoryOnlyIfEmpty: true
        },
        phone: {
            placeholderRow: 'type a phone number'
        },
        date1: {
            // a date field shows the formatter's placeholder (YYYY-MM-DD), this one wins over it
            placeholderFilter: 'from date...'
        }
    },
    layout: { center: [ ... ] }
};

// change it while the grid is shown
gridInterface.updateConfig({ placeholderRowCurrentEntityOnly: false });
`,
    run(stage) {
        const ui = createStage(stage);

        const config: GridConfig = {
            panelHeight: 25,
            readonly: false,
            columns: {
                company: {
                    mandatory: true,
                    placeholderRow: 'company is mandatory',
                    placeholderFilter: 'search company...'
                },
                country: { mandatory: true, mandatoryOnlyIfEmpty: true },
                phone: { placeholderRow: 'type a phone number' },
                date1: { placeholderFilter: 'from date...' }
            },
            layout: {
                center: [
                    { fields: ['company'], width: 180 },
                    { fields: ['country'], width: 130 },
                    { fields: ['phone'], width: 160 },
                    { fields: ['date1'], width: 110 }
                ]
            }
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
            gridInterface.updateConfig({ placeholderRowCurrentEntityOnly: false });
        });
        ui.button('Placeholders on current row only (default)', () => {
            gridInterface.updateConfig({ placeholderRowCurrentEntityOnly: true });
        });
    }
};
