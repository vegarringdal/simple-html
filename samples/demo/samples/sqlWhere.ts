import { and, where } from '@simple-html/grid';
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
        'The grid filters in the browser; a backend that loads only the rows it lets through needs the filter as SQL. toSqlWhere() from @simple-html/grid/sql turns datasource.getFilter() - sent to the backend as JSON - into the condition of a WHERE and its parameters, for PostgreSQL, Oracle, SQLite and SQL Server: no value is ever in the SQL, only placeholders, and a field that is not in the columns it is given throws. Filter in the header, the menus or the filter editor: the WHERE below follows. Find (Ctrl+F in the grid) is not in it: its Filter rows filters the rows in the browser, also the rows loaded after. The dates are read in the time zone of this browser, as the grid reads them.',
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
            // what the browser would send: the filter as JSON
            const filter = JSON.parse(JSON.stringify(datasource.getFilter()));
            output.replaceChildren(
                ...DIALECTS.map((dialect) => {
                    const block = document.createElement('pre');
                    block.className = 'demo-sql-block';
                    try {
                        const { sql, params } = toSqlWhere(filter, { dialect, columns: COLUMNS, timeZone });
                        block.textContent = `${dialect}\nWHERE ${sql}\nparams: ${JSON.stringify(params)}`;
                    } catch (error) {
                        // a field that is not in the columns, a filter over a limit: a 400 in a backend
                        block.textContent = `${dialect}\n${(error as Error).message}`;
                    }
                    return block;
                })
            );
        };
        datasource.on('collection-filtered', show);
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
        // Find's Filter rows filters the rows in the browser: the SQL stays as it is
        ui.button('Find "acme", Filter rows', () => {
            gridInterface.find('acme', { filterRows: true, caseSensitive: false });
        });
        ui.button('Close find', () => {
            gridInterface.closeFind();
        });
        ui.button('Open filter editor', () => {
            gridInterface.openFilterEditor();
        });
    }
};
