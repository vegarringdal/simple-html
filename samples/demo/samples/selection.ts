import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const selection: DemoSample = {
    id: 'selection',
    title: 'Selection',
    group: 'Datasource',
    description:
        'Click rows to select (ctrl/shift-click for multi select in multiple mode). The datasource exposes the same operations from code, plus getSelectedRows() to read the current selection.',
    run(stage) {
        const ui = createStage(stage);
        const { datasource } = mountGrid(ui.gridHost, baseGridConfig());
        datasource.setSelectionMode('multiple'); // 'none' | 'single' | 'multiple'

        ui.button('Select all', () => {
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
