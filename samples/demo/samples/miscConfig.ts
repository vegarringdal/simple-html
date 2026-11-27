import type { GridConfig } from '@simple-html/grid';
import { createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

export const miscConfig: DemoSample = {
    id: 'misc-options',
    title: 'Misc options',
    group: 'Config',
    description:
        'Grab bag: dimRepeatedValues dims cells repeating the value of the row above (sort by country and toggle it - also available in the row right-click menu). numberOverride maps between blank and 0 per column (bonus hides zeros, age shows blanks as 0). website only accepts paste/clear, no typing. fitColumns() fits the columns to their content, resetColumnWidths() takes them back - the header menu and a double click on the resize handle of a column do the same. updateConfig() changes an option while the grid is shown, the sorting, filter and column order stay.',
    run(stage) {
        const ui = createStage(stage);

        const config: GridConfig = {
            panelHeight: 25,
            readonly: false,
            // dimRepeatedValues: true dims cells that repeat the value of the row above
            // (also in the row context menu), the buttons turn it on and off
            columns: {
                // 0 is displayed as blank (number fields only)
                bonus: { numberOverride: 'ZERO_TO_BLANK' },
                // blank is displayed as 0
                age: { numberOverride: 'BLANK_TO_ZERO' },
                // typing is blocked, only paste (ctrl+v) and clearing allowed
                website: { allowPasteClearOnly: true }
            },
            layout: {
                center: [
                    { fields: ['country'], width: 130 },
                    { fields: ['company'], width: 170 },
                    { fields: ['bonus'], width: 90 },
                    { fields: ['age'], width: 70 },
                    { fields: ['website'], width: 220 }
                ]
            }
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
        // change an option later, the state (sorting, filter, column order ...) stays
        ui.button('dimRepeatedValues: on', () => {
            gridInterface.updateConfig({ dimRepeatedValues: true });
        });
        ui.button('dimRepeatedValues: off', () => {
            gridInterface.updateConfig({ dimRepeatedValues: false });
        });
        // fit the columns to their content, and back to the widths of the config
        ui.button('fitColumns()', () => {
            gridInterface.fitColumns();
        });
        ui.button('resetColumnWidths()', () => {
            gridInterface.resetColumnWidths();
        });
        ui.button('Try typing in website (paste/clear only)', () => {
            ui.log('typing in website cells is blocked - paste (ctrl+v) or clear with delete/backspace');
        });
    }
};
