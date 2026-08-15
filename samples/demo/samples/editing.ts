import type { GridConfig } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const editing: DemoSample = {
    id: 'editing',
    title: 'Editing & row state',
    group: 'Editing',
    description:
        'Cells are editable by default. The datasource tracks new/modified/deleted rows (see the RS column: N/M/D) so you can collect changes and send them to a server, or throw them away. Edit some cells and click "Show changes".',
    code: `
// readonly is config, per attribute or for the whole grid
const config = gridInterface.saveConfig();
config.readonly = true;
gridInterface.loadConfig(config);

// add a new row (scrolls to it), optionally with data
datasource.addNewEmpty({ company: 'NEW COMPANY' });

// mark selected rows for deletion (rendered with strike-through)
datasource.markForDeletion(datasource.getSelectedRows());

// collect all local edits/new rows/deletions, e.g. before saving to a server
console.log(datasource.getChanges());

// throw away all local changes
datasource.resetData();
`,
    run(stage) {
        const ui = createStage(stage);
        const config: GridConfig = baseGridConfig();
        config.columnsCenter.unshift({ rows: ['__rowState'], width: 20 });
        config.attributes.push({ attribute: '__rowState', label: 'RS', readonly: true });

        const { datasource, gridInterface } = mountGrid(ui.gridHost, config);
        datasource.setSelectionMode('multiple');

        ui.button('Toggle readonly', () => {
            const current = gridInterface.saveConfig();
            current.readonly = !current.readonly;
            gridInterface.loadConfig(current);
            ui.log('grid readonly: ' + current.readonly);
        });
        ui.button('Add new row', () => {
            datasource.addNewEmpty({ company: 'NEW COMPANY' });
        });
        ui.button('Mark selected for deletion', () => {
            datasource.markForDeletion(datasource.getSelectedRows());
        });
        ui.button('Show changes', () => {
            const changes = JSON.stringify(datasource.getChanges());
            ui.log(changes.length > 400 ? changes.slice(0, 400) + '...' : changes);
        });
        ui.button('Reset changes', () => {
            datasource.resetData();
            ui.log('local changes reset');
        });
    }
};
