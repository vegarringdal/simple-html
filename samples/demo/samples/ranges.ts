// ranges of cells, copy and paste like a spreadsheet: getRanges(), setRanges(), the range-change event.
// The column numbers select columns: getSelectedColumns(), selectColumns(), column-selection-change
import type { CellRange, GridConfig } from '@simple-html/grid';
import { baseFields, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const ranges: DemoSample = {
    id: 'ranges',
    title: 'Ranges & clipboard',
    group: 'Editing',
    description:
        'Drag over the cells to select a range: across the pinned columns, and a column of two fields is two columns. Shift+click extends it from the active cell (the one with the focus), Ctrl+click (Cmd on a Mac) adds another range, Alt+Shift+arrows extend it from the keyboard - Shift+PageDown a page, Ctrl+Shift+End to the last cell, Alt+Shift+End to the end of the row, Ctrl+Shift+ArrowDown to the edge of the data - Esc clears it. Ctrl+C copies the range as tab separated text - paste it into Excel or Google Sheets - and Ctrl+V pastes cells copied there (or here) from the top left of the range: one value fills the whole range. Delete clears it. Readonly cells are skipped (country is readonly here), and a paste or a clear is one Ctrl+Z. The footer sums up the selected cells at its right: count, sum, average, min and max. Ctrl+D fills the range down from its top row, and the small square at its bottom right corner drags down to fill more rows. A plain click, typing or moving to another cell clears the ranges; so do a filter, a sort and moving a column. The right click menu has Copy / Paste / Clear range too. The numbers under the header filters select columns: a click one, Ctrl+click (Cmd) one more or less, Shift+click the ones between - across the pinned columns, and a column of two fields is one number. Right click a number (or Shift+F10 on it) to copy the column, the selected columns or the header names; Ctrl+C on a number copies the selected columns, Esc selects none. Moving or hiding a column clears the selected columns.',
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
        // the columns selected with the numbers under the header filters
        gridInterface.on('column-selection-change', ({ columns, fields }) => {
            ui.log(
                columns.length
                    ? `column-selection-change: ${columns.join(', ')} (${fields.join(', ')})`
                    : 'column-selection-change: none'
            );
        });
        ui.button('Select columns 2-3', () => gridInterface.selectColumns([2, 3]));
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
