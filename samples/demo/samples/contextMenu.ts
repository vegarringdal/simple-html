import { baseGridConfig, createStage, type DemoSample, FRUITS, mountGrid } from '../demoUtils';

export const contextMenu: DemoSample = {
    id: 'context-menu',
    title: 'Custom cell menu',
    group: 'Editing',
    description:
        'contextMenuCustom() opens the built-in menu widget with your own items. Here it acts as a value picker: click a cell in the fruit column and pick a value.',
    code: `
gridInterface.on('cell-click', (data) => {
    if (data.attribute === 'favoriteFruit') {
        gridInterface.contextMenuCustom(
            data.originalEvent,
            [
                { value: '', label: 'Pick a fruit', isHeader: true },
                { value: 'Apple', label: 'Apple', isHeader: false },
                { value: 'Banana', label: 'Banana', isHeader: false },
                { value: 'Cherry', label: 'Cherry', isHeader: false }
            ],
            data.cell,
            (result) => {
                data.rowData[data.attribute] = result;
                gridInterface.triggerScrollEvent(); // rerender rows
            }
        );
    }
});
`,
    run(stage) {
        const ui = createStage(stage);
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        gridInterface.on('cell-click', (data) => {
            if (data.attribute === 'favoriteFruit') {
                const items = [{ value: '', label: 'Pick a fruit', isHeader: true }].concat(
                    FRUITS.map((fruit) => {
                        return { value: fruit, label: fruit, isHeader: false };
                    })
                );
                gridInterface.contextMenuCustom(data.originalEvent, items, data.cell, (result: string) => {
                    data.rowData[data.attribute] = result;
                    gridInterface.triggerScrollEvent();
                    ui.log('picked: ' + result);
                });
            }
        });

        ui.log('click a cell in the fruit column to open the picker');
    }
};
