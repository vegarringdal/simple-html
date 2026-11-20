import { baseGridConfig, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

export const rowsData: DemoSample = {
    id: 'rows-data',
    title: 'Add & remove rows',
    group: 'Datasource',
    description:
        'setData() replaces the data, setData(rows, { add: true }) appends. A filter that is set applies to the new rows; { refilter: false } shows them all (type in a header filter, then append). "Delete selected" marks the rows for deletion (markForDeletion): they stay, with a struck through row number, until the changes are saved - so "Undo delete" can take the mark off. removeData() and removeAllData() remove rows for good, without tracking: getChanges() does not list them. Use them for rows that never came from a server. getAllData() is everything in the container, getRows() is the current filtered/sorted view and getDataRows() the same without the group rows.',
    run(stage) {
        const ui = createStage(stage);
        const { datasource } = mountGrid(ui.gridHost, baseGridConfig(), generateRows(10));

        // setData() replaces all data. A filter that is set runs on the new rows
        ui.button('Replace with 10 rows', () => {
            datasource.setData(generateRows(10));
            ui.log('setData -> ' + datasource.length() + ' rows');
        });
        ui.button('Replace with 500 rows', () => {
            datasource.setData(generateRows(500));
            ui.log('setData -> ' + datasource.length() + ' rows');
        });
        // add: true appends instead
        ui.button('Append 10 rows', () => {
            datasource.setData(generateRows(10), { add: true });
            ui.log('setData(rows, { add: true }) -> ' + datasource.length() + ' rows');
        });
        // refilter: false shows the new rows also when the filter leaves them out
        ui.button('Append 10, refilter: false', () => {
            datasource.setData(generateRows(10), { add: true, refilter: false });
            ui.log('setData(rows, { add: true, refilter: false }) -> ' + datasource.length() + ' rows');
        });
        // deleting is a tag: the rows are marked, getChanges() lists them for the server, and the
        // mark can be taken off again
        ui.button('Delete selected', () => {
            const selected = datasource.getSelectedRows();
            datasource.markForDeletion(selected);
            ui.log(`markForDeletion() -> ${datasource.getMarkedForDeletion().length} rows marked`);
        });
        ui.button('Undo delete', () => {
            datasource.unmarkForDeletion(datasource.getSelectedRows());
            ui.log(`unmarkForDeletion() -> ${datasource.getMarkedForDeletion().length} rows marked`);
        });
        // removes rows for good, without tracking: no undo, not in getChanges(). For rows that
        // never came from a server
        ui.button('Remove selected (untracked)', () => {
            const selected = datasource.getSelectedRows();
            datasource.removeData(selected);
            ui.log(`removeData() -> removed ${selected.length} rows, ${datasource.length()} left`);
        });
        ui.button('Remove all (untracked)', () => {
            const removed = datasource.removeAllData();
            ui.log(`removeAllData() -> removed ${removed.length} rows`);
        });
        // length(): the rows in the current (filtered) view. getAllData(): everything in the data
        // container. getRows(): the current view, sorted/filtered/grouped - with the group rows,
        // see isGroupRow(). getDataRows(): the current view, data rows only
        ui.button('Row count', () => {
            const view = datasource.length();
            const dataRows = datasource.getDataRows().length;
            ui.log(`view: ${view} rows (${dataRows} data rows), container: ${datasource.getAllData().length} rows`);
        });
    }
};
