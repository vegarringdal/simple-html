import { and, or, where } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const filtering: DemoSample = {
    id: 'filtering',
    title: 'Filtering',
    group: 'Datasource',
    description:
        'Users can type in the filter row under the headers, or use the built-in filter editor for advanced conditions. From code you build a filter with where(), and() and or() - a single condition, or AND/OR groups nested as deep as you need. A condition has no type of its own: the datasource takes it from its fields. The filter is plain data, getFilter() gives it back.',
    run(stage) {
        const ui = createStage(stage);
        const { datasource, gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        ui.button('balance > 2500', () => {
            // a single condition
            datasource.filter(where('balance', 'GREATER_THAN', 2500));
        });
        ui.button('Norway AND age < 30', () => {
            datasource.filter(and(where('country', 'EQUAL', 'Norway'), where('age', 'LESS_THAN', 30)));
        });
        ui.button('(Norway OR Sweden) AND from July', () => {
            // groups nest
            datasource.filter(
                and(
                    or(where('country', 'EQUAL', 'Norway'), where('country', 'EQUAL', 'Sweden')),
                    where('date1', 'GREATER_THAN_OR_EQUAL_TO', new Date(2026, 6, 1))
                )
            );
        });
        ui.button('Log the filter', () => {
            // the filter is plain data - typing in a header filter adds to it.
            // { field: 'balance', operator: 'GREATER_THAN', value: 2500 }
            ui.log(JSON.stringify(datasource.getFilter()));
            // ([BALANCE] <<GREATER_THAN>> '2500')
            ui.log(datasource.getFilterString() || '(no filter)');
        });
        ui.button('Clear filter', () => {
            datasource.filter(null);
        });
        // or let the user build it in the built-in dialog
        ui.button('Open filter editor', () => {
            gridInterface.openFilterEditor();
        });
    }
};
