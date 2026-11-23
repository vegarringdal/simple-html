// GridConfig.importMenu adds "Import rows…" to the header menu and "Paste › As new rows…" to the row menu:
// the import dialog. gridInterface.openImport(file or text) opens it from code, gridInterface.importRows()
// imports without it
import { Datasource, type GridConfig, GridInterface } from '@simple-html/grid';
import { baseFields, baseGridConfig, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

// a CSV file as Norwegian Excel saves it: semicolons, decimal commas, dates with dots - and rows with
// problems: a number that is no number, a negative age, a day that is not, a formula (it stays text)
const SAMPLE_CSV = [
    'company;country;age;balance;date;active;fruit',
    'Fjord AS;Norway;34;1 234,50;20.11.2026;true;Apple',
    'Nordlys;Sweden;abc;12,5;2026-01-31;false;Pear',
    '"=HYPERLINK(""http://example.com"")";Denmark;-3;0;31.02.2026;maybe;Mango',
    'Kyst og Fjell;Iceland;51;-7,25;01.03.2026;true;Cherry'
].join('\r\n');

// rows for the Excel file: written by the grid's own export (getExcel()), typed - numbers, dates, booleans
const EXCEL_ROWS = [
    {
        company: 'Excel Import 1',
        country: 'Finland',
        age: 28,
        balance: 99.5,
        date1: new Date(2026, 4, 17),
        isActive: true,
        favoriteFruit: 'Banana'
    },
    {
        company: 'Excel Import 2',
        country: 'Germany',
        age: 63,
        balance: 1500,
        date1: new Date(1990, 11, 31),
        isActive: false,
        favoriteFruit: 'Orange'
    }
];

/** a file to download: the browser saves it as from a link */
function download(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 40_000);
}

export const importRows: DemoSample = {
    id: 'import',
    title: 'Import CSV and Excel',
    group: 'Export',
    description:
        'importMenu: true adds "Import rows…" to the header menu (right click a column label) and "Paste › As new rows…" to the row menu, in an editable grid where the user may add rows (edit.add). The dialog takes a CSV or Excel (.xlsx) file - picked, or dropped on it - or rows pasted from a spreadsheet: copy rows in Excel or Google Sheets, right click a cell, Paste › As new rows… (or paste them into the dialog with Ctrl+V). It shows the first rows with a field over each column - matched by the names of the header row, or by position from the cell you clicked - the problems it found (a number that is not a number, a day that is not, a validation rule: age is at least 0), and imports the rows as new rows, one step of Undo. The sample CSV is as Norwegian Excel saves it: semicolons, decimal commas, dates with dots. Try a sample file below, or download them and drop them on the dialog.',
    run(stage) {
        const ui = createStage(stage);
        const config: GridConfig = { ...baseGridConfig(), importMenu: true };
        const fields = {
            ...baseFields(),
            age: { type: 'number' as const, validate: [{ id: 'min', value: 0 }] },
            balance: { type: 'number' as const, formatter: 'numberComma' }
        };
        const { gridInterface, datasource } = mountGrid(ui.gridHost, config, generateRows(8), { fields });

        // the .xlsx file: a grid interface of its own, not on the page - getExcel() reads its config and rows
        const excelSource = new Datasource({ fields });
        excelSource.setData(EXCEL_ROWS);
        const excelFile = async () =>
            new File([await new GridInterface(baseGridConfig(), excelSource).getExcel()], 'sample.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
        const csvFile = () => new File([SAMPLE_CSV], 'sample.csv', { type: 'text/csv' });

        ui.button('Import rows…', () => gridInterface.openImport());
        ui.button('Try the sample CSV', () => gridInterface.openImport(csvFile()));
        ui.button('Try the sample Excel file', async () => gridInterface.openImport(await excelFile()));
        ui.button('Download the sample CSV', () => download(csvFile()));
        ui.button('Download the sample Excel file', async () => download(await excelFile()));
        ui.button('Copy two rows (as Excel does)', async () => {
            // tab separated, a line end after each row: what a spreadsheet puts on the clipboard
            await navigator.clipboard.writeText(
                'Copied AS\tSpain\t44\t10,5\t05.06.2026\ttrue\tPear\r\nCopied Two\tItaly\t19\t0\t2026-07-08\tfalse\tApple\r\n'
            );
            ui.log('two rows copied: right click a company cell, Paste › As new rows…');
        });
        ui.button('Undo', () => datasource.undo());

        datasource.on('collection-changed', ({ added }) => {
            if (added) {
                ui.log(`${datasource.getChanges().newEntities.length} new rows in all`);
            }
        });
    }
};
