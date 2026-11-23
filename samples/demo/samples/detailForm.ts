import type { GridConfig, GridState } from '@simple-html/grid';
import { baseFields, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

/**
 * notes of one line and of several: the form shows all of them
 */
const NOTES = [
    'Call back on Monday\nAsk for the new price list\nSend the contract by mail\nConfirm the delivery date',
    'Paid in full',
    '',
    'Delivery to the back door\nRing the bell twice\nThe gate code is 4711',
    'VIP customer\r\nAlways confirm by phone'
];

/** where Save keeps the state */
const STORAGE_KEY = 'simple-html-demo-detail-form-state';

export const detailForm: DemoSample = {
    id: 'detail-form',
    title: 'Detail form',
    group: 'Editing',
    description:
        'The detail form (GridConfig.detailForm): the current row as a form at the right of the rows - a label and a value for each field picked, in their order. Notes has several lines and is not in the layout: the form shows all of it, in a field as tall as its lines. Click a row, or move with the arrows: the form follows. Edit in the form as in a cell - Ctrl+Z undoes - and the cells follow. Its title collapses it to a narrow strip, and expands it again. Notes has at least 5 lines (fieldOptions: minRows, paddingTop / paddingBottom), and Country, Date and Active are in a panel More whose header collapses it - a section is an entry of fields ({ section, panel, collapsed, paddingTop, paddingBottom }). In the tab Detail form of the dialog: Add section, then move fields under it; the settings of the section or field picked are under the list. Drag its left edge to make it wider or narrower (200 to 600px here: minWidth, maxWidth) - or Tab to the edge and use ArrowLeft / ArrowRight. The gear at the right end of the footer opens the grid config dialog: its tab Detail form turns the form on and off, expands it, sets its width, min and max and picks the fields and their order (drag a field by its handle, Move up / Move down, Alt+↑ / Alt+↓). It is part of the state: Save and Restore keep it - the width dragged and collapsed too. Where the rows would get too little room beside it (a phone), the form is under them.',
    run(stage) {
        const ui = createStage(stage);

        const config: GridConfig = {
            readonly: false,
            columns: { notes: { label: 'Notes' } },
            layout: {
                left: [{ fields: ['company'], width: 170 }],
                center: [
                    { fields: ['country'], width: 120 },
                    { fields: ['age'], width: 70 },
                    { fields: ['date1'], width: 110 },
                    { fields: ['balance'], width: 100 },
                    { fields: ['phone'], width: 140 },
                    { fields: ['favoriteFruit'], width: 110 },
                    { fields: ['isActive'], width: 70 }
                ]
            },
            // the form the grid starts with: notes is a column of the config, not in the layout. Its edge is
            // dragged between 200 and 600px
            detailForm: {
                show: true,
                // a section is an entry of the list: the fields after it, up to the next one, are in it
                fields: ['company', 'notes', { section: 'More', panel: true, paddingTop: 6 }, 'country', 'date1', 'isActive'],
                width: 280,
                minWidth: 200,
                maxWidth: 600,
                // notes at least 5 lines
                fieldOptions: { notes: { minRows: 5 } }
            }
        };

        const rows = generateRows(200).map((row, i) => ({ ...row, notes: NOTES[i % NOTES.length] }));
        const { datasource, gridInterface } = mountGrid(ui.gridHost, config, rows, {
            fields: { ...baseFields(), notes: { label: 'Notes', multiline: true } }
        });
        // a row to show from the start
        datasource.setRowAsCurrentEntity(0);

        ui.button('Detail form settings', () => gridInterface.openDetailFormSettings());
        ui.button('Show / hide', () => {
            const form = gridInterface.getState().detailForm;
            gridInterface.setState({ detailForm: { ...form, show: !form.show } });
        });
        // what the button of its title does: expanded is part of the state
        ui.button('Collapse / expand', () => {
            const form = gridInterface.getState().detailForm;
            gridInterface.setState({ detailForm: { ...form, expanded: form.expanded === false } });
        });
        let readonly = false;
        ui.button('Editing on / off', () => {
            readonly = !readonly;
            gridInterface.updateConfig({ readonly });
            ui.log(`grid readonly: ${readonly}`);
        });
        // the detail form is state: saved and given back as JSON with the rest (storage can be blocked)
        ui.button('Save state', () => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(gridInterface.getState()));
                ui.log(`saved, detailForm: ${JSON.stringify(gridInterface.getState().detailForm)}`);
            } catch {
                ui.log('the browser does not let the page store');
            }
        });
        ui.button('Restore state', () => {
            try {
                const saved: GridState | null = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
                if (saved) {
                    gridInterface.setState(saved);
                }
            } catch (error) {
                ui.log(String(error));
            }
        });
        ui.button('resetState()', () => gridInterface.resetState());
        ui.button('Undo', () => datasource.undo());
    }
};
