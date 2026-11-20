import { baseGridConfig, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

export const rowsData: DemoSample = {
    id: 'rows-data',
    title: 'Add & remove rows',
    group: 'Datasource',
    description:
        'setData() replaces the data, setData(rows, true) appends. removeData() removes entities for real (unlike markForDeletion, which only flags them). getAllData() is everything in the container, getRows() is the current filtered/sorted view.',
    code: `
// replace all data
datasource.setData(rows);

// append instead of replace
datasource.setData(moreRows, true);

// remove entities for real (no undo, unlike markForDeletion)
datasource.removeData(datasource.getSelectedRows());

datasource.length(); // rows in current (filtered) view
datasource.getAllData(); // everything in the data container
datasource.getRows(); // current view, sorted/filtered/grouped
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
            datasource.setData(generateRows(10), true);
            ui.log('setData(rows, true) -> ' + datasource.length() + ' rows');
        });
        ui.button('Remove selected rows', () => {
            const selected = datasource.getSelectedRows();
            datasource.removeData(selected);
            ui.log('removed ' + selected.length + ' rows -> ' + datasource.length() + ' left');
        });
        ui.button('Row count', () => {
            ui.log('view: ' + datasource.length() + ' rows, container: ' + datasource.getAllData().length + ' rows');
        });
    }
};
