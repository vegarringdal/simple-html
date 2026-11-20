import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const selection: DemoSample = {
    id: 'selection',
    title: 'Selection',
    group: 'Datasource',
    description:
        'Click rows to select (ctrl/shift-click for multi select in multiple mode). The datasource exposes the same operations from code, plus getSelectedRows() to read the current selection.',
    code: `
datasource.setSelectionMode('multiple'); // 'none' | 'single' | 'multiple'

datasource.selectAll();
datasource.deselectAll();
datasource.selectFirst();
datasource.selectNext();
datasource.selectPrev();
datasource.selectLast();
datasource.select(5); // row index

const rows = datasource.getSelectedRows();
console.log(rows.length, 'rows selected');
`,
    run(stage) {
        const ui = createStage(stage);
        const { datasource } = mountGrid(ui.gridHost, baseGridConfig());
        datasource.setSelectionMode('multiple');

        ui.button('Select all', () => {
            datasource.selectAll();
        });
        ui.button('Deselect all', () => {
            datasource.deselectAll(true);
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
            datasource.select(5);
        });
        ui.button('getSelectedRows()', () => {
            const rows = datasource.getSelectedRows();
            ui.log(rows.length + ' rows selected' + (rows.length ? ', first: ' + (rows[0] as any).company : ''));
        });
    }
};
