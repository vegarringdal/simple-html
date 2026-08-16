import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const filterOperatorHeader: DemoSample = {
    id: 'filter-operator-header',
    title: 'Filter operator in header',
    group: 'Events',
    description:
        'Right-click a filter cell (the row under the headers) and pick an operator under "Set Operator" (equal/contains for text, greater/less than for numbers and dates). The grid fires a filter-operator-change event with the cell config and a rebuildHeaderColumns helper, so you can e.g. write the active operator into the filter placeholder as feedback.',
    code: `
gridInterface.addEventListener({
    handleEvent: (e) => {
        if (e.type === 'filter-operator-change') {
            // show the active operator as the filter placeholder
            e.data.cellConfig.placeHolderFilter = e.data.cellConfig.operator;
            // and rerender the header row
            e.data.rebuildHeaderColumns(e.data.ctx);
        }
        return true; // keep subscribing
    }
});
`,
    run(stage) {
        const ui = createStage(stage);
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        gridInterface.addEventListener({
            handleEvent: (e: any) => {
                if (e.type === 'filter-operator-change') {
                    e.data.cellConfig.placeHolderFilter = e.data.cellConfig.operator;
                    e.data.rebuildHeaderColumns(e.data.ctx);
                    ui.log(e.data.cellConfig.attribute + ' operator -> ' + e.data.cellConfig.operator);
                }
                return true;
            }
        });

        ui.log('right-click a filter cell and pick an operator');
    }
};
