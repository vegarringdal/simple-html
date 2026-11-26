// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { Entity } from '../../datasource/entity';
import type { GridConfig } from '../gridConfig';
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
