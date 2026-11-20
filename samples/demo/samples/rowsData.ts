import { baseGridConfig, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

export const rowsData: DemoSample = {
    id: 'rows-data',
    title: 'Add & remove rows',
    group: 'Datasource',
    description:
        'setData() replaces the data, setData(rows, { add: true }) appends. removeData() removes entities for real (unlike markForDeletion, which only flags them), removeAllData() removes every row. getAllData() is everything in the container, getRows() is the current filtered/sorted view and getDataRows() the same without the group rows.',
    code: `
// replace all data
datasource.setData(rows);

// append instead of replace
datasource.setData(moreRows, { add: true });

// remove entities for real (no undo, unlike markForDeletion)
datasource.removeData(datasource.getSelectedRows());
datasource.removeAllData(); // every row

datasource.length(); // rows in current (filtered) view
datasource.getAllData(); // everything in the data container
datasource.getRows(); // current view, sorted/filtered/grouped - with the group rows, see isGroupRow()
datasource.getDataRows(); // current view, data rows only
`,
    run(stage) {
        const ui = createStage(stage);
        const { datasource } = mountGrid(ui.gridHost, baseGridConfig(), generateRows(10));
        datasource.setSelectionMode('multiple');

        ui.button('Replace with 10 rows', () => {
            datasource.setData(generateRows(10));
            ui.log('setData -> ' + datasource.length() + ' rows');
        });
        ui.button('Replace with 500 rows', () => {
            datasource.setData(generateRows(500));
            ui.log('setData -> ' + datasource.length() + ' rows');
        });
        ui.button('Append 10 rows', () => {
            datasource.setData(generateRows(10), { add: true });
            ui.log('setData(rows, { add: true }) -> ' + datasource.length() + ' rows');
        });
        ui.button('Remove selected rows', () => {
            const selected = datasource.getSelectedRows();
            datasource.removeData(selected);
            ui.log('removed ' + selected.length + ' rows -> ' + datasource.length() + ' left');
        });
        ui.button('Remove all rows', () => {
            const removed = datasource.removeAllData();
            ui.log(`removeAllData() -> removed ${removed.length} rows`);
        });
        ui.button('Row count', () => {
            const view = datasource.length();
            const dataRows = datasource.getDataRows().length;
            ui.log(`view: ${view} rows (${dataRows} data rows), container: ${datasource.getAllData().length} rows`);
        });
    }
};
