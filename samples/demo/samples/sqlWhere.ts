import { and, type FilterExpression, where } from '@simple-html/grid';
import { type SqlDialect, type SqlOptions, toSqlWhere } from '@simple-html/grid/sql';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

/**
 * The whitelist a backend gives toSqlWhere: each field of the grid a filter may use, its column and its
 * type. A field that is not here throws - in this sample the phone column, try a filter on it.
 */
const COLUMNS: SqlOptions['columns'] = {
    company: 'company_name',
    country: 'country',
    age: { column: 'age', type: 'number' },
    balance: { column: 'balance', type: 'number' },
    date1: { column: 'date1', type: 'date' },
    isActive: { column: 'is_active', type: 'boolean' },
    favoriteFruit: 'favorite_fruit'
};

const DIALECTS: SqlDialect[] = ['postgres', 'oracle', 'sqlite', 'mssql'];

export const sqlWhere: DemoSample = {
    id: 'sql',
    title: 'SQL from the filter',
    group: 'Datasource',
    description:
        'The grid filters in the browser; a backend that loads only the rows it lets through needs the filter as SQL. toSqlWhere() from @simple-html/grid/sql turns datasource.getFilter() - sent to the backend as JSON - into the condition of a WHERE and its parameters, for PostgreSQL, Oracle, SQLite and SQL Server: no value is ever in the SQL, only placeholders, and a field that is not in the columns it is given throws. Filter in the header, the menus or the filter editor: the WHERE below follows. Find (Ctrl+F in the grid) with its funnel, Filter rows, on is ANDed to it: gridInterface.getFindFilter() - a text field CONTAINS the text as it is (literal: 50% is no wildcard), with Aa (Match case) caseSensitive; a number EQUAL the number the text is, a date the day. The dates are read in the time zone of this browser, as the grid reads them.',
    run(stage) {
        const ui = createStage(stage);
        const { datasource, gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        // the output: one block for each dialect
        const output = document.createElement('div');
        output.className = 'demo-sql';
        stage.appendChild(output);

        // the user's time zone: the backend gets it with the filter
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const show = () => {
            // Find's "Filter rows" as a filter, on the fields the backend has columns for (not the phone):
            // null while it shows every row
            const find = gridInterface.getFindFilter({ fields: Object.keys(COLUMNS) });
            // what the browser would send: the filter AND the find, as JSON - an empty AND is no filter
            const parts = [datasource.getFilter(), find].filter((part): part is FilterExpression => part !== null);
            const filter = JSON.parse(JSON.stringify(and(...parts)));
            const findNote = find ? `\n(with Find's Filter rows: "${gridInterface.getFind().text}")` : '';
            output.replaceChildren(
                ...DIALECTS.map((dialect) => {
                    const block = document.createElement('pre');
                    block.className = 'demo-sql-block';
                    try {
                        const { sql, params } = toSqlWhere(filter, { dialect, columns: COLUMNS, timeZone });
                        block.textContent = `${dialect}${findNote}\nWHERE ${sql}\nparams: ${JSON.stringify(params)}`;
                    } catch (error) {
                        // a field that is not in the columns, a filter over a limit: a 400 in a backend
                        block.textContent = `${dialect}\n${(error as Error).message}`;
                    }
                    return block;
                })
            );
        };
        datasource.on('collection-filtered', show);
        // the rows Find's "Filter rows" shows changed: on, off, the text, Match case
        gridInterface.on('find-filter-change', show);
        show();

        ui.button('Norway, age 30-40', () => {
            datasource.filter(and(where('country', 'EQUAL', 'Norway'), where('age', 'BETWEEN', [30, 40])));
        });
        ui.button('company starts with "a", not active', () => {
            datasource.filter(and(where('company', 'BEGIN_WITH', 'a'), where('isActive', 'EQUAL', false)));
        });
        ui.button('fruit in a list, or blank', () => {
            datasource.filter(where('favoriteFruit', 'IN', ['Apple', 'Mango', 'NULL']));
        });
        ui.button('date in March', () => {
            datasource.filter(where('date1', 'BETWEEN', [new Date(2026, 2, 1), new Date(2026, 2, 31)]));
        });
        ui.button('hostile text', () => {
            // only a parameter: the SQL is the same as for any other text
            datasource.filter(where('company', 'EQUAL', "'; DROP TABLE customer; --"));
        });
        ui.button('phone (not a column)', () => {
            datasource.filter(where('phone', 'CONTAINS', '47'));
        });
        ui.button('Clear filter', () => {
            datasource.filter(null);
        });
        // as typing in the find bar (Ctrl+F) with its funnel, Filter rows, on - and Aa, Match case
        ui.button('Find "acme", Filter rows', () => {
            gridInterface.find('acme', { filterRows: true, caseSensitive: false });
        });
        ui.button('Find "ACME" (match case), Filter rows', () => {
            gridInterface.find('ACME', { filterRows: true, caseSensitive: true });
        });
        // as Find takes it: 50% is the text 50%, no wildcard - the SQL escapes the %
        ui.button('Find "50%", Filter rows', () => {
            gridInterface.find('50%', { filterRows: true, caseSensitive: false });
        });
        ui.button('Find "30", Filter rows', () => {
            gridInterface.find('30', { filterRows: true, caseSensitive: false });
        });
        ui.button('Close find', () => {
            gridInterface.closeFind();
        });
        ui.button('Open filter editor', () => {
            gridInterface.openFilterEditor();
        });
    }
};
