// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, or, where } from '../../datasource/filterExpression';
import type { ExportedGrid } from '../configVersion';
import type { GridConfig } from '../gridConfig';
import { columnChooserFields } from '../gridFunctions/contextMenuColumnChooser';
import { reconcileColumns, type SourceColumn } from '../reconcileColumns';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * A saved grid brought up to date with the columns its source has now (reconcileColumns.ts), and
 * gridInterface.updateColumns() on a grid that is shown: a field gone leaves everything that named it, a
 * new one is listed by the column chooser.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});
beforeEach(() => {
    document.body.innerHTML = '';
});

/** a grid made from a view with company, country, city, balance - city has gone from it since */
const config = (): GridConfig => ({
    columns: {
        company: { label: 'Company', readonly: true },
        country: { label: 'Country' },
        city: {
            label: 'City',
            format: { rules: [{ operator: 'EQUAL', value: 'Oslo', background: 'blue' }] }
        },
        balance: {
            format: {
                rules: [
                    // on balance only: stays
                    { operator: 'LESS_THAN', value: '0', color: 'red' },
                    // a condition on city and one on country: the one on country stays
                    {
                        conditions: [
                            { field: 'city', operator: 'EQUAL', value: 'Oslo' },
                            { field: 'country', operator: 'EQUAL', value: 'Norway' }
                        ],
                        background: 'yellow'
                    },
                    // on city only: goes
                    { conditions: [{ field: 'city', operator: 'IS_BLANK' }], background: 'grey' },
                    // a formula naming city: goes
                    { expression: '{city} = "Oslo"', bold: true }
                ]
            }
        }
    },
    layout: {
        left: [{ fields: ['company'], width: 120 }],
        center: [
            { fields: ['country', 'city'], width: 100 },
            { fields: ['city'], width: 100 },
            { fields: ['balance'], width: 100 }
        ]
    },
    calculatedColumns: {
        // names city: goes, and so does the one naming it
        place: { formula: 'CONCAT({city}, ", ", {country})', label: 'Place' },
        placeUpper: { formula: 'CONCAT({place}, "!")', label: 'Upper place' },
        // names balance only: stays
        double: { formula: '{balance} * 2', type: 'number' }
    },
    detailForm: {
        show: true,
        fields: ['company', { section: 'Where' }, 'city', 'country'],
        fieldOptions: { city: { paddingTop: 4 } }
    }
});

const SOURCE: SourceColumn[] = [
    { field: 'company', label: 'Company name' },
    { field: 'country' },
    { field: 'balance', label: 'Balance' },
    // new in the view
    { field: 'region', label: 'Region' }
];

const saved = (): ExportedGrid => ({
    version: 2,
    config: config(),
    state: {
        sorting: [
            { attribute: 'city', ascending: true },
            { attribute: 'company', ascending: true }
        ],
        grouping: [{ attribute: 'city', title: 'City' }],
        filter: and(where('city', 'EQUAL', 'Oslo'), or(where('country', 'EQUAL', 'Norway'), where('city', 'CONTAINS', 'o')), {
            field: 'country',
            operator: 'EQUAL',
            valueField: 'city'
        }),
        headerFilters: { city: { value: 'Oslo' }, country: { value: 'Nor*' } },
        formats: { city: { label: 'Town' }, country: { label: 'Land' } },
        aggregates: { city: ['count'], balance: ['sum'] }
    }
});

