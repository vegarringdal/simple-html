import type { GridConfig } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const editing: DemoSample = {
    id: 'editing',
    title: 'Editing & row state',
    group: 'Editing',
    description:
        'The grid defaults to readonly: true, so set readonly: false in the config to edit cells. The datasource tracks new/modified/deleted rows (see the RS column: N/M/D) so you can collect changes and send them to a server, or throw them away. Edit some cells and click "Show changes" - a cell edited back to its original value is not a change, and a date typed again on the same day is not either. Deleting marks the rows, so it can be undone: select rows and use the buttons, or right click a cell (Delete: Rows / Undo). Ctrl+Z undoes the last edit, paste, clear or delete, Ctrl+Y redoes it - while you type in a cell Ctrl+Z is the input\'s own undo, until you leave the cell. The Undo / Redo buttons follow the history-changed event, and the row menu has Edit: Undo / Redo / Revert cell / Revert rows. The "Saving" sample sends the changes to a server.',
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
            // they stay, struck through, and getChanges() has them in deletedEntities.
            // A new row is marked too, but not sent: it was never saved
            datasource.markForDeletion(datasource.getSelectedRows());
        });
        ui.button('Undo delete (selected)', () => {
            // takes the mark off, the rows are as they were - edits kept, a new row new again
            datasource.unmarkForDeletion(datasource.getSelectedRows());
        });
        ui.button('Mark all for deletion', () => {
            datasource.markAllForDeletion();
        });
        ui.button('Undo delete (all)', () => {
            datasource.unmarkAllForDeletion();
        });
        ui.button('Show changes', () => {
            // all local edits, new rows and deletions, e.g. to save them on a server.
            // modifiedEntities has the key and the changed fields of each edited row
            const { newEntities, modifiedEntities, deletedEntities } = datasource.getChanges();
            ui.log(`${newEntities.length} new, ${modifiedEntities.length} modified, ${deletedEntities.length} deleted`);
            ui.log(`hasChanges(): ${datasource.hasChanges()}`);
            const changes = JSON.stringify(modifiedEntities);
            ui.log(`modified: ${changes.length > 400 ? `${changes.slice(0, 400)}...` : changes}`);
        });
        ui.button('Reset changes', () => {
            // throw away all local changes - and the undo history with them
            datasource.resetData();
            ui.log('local changes reset');
        });

        // the undo history: Ctrl+Z / Ctrl+Y in a cell, the row menu, or buttons of your own
        const undoButton = ui.button('Undo', () => datasource.undo());
        const redoButton = ui.button('Redo', () => datasource.redo());
        ui.button('Revert selected rows', () => {
            // their original values, deletion marks off - a new row stays. One step: Undo brings it back
            datasource.resetRows(datasource.getSelectedRows());
            gridInterface.refresh();
        });
        const showHistory = () => {
            undoButton.disabled = !datasource.canUndo();
            redoButton.disabled = !datasource.canRedo();
        };
        datasource.on('history-changed', (data) => {
            showHistory();
            ui.log(`history-changed: ${data.info}`);
        });
        showHistory();
    }
};
