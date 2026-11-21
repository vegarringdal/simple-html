import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const filterOperatorHeader: DemoSample = {
    id: 'filter-operator-header',
    title: 'Filter operator in header',
    group: 'Events',
    description:
        'Right-click a filter cell (the row under the headers) and pick an operator under "Filter › Operator ›" (equal/contains for text, greater/less than for numbers and dates). The grid fires a filter-operator-change event with the field, the operator, the column\'s options and a rebuildHeader() helper, so you can e.g. write the active operator into the filter placeholder as feedback. The operator picked is state: getState().headerFilters has it, columns[field].operator in the config is only the one a header filter starts with.',
    run(stage) {
        const ui = createStage(stage);
        const config = baseGridConfig();
        // the operator a header filter starts with is config
        config.columns = { company: { operator: 'CONTAINS' } };
        const { gridInterface } = mountGrid(ui.gridHost, config);

        gridInterface.on('filter-operator-change', (data) => {
            // show the active operator as the filter placeholder, and render the header row again
            data.column.placeholderFilter = data.operator;
            data.rebuildHeader();
            ui.log(data.field + ' operator -> ' + data.operator);
            // the one picked is state
            ui.log(`headerFilters: ${JSON.stringify(gridInterface.getState().headerFilters)}`);
        });

        ui.log('right-click a filter cell and pick an operator');
    }
};
