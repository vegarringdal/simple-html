import { baseGridConfig, createStage, type DemoSample, FRUITS, mountGrid } from '../demoUtils';

export const contextMenu: DemoSample = {
    id: 'context-menu',
    title: 'Custom cell menu',
    group: 'Editing',
    description:
        'contextMenuCustom() opens the built-in menu widget with your own items. Here it acts as a value picker: click a cell in the fruit column and pick a value.',
    code: `
gridInterface.addEventListener({
    handleEvent: (e) => {
        if (e.type === 'cell-click' && e.data.attribute === 'favoriteFruit') {
            gridInterface.contextMenuCustom(
                e.data.originalEvent,
                [
                    { value: '', label: 'Pick a fruit', isHeader: true },
                    { value: 'Apple', label: 'Apple', isHeader: false },
                    { value: 'Banana', label: 'Banana', isHeader: false },
                    { value: 'Cherry', label: 'Cherry', isHeader: false }
                ],
                e.data.cell,
                (result) => {
                    datasource.currentEntity[e.data.attribute] = result;
                    gridInterface.triggerScrollEvent(); // rerender rows
                    return true;
                }
            );
        }
        return true; // keep subscribing
    }
});
`,
    run(stage) {
        const ui = createStage(stage);
        const { datasource, gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        gridInterface.addEventListener({
            handleEvent: (e: any) => {
                if (e.type === 'cell-click' && e.data.attribute === 'favoriteFruit') {
                    const items = [{ value: '', label: 'Pick a fruit', isHeader: true }].concat(
                        FRUITS.map((fruit) => {
                            return { value: fruit, label: fruit, isHeader: false };
                        })
                    );
                    gridInterface.contextMenuCustom(e.data.originalEvent, items, e.data.cell, (result: string) => {
                        datasource.currentEntity[e.data.attribute] = result;
                        gridInterface.triggerScrollEvent();
                        ui.log('picked: ' + result);
                        return true;
                    });
                }
                return true;
            }
        });

        ui.log('click a cell in the fruit column to open the picker');
    }
};
