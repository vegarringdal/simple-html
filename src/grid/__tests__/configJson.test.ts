// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { isGroupRow } from '../../datasource/entity';
import { and, where } from '../../datasource/filterExpression';
import { registerFormatter } from '../../datasource/formatterRegistry';
import { NumberFormatterDot } from '../../datasource/numberFormatterDot';
import { registerValidator } from '../../datasource/validatorRegistry';
import type { GridConfig, GridState } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { type MountedGrid, mountGrid, renderedColumn, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * The config, the state and the datasource's fields + formatters are plain JSON: they can be stored
 * (in a backend, say) and given back. The functions are hooks and registered formatters, code.
 *
 * Each part goes through `JSON.parse(JSON.stringify(x))` and must come back equal - and work the same.
 * A `Date` is the exception: it comes back as its ISO text, see the state tests below.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const viaJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const rows = () => [
    { name: 'Ann', age: 36, born: new Date(1990, 4, 17), valueType: 'number', value: 12.5, country: 'Norway', phone: '1' },
    { name: 'Bob', age: 17, born: new Date(2009, 0, 2), valueType: 'text', value: 'x', country: 'Norway', phone: '2' },
    {
        name: 'Cid',
        age: 52,
        born: new Date(1974, 8, 30),
        valueType: 'date',
        value: new Date(2020, 1, 3),
        country: 'Sweden',
        phone: '3'
    },
    { name: 'Dan', age: 0, born: null, valueType: 'boolean', value: true, country: 'Sweden', phone: '4' }
];

// name is required: the stripes of an empty name are part of the markup compared
const fields = (): DatasourceOptions => ({ fields: { name: { validate: ['required'] }, age: 'number', born: 'date' } });

/**
 * a config with every option set
 */
const fullConfig = (): GridConfig => ({
    columns: {
        name: {
            label: 'Name',
            placeholderRow: 'required',
            placeholderFilter: 'search',
            operator: 'CONTAINS',
            filterOperators: ['CONTAINS', 'BEGIN_WITH', 'IN', 'NOT_IN', 'IS_BLANK'],
            filterCaseSensitive: true,
            focusButton: 'SHOW_IF_GRID_NOT_READONLY'
        },
        age: {
            label: 'Age',
            readonly: true,
            numberOverride: 'ZERO_TO_BLANK',
            aggregate: 'avg',
            filterOperators: ['GREATER_THAN_OR_EQUAL_TO', 'BETWEEN', 'IS_BLANK']
        },
        born: { placeholderFilter: 'from' },
        value: { dynamicCellTypeColumn: 'valueType', allowPasteClearOnly: true },
        country: { label: 'Country', aggregate: 'count' },
        // not in the layout: the column chooser can add it
        phone: { label: 'Phone' }
    },
    layout: {
        left: [{ fields: ['name'], width: 150 }],
        center: [
            { fields: ['age', 'born'], width: 100 },
            { fields: ['valueType'], width: 80 },
            { fields: ['value'], width: 120 }
        ],
        right: [{ fields: ['country'], width: 100 }]
    },
    initialState: {
        sorting: [{ attribute: 'name', ascending: false }],
        grouping: [{ attribute: 'country', title: 'Country' }],
        expandedGroups: ['Norway'],
        filter: and(where('age', 'GREATER_THAN_OR_EQUAL_TO', 17)),
        headerFilters: { age: { value: 17 }, name: { value: null, operator: 'BEGIN_WITH' } }
    },
    cellHeight: 24,
    multilineLineHeight: 18,
    panelHeight: 26,
    cellHeaderLabelHeight: 30,
    footerHeight: 40,
    selectSizeHeight: 16,
    hideLabels: false,
    hideFilter: false,
    filterOperatorIndicator: false,
    readonly: false,
    autoRemoveContextMenuOnScrollEvent: true,
    dimRepeatedValues: true,
    rowStatus: false,
    editedMarker: false,
    mergeHighlight: false,
    copyHeaders: false,
    tooltips: false,
    texts: {
        'filterEditor.close.tooltip': 'Lukk',
        'datePicker.month.january': 'Januar',
        'footer.summary.count': 'Antall: {count}'
    },
    datePickerConfig: {
        showWeek: false,
        isoWeek: false,
        weekStart: 0,
        rowHeight: 20,
        monthWidth: 200,
        monthMargin: 8,
        hideDimmedDates: true,
        showYearInMonth: true,
        datepickerHeight: 300
    },
    placeholderRowCurrentEntityOnly: false,
    groupAggregates: true,
    totalsRow: true
});

/**
 * what a grid shows and holds: the state, the displayed rows (group rows by id) and the markup
 */
function shown({ element, datasource, gridInterface }: MountedGrid) {
    return {
        state: gridInterface.getState(),
        rows: datasource.getRows().map((row) => (isGroupRow(row) ? row.__groupID : row.name)),
        hidden: gridInterface.getHiddenFields(),
        // the ids aria-owns points to start with the grid's own prefix, simple-html-grid-<n>
        html: element.innerHTML.replace(/simple-html-grid-\d+-/g, 'simple-html-grid-<n>-')
    };
}

describe('config as JSON - GridConfig', () => {
    it('expect a config with every option to come back from JSON unchanged', () => {
        expect(viaJson(fullConfig())).toEqual(fullConfig());
    });

    it('expect a grid made from the JSON copy to show and hold the same', async () => {
        const original = await mountGrid(fullConfig(), rows(), fields());
        const fromJson = await mountGrid(viaJson(fullConfig()), rows(), fields());

        expect(shown(fromJson)).toEqual(shown(original));
        // a sanity check of what is compared: grouped, sorted, filtered and the right pinned column
        expect(shown(fromJson).rows).toEqual(['Norway', 'Bob', 'Ann', 'Sweden']);
        expect(fromJson.gridInterface.getLayoutFields()).toEqual(['name', 'age', 'born', 'valueType', 'value', 'country']);
        // and the aggregates: in the totals row, over Ann, Bob and Cid, and in the group rows
        const aggregate = (selector: string) =>
            fromJson.element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
        expect(aggregate('.simple-html-grid-totals [data-aggregate="avg:age"]')).toEqual('Avg Age 35');
        expect(aggregate('.simple-html-grid-body-row-container-group [data-aggregate="count:country"]')).toEqual('Count 2');
    });

    it('expect updateConfig() to take a config part from JSON', async () => {
        const { element, gridInterface } = await mountGrid(simpleConfig());
        const saved = JSON.stringify({ columns: { firstname: { label: 'First name' } }, readonly: false });

        gridInterface.updateConfig(JSON.parse(saved));

        expect(element.querySelector('[data-attribute-header="firstname"]')?.textContent?.trim()).toEqual('First name');
        expect((element.querySelector('input[data-attribute="firstname"]') as HTMLInputElement).readOnly).toBe(false);
    });
});

describe('config as JSON - GridState', () => {
    /**
     * a grid the user worked with: sorted, grouped, a group expanded, a header filter typed with an
     * operator picked, a column moved
     */
    async function workedWith() {
        const config: GridConfig = {
            readonly: false,
            layout: { center: ['name', 'age', 'country'].map((field) => ({ fields: [field], width: 100 })) }
        };
        const mounted = await mountGrid(config, rows(), fields());
        const { datasource, gridInterface, element } = mounted;
        datasource.group([{ attribute: 'country', title: 'Country' }]);
        datasource.expandGroup('Sweden');
        datasource.sort([{ attribute: 'age', ascending: false }], { add: true });
        gridInterface.setState({ headerFilters: { name: { value: null, operator: 'CONTAINS', caseSensitive: true } } });
        typeInHeaderFilter(element, 'name', 'a');
        gridInterface.setState({
            layout: { left: [{ fields: ['country'], width: 90 }], center: config.layout.center.slice(0, 2) }
        });
        return { mounted, config };
    }

    it('expect a getState() result to come back from JSON unchanged', async () => {
        const { mounted } = await workedWith();
        const state = mounted.gridInterface.getState();

        expect(viaJson(state)).toEqual(state);
        // a sanity check that the state has every part
        expect(state.grouping).toHaveLength(1);
        expect(state.expandedGroups).toEqual(['Sweden']);
        expect(state.headerFilters).toEqual({ name: { value: 'a', operator: 'CONTAINS', caseSensitive: true } });
        expect(state.filter).toEqual({
            group: 'AND',
            children: [{ field: 'name', operator: 'CONTAINS', value: 'a', caseSensitive: true }]
        });
    });

    it('expect setState() with the JSON copy to give another grid the same state and rows', async () => {
        const { mounted, config } = await workedWith();
        const saved = JSON.stringify(mounted.gridInterface.getState());

        const other = await mountGrid(config, rows(), fields());
        other.gridInterface.setState(JSON.parse(saved));

        expect(shown(other)).toEqual(shown(mounted));
    });
});

describe('config as JSON - a Date in the state', () => {
    const config: GridConfig = {
        layout: {
            center: [
                { fields: ['name'], width: 100 },
                { fields: ['born'], width: 100 },
                { fields: ['since'], width: 100 }
            ]
        }
    };
    // `since` holds Dates but is not listed in the fields: a text field
    const data = () => [
        { name: 'a', born: new Date(2001, 4, 17, 10), since: new Date(2001, 4, 17, 10) },
        { name: 'b', born: new Date(2001, 4, 18, 10), since: new Date(2001, 4, 18, 10) },
        { name: 'c', born: new Date(2001, 4, 19, 10), since: new Date(2001, 4, 19, 10) }
    ];
    const names = ({ datasource }: MountedGrid) => datasource.getDataRows().map((row) => row.name);

    it('expect the Date to come back as its ISO text, which setState() keeps as text', async () => {
        const mounted = await mountGrid(config, data(), { fields: { born: 'date' } });
        const from = new Date(2001, 4, 18);
        mounted.gridInterface.setState({
            filter: and(where('born', 'GREATER_THAN_OR_EQUAL_TO', from)),
            headerFilters: { born: { value: from } }
        });
        const saved: GridState = viaJson(mounted.gridInterface.getState());

        expect(saved.filter).toEqual(and(where('born', 'GREATER_THAN_OR_EQUAL_TO', from.toISOString())));
        expect(saved.headerFilters).toEqual({ born: { value: from.toISOString() } });

        mounted.gridInterface.resetState();
        mounted.gridInterface.setState(saved);

        // not turned back into a Date
        expect(mounted.gridInterface.getState().headerFilters.born.value).toEqual(from.toISOString());
    });

    it('expect a date field to filter and show the ISO text the same as the Date', async () => {
        const mounted = await mountGrid(config, data(), { fields: { born: 'date' } });
        const from = new Date(2001, 4, 18);
        mounted.gridInterface.setState({
            filter: and(where('born', 'GREATER_THAN_OR_EQUAL_TO', from)),
            headerFilters: { born: { value: from } }
        });
        const before = { rows: names(mounted), header: headerFilterInput(mounted.element, 'born').value };
        const filterString = mounted.datasource.getFilterString();
        const saved = JSON.stringify(mounted.gridInterface.getState());

        mounted.gridInterface.resetState();
        mounted.gridInterface.setState(JSON.parse(saved));

        expect(before).toEqual({ rows: ['b', 'c'], header: '2001-05-18' });
        expect({ rows: names(mounted), header: headerFilterInput(mounted.element, 'born').value }).toEqual(before);
        expect(mounted.datasource.getFilterString()).toEqual(filterString);
    });

    it('expect a Date on a field that is not a date field to filter as text after JSON - list its type', async () => {
        const mounted = await mountGrid(config, data(), { fields: { born: 'date' } });
        mounted.gridInterface.setState({ filter: and(where('since', 'GREATER_THAN_OR_EQUAL_TO', new Date(2001, 4, 18))) });
        expect(names(mounted)).toEqual(['b', 'c']);
        const saved = JSON.stringify(mounted.gridInterface.getState());

        mounted.gridInterface.setState(JSON.parse(saved));

        // the text '2001-05-1...Z' compared with the row values as text: not the rows of before
        expect(names(mounted)).not.toEqual(['b', 'c']);

        // with its type listed, the text filters the same as the Date did
        const listed = await mountGrid(config, data(), { fields: { born: 'date', since: 'datetime' } });
        listed.gridInterface.setState(JSON.parse(saved));
        expect(names(listed)).toEqual(['b', 'c']);
    });
});

describe('config as JSON - the datasource fields and formatters', () => {
    // a formatter of your own is code: registered under an id the JSON names
    registerFormatter('configJson.money', {
        ...NumberFormatterDot,
        format: (value) => (typeof value === 'number' ? value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''),
        parse: (text) => NumberFormatterDot.parse(text.replaceAll(' ', ''))
    });
    // and so is a validator of your own, its options are in the JSON
    registerValidator('configJson.below', (value, _row, rule) =>
        typeof value === 'number' && typeof rule.limit === 'number' && value >= rule.limit ? 'at least {limit}' : null
    );

    const options = (): Pick<DatasourceOptions, 'fields' | 'formatters'> => ({
        fields: {
            id: 'number',
            name: { label: 'Name', validate: ['required', { id: 'maxLength', value: 2, message: 'at most {value}' }] },
            price: {
                type: 'number',
                label: 'Price',
                formatter: 'configJson.money',
                validate: [{ id: 'configJson.below', limit: 100 }]
            },
            born: { type: 'date', formatter: 'dateDDMMYYYY' },
            lastLogin: 'datetime',
            active: 'boolean',
            amount: {
                type: 'number',
                validate: [
                    { id: 'min', value: 0 },
                    { id: 'pattern', value: '^x$' }
                ]
            }
        },
        formatters: { number: 'numberComma', datetime: 'datetimeDDMMYYYY' }
    });

    const data = () => [
        {
            id: 1,
            name: 'Ann',
            price: 12345.6,
            born: new Date(1990, 4, 17),
            lastLogin: new Date(2026, 10, 20, 8, 15),
            active: true,
            amount: 1.5
        }
    ];

    const gridConfig = (): GridConfig => ({
        layout: { center: ['name', 'price', 'born', 'lastLogin', 'amount'].map((field) => ({ fields: [field], width: 100 })) }
    });

    it('expect them to come back from JSON unchanged', () => {
        expect(viaJson(options())).toEqual(options());
    });

    it('expect a datasource made from the JSON copy to resolve every field the same', async () => {
        const original = await mountGrid(gridConfig(), data(), { key: 'id', ...options() });
        const fromJson = await mountGrid(gridConfig(), data(), { key: 'id', ...viaJson(options()) });

        for (const field of ['id', 'name', 'price', 'born', 'lastLogin', 'active', 'amount', 'not-listed']) {
            expect(fromJson.datasource.getField(field)).toEqual(original.datasource.getField(field));
        }
        const cells = (element: GridElement) =>
            ['price', 'born', 'lastLogin', 'amount'].map((field) => renderedColumn(element, field)[0]);
        expect(cells(fromJson.element)).toEqual(cells(original.element));
        expect(cells(fromJson.element)).toEqual(['12 345.60', '17.05.1990', '20.11.2026T08:15:00', '1,5']);
    });

    it('expect a datasource made from the JSON copy to validate the same', async () => {
        const original = await mountGrid(gridConfig(), data(), { key: 'id', ...options() });
        const fromJson = await mountGrid(gridConfig(), data(), { key: 'id', ...viaJson(options()) });

        const errors = (mounted: MountedGrid) =>
            mounted.datasource.validate().map(({ field, messages }) => ({ field, messages }));
        expect(errors(fromJson)).toEqual(errors(original));
        // a sanity check that the rules ran: a built-in with a message of its own, one of your own
        expect(errors(fromJson)).toEqual([
            { field: 'name', messages: ['at most 2'] },
            { field: 'price', messages: ['at least 100'] }
        ]);
    });
});
