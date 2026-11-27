import type { GridHooks } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const cellStyling: DemoSample = {
    id: 'cell-styling',
    title: 'Cell styling & readonly',
    group: 'Formatting',
    description:
        'The cellClass hook adds css classes to a cell from its row - here balance cells get a red/green tint by value. The rowClass hook adds classes to a whole row, on its element in every section - here the inactive rows get a tint and italic text; edit active in a row and its look follows in the next frame. The isReadonly hook does the same for readonly - here company becomes readonly on inactive rows. Both are called per cell when it is rendered. Hooks are functions, so they are not part of the config (which stays plain JSON): give them to createGrid, and set or remove them with updateHooks() while the grid is shown.',
    run(stage) {
        const ui = createStage(stage);
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        // called per cell when it is rendered. input is a class on the cell's input (the text),
        // background one on the element behind it - that one has no size of its own, the css gives
        // it one (.demo-cell-low in index.css). null: no classes
        const balanceColors: GridHooks['cellClass'] = (row, field) => {
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

        // set or remove the hooks while the grid is shown, undefined removes one. The other hooks
        // stay as they are. When what a hook reads changes without the grid knowing,
        // gridInterface.refresh() renders the cells again
        ui.button('Color balance cells', () => {
            gridInterface.updateHooks({ cellClass: balanceColors });
        });
        ui.button('Remove coloring', () => {
            // no extra classes, same as a hook that returns null
            gridInterface.updateHooks({ cellClass: undefined });
        });
        // classes on a whole row, from its values: on the row element of every section (the row
        // number, pinned and middle columns). .demo-row-inactive in index.css
        ui.button('Mark inactive rows', () => {
            gridInterface.updateHooks({ rowClass: (row) => (row.isActive === false ? 'demo-row-inactive' : null) });
        });
        ui.button('Remove row marks', () => {
            gridInterface.updateHooks({ rowClass: undefined });
        });
        ui.button('Readonly company when inactive', () => {
            gridInterface.updateHooks({
                // readonly from the row. null: the column config decides
                isReadonly: (row, field) => (field === 'company' && row.isActive === false ? true : null)
            });
            ui.log('company cells on rows with active=false are now readonly (dimmed)');
        });
        ui.button('Remove readonly rule', () => {
            // the column config decides again, same as a hook that returns null
            gridInterface.updateHooks({ isReadonly: undefined });
        });
    }
};
