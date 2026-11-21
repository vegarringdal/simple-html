import { type Changes, registerValidator } from '@simple-html/grid';
import { baseFields, baseGridConfig, COUNTRIES, createStage, type DemoSample, generateRows, mountGrid } from '../demoUtils';

// a validator of your own, registered when the page loads - before the datasource that names it.
// Its options come from the rule: { id: 'oneOf', values: [...] }
registerValidator('oneOf', (value, _row, rule) => {
    if (value === null || value === undefined || value === '') {
        return null; // an empty value is the required rule's job
    }
    return Array.isArray(rule.values) && rule.values.includes(String(value)) ? null : 'Not in the list';
});

export const validation: DemoSample = {
    id: 'validation',
    title: 'Validation',
    group: 'Editing',
    description:
        'The rules are in the datasource\'s fields, as JSON: required, min/max, maxLength, pattern and a validator of its own (oneOf). An edit is validated at once: empty a company, type an age of 10 or a phone without +47 - the cell gets the error border, the message is its tooltip, and the row number shows the row has an error. A new row is not validated until it is edited or validate() runs: "Save" validates first and saves only when there is no error. "Server error" puts an error from the server on the selected rows (setErrors()): the row number shows both, apart from the validation errors.',
    run(stage) {
        const ui = createStage(stage);
        const config = baseGridConfig();
        config.layout.center.unshift({ fields: ['__rowState'], width: 20 }, { fields: ['id'], width: 60 });
        config.columns = { __rowState: { label: 'RS', readonly: true }, id: { readonly: true } };

        const rows = generateRows(30).map((row, i) => ({ id: i + 1, ...row }));
        const { datasource, gridInterface } = mountGrid(ui.gridHost, config, rows, {
            key: 'id',
            fields: {
                ...baseFields(),
                id: 'number',
                // a string is a rule without options, an object { id, ...options, message? }
                company: { validate: ['required', { id: 'maxLength', value: 20 }] },
                age: {
                    type: 'number',
                    validate: [
                        'required',
                        { id: 'min', value: 18 },
                        { id: 'max', value: 99, message: 'Too old, at most {value}' }
                    ]
                },
                // not anchored on its own: ^ and $ make it match the whole text
                phone: { validate: [{ id: 'pattern', value: '^\\+47 \\d{8}$', message: 'Must be +47 and 8 digits' }] },
                country: { validate: ['required', { id: 'oneOf', values: COUNTRIES }] }
            }
        });

        // the fake server: saves the changes in one transaction, and answers with the id it gave each new row
        let lastId = rows.length;
        const save = async (changes: Changes<{ id: number }>) => {
            await new Promise((resolve) => setTimeout(resolve, 300));
            return changes.newEntities.map((row) => ({ temporaryId: row.id, id: ++lastId }));
        };

        ui.button('Add new row', () => {
            // not validated yet: the required stripes show what to fill in
            datasource.addNewEmpty();
        });
        ui.button('Validate', () => {
            const errors = datasource.validate();
            ui.log(errors.length ? `${errors.length} fields with errors` : 'every row is valid');
        });
        ui.button('Save', async () => {
            // validate first: the edits were checked as they were made, the fields never edited only here
            const errors = datasource.validate();
            if (errors.length) {
                ui.log(`not saved, ${errors.length} fields with errors:`);
                for (const { row, field, messages } of errors.slice(0, 5)) {
                    ui.log(`  row ${row.id}, ${datasource.getField(field).label}: ${messages.join(', ')}`);
                }
                return;
            }
            if (!datasource.hasChanges()) {
                ui.log('nothing to save');
                return;
            }
            gridInterface.updateConfig({ readonly: true });
            try {
                const saved = await save(datasource.getChanges());
                // clears the errors of the server too
                datasource.acceptChanges({ newKeys: new Map(saved.map((row) => [row.temporaryId, row.id])) });
                ui.log('saved');
            } finally {
                gridInterface.updateConfig({ readonly: false });
            }
        });
        ui.button('Server error (selected)', () => {
            // the server's errors are apart from the validation errors: __rowError, by key
            const keys = datasource.getSelectedRows().map((row) => String(row.__KEY));
            datasource.getDataContainer().setErrors(new Map(keys.map((key) => [key, 'The server refused this row'])));
            gridInterface.refresh();
        });
        ui.button('hasErrors()', () => {
            ui.log(`hasErrors(): ${datasource.hasErrors()}`);
        });
        ui.button('Reset changes', () => {
            // the edits undone, the new rows removed, the validation errors cleared
            datasource.resetData();
        });
    }
};
