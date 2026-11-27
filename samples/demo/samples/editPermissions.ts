import type { EditPermissions, GridConfig } from '@simple-html/grid';
import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

export const editPermissions: DemoSample = {
    id: 'edit-permissions',
    title: 'Edit permissions',
    group: 'Editing',
    description:
        'What the user may do in an editable grid: add rows, change values, delete rows - any of them, set by you (edit in the config, after a login check say), not by the user: it is not in the state, no menu or dialog changes it. It starts as "add only": the rows that are there can not be typed in, pasted into, cleared, filled down (Ctrl+D, the fill handle) or changed in the detail form, and the row menu\'s Delete › is greyed out on them. "Add new row" adds a row you can fill in and take out again (Delete on its row number, Delete › Row) - it is not on the server. "Save" takes the changes in (acceptChanges): the new rows are rows that were there now, and are locked too. The buttons turn each permission on and off as a developer would, with updateConfig({ edit }). Undo, redo and the reverts keep working: they put back what was.',
    run(stage) {
        const ui = createStage(stage);
        // the permissions: a setting of yours, not the user's. Each is true when it is left out.
        // add only: new rows can be added and filled in, the rest stays as it is
        const edit: Required<EditPermissions> = { add: true, change: false, delete: false };
        const config: GridConfig = {
            ...baseGridConfig(), // readonly: false - the permissions are about an editable grid
            edit,
            // the detail form follows them too: a field of a locked row is shown, not edited
            detailForm: { show: true, fields: ['company', 'country', 'age', 'date1', 'isActive'], width: 260 }
        };
        const { datasource, gridInterface } = mountGrid(ui.gridHost, config);

        // the grid has no way of its own to add a row: your add button follows edit.add
        const addButton = ui.button('Add new row', () => {
            if (edit.add) {
                datasource.addNewEmpty({ company: 'NEW COMPANY' });
            }
        });

        // one button per permission, as a developer would set them
        const showAll: (() => void)[] = [];
        const show = () => {
            for (const each of showAll) {
                each();
            }
            addButton.disabled = !edit.add;
        };
        for (const name of ['add', 'change', 'delete'] as const) {
            const button = ui.button('', () => {
                edit[name] = !edit[name];
                // replaces the permissions as a whole: a permission left out is allowed again
                gridInterface.updateConfig({ edit: { ...edit } });
                show();
                ui.log(`edit: ${JSON.stringify(edit)}`);
            });
            button.setAttribute('data-permission', name);
            showAll.push(() => {
                button.textContent = `${name}: ${edit[name] ? 'allowed' : 'not allowed'}`;
            });
        }
        show();

        ui.button('Show changes', () => {
            const { newEntities, modifiedEntities, deletedEntities } = datasource.getChanges();
            ui.log(`${newEntities.length} new, ${modifiedEntities.length} modified, ${deletedEntities.length} deleted`);
        });
        ui.button('Save', () => {
            // as after a save on a server: the new rows are ordinary rows now - with change: false they
            // are locked like the rest
            datasource.acceptChanges();
            ui.log('changes accepted');
        });
        ui.log(`edit: ${JSON.stringify(edit)}`);
    }
};
