import type { GridConfig } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const cellStyling: DemoSample = {
    id: 'cell-styling',
    title: 'Cell styling & readonly',
    group: 'Formatting',
    description:
        'cellClass in the config adds css classes to a cell from its row - here balance cells get a red/green tint by value. isReadonly does the same for readonly - here company becomes readonly on inactive rows. Both are called per cell when it is rendered; updateConfig() sets or removes them while the grid is shown.',
    code: `
/* the background class goes on the element behind the cell's input, give it a size:
.cell-low {
    position: absolute;
    inset: 0;
    background: rgba(239, 68, 68, 0.22);
    pointer-events: none;
}
*/

const gridConfig: GridConfig = {
    readonly: false,
    layout: { center: [ ... ] },

    // color cells based on row values: input is a class on the cell's input (the text),
    // background one on the element behind it. null: no classes
    cellClass: (row, field) => {
        if (field === 'balance' && row.balance < 500) {
            return { background: 'cell-low' };
        }
        if (field === 'balance' && row.balance > 2500) {
            return { background: 'cell-high' };
        }
        return null;
    },

    // readonly based on row values. null: the column config decides (readonlyByConfig)
    isReadonly: (row, field, readonlyByConfig) => {
        if (field === 'company' && row.isActive === false) {
            return true;
        }
        return null;
    }
};

const gridInterface = createGrid(container, { config: gridConfig, datasource });

// set or remove them while the grid is shown - undefined removes a callback
gridInterface.updateConfig({ cellClass: undefined });
gridInterface.updateConfig({ isReadonly: undefined });

// what a callback reads changed, without the grid knowing: render the cells again
gridInterface.refresh();
`,
    run(stage) {
        const ui = createStage(stage);
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        const balanceColors: GridConfig['cellClass'] = (row, field) => {
            if (field === 'balance') {
                if (row.balance < 500) {
                    return { background: 'demo-cell-low' };
                }
                if (row.balance > 2500) {
                    return { background: 'demo-cell-high' };
                }
            }
            return null;
        };

        ui.button('Color balance cells', () => {
            gridInterface.updateConfig({ cellClass: balanceColors });
        });
        ui.button('Remove coloring', () => {
            // no extra classes, same as no callback
            gridInterface.updateConfig({ cellClass: undefined });
        });
        ui.button('Readonly company when inactive', () => {
            gridInterface.updateConfig({
                isReadonly: (row, field) => (field === 'company' && row.isActive === false ? true : null)
            });
            ui.log('company cells on rows with active=false are now readonly (dimmed)');
        });
        ui.button('Remove readonly rule', () => {
            // the column config decides again, same as a callback that returns null
            gridInterface.updateConfig({ isReadonly: undefined });
        });
    }
};
