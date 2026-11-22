import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const filterOperatorHeader: DemoSample = {
    id: 'filter-operator-header',
    title: 'Filter operator in header',
    group: 'Events',
    description:
        'Click the operator symbol in a filter cell (the row under the headers: = on the right of a text filter, ≥ on the left of a number or date filter; F4 from the keyboard), or right-click the cell and pick an operator under "Filter › Operator ›" (the operators of the column\'s type: equal, contains, begins with ... for text, less/greater than and between - typed as 10..20 - for numbers and dates; a text column has "Match case" next to it). The grid fires a filter-operator-change event with the field, the operator, the column\'s options and a rebuildHeader() helper (to change the column, e.g. its placeholderFilter, and show it) - here it is logged. The operator picked is state: getState().headerFilters has it, columns[field].operator in the config is only the one a header filter starts with.',
    run(stage) {
        const ui = createStage(stage);
        const config = baseGridConfig();
        // the operator a header filter starts with is config
        config.columns = { company: { operator: 'CONTAINS' } };
        const { gridInterface } = mountGrid(ui.gridHost, config);

        gridInterface.on('filter-operator-change', (data) => {
            // the cell shows the operator itself (the symbol); data.column and data.rebuildHeader() are there to
            // change the column on a change, e.g. data.column.placeholderFilter = '...'; data.rebuildHeader();
            ui.log(data.field + ' operator -> ' + data.operator);
            // the one picked is state
            ui.log(`headerFilters: ${JSON.stringify(gridInterface.getState().headerFilters)}`);
        });

        ui.log('click the operator symbol in a filter cell (or right-click the cell) and pick an operator');
    }
};
