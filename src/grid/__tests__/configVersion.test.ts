// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { convertGridConfig, GRID_CONFIG_VERSION } from '../configVersion';
import type { GridConfig } from '../gridConfig';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The version of a saved grid (configVersion.ts): exportConfig() writes { version: 2, config, state },
 * importConfig() and convertGridConfig() take it back - and a saved grid without a version, a v5 config
 * (saveConfig()), converted to v6.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

/** a config as v5's saveConfig() saved it: no version */
const V5 = () => ({
    cellHeight: 22,
    readonly: false,
    selectionMode: 'multiple',
    tooltipText: { x: 'y' },
    placeHolderRowCurrentEnityOnly: true,
    columnsPinnedLeft: [{ rows: ['name'], width: 150 }],
    columnsCenter: [
        { rows: ['age', 'born'], width: 100 },
        { rows: ['city'], width: 120 }
    ],
    attributes: [
        { attribute: 'name', label: 'Name', placeHolderRow: 'type a name', currentFilterValue: 'an*', mandatory: true },
        { attribute: 'age', label: 'Age', type: 'number', placeHolderFilter: '≥', currentFilterValue: '' },
        { attribute: 'born', type: 'date' },
        { attribute: 'city', readonly: true }
    ],
    sorting: [{ attribute: 'name', ascending: true }],
    grouping: null,
    expandedGroups: null,
    filter: {
        type: 'GROUP',
        logicalOperator: 'AND',
        filterArguments: [
            { type: 'CONDITION', attribute: 'age', operator: 'GREATER_THAN', value: 30, valueType: 'VALUE' },
            { type: 'CONDITION', attribute: 'city', operator: 'EQUAL', value: 'name', valueType: 'ATTRIBUTE' },
            { type: 'CONDITION', attribute: null, operator: null }
        ]
    }
});

const rows = () => [
    { name: 'Ann', age: 40, born: new Date(1986, 1, 2), city: 'Oslo' },
    { name: 'Bob', age: 20, born: null, city: 'Bob' },
    { name: 'Cid', age: 50, born: null, city: 'Cid' }
];
const fields = () => ({ fields: { age: 'number' as const, born: 'date' as const } });

const V6: GridConfig = {
    readonly: false,
    columns: { name: { label: 'Name' }, age: { label: 'Age' } },
    layout: {
        center: [
            { fields: ['name'], width: 120 },
            { fields: ['age'], width: 80 }
        ]
    }
};

describe('convertGridConfig - version 1, a v5 config', () => {
    it('expect attributes as columns, columns* as the layout, the state of v5 as initialState and state', () => {
        const { version, config, state } = convertGridConfig(V5());
        expect(version).toBe(GRID_CONFIG_VERSION);
        expect(config.columns).toEqual({
            name: { label: 'Name', placeholderRow: 'type a name' },
            age: { label: 'Age', placeholderFilter: '≥' },
            born: {},
            city: { readonly: true }
        });
        expect(config.layout).toEqual({
            left: [{ fields: ['name'], width: 150 }],
            center: [
                { fields: ['age', 'born'], width: 100 },
                { fields: ['city'], width: 120 }
            ],
            right: []
        });
        const filter = {
            group: 'AND',
            children: [
                { field: 'age', operator: 'GREATER_THAN', value: 30 },
                { field: 'city', operator: 'EQUAL', valueField: 'name' }
            ]
        };
        expect(config.initialState).toEqual({
            sorting: [{ attribute: 'name', ascending: true }],
            grouping: [],
            expandedGroups: [],
            filter,
            headerFilters: { name: { value: 'an*' } }
        });
        expect(state).toEqual({ ...config.initialState, layout: config.layout });
        // the options that did not change kept, the gone ones left out, the misspelt one with its v6 name
        expect(config.cellHeight).toBe(22);
        expect(config.placeholderRowCurrentEntityOnly).toBe(true);
        for (const gone of ['selectionMode', 'tooltipText', 'attributes', 'columnsCenter', 'sorting', 'filter']) {
            expect(gone in config, gone).toBe(false);
        }
    });

    it('expect version 1 given to be the same as none, the saved grid not changed', () => {
        const saved = V5();
        const copy = structuredClone(saved);
        expect(convertGridConfig({ ...saved, version: 1 })).toEqual(convertGridConfig(saved));
        expect(saved).toEqual(copy);
    });

    it('expect a v5 config of few options: an empty layout, no state of its own', () => {
        expect(convertGridConfig({ columnsCenter: [{ rows: ['a'], width: 50 }] })).toEqual({
            version: 2,
            config: {
                columns: {},
                layout: { left: [], center: [{ fields: ['a'], width: 50 }], right: [] },
                initialState: { sorting: [], grouping: [], expandedGroups: [], filter: null, headerFilters: {} }
            },
            state: {
                sorting: [],
                grouping: [],
                expandedGroups: [],
                filter: null,
                headerFilters: {},
                layout: { left: [], center: [{ fields: ['a'], width: 50 }], right: [] }
            }
        });
    });
});