describe('reconcileColumns', () => {
    it('expect the report: the field added, the one removed, the calculated columns and rules that needed it', () => {
        const { report } = reconcileColumns(saved(), SOURCE);
        expect(report.added).toEqual(['region']);
        expect(report.removed).toEqual(['city']);
        expect(report.removedCalculated).toEqual(['place', 'placeUpper']);
        expect(report.removedRules.map(({ field, rule }) => [field, rule.background ?? (rule.bold ? 'bold' : '')])).toEqual([
            ['balance', 'grey'],
            ['balance', 'bold']
        ]);
    });

    it("expect the config's columns the source's - its options over the saved ones - the layout without the field", () => {
        const { grid } = reconcileColumns(saved(), SOURCE);
        expect(Object.keys(grid.config.columns ?? {})).toEqual(['company', 'country', 'balance', 'region']);
        // the source's label over the saved one, the saved readonly kept
        expect(grid.config.columns?.company).toEqual({ label: 'Company name', readonly: true });
        expect(grid.config.layout).toEqual({
            left: [{ fields: ['company'], width: 120 }],
            center: [
                { fields: ['country'], width: 100 },
                { fields: ['balance'], width: 100 }
            ]
        });
        expect(grid.config.calculatedColumns).toEqual({ double: { formula: '{balance} * 2', type: 'number' } });
        expect(grid.config.detailForm).toEqual({
            show: true,
            fields: ['company', { section: 'Where' }, 'country'],
            fieldOptions: {}
        });
    });

    it('expect a rule with a condition left to keep it, the others to stay as they were', () => {
        const { grid } = reconcileColumns(saved(), SOURCE);
        expect(grid.config.columns?.balance.format?.rules).toEqual([
            { operator: 'LESS_THAN', value: '0', color: 'red' },
            { conditions: [{ field: 'country', operator: 'EQUAL', value: 'Norway' }], background: 'yellow' }
        ]);
    });

    it('expect the state without the field: sort, grouping, filter (a group left with one), header filters, formats, aggregates', () => {
        const { grid } = reconcileColumns(saved(), SOURCE);
        expect(grid.state).toEqual({
            sorting: [{ attribute: 'company', ascending: true }],
            grouping: [],
            filter: {
                group: 'AND',
                children: [{ group: 'OR', children: [{ field: 'country', operator: 'EQUAL', value: 'Norway' }] }]
            },
            headerFilters: { country: { value: 'Nor*' } },
            formats: { country: { label: 'Land' } },
            aggregates: { balance: ['sum'] }
        });
    });

    it('expect a filter of the gone field only to be none; the saved grid unchanged', () => {
        const before = saved();
        const copy = structuredClone(before);
        before.state = { filter: where('city', 'EQUAL', 'Oslo') };
        const { grid } = reconcileColumns(before, SOURCE);
        expect(grid.state?.filter).toBeNull();
        reconcileColumns(copy, SOURCE);
        expect(copy).toEqual(saved());
    });

    it('expect the views of the config and the initialState cleaned too', () => {
        const withViews = saved();
        withViews.config.initialState = { sorting: [{ attribute: 'city', ascending: false }] };
        withViews.config.views = [{ id: 'oslo', name: 'Oslo', state: { filter: where('city', 'EQUAL', 'Oslo'), sorting: [] } }];
        const { grid } = reconcileColumns(withViews, SOURCE);
        expect(grid.config.initialState).toEqual({ sorting: [] });
        expect(grid.config.views).toEqual([{ id: 'oslo', name: 'Oslo', state: { filter: null, sorting: [] } }]);
    });

    it('expect showNew to put a new column at the end of the scrolling ones, the config and the state', () => {
        const withLayout = saved();
        withLayout.state = { layout: { center: [{ fields: ['country'], width: 90 }] } };
        const { grid } = reconcileColumns(withLayout, SOURCE, { showNew: true, width: 140 });
        expect(grid.config.layout.center.at(-1)).toEqual({ fields: ['region'], width: 140 });
        expect(grid.state?.layout?.center).toEqual([
            { fields: ['country'], width: 90 },
            { fields: ['region'], width: 140 }
        ]);
    });

    it('expect nothing changed when the source has the same columns', () => {
        const same: SourceColumn[] = ['company', 'country', 'city', 'balance'].map((field) => ({ field }));
        const { grid, report } = reconcileColumns(saved(), same);
        expect(report).toEqual({ added: [], removed: [], removedCalculated: [], removedRules: [] });
        expect(grid.state).toEqual(saved().state);
        expect(grid.config.layout).toEqual(config().layout);
    });
});

describe('gridInterface.updateColumns', () => {
    const rows = () => [
        { company: 'Acme', country: 'Norway', city: 'Oslo', balance: -5, region: 'North' },
        { company: 'Bolt', country: 'Sweden', city: 'Malmö', balance: 10, region: 'South' }
    ];
    const fields = { fields: { balance: 'number' as const } };

    it('expect a grid that is shown brought up to date: the layout, the chooser, the colours, the filter, a view', async () => {
        const { gridInterface, datasource } = await mountGrid(config(), rows(), fields);
        gridInterface.setState({
            filter: and(where('city', 'EQUAL', 'Oslo')),
            sorting: [{ attribute: 'city', ascending: true }]
        });
        gridInterface.setViews([{ id: 'v', name: 'By city', state: { sorting: [{ attribute: 'city', ascending: false }] } }]);
        expect(datasource.getRows()).toHaveLength(1);

        const report = gridInterface.updateColumns(SOURCE);
        expect([report.added, report.removed]).toEqual([['region'], ['city']]);

        const state = gridInterface.getState();
        const shown = [...(state.layout.left ?? []), ...state.layout.center].flatMap((column) => column.fields);
        expect(shown).toEqual(['company', 'country', 'balance']);
        expect(state.sorting).toEqual([]);
        // the filter on city is gone: every row
        expect(datasource.getRows()).toHaveLength(2);
        expect(Object.keys(state.calculatedColumns)).toEqual(['double']);
        // the chooser: region is there, city not
        const chooser = (search: string) => columnChooserFields({ gridInterface }, search).map((each) => each.field);
        expect(chooser('region')).toEqual(['region']);
        expect(chooser('city')).toEqual([]);
        // the views saved: without city
        expect(gridInterface.getViews()).toEqual([{ id: 'v', name: 'By city', state: { sorting: [] } }]);
    });

    it('expect showNew to show the new column', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields);
        gridInterface.updateColumns(SOURCE, { showNew: true });
        expect(gridInterface.getState().layout.center.at(-1)?.fields).toEqual(['region']);
    });
});
