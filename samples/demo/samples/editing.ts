import type { GridConfig } from '@simple-html/grid';
import { baseFields, baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const editing: DemoSample = {
    id: 'editing',
    title: 'Editing & row state',
    group: 'Editing',
    description:
        'The grid defaults to readonly: true, so set readonly: false in the config to edit cells. The datasource tracks new, edited and deleted rows so you can collect changes and send them to a server, or throw them away. The row number shows the state of each row (rowStatus: a + for a new row, a pencil for an edited one, a trash can and struck through for a deleted one, ! for an error - hover it), and an edited cell gets a marker in its corner (editedMarker): hover it for the original value, click it to put the original value back. Type an age under 18 for an error. Edit some cells and click "Show changes" - a cell edited back to its original value is not a change, and a date typed again on the same day is not either. Deleting marks the rows, so it can be undone: select rows and use the buttons, or right click a cell (Delete › Rows / Undo). "Changed rows only" shows the new, edited and deleted rows, with the filter there is - also in the row menu (View ›). Ctrl+Z undoes the last edit, paste, clear or delete, Ctrl+Y redoes it - while you type in a cell Ctrl+Z is the input\'s own undo, until you leave the cell. The Undo / Redo buttons follow the history-changed event, and the row menu (right click a cell) starts with Undo last change / Redo / Undo cell edit / Undo row edits (the row clicked) / Undo row edits (selected rows). "Toggle readonly" hides the editing entries and submenus of the menu. The "Saving" sample sends the changes to a server.',
    run(stage) {
        const ui = createStage(stage);
        // the grid defaults to readonly: true, baseGridConfig() has readonly: false.
        // Per column: columns: { company: { readonly: true } }.
        // The row numbers show the state of the rows, and edited cells get a marker: both are on by
        // default, rowStatus: false and editedMarker: false turn them off
        const config: GridConfig = baseGridConfig();

        // a rule, to see an error: type an age under 18. The cell and the row number show it
        const fields = { ...baseFields(), age: { type: 'number' as const, validate: [{ id: 'min', value: 18 }] } };
        const { datasource, gridInterface } = mountGrid(ui.gridHost, config, undefined, { fields });

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
        ui.button('Changed rows only', () => {
            // the new, edited and deleted rows, with the filter there is (AND). Not part of the
            // filter: a header filter keeps it on, the footer's Clear turns it off
            datasource.filterChangedOnly(!datasource.isChangedOnly());
            ui.log(`changed rows only: ${datasource.isChangedOnly()}`);
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
