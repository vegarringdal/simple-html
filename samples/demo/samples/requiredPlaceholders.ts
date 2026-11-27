import type { GridConfig } from '@simple-html/grid';
import { baseFields, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

export const requiredPlaceholders: DemoSample = {
    id: 'required-placeholders',
    title: 'Required fields & placeholders',
    group: 'Cells',
    description:
        "A field with the required rule (validate: ['required'] in the datasource's fields) shows a striped marker on its empty editable cells, it clears as soon as the cell has a value. Empty a cell and it is validated: it gets the error border, and the message as its tooltip. placeholderRow shows a placeholder in empty cells - by default only on the current row, controlled by placeholderRowCurrentEntityOnly. placeholderFilter overrides the placeholder in the filter row. Click around the empty rows to see the placeholders follow the current row.",
    run(stage) {
        const ui = createStage(stage);

        const config: GridConfig = {
            panelHeight: 25,
            readonly: false,
            // placeholders show on the current row only, set false for all rows
            placeholderRowCurrentEntityOnly: true, // default
            columns: {
                company: {
                    placeholderRow: 'company is required',
                    placeholderFilter: 'search company...'
                },
                phone: { placeholderRow: 'type a phone number' },
                // a date field shows the formatter's placeholder (YYYY-MM-DD), this one wins over it
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

        // required is a rule of the datasource's field: striped while it is empty
        const { datasource, gridInterface } = mountGrid(ui.gridHost, config, rows, {
            fields: {
                ...baseFields(),
                company: { validate: ['required'] },
                country: { validate: ['required'] }
            }
        });

        // change it while the grid is shown
        ui.button('Placeholders on all rows', () => {
            gridInterface.updateConfig({ placeholderRowCurrentEntityOnly: false });
        });
        ui.button('Placeholders on current row only (default)', () => {
            gridInterface.updateConfig({ placeholderRowCurrentEntityOnly: true });
        });
        ui.button('Validate', () => {
            // the empty cells were never edited: validate() checks them, and the grid shows the errors
            const errors = datasource.validate();
            ui.log(`${errors.length} empty required cells`);
        });
    }
};
