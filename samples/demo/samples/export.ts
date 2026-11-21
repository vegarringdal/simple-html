// gridInterface.getCsv(options) gives the rows as CSV text, downloadCsv(filename, options) saves them as a file
import type { CsvOptions, GridConfig } from '@simple-html/grid';
import { baseFields, baseGridConfig, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

export const exportCsv: DemoSample = {
    id: 'export',
    title: 'Export to CSV',
    group: 'Export',
    description:
        "getCsv() gives the rows as CSV text, downloadCsv() saves them as a file (with a BOM, so Excel reads æøå). By default it is what the grid shows: the rows the filter lets through, sorted (when grouped every data row, collapsed groups too), the columns of the layout in their order, each value as the cell shows it. Filter, sort, group or select rows and export again. Use the ; separator for Excel in a locale with a decimal comma, like Norwegian. The first company starts with = : it is written with a ' in front, so a spreadsheet does not run it as a formula.",
    run(stage) {
        const ui = createStage(stage);

        // company pinned left, the rest in the center: the export follows the order the user sees
        const config: GridConfig = baseGridConfig();
        config.layout.left = config.layout.center.splice(0, 1);

        const rows = generateRows();
        // a value a user typed that a spreadsheet would run as a formula
        rows[0].company = '=HYPERLINK("http://example.com","click me")';

        // balance with a decimal comma: 1234,5 is quoted with the ',' separator, not with ';'
        const { gridInterface, datasource } = mountGrid(ui.gridHost, config, rows, {
            fields: { ...baseFields(), balance: { type: 'number', formatter: 'numberComma' } }
        });

        // the options both the preview and the downloads use
        const options: CsvOptions = { separator: ',', formatted: true };

        // the first lines of getCsv(), under the toolbar
        const preview = document.createElement('pre');
        preview.className = 'demo-log';
        preview.style.margin = '0 0 10px';
        preview.style.height = '150px';
        stage.insertBefore(preview, ui.gridHost);

        const showPreview = () => {
            const lines = gridInterface.getCsv(options).split('\r\n').slice(0, -1);
            const more = lines.length > 12 ? `\n... ${lines.length - 12} more lines` : '';
            preview.textContent = `getCsv(${JSON.stringify(options)}):\n${lines.slice(0, 12).join('\n')}${more}`;
        };
        showPreview();

        // the rows changed: filtered, sorted, grouped, edited
        for (const event of ['collection-filtered', 'collection-sorted', 'collection-grouped', 'collection-changed'] as const) {
            datasource.on(event, showPreview);
        }
        datasource.on('history-changed', showPreview);

        ui.button('Download CSV (all rows)', () => {
            gridInterface.downloadCsv('export.csv', options);
        });
        ui.button('Download CSV (selected rows)', () => {
            // the selected rows that are displayed, in the order of the grid
            gridInterface.downloadCsv('selected.csv', { ...options, rows: 'selected' });
        });
        const separatorButton = ui.button('Separator: , (use ;)', () => {
            options.separator = options.separator === ',' ? ';' : ',';
            separatorButton.textContent = options.separator === ',' ? 'Separator: , (use ;)' : 'Separator: ; (use ,)';
            showPreview();
        });
        const formattedButton = ui.button('Values: formatted (use raw)', () => {
            // raw: numbers with a dot, dates as ISO strings (UTC), booleans as true/false
            options.formatted = !options.formatted;
            formattedButton.textContent = options.formatted ? 'Values: formatted (use raw)' : 'Values: raw (use formatted)';
            showPreview();
        });
        ui.button('Refresh preview', () => {
            // moving, hiding or pinning a column sends no event of the datasource
            showPreview();
        });
    }
};
