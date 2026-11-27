// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { Entity } from '../../datasource/entity';
import { registerValidator } from '../../datasource/validatorRegistry';
import { setTexts } from '../../texts';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { GridInterface } from '../gridInterface';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * ColumnConfig.validate: validation rules in the grid's config, set by code - added after the field's own
 * (FieldConfig.validate), not in the state, so the user can not change them
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

afterEach(() => {
    document.querySelectorAll('dialog').forEach((dialog) => {
        dialog.remove();
    });
});

/** the cell element of a body cell, by its field and its displayed row (0 based) */
const cellOf = (element: GridElement, field: string, row: number) =>
    Array.from(element.querySelectorAll<HTMLInputElement>(`input[data-attribute="${field}"]`))
        .map((input) => input.closest('.simple-html-grid-col-cell') as HTMLElement & { $row?: number })
        .find((cell) => cell.$row === row) as HTMLElement;

/** after the frame the grid renders the changed rows in */
const nextFrame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(resolve));
};

const rows = () => [
    { id: 1, code: 'AB-123', hours: 8, status: 'Open' },
    { id: 2, code: 'x', hours: 30, status: 'Done' }
];
const layout = { center: ['id', 'code', 'hours', 'status'].map((field) => ({ fields: [field], width: 100 })) };
const config = (): GridConfig => ({
    readonly: false,
    columns: {
        code: { validate: ['required', { id: 'pattern', value: '^[A-Z]{2}-\\d{3}$', message: 'Like AB-123' }] },
        hours: { validate: [{ id: 'max', value: 24 }] },
        status: { validate: [{ id: 'oneOf', value: ['Open', 'Closed'] }] }
    },
    layout
});
const fields: DatasourceOptions = {
    key: 'id',
    fields: { id: 'number', hours: { type: 'number', validate: [{ id: 'min', value: 0 }] } }
};

/** the messages of the rows by field, as `field: message` */
const errors = (datasource: Datasource) =>
    datasource
        .validate()
        .map((error) => `${error.field}: ${error.messages.join(' / ')}`)
        .sort();

