// ranges of cells, copy and paste like a spreadsheet: getRanges(), setRanges(), the range-change event
import type { CellRange, GridConfig } from '@simple-html/grid';
import { baseFields, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const ranges: DemoSample = {
    id: 'ranges',
    title: 'Ranges & clipboard',
    group: 'Editing',
    description:
        'Drag over the cells to select a range: across the pinned columns, and a column of two fields is two columns. Shift+click extends it from the active cell (the one with the focus), Ctrl+click (Cmd on a Mac) adds another range, Alt+Shift+arrows extend it from the keyboard, Esc clears it. Ctrl+C copies the range as tab separated text - paste it into Excel or Google Sheets - and Ctrl+V pastes cells copied there (or here) from the top left of the range: one value fills the whole range. Delete clears it. Readonly cells are skipped (country is readonly here), and a paste or a clear is one Ctrl+Z. A plain click, typing or moving to another cell clears the ranges; so do a filter, a sort and moving a column. The right click menu has Copy / Paste / Clear range too.',
    run(stage) {
        const ui = createStage(stage);
        const config: GridConfig = {
            panelHeight: 25,
            readonly: false,
            // country can not be edited: a paste or a clear skips it
            columns: { country: { readonly: true } },
            layout: {
                left: [{ fields: ['company'], width: 160 }],
                center: [
                    { fields: ['country'], width: 110 },
                    // two fields stacked: two columns of a range, name above age
                    { fields: ['phone', 'age'], width: 140 },
                    { fields: ['date1'], width: 110 },
                    { fields: ['isActive'], width: 70 },
                    { fields: ['favoriteFruit'], width: 110 }
                ],
                right: [{ fields: ['balance'], width: 110 }]
            }
        };
        const { gridInterface, datasource } = mountGrid(ui.gridHost, config, undefined, { fields: baseFields() });

        // what is selected: the last range is the one made last, its from is the active cell
        ui.log('drag over the cells, the ranges show here');
        const describe = (range: CellRange) => `rows ${range.fromRow}-${range.toRow}, ${range.fromField} to ${range.toField}`;
        gridInterface.on('range-change', ({ ranges }) => {
            ui.log(ranges.length ? `range-change: ${ranges.map(describe).join(' + ')}` : 'range-change: no ranges');
        });

        ui.button('Select rows 2-6, company to age', () => {
            gridInterface.setRanges([{ fromRow: 2, fromField: 'company', toRow: 6, toField: 'age' }]);
        });
        ui.button('Two ranges', () => {
            gridInterface.setRanges([
                { fromRow: 0, fromField: 'country', toRow: 3, toField: 'country' },
                { fromRow: 5, fromField: 'balance', toRow: 8, toField: 'date1' }
            ]);
        });
        ui.button('Clear ranges', () => gridInterface.clearRanges());
        ui.button('Log the range as CSV', () => {
            // the cells of the last range, with a header line: the export of the range
            ui.log(gridInterface.getCsv({ rows: 'range', separator: ';' }).trim() || 'no range');
        });
        const undoButton = ui.button('Undo', () => datasource.undo());
        const showHistory = () => {
            undoButton.disabled = !datasource.canUndo();
        };
        datasource.on('history-changed', showHistory);
        showHistory();
    }
};
