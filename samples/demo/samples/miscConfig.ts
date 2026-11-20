import type { GridConfig } from '@simple-html/grid';
import { createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

export const miscConfig: DemoSample = {
    id: 'misc-options',
    title: 'Misc options',
    group: 'Config',
    description:
        'Grab bag: dimRepeatedValues dims cells repeating the value of the row above (sort by country and toggle it - also available in the row right-click menu). numberOverride maps between blank and 0 per column (bonus hides zeros, age shows blanks as 0). website only accepts paste/clear, no typing. autoResizeColumns() sizes columns to content.',
    code: `
const datasource = new Datasource({ fields: { bonus: 'number', age: 'number' } });

const gridConfig: GridConfig = {
    readonly: false,
    // dim cells that repeat the value of the row above (also in row context menu)
    dimRepeatedValues: true,
    columnsCenter: [ ... ],
    attributes: [
        // 0 is displayed as blank (number fields only)
        { attribute: 'bonus', numberOverride: 'ZERO_TO_BLANK' },
        // blank is displayed as 0
        { attribute: 'age', numberOverride: 'BLANK_TO_ZERO' },
        // typing is blocked, only paste (ctrl+v) and clearing allowed
        { attribute: 'website', allowPasteClearOnly: true }
    ]
};

// size columns to their content
gridInterface.autoResizeColumns();
`,
    run(stage) {
        const ui = createStage(stage);

        const config: GridConfig = {
            panelHeight: 25,
            readonly: false,
            columnsCenter: [
                { rows: ['country'], width: 130 },
                { rows: ['company'], width: 170 },
                { rows: ['bonus'], width: 90 },
                { rows: ['age'], width: 70 },
                { rows: ['website'], width: 220 }
            ],
            attributes: [
                { attribute: 'country' },
                { attribute: 'company' },
                { attribute: 'bonus', numberOverride: 'ZERO_TO_BLANK' },
                { attribute: 'age', numberOverride: 'BLANK_TO_ZERO' },
                { attribute: 'website', allowPasteClearOnly: true }
            ]
        };

        const rows = generateRows(300);
        rows.forEach((row: any, i: number) => {
            row.bonus = i % 3 === 0 ? 0 : Math.round(row.balance) / 10;
            row.website =
                'https://' +
                String(row.company)
                    .toLowerCase()
                    .replace(/[^a-z]/g, '') +
                '.com';
            if (i % 4 === 0) {
                row.age = null;
            }
        });

        const { datasource, gridInterface } = mountGrid(ui.gridHost, config, rows, {
            fields: { bonus: 'number', age: 'number' }
        });

        ui.button('Sort by country', () => {
            datasource.sort({ attribute: 'country', ascending: true });
        });
        ui.button('dimRepeatedValues: on', () => {
            const current = gridInterface.saveConfig();
            current.dimRepeatedValues = true;
            gridInterface.loadConfig(current);
        });
        ui.button('dimRepeatedValues: off', () => {
            const current = gridInterface.saveConfig();
            current.dimRepeatedValues = false;
            gridInterface.loadConfig(current);
        });
        ui.button('autoResizeColumns()', () => {
            gridInterface.autoResizeColumns();
        });
        ui.button('Try typing in website (paste/clear only)', () => {
            ui.log('typing in website cells is blocked - paste (ctrl+v) or clear with delete/backspace');
        });
    }
};