describe('the rules of the columns', () => {
    it("expect validate() to check them after the field's own, getField() to list both", async () => {
        const { datasource } = await mountGrid(config(), rows(), fields);
        expect(errors(datasource)).toEqual([
            'code: Like AB-123',
            'hours: Must be at most 24',
            'status: Must be one of Open, Closed'
        ]);
        expect(datasource.getField('hours').validate).toEqual([
            { id: 'min', value: 0 },
            { id: 'max', value: 24 }
        ]);
        // required: the grid's stripes and the detail form read it here
        expect(datasource.getField('code').validate.map((rule) => rule.id)).toEqual(['required', 'pattern']);
        const row = datasource.getRows()[1] as Entity & { hours: number };
        row.hours = -1;
        expect(datasource.getErrors().find((error) => error.field === 'hours')?.messages).toEqual(['Must be at least 0']);
    });

    it('expect an edit validated with them', async () => {
        const { datasource } = await mountGrid(config(), rows(), fields);
        const row = datasource.getRows()[0] as Entity & { code: string };
        row.code = 'ab-1';
        expect(datasource.getErrors().map((error) => error.messages)).toEqual([['Like AB-123']]);
        row.code = 'CD-456';
        expect(datasource.hasErrors()).toBe(false);
    });

    it('expect the state not to change them: setState, resetState and the state have none', async () => {
        const { datasource, gridInterface } = await mountGrid(config(), rows(), fields);
        const state = gridInterface.getState();
        expect(JSON.stringify(state)).not.toContain('validate');
        gridInterface.setState({ ...state, formats: {} });
        gridInterface.resetState();
        expect(datasource.getField('status').validate).toEqual([{ id: 'oneOf', value: ['Open', 'Closed'] }]);
    });

    it('expect updateConfig({ columns }) to replace them, and the rows with errors validated again', async () => {
        const { datasource, gridInterface } = await mountGrid(config(), rows(), fields);
        expect(datasource.validate()).toHaveLength(3);
        gridInterface.updateConfig({ columns: { status: { validate: [{ id: 'oneOf', value: ['Open', 'Done'] }] } } });
        expect(datasource.getErrors()).toEqual([]);
        expect(datasource.getField('code').validate).toEqual([]);
        // another option of the config keeps them
        gridInterface.updateConfig({ readonly: true });
        expect(datasource.getField('status').validate).toEqual([{ id: 'oneOf', value: ['Open', 'Done'] }]);
    });

    it("expect destroy() to take them back, a second grid's to be used while it is there", async () => {
        const datasource = new Datasource(fields);
        datasource.setData(rows());
        const first = new GridInterface(config(), datasource);
        const second = new GridInterface({ columns: { status: { validate: ['required'] } }, layout }, datasource);
        expect(datasource.getField('status').validate).toEqual([{ id: 'required' }]);
        expect(datasource.getField('code').validate).toEqual([]);
        second.destroy();
        expect(datasource.getField('status').validate).toEqual([{ id: 'oneOf', value: ['Open', 'Closed'] }]);
        first.destroy();
        expect(datasource.getField('status').validate).toEqual([]);
        expect(datasource.getField('hours').validate).toEqual([{ id: 'min', value: 0 }]);
    });

    it("expect a second grid without rules to leave the first one's in place, the first's updateConfig to take its own away", () => {
        const datasource = new Datasource(fields);
        datasource.setData(rows());
        const first = new GridInterface(config(), datasource);
        const second = new GridInterface({ columns: {}, layout }, datasource);
        expect(datasource.getField('status').validate).toEqual([{ id: 'oneOf', value: ['Open', 'Closed'] }]);
        first.updateConfig({ columns: {} });
        expect(datasource.getField('status').validate).toEqual([]);
        second.destroy();
        first.destroy();
    });

    it('expect an unknown id, wrong options or a calculated column to throw, naming the column - nothing changed', async () => {
        const datasource = new Datasource(fields);
        const make = (columns: GridConfig['columns'], extra: Partial<GridConfig> = {}) =>
            new GridInterface({ columns, layout, ...extra }, datasource);
        expect(() => make({ code: { validate: ['nope'] } })).toThrow("GridConfig: columns.code has the unknown validator 'nope'");
        expect(() => make({ hours: { validate: [{ id: 'max', value: 'a lot' }] } })).toThrow(
            "GridConfig: columns.hours has the rule 'max', which takes a number or a day"
        );
        expect(() =>
            make({ total: { validate: ['required'] } }, { calculatedColumns: { total: { formula: '{hours} * 2' } } })
        ).toThrow("GridConfig: columns.total.validate is for a column that is edited, 'total' is a calculated column");
        expect(datasource.getField('code').validate).toEqual([]);

        const { gridInterface } = await mountGrid(config(), rows(), fields);
        const ds = gridInterface.getDatasource();
        expect(() => gridInterface.updateConfig({ columns: { code: { validate: [{ id: 'oneOf' }] } } })).toThrow(
            "GridConfig: columns.code has the rule 'oneOf'"
        );
        expect(ds.getField('code').validate.map((rule) => rule.id)).toEqual(['required', 'pattern']);
    });
});