describe('convertGridConfig - version 2, and what is none', () => {
    it('expect version 2 as it is, copied; state left out when there is none', () => {
        const saved = { version: 2, config: V6, state: { sorting: [{ attribute: 'age', ascending: false }] } };
        const converted = convertGridConfig(saved);
        expect(converted).toEqual(saved);
        expect(converted.config).not.toBe(V6);
        expect(convertGridConfig({ version: 2, config: V6, state: null })).toEqual({ version: 2, config: V6 });
    });

    it('expect a TypeError that says what is wrong', () => {
        expect(() => convertGridConfig(null)).toThrow(/a saved grid is an object/);
        expect(() => convertGridConfig([])).toThrow(TypeError);
        expect(() => convertGridConfig({ version: '2', config: V6 })).toThrow(/version is a whole number from 1/);
        expect(() => convertGridConfig({ version: 0, config: V6 })).toThrow(TypeError);
        expect(() => convertGridConfig({ version: 3, config: V6 })).toThrow(/version 3 is newer than this grid's \(2\)/);
        expect(() => convertGridConfig({ version: 2 })).toThrow(/config of version 2 is an object/);
        expect(() => convertGridConfig({ version: 2, config: V6, state: 'x' })).toThrow(/state is an object/);
        // a v6 config without a version is no v5 config: not converted into an empty grid
        expect(() => convertGridConfig(V6)).toThrow(/has layout, columns of v6 - save it as \{ version: 2, config \}/);
    });
});

describe('exportConfig() and importConfig()', () => {
    it('expect exportConfig to be the version, the config given with updateConfig, and the state - JSON', async () => {
        const { gridInterface } = await mountGrid(V6, rows(), fields());
        gridInterface.updateConfig({ readonly: true });
        gridInterface.setState({ sorting: [{ attribute: 'age', ascending: false }] });
        const saved = gridInterface.exportConfig();
        expect(saved.version).toBe(2);
        expect(saved.config).toEqual({ ...V6, readonly: true });
        expect(saved.state).toEqual(gridInterface.getState());
        expect(JSON.parse(JSON.stringify(saved)).config).toEqual(saved.config);
        // a copy: changing it changes no grid
        saved.config.columns!.name.label = 'changed';
        expect(gridInterface.exportConfig().config.columns?.name.label).toBe('Name');
    });

    it('expect importConfig to take back what exportConfig made: the config and the state', async () => {
        const { gridInterface } = await mountGrid(V6, rows(), fields());
        gridInterface.setState({ sorting: [{ attribute: 'age', ascending: false }], headerFilters: { name: { value: 'b*' } } });
        const saved = JSON.parse(JSON.stringify(gridInterface.exportConfig()));

        const { gridInterface: other, datasource } = await mountGrid(V6, rows(), fields());
        other.importConfig(saved);
        expect(other.getState().sorting).toEqual([{ attribute: 'age', ascending: false }]);
        expect(other.getState().headerFilters).toEqual(gridInterface.getState().headerFilters);
        expect(datasource.getRows().map((row) => row.name)).toEqual(['Cid', 'Ann', 'Bob']);
    });

    it('expect importConfig to convert a v5 config: its columns, layout, sort and filter', async () => {
        const { gridInterface, datasource } = await mountGrid(V6, rows(), fields());
        gridInterface.importConfig(V5());
        const state = gridInterface.getState();
        expect(state.layout.left?.map((column) => column.fields)).toEqual([['name']]);
        expect(state.layout.center.map((column) => column.fields)).toEqual([['age', 'born'], ['city']]);
        expect(state.headerFilters.name?.value).toBe('an*');
        // the v5 filter: age > 30 and city = name - Cid, whose city is Cid
        expect(datasource.getRows().map((row) => row.name)).toEqual(['Cid']);
        expect(gridInterface.exportConfig().config.columns?.name).toEqual({ label: 'Name', placeholderRow: 'type a name' });
    });

    it('expect a saved grid without a state to start as its config says, one that throws to change nothing', async () => {
        const { gridInterface } = await mountGrid(V6, rows(), fields());
        gridInterface.setState({ sorting: [{ attribute: 'age', ascending: false }] });
        gridInterface.importConfig({
            version: 2,
            config: { ...V6, initialState: { sorting: [{ attribute: 'name', ascending: true }] } }
        });
        expect(gridInterface.getState().sorting).toEqual([{ attribute: 'name', ascending: true }]);

        const before = gridInterface.exportConfig();
        expect(() => gridInterface.importConfig({ version: 9, config: V6 })).toThrow(TypeError);
        expect(() => gridInterface.importConfig({ version: 2, config: { ...V6, detailForm: { show: 1 } as any } })).toThrow();
        expect(gridInterface.exportConfig()).toEqual(before);
    });

    it("expect the views - the config's and the user's saved - in exportConfig, given back by importConfig", async () => {
        const { gridInterface } = await mountGrid(
            { ...V6, views: [{ id: 'cfg', name: 'From the config', state: { sorting: [] } }] },
            rows(),
            fields()
        );
        // the user saves the state shown as a view of their own (the views button's Save as new view…)
        gridInterface.setState({ sorting: [{ attribute: 'age', ascending: false }] });
        gridInterface.saveViewAs('Mine');
        const saved = JSON.parse(JSON.stringify(gridInterface.exportConfig()));
        expect(saved.views.map((view: { name: string }) => view.name)).toEqual(['From the config', 'Mine']);
        expect(saved.config.views).toEqual([{ id: 'cfg', name: 'From the config', state: { sorting: [] } }]);

        const { gridInterface: other } = await mountGrid(V6, rows(), fields());
        expect(other.getViews()).toEqual([]);
        other.importConfig(saved);
        expect(other.getViews().map((view) => view.name)).toEqual(['From the config', 'Mine']);
        expect(other.getViews()[1].state.sorting).toEqual([{ attribute: 'age', ascending: false }]);
    });

    it('expect a grid without views to export none, and a saved grid without views to leave them', async () => {
        const { gridInterface } = await mountGrid(V6, rows(), fields());
        expect('views' in gridInterface.exportConfig()).toBe(false);
        gridInterface.setViews([{ id: 'a', name: 'A', state: {} }]);
        gridInterface.importConfig({ version: 2, config: V6 });
        expect(gridInterface.getViews().map((view) => view.id)).toEqual(['a']);
        expect(() => gridInterface.importConfig({ version: 2, config: V6, views: 'x' })).toThrow(/views is a list of views/);
    });
});
