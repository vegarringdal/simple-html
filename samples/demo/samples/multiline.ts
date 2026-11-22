import type { GridConfig } from '@simple-html/grid';
import { baseFields, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

/**
 * notes of one line and of several. The last one has CR LF line breaks, as text from Windows can
 */
const NOTES = [
    'Call back on Monday\nAsk for the new price list\nSend the contract by mail',
    'Paid in full',
    '',
    'Delivery to the back door\nRing the bell twice',
    'VIP customer\r\nAlways confirm by phone'
];

/**
 * the notes of a meeting, on every tenth row from row 7: more lines than the tooltip shows, an empty
 * line between the parts
 */
const MEETING = [
    'Meeting 12 March',
    'Present: Anna, Ole, Kari',
    '',
    'Agreed:',
    '- new prices from April',
    '- delivery every second week',
    '',
    'To do:',
    '- Ole sends the contract',
    '- Kari calls the bank'
].join('\n');

export const multiline: DemoSample = {
    id: 'multiline',
    title: 'Multiline text',
    group: 'Editing',
    description:
        'Notes is a multiline field (fields: { notes: { multiline: true } }): a cell shows its first line, a marker when there are more, and its first 5 lines as its tooltip (multilineTooltipLines) - hover the notes of row 8. Address (pinned right) has no option: only its values with a line break are multiline. Enter, F2, a double click or typing a character opens an editor over the cell: Enter is a new line, Ctrl+Enter saves, Esc cancels, Tab saves and goes on; a click outside or scrolling saves too. A save is one undo step (Ctrl+Z in the cell). The notes have a rule, at most 120 characters. Sizes, like Excel: fitRows() makes the rows as high as their notes need, the lines under the first a line of text apart (multilineLineHeight, 15px); fitColumns() the columns as wide as their content. Both are in the Size › submenu of the row and header menus too, and a column fits with a double click on the edge of its header.',
    run(stage) {
        const ui = createStage(stage);

        const config: GridConfig = {
            panelHeight: 25,
            readonly: false,
            layout: {
                center: [
                    { fields: ['company'], width: 170 },
                    { fields: ['notes'], width: 220 },
                    { fields: ['country'], width: 120 },
                    { fields: ['age'], width: 70 },
                    { fields: ['phone'], width: 140 }
                ],
                right: [{ fields: ['address'], width: 180 }]
            }
        };

        const rows = generateRows(200).map((row, i) => ({
            ...row,
            notes: i % 10 === 7 ? MEETING : NOTES[i % NOTES.length],
            // every third address has a line break
            address: i % 3 === 0 ? `Storgata ${i + 1}\n0155 Oslo` : `Kirkeveien ${i + 1}, Oslo`
        }));

        const { datasource, gridInterface } = mountGrid(ui.gridHost, config, rows, {
            fields: {
                ...baseFields(),
                notes: { label: 'Notes', multiline: true, validate: [{ id: 'maxLength', value: 120 }] }
            }
        });

        let readonly = false;
        ui.button('Toggle readonly', () => {
            readonly = !readonly;
            gridInterface.updateConfig({ readonly });
            ui.log(`grid readonly: ${readonly}`);
        });
        ui.button('Show the notes of the current row', () => {
            // the text as it is stored: the editor saves its line breaks as \n
            ui.log(JSON.stringify(datasource.currentEntity?.notes ?? null));
        });
        ui.button('Undo', () => datasource.undo());

        // the sizes: rows as high as their notes need, columns as wide as their content
        ui.button('fitRows()', () => gridInterface.fitRows());
        ui.button('resetRowHeights()', () => gridInterface.resetRowHeights());
        ui.button('fitColumns()', () => gridInterface.fitColumns());
        ui.button('resetColumnWidths()', () => gridInterface.resetColumnWidths());
    }
};
