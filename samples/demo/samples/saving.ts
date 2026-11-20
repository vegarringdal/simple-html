import type { Changes } from '@simple-html/grid';
import { baseFields, baseGridConfig, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

export const saving: DemoSample = {
    id: 'saving',
    title: 'Saving',
    group: 'Editing',
    description:
        'Edit cells, add rows and delete rows (select them, then "Delete selected" or right click a cell: Delete: Rows), then click "Save". getChanges() has the deleted, edited and new rows: one call sends them to a fake server, which saves them in one transaction and gives each new row an id. acceptChanges({ newKeys }) then shows what was saved: the deleted rows are gone, the new rows have the ids from the server, and nothing counts as changed (hasChanges() is false).',
    run(stage) {
        const ui = createStage(stage);
        const config = baseGridConfig();
        config.layout.center.unshift({ fields: ['__rowState'], width: 20 }, { fields: ['id'], width: 60 });
        config.columns = { __rowState: { label: 'RS', readonly: true }, id: { readonly: true } };

        // key: 'id' - a new row gets a temporary id, a negative number, until the server gives it one
        const rows = generateRows(20).map((row, i) => ({ id: i + 1, ...row }));
        const { datasource, gridInterface } = mountGrid(ui.gridHost, config, rows, {
            key: 'id',
            fields: { ...baseFields(), id: 'number' }
        });

        // the fake server: saves the changes in one transaction, and answers with the id it gave
        // each new row
        let lastId = rows.length;
        const save = async (changes: Changes<{ id: number }>) => {
            await new Promise((resolve) => setTimeout(resolve, 300));
            return changes.newEntities.map((row) => ({ temporaryId: row.id, id: ++lastId }));
        };

        ui.button('Add new row', () => {
            datasource.addNewEmpty({ company: 'NEW COMPANY' });
        });
        ui.button('Delete selected', () => {
            // marked, not removed: struck through until the save, and it can be undone
            datasource.markForDeletion(datasource.getSelectedRows());
        });
        ui.button('Undo delete', () => {
            datasource.unmarkForDeletion(datasource.getSelectedRows());
        });
        ui.button('hasChanges()', () => {
            ui.log(datasource.hasChanges() ? 'unsaved changes' : 'nothing to save');
        });
        ui.button('Save', async () => {
            if (!datasource.hasChanges()) {
                ui.log('nothing to save');
                return;
            }
            const changes = datasource.getChanges();
            const { newEntities, modifiedEntities, deletedEntities } = changes;
            ui.log(`sending ${newEntities.length} new, ${modifiedEntities.length} edited, ${deletedEntities.length} deleted`);

            // readonly while the save runs: an edit made in between would be accepted without being saved
            gridInterface.updateConfig({ readonly: true });
            try {
                const saved = await save(changes);
                // the server's id for each temporary id: the new rows get it, and become ordinary rows
                datasource.acceptChanges({ newKeys: new Map(saved.map((row) => [row.temporaryId, row.id])) });
                ui.log(`saved. New ids: ${saved.map((row) => `${row.temporaryId} -> ${row.id}`).join(', ') || 'none'}`);
            } finally {
                gridInterface.updateConfig({ readonly: false });
            }
        });
        ui.button('Reset changes', () => {
            // back to what was saved last
            datasource.resetData();
        });
    }
};
