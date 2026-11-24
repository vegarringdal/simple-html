// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { nullsAsDefaults } from '../configNulls';
import type { GridConfig } from '../gridConfig';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * configNulls.ts: null in a grid config is an option left out - a config from a backend has null for
 * what is not set. The options of the config go back to their defaults, the options of a column and of its
 * format are left out
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const rows = () => [
    { id: 1, name: 'Ann', age: 30, born: new Date(2001, 4, 17) },
    { id: 2, name: '', age: 0, born: null }
];
const fields = { age: 'number', born: 'date' } as const;
const layout = { center: ['name', 'age', 'born'].map((field) => ({ fields: [field], width: 100 })) };

/** every option of a column and of its format, null */
const COLUMN_KEYS = [
    'label',
    'placeholderRow',
    'placeholderFilter',
    'operator',
    'filterOperators',
    'filterCaseSensitive',
    'filterOnType',
    'datePresets',
    'dynamicCellTypeColumn',
    'readonly',
    'numberOverride',
    'focusButton',
    'allowPasteClearOnly',
    'editor',
    'aggregate',
    'renderer',
    'format'
];
const FORMAT_KEYS = [
    'label',
    'placeholderRow',
    'placeholderRowLabel',
    'readonly',
    'date',
    'number',
    'numberOverride',
    'rules',
    'text',
    'link',
    'bar'
];

describe('nullsAsDefaults', () => {
    it('expect the options of the config undefined, the columns and formats without their null keys - a copy', () => {
        const config = {
            readonly: null,
            texts: null,
            layout,
            columns: { name: { label: null, placeholderRow: 'type a name', format: { label: null, readonly: true } }, age: null }
        } as unknown as GridConfig;
        const copy = nullsAsDefaults(config);
        expect(copy).toEqual({
            readonly: undefined,
            texts: undefined,
            layout,
            columns: { name: { placeholderRow: 'type a name', format: { readonly: true } }, age: {} }
        });
        expect((config.columns as Record<string, unknown>).age).toBeNull();
    });

    it('expect a layout of null left for its check', () => {
        expect(nullsAsDefaults({ layout: null } as unknown as GridConfig).layout).toBeNull();
    });
});

describe('a grid with null in its config', () => {
    for (const key of COLUMN_KEYS) {
        for (const field of ['name', 'age', 'born']) {
            it(`expect columns.${field}.${key}: null to be the default`, async () => {
                const plain = await mountGrid({ layout }, rows(), { key: 'id', fields });
                const expected = plain.gridInterface.__getGridConfig().columns[field];
                document.body.innerHTML = '';
                const { gridInterface } = await mountGrid({ layout, columns: { [field]: { [key]: null } } as never }, rows(), {
                    key: 'id',
                    fields
                });
                expect(gridInterface.__getGridConfig().columns[field]).toEqual(expected);
            });
        }
    }

    for (const key of FORMAT_KEYS) {
        it(`expect columns.age.format.${key}: null to be the default`, async () => {
            const { gridInterface } = await mountGrid(
                { layout, columns: { age: { format: { [key]: null } } } as never },
                rows(),
                {
                    key: 'id',
                    fields
                }
            );
            expect(gridInterface.getState().formats).toEqual({});
        });
    }

    it('expect the options of the config at their defaults, a placeholder of null none', async () => {
        const { gridInterface } = await mountGrid(
            {
                layout,
                readonly: null,
                tooltips: null,
                cellHeight: null,
                texts: null,
                edit: null,
                detailForm: null,
                typeFormats: null,
                initialState: null,
                calculatedColumns: null,
                columns: { name: { placeholderRow: null, placeholderFilter: null } }
            } as never,
            rows(),
            { key: 'id', fields }
        );
        const config = gridInterface.__getGridConfig();
        expect([config.readonly, config.tooltips, config.cellHeight]).toEqual([true, true, 22]);
        const filter = document.querySelector<HTMLInputElement>('simple-html-grid .simple-html-grid-header input');
        expect(filter?.placeholder).toBe('Text');
        const cell = document.querySelector<HTMLInputElement>('simple-html-grid input[data-attribute="name"]');
        expect(cell?.placeholder).toBe('');
    });

    it('expect updateConfig() with null to set the option back to its default', async () => {
        const { gridInterface } = await mountGrid({ layout, readonly: false, cellHeight: 30 }, rows(), { key: 'id', fields });
        gridInterface.updateConfig({
            readonly: null,
            cellHeight: null,
            columns: { age: { operator: null, format: null } }
        } as never);
        const config = gridInterface.__getGridConfig();
        expect([config.readonly, config.cellHeight]).toEqual([true, 22]);
        expect(config.columns.age.operator).toBeUndefined();
    });

    it('expect a value that is wrong to still throw', async () => {
        await expect(
            mountGrid({ layout, columns: { age: { operator: 'NOPE' } } } as never, rows(), { key: 'id', fields })
        ).rejects.toThrow(TypeError);
    });
});
