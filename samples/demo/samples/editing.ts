import type { GridConfig } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid, reconfigure } from '../demoUtils';

export const editing: DemoSample = {
    id: 'editing',
    title: 'Editing & row state',
    group: 'Editing',
    description:
        'The grid defaults to readonly: true, so set readonly: false in the config to edit cells. The datasource tracks new/modified/deleted rows (see the RS column: N/M/D) so you can collect changes and send them to a server, or throw them away. Edit some cells and click "Show changes" - a cell edited back to its original value is not a change, and a date typed again on the same day is not either.',
    code: `
// the grid defaults to readonly: true - enable editing in the config,
// or per column with columns: { x: { readonly: true/false } }
const gridConfig: GridConfig = { readonly: false, ... };

// readonly is config: to toggle it, connect a new interface with the changed config,
// started in the state the old one is in (sorting, filter, column order ...)
const next = new GridInterface({ ...gridConfig, readonly: true, initialState: gridInterface.getState() }, datasource);
element.connectInterface(next);

// add a new row (scrolls to it), optionally with data
datasource.addNewEmpty({ company: 'NEW COMPANY' });

// mark selected rows for deletion (rendered with strike-through)
datasource.markForDeletion(datasource.getSelectedRows());
datasource.markAllForDeletion(); // every row

// collect all local edits/new rows/deletions, e.g. before saving to a server.
// modifiedEntities has the key and the changed fields of each edited row
const { newEntities, modifiedEntities, deletedEntities } = datasource.getChanges();
console.log(newEntities, modifiedEntities, deletedEntities);

// throw away all local changes
datasource.resetData();
`,
    run(stage) {
        const ui = createStage(stage);
        const config: GridConfig = baseGridConfig();
        config.layout.center.unshift({ fields: ['__rowState'], width: 20 });
        config.columns = { __rowState: { label: 'RS', readonly: true } };

        const { datasource, element, gridInterface: first } = mountGrid(ui.gridHost, config);
        let gridInterface = first;
        datasource.setSelectionMode('multiple');

        ui.button('Toggle readonly', () => {
            config.readonly = !config.readonly;
            gridInterface = reconfigure(element, gridInterface, config);
            ui.log('grid readonly: ' + config.readonly);
        });
        ui.button('Add new row', () => {
            datasource.addNewEmpty({ company: 'NEW COMPANY' });
        });
        ui.button('Mark selected for deletion', () => {
            datasource.markForDeletion(datasource.getSelectedRows());
        });
        ui.button('Mark all for deletion', () => {
            datasource.markAllForDeletion();
        });
        ui.button('Show changes', () => {
            const { newEntities, modifiedEntities, deletedEntities } = datasource.getChanges();
            ui.log(`${newEntities.length} new, ${modifiedEntities.length} modified, ${deletedEntities.length} deleted`);
            const changes = JSON.stringify(modifiedEntities);
            ui.log(`modified: ${changes.length > 400 ? `${changes.slice(0, 400)}...` : changes}`);
        });
        ui.button('Reset changes', () => {
            datasource.resetData();
            ui.log('local changes reset');
        });
    }
};
