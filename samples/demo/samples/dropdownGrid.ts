import { Datasource, registerLookup } from '@simple-html/grid';
import { baseGridConfig, COMPANIES, COUNTRIES, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const dropdownGrid: DemoSample = {
    id: 'dropdown-grid',
    title: 'Grid as dropdown',
    group: 'Editing',
    description:
        'The company column picks its value from a grid: editor: { type: "grid", lookup: "companies" }, a lookup registered with registerLookup(). Click the button at the right of a company cell, or press Alt+ArrowDown, F4 or Space in it - or just type: the dropdown grid opens with the text in its filter, which searches as you type. Enter picks the first row found, ArrowDown goes to it and the arrows move between the rows, Enter or a click on a row picks it, Esc closes the dropdown. A pick is one step of the undo history: Ctrl+Z. The lookups guide has the select, the options and the do-it-yourself way with focusButton and openMenu().',
    run(stage) {
        const ui = createStage(stage);

        // the rows to pick from, with a column more than the cell shows
        const companies = new Datasource();
        companies.setData(COMPANIES.map((company, i) => ({ company, country: COUNTRIES[i % COUNTRIES.length] })));
        registerLookup('companies', {
            datasource: companies,
            valueField: 'company',
            config: {
                layout: {
                    center: [
                        { fields: ['company'], width: 170 },
                        { fields: ['country'], width: 100 }
                    ]
                }
            }
        });

        const config = baseGridConfig();
        config.columns = { company: { editor: { type: 'grid', lookup: 'companies' } } };
        const { datasource } = mountGrid(ui.gridHost, config);

        datasource.on('rows-changed', ({ rows, fields }) => {
            for (const row of rows) {
                if (fields.get(row)?.has('company')) {
                    ui.log(`picked: ${row.company}`);
                }
            }
        });
        ui.log('click a company cell, then the button at its right - or type in the cell');
    }
};
