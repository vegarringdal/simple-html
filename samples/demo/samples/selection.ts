import type { SelectionMode } from '@simple-html/grid';
import { baseFields, baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const selection: DemoSample = {
    id: 'selection',
    title: 'Selection',
    group: 'Datasource',
    description:
        'Click rows to select (ctrl/shift-click for multi select in multiple mode). The selection mode belongs to the datasource: set it in its options or with setSelectionMode(), the grid uses it. The datasource exposes the same operations from code, plus getSelectedRows() to read the current selection. Columns are selected in the grid, with the numbers under the header filters (click, Ctrl+click, Shift+click): gridInterface.getSelectedColumns(), see the Ranges & clipboard sample.',
    run(stage) {
        const ui = createStage(stage);
        // the datasource owns the selection mode, the grid has no option for it
        const { datasource } = mountGrid(ui.gridHost, baseGridConfig(), undefined, {
            fields: baseFields(),
            selectionMode: 'multiple' // the default. 'single' | 'none'
        });

        const modes: SelectionMode[] = ['multiple', 'single', 'none'];
        for (const mode of modes) {
            ui.button(`Mode: ${mode}`, () => {
                // the grid uses it from the next click on
                datasource.setSelectionMode(mode);
                ui.log(`getSelectionMode() -> ${datasource.getSelectionMode()}`);
            });
        }
        ui.button('Select all', () => {
            // 'multiple' only: in the other modes it selects nothing
            datasource.selectAll();
        });
        ui.button('Deselect all', () => {
            // notify: send selection-change, the grid redraws
            datasource.deselectAll({ notify: true });
        });
        ui.button('First', () => {
            datasource.selectFirst();
        });
        ui.button('Prev', () => {
            datasource.selectPrev();
        });
        ui.button('Next', () => {
            datasource.selectNext();
        });
        ui.button('Last', () => {
            datasource.selectLast();
        });
        ui.button('Select row 5', () => {
            // the 5th displayed row, it starts on 1. notify: and scroll the grid to it
            datasource.select(5, { notify: true });
        });
        ui.button('getSelectedRows()', () => {
            const rows = datasource.getSelectedRows();
            ui.log(rows.length + ' rows selected' + (rows.length ? ', first: ' + (rows[0] as any).company : ''));
        });
    }
};
