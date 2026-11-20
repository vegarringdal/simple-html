import type { GridConfig } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const editing: DemoSample = {
    id: 'editing',
    title: 'Editing & row state',
    group: 'Editing',
    description:
        'The grid defaults to readonly: true, so set readonly: false in the config to edit cells. The datasource tracks new/modified/deleted rows (see the RS column: N/M/D) so you can collect changes and send them to a server, or throw them away. Edit some cells and click "Show changes" - a cell edited back to its original value is not a change, and a date typed again on the same day is not either.',
    run(stage) {
        const ui = createStage(stage);
        // the grid defaults to readonly: true, baseGridConfig() has readonly: false.
        // Per column: columns: { company: { readonly: true } }
        const config: GridConfig = baseGridConfig();
        config.layout.center.unshift({ fields: ['__rowState'], width: 20 });
        config.columns = { __rowState: { label: 'RS', readonly: true } };

        const { datasource, gridInterface } = mountGrid(ui.gridHost, config);

        // toggle it while the grid is shown: sorting, filter, column order ... stay as they are
        let readonly = config.readonly;
        ui.button('Toggle readonly', () => {
            readonly = !readonly;
            gridInterface.updateConfig({ readonly });
            ui.log(`grid readonly: ${readonly}`);
        });
        ui.button('Add new row', () => {
            // scrolls to it, the data is optional
            datasource.addNewEmpty({ company: 'NEW COMPANY' });
        });
        ui.button('Mark selected for deletion', () => {
            // rendered with strike-through, getChanges() has them in deletedEntities
            datasource.markForDeletion(datasource.getSelectedRows());
        });
        ui.button('Mark all for deletion', () => {
            datasource.markAllForDeletion();
        });
        ui.button('Show changes', () => {
            // all local edits, new rows and deletions, e.g. to save them on a server.
            // modifiedEntities has the key and the changed fields of each edited row
            const { newEntities, modifiedEntities, deletedEntities } = datasource.getChanges();
            ui.log(`${newEntities.length} new, ${modifiedEntities.length} modified, ${deletedEntities.length} deleted`);
            const changes = JSON.stringify(modifiedEntities);
            ui.log(`modified: ${changes.length > 400 ? `${changes.slice(0, 400)}...` : changes}`);
        });
        ui.button('Reset changes', () => {
            // throw away all local changes
            datasource.resetData();
            ui.log('local changes reset');
        });
    }
};
