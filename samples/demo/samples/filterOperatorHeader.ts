import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const filterOperatorHeader: DemoSample = {
    id: 'filter-operator-header',
    title: 'Filter operator in header',
    group: 'Events',
    description:
        'Right-click a filter cell (the row under the headers) and pick an operator under "Set Operator" (equal/contains for text, greater/less than for numbers and dates). The grid fires a filter-operator-change event with the cell config and a rebuildHeader() helper, so you can e.g. write the active operator into the filter placeholder as feedback.',
    code: `
gridInterface.on('filter-operator-change', (data) => {
    // show the active operator as the filter placeholder
    data.cellConfig.placeHolderFilter = data.cellConfig.operator;
    // and rerender the header row
    data.rebuildHeader();
});
`,
    run(stage) {
        const ui = createStage(stage);
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        gridInterface.on('filter-operator-change', (data) => {
            data.cellConfig.placeHolderFilter = data.cellConfig.operator;
            data.rebuildHeader();
            ui.log(data.cellConfig.attribute + ' operator -> ' + data.cellConfig.operator);
        });

        ui.log('right-click a filter cell and pick an operator');
    }
};