describe('unique in a column, and the rules shown in the dialog', () => {
    const uniqueConfig = (): GridConfig => ({
        readonly: false,
        columns: { code: { validate: ['unique'] }, hours: { validate: [{ id: 'unique', with: ['status'], ignoreCase: true }] } },
        layout
    });

    it("expect an edit to a value of another row to show the error on both rows' cells", async () => {
        const { element, datasource } = await mountGrid(uniqueConfig(), rows(), fields);
        datasource.validate();
        const row = datasource.getRows()[1] as Entity & { code: string };
        row.code = 'AB-123';
        await nextFrame();
        expect([0, 1].map((at) => cellOf(element, 'code', at).classList.contains('simple-html-cell-error'))).toEqual([
            true,
            true
        ]);
        expect(cellOf(element, 'code', 0).getAttribute('data-tooltip')).toBe('Another row has the same value');
        row.code = 'x';
        await nextFrame();
        expect(element.querySelectorAll('.simple-html-cell-error')).toHaveLength(0);
    });

    it('expect the dialog to list the rules of the column, read only, with the hint that the application sets them', async () => {
        const { gridInterface } = await mountGrid(
            {
                ...config(),
                columns: {
                    ...config().columns,
                    status: { validate: [{ id: 'unique', with: ['code'], ignoreCase: true }, 'email'] }
                }
            },
            rows(),
            fields
        );
        gridInterface.openColumnSettings('code');
        const dialog = document.querySelector('dialog.column-settings') as HTMLDialogElement;
        /** the column picked in the dialog's list: its rules, the hint under them, what could change them */
        const listed = (field: string) => {
            dialog.querySelector<HTMLElement>(`.column-settings-option[data-field="${field}"]`)?.click();
            const list = dialog.querySelector('.column-settings-validation');
            const items = Array.from(list?.querySelectorAll('li') ?? [], (item) => item.textContent?.trim());
            const hint = list ? dialog.querySelector(`#${list.getAttribute('aria-describedby')}`)?.textContent?.trim() : null;
            return { items, hint, inputs: list?.querySelectorAll('input, button, select').length ?? 0 };
        };
        expect(listed('code')).toEqual({
            items: ['Required', 'Like AB-123'],
            hint: 'Set by the application: checked on every edit, not changed here',
            inputs: 0
        });
        // the field's own, then the column's
        expect(listed('hours').items).toEqual(['Must be at least 0', 'Must be at most 24']);
        expect(listed('status').items).toEqual(['Unique together with Code, in any case', 'Not an email address']);
        // no rules: nothing
        expect(listed('id').items).toEqual([]);
    });

    it('expect a pattern without a message shown as its expression, a rule of the application by its text or its id', async () => {
        registerValidator('phoneNO', () => null);
        registerValidator('shoeSize', () => null);
        setTexts({ 'validation.phoneNO': 'Must be 8 digits' });
        const { gridInterface } = await mountGrid(
            {
                ...config(),
                columns: { code: { validate: [{ id: 'pattern', value: '^[A-Z]+$' }, 'unique', 'phoneNO', 'shoeSize'] } }
            },
            rows(),
            fields
        );
        gridInterface.openColumnSettings('code');
        const items = Array.from(document.querySelectorAll('dialog.column-settings .column-settings-validation li'), (item) =>
            item.textContent?.trim()
        );
        expect(items).toEqual(['Must match ^[A-Z]+$', 'Unique', 'Must be 8 digits', 'shoeSize']);
        setTexts({});
    });

    it("expect an import to compare its rows with the grid's and with each other", async () => {
        const { gridInterface, datasource } = await mountGrid(uniqueConfig(), rows(), fields);
        const result = gridInterface.importRows(
            [
                ['AB-123', '1', 'Open'],
                ['CD-1', '2', 'Open'],
                ['CD-1', '3', 'Open'],
                ['EF-1', '4', 'Open']
            ],
            { fields: ['code', 'hours', 'status'] }
        );
        expect(result.problems.map((problem) => [problem.row, problem.field, problem.message])).toEqual([
            [0, 'code', 'Another row has the same value'],
            [1, 'code', 'Another row has the same value'],
            [2, 'code', 'Another row has the same value']
        ]);
        // added and validated: the grid's row with AB-123 has the error too
        expect(
            datasource
                .getErrors()
                .map((error) => (error.row as Entity & { code: string }).code)
                .sort()
        ).toEqual(['AB-123', 'AB-123', 'CD-1', 'CD-1']);
    });
});
