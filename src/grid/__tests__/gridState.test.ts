// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Datasource } from '../../datasource/dataSource';
import { and, type FilterCondition, isFilterGroup, where } from '../../datasource/filterExpression';
import type { GridConfig, GridState } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { GridInterface } from '../gridInterface';
import { footerText, mountGrid, renderedColumn, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import {
    dragAndDrop,
    dragResizeHandle,
    headerFilterInput,
    labelCell,
    menuItem,
    openFilterMenu,
    openLabelMenu,
    typeInHeaderFilter
} from './interactionTestHelpers';

/**
 * getState / setState / resetState and GridConfig.initialState.
 *
 * They must hand out and take in copies. The datasource keeps the sorting/filter objects it is
 * given and changes them in place (shift+click sort), code holding `getFilter()` can change the
 * filter in place, and the grid changes its layout in place (drag/drop, resizing) - so any object
 * shared with them changes behind the user's back.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const ageOver15 = () => and(where('age', 'GREATER_THAN', 15));

const firstnameIsFirst3 = () => where('firstname', 'EQUAL', 'first3');

/**
 * changes the datasource filter in place and re-runs it, the way code holding getFilter() can
 */
function addToFilterInPlace(datasource: Datasource, condition: FilterCondition) {
    const filter = datasource.getFilter();
    if (filter && isFilterGroup(filter)) {
        filter.children.push(condition);
    }
    datasource.filter();
}

/**
 * the text of a header label
 */
const headerLabel = (element: GridElement, field: string) =>
    element.querySelector(`[data-attribute-header="${field}"]`)?.textContent?.trim();

/**
 * what the user does to a grid: moves lastname in front of firstname, makes the first column wider,
 * pins age, types in a header filter and sorts. Every part of the state changes but the grouping
 */
async function changeEverything(element: GridElement, datasource: Datasource) {
    const target = labelCell(element, 'firstname').querySelector('.simple-html-grid-drop-zone-left') as HTMLElement;
    dragAndDrop(labelCell(element, 'lastname'), target);
    dragResizeHandle(element, 0, 50);
    openLabelMenu(element, 'age');
    menuItem('Pin left').click();
    typeInHeaderFilter(element, 'firstname', 'first*');
    datasource.sort({ attribute: 'age', ascending: false });
}

describe('getState', () => {
    it('expect the state a grid starts with', async () => {
        const { gridInterface } = await mountGrid();

        expect(gridInterface.getState()).toEqual({
            layout: {
                left: [],
                center: [
                    { fields: ['firstname'], width: 100 },
                    { fields: ['lastname'], width: 100 },
                    { fields: ['age'], width: 100 }
                ],
                right: []
            },
            sorting: [],
            grouping: [],
            expandedGroups: [],
            filter: null,
            headerFilters: {},
            aggregates: {},
            totalsRow: false
        });
    });

    it('expect the sorting from getState not to change when the user adds a sort column', async () => {
        const { datasource, gridInterface } = await mountGrid();
        datasource.sort({ attribute: 'firstname', ascending: true });

        const state = gridInterface.getState();
        datasource.sort({ attribute: 'age', ascending: false }, { add: true }); // shift+click on a header

        expect(state.sorting).toEqual([{ attribute: 'firstname', ascending: true }]);
    });

    it('expect the filter from getState not to change when the filter is changed in place', async () => {
        const config = simpleConfig();
        config.initialState = { filter: ageOver15() };
        const { datasource, gridInterface } = await mountGrid(config);

        const state = gridInterface.getState();
        addToFilterInPlace(datasource, firstnameIsFirst3());

        expect(state.filter).toEqual(ageOver15());
    });

    it('expect the layout from getState not to change when the user moves, pins and resizes columns', async () => {
        const { element, datasource, gridInterface } = await mountGrid();
        const state = gridInterface.getState();
        const copy = structuredClone(state);

        await changeEverything(element, datasource);

        expect(gridInterface.getState().layout).toEqual({
            left: [{ fields: ['age'], width: 100 }],
            center: [
                { fields: ['lastname'], width: 150 },
                { fields: ['firstname'], width: 100 }
            ],
            right: []
        });
        expect(state).toEqual(copy);
    });

    it('expect changing the state from getState to change nothing in the grid', async () => {
        const { element, gridInterface } = await mountGrid();
        typeInHeaderFilter(element, 'firstname', 'first1');
        const before = gridInterface.getState();

        const state = gridInterface.getState();
        state.layout.center[0].width = 999;
        state.layout.center[1].fields.push('age');
        state.layout.center.reverse();
        state.sorting.push({ attribute: 'age', ascending: true });
        state.headerFilters.firstname.value = 'changed';
        if (state.filter && isFilterGroup(state.filter)) {
            state.filter.children.push(firstnameIsFirst3());
        }

        expect(gridInterface.getState()).toEqual(before);
        expect(renderedColumn(element, 'firstname')).toEqual(['first1']);
    });

    it('expect the header filter typed by the user in headerFilters, and its condition in filter', async () => {
        const { element, gridInterface } = await mountGrid();
        typeInHeaderFilter(element, 'firstname', 'first1');

        const state = gridInterface.getState();
        expect(state.headerFilters).toEqual({ firstname: { value: 'first1' } });
        expect(state.filter).toEqual(and(where('firstname', 'EQUAL', 'first1')));
    });

    it('expect the operator picked in the header filter menu in headerFilters, not in the column config', async () => {
        const config = simpleConfig();
        const { element, gridInterface } = await mountGrid(config);
        const columns: unknown[] = [];
        gridInterface.on('filter-operator-change', (data) => columns.push(structuredClone(data.column)));
        typeInHeaderFilter(element, 'age', '20');

        openFilterMenu(element, 'age');
        menuItem('Equal').click();

        expect(gridInterface.getState().headerFilters).toEqual({ age: { value: 20, operator: 'EQUAL' } });
        expect(gridInterface.getState().filter).toEqual(and(where('age', 'EQUAL', 20)));
        // the column's own options are config, the default operator there stays unset
        expect(columns).toEqual([{}]);
        expect(config.columns).toBeUndefined();
    });

    it('expect an operator picked without a value to be kept, and the column filter cleared to keep it', async () => {
        const { element, gridInterface } = await mountGrid();
        openFilterMenu(element, 'lastname');
        menuItem('Contains').click();
        expect(gridInterface.getState().headerFilters).toEqual({ lastname: { value: null, operator: 'CONTAINS' } });

        typeInHeaderFilter(element, 'lastname', 'ast3');
        expect(gridInterface.getState().filter).toEqual(and(where('lastname', 'CONTAINS', 'ast3')));

        openFilterMenu(element, 'lastname');
        menuItem('Clear Filter').click();
        expect(gridInterface.getState().headerFilters).toEqual({ lastname: { value: null, operator: 'CONTAINS' } });
    });
});

describe('setState', () => {
    it('expect the state passed in not to be changed by later sorting and filtering', async () => {
        const { datasource, gridInterface } = await mountGrid();

        const state: Partial<GridState> = {
            sorting: [{ attribute: 'firstname', ascending: true }],
            filter: ageOver15()
        };
        gridInterface.setState(state);

        datasource.sort({ attribute: 'firstname', ascending: false }, { add: true }); // shift+click on a header
        addToFilterInPlace(datasource, firstnameIsFirst3());

        expect(state.sorting).toEqual([{ attribute: 'firstname', ascending: true }]);
        expect(state.filter).toEqual(ageOver15());
    });

    it('expect the layout passed in not to be changed when the user moves or resizes columns', async () => {
        const { element, datasource, gridInterface } = await mountGrid();
        const state = gridInterface.getState();
        gridInterface.setState(state);
        const copy = structuredClone(state);

        await changeEverything(element, datasource);

        expect(state).toEqual(copy);
    });

    it('expect getState, changes, then setState to give the same grid back', async () => {
        const { element, datasource, gridInterface } = await mountGrid();
        datasource.sort({ attribute: 'age', ascending: false });
        typeInHeaderFilter(element, 'lastname', 'last*');
        const saved = gridInterface.getState();
        const firstnames = renderedColumn(element, 'firstname');

        // a different layout, another header filter, another sort, grouped
        await changeEverything(element, datasource);
        datasource.group([{ attribute: 'lastname', title: 'Last name' }]);
        expect(gridInterface.getState()).not.toEqual(saved);

        gridInterface.setState(saved);

        expect(gridInterface.getState()).toEqual(saved);
        expect(renderedColumn(element, 'firstname')).toEqual(firstnames);
        expect(headerFilterInput(element, 'lastname').value).toEqual('last*');
        expect(headerFilterInput(element, 'firstname').value).toEqual('');
        expect(
            element.querySelectorAll('.simple-html-grid-header-row-container-pinned-left [data-attribute-header]')
        ).toHaveLength(0);
    });

    it('expect a partial state to change what it has and keep the rest', async () => {
        const { element, datasource, gridInterface } = await mountGrid();
        await changeEverything(element, datasource);
        datasource.group([{ attribute: 'lastname', title: 'Last name' }]);
        datasource.expandGroup();
        const before = gridInterface.getState();

        gridInterface.setState({ sorting: [{ attribute: 'firstname', ascending: true }] });

        const after = gridInterface.getState();
        // the grouped field stays first in the sort
        expect(after.sorting).toEqual([
            { attribute: 'lastname', ascending: true },
            { attribute: 'firstname', ascending: true }
        ]);
        expect({ ...after, sorting: before.sorting }).toEqual(before);
        expect(headerFilterInput(element, 'firstname').value).toEqual('first*');
    });

    it('expect only the layout to change when only the layout is given', async () => {
        const { element, gridInterface } = await mountGrid();
        typeInHeaderFilter(element, 'firstname', 'first1');
        const before = gridInterface.getState();

        gridInterface.setState({ layout: { center: [{ fields: ['age', 'firstname'], width: 150 }] } });

        expect(gridInterface.getState()).toEqual({
            ...before,
            layout: { left: [], center: [{ fields: ['age', 'firstname'], width: 150 }], right: [] }
        });
        expect(headerFilterInput(element, 'firstname').value).toEqual('first1');
        expect(headerLabel(element, 'lastname')).toBeUndefined();
    });

    it('expect a field in the new layout without a columns entry to get the defaults', async () => {
        const { element, gridInterface } = await mountGrid(simpleConfig(), [{ firstname: 'a', nick_name: 'b' }]);

        gridInterface.setState({ layout: { center: [{ fields: ['firstname', 'nick_name'], width: 100 }] } });

        expect(headerLabel(element, 'nick_name')).toEqual('Nick Name');
        expect(renderedColumn(element, 'nick_name')).toEqual(['b']);
        // the fields that left the layout can be added back from the column chooser
        expect(gridInterface.getHiddenFields().sort()).toEqual(['age', 'lastname']);
    });

    it('expect an empty sort to remove the sort and give the rows their own order back', async () => {
        const { element, datasource, gridInterface } = await mountGrid();
        datasource.sort({ attribute: 'age', ascending: false });
        expect(renderedColumn(element, 'age')).toEqual(['50', '40', '30', '20', '10']);

        gridInterface.setState({ sorting: [] });

        expect(gridInterface.getState().sorting).toEqual([]);
        expect(renderedColumn(element, 'age')).toEqual(['10', '20', '30', '40', '50']);
    });

    it('expect the header filters given to be shown in the header', async () => {
        const { element, gridInterface } = await mountGrid();
        typeInHeaderFilter(element, 'lastname', 'last1');

        gridInterface.setState({ headerFilters: { firstname: { value: 'first2' } } });

        expect(headerFilterInput(element, 'firstname').value).toEqual('first2');
        // headerFilters replaces every header filter, it is not merged
        expect(headerFilterInput(element, 'lastname').value).toEqual('');
        expect(gridInterface.getState().headerFilters).toEqual({ firstname: { value: 'first2' } });
    });

    it('expect a state stored as JSON to filter the same, its Dates come back as text', async () => {
        const config: GridConfig = { layout: { center: [{ fields: ['name'], width: 100 }] } };
        const data = [
            { name: 'a', born: new Date(2001, 4, 17) },
            { name: 'b', born: new Date(2001, 4, 18) },
            { name: 'c', born: new Date(2001, 4, 19) }
        ];
        const { datasource, gridInterface } = await mountGrid(config, data, { fields: { born: 'date' } });
        datasource.filter(and(where('born', 'GREATER_THAN_OR_EQUAL_TO', new Date(2001, 4, 18))));
        const json = JSON.stringify(gridInterface.getState());

        gridInterface.resetState();
        expect(datasource.getDataRows()).toHaveLength(3);
        gridInterface.setState(JSON.parse(json));

        expect(datasource.getDataRows().map((row) => row.name)).toEqual(['b', 'c']);
    });

    it('expect a boolean header filter set to false to show false, not empty', async () => {
        const config: GridConfig = { layout: { center: [{ fields: ['active'], width: 100 }] } };
        const { element, gridInterface } = await mountGrid(config, [{ active: true }, { active: false }], {
            fields: { active: 'boolean' }
        });

        gridInterface.setState({ headerFilters: { active: { value: false } }, filter: and(where('active', 'EQUAL', false)) });

        const checkbox = headerFilterInput(element, 'active');
        expect(checkbox.checked).toEqual(false);
        // v5 read the value with ||, so false showed as "no filter"
        expect(checkbox.indeterminate).toEqual(false);
    });

    it('expect a number header filter of 0 to show 0, not empty', async () => {
        const { element, gridInterface } = await mountGrid();

        gridInterface.setState({ headerFilters: { age: { value: 0 } } });

        expect(headerFilterInput(element, 'age').value).toEqual('0');
    });
});

describe('resetState', () => {
    it('expect the initial sorting to come back after a shift+click sort', async () => {
        const config = simpleConfig();
        config.initialState = { sorting: [{ attribute: 'firstname', ascending: true }] };
        const { datasource, gridInterface } = await mountGrid(config);

        gridInterface.resetState();
        datasource.sort({ attribute: 'firstname', ascending: false }, { add: true }); // shift+click on the sorted header
        gridInterface.resetState();

        expect(datasource.getLastSorting()).toEqual([{ attribute: 'firstname', ascending: true }]);
    });

    it('expect the initial filter to come back after the filter was changed in place', async () => {
        const config = simpleConfig();
        config.initialState = { filter: ageOver15() };
        const { element, datasource, gridInterface } = await mountGrid(config);

        gridInterface.resetState();
        addToFilterInPlace(datasource, firstnameIsFirst3());
        expect(footerText(element)).toContain('1/5');

        gridInterface.resetState();

        expect(gridInterface.getDatasource().getFilter()).toEqual(ageOver15());
        expect(footerText(element)).toContain('4/5');
    });

    it('expect the start state back after drag/drop, pinning, resizing, a header filter, a sort and grouping', async () => {
        const { element, datasource, gridInterface } = await mountGrid();
        const start = gridInterface.getState();
        const firstnames = renderedColumn(element, 'firstname');

        await changeEverything(element, datasource);
        datasource.group([{ attribute: 'lastname', title: 'Last name' }]);
        expect(footerText(element)).toContain('5/5');
        typeInHeaderFilter(element, 'lastname', 'last1');
        expect(footerText(element)).not.toContain('5/5');

        gridInterface.resetState();

        expect(gridInterface.getState()).toEqual(start);
        expect(footerText(element)).toContain('5/5');
        expect(renderedColumn(element, 'firstname')).toEqual(firstnames);
        expect(headerFilterInput(element, 'firstname').value).toEqual('');
        expect(headerFilterInput(element, 'lastname').value).toEqual('');
    });

    it('expect the config layout to be the one the grid goes back to, not changed by the user', async () => {
        const config = simpleConfig();
        const { element, datasource, gridInterface } = await mountGrid(config);
        const layout = structuredClone(config.layout);

        await changeEverything(element, datasource);

        expect(config.layout).toEqual(layout);
        gridInterface.resetState();
        expect(gridInterface.getState().layout).toEqual({ left: [], center: layout.center, right: [] });
    });
});

describe('initialState', () => {
    it('expect the grid to start sorted, grouped, expanded, filtered and with the header filters shown', async () => {
        const config = simpleConfig();
        config.initialState = {
            sorting: [
                { attribute: 'lastname', ascending: true },
                { attribute: 'age', ascending: false }
            ],
            grouping: [{ attribute: 'lastname', title: 'Last name' }],
            expandedGroups: ['last2'],
            filter: and(where('age', 'GREATER_THAN_OR_EQUAL_TO', 20)),
            headerFilters: { age: { value: 20 } }
        };
        const { element, datasource, gridInterface } = await mountGrid(config);

        expect(datasource.getGrouping()).toEqual([{ attribute: 'lastname', title: 'Last name' }]);
        expect(datasource.getLastSorting()).toEqual(config.initialState.sorting);
        expect(datasource.getFilter()).toEqual(config.initialState.filter);
        expect(headerFilterInput(element, 'age').value).toEqual('20');
        expect(gridInterface.getState()).toEqual({
            ...config.initialState,
            layout: { left: [], center: config.layout.center, right: [] },
            aggregates: {},
            totalsRow: false
        });
    });

    it('expect initialState.layout to be the start layout, and the one resetState goes back to', async () => {
        const config = simpleConfig();
        const layout = { left: [{ fields: ['age'], width: 50 }], center: [{ fields: ['firstname'], width: 120 }], right: [] };
        config.initialState = { layout };
        const { element, datasource, gridInterface } = await mountGrid(config);
        expect(gridInterface.getState().layout).toEqual(layout);
        expect(headerLabel(element, 'lastname')).toBeUndefined();

        datasource.sort({ attribute: 'age', ascending: true });
        dragResizeHandle(element, 0, 30);
        gridInterface.resetState();

        expect(gridInterface.getState().layout).toEqual(layout);
    });

    it('expect the initialState passed in not to be changed by later sorting and filtering', async () => {
        const config = simpleConfig();
        config.initialState = { sorting: [{ attribute: 'firstname', ascending: true }], filter: ageOver15() };
        const { datasource } = await mountGrid(config);

        datasource.sort({ attribute: 'age', ascending: false }, { add: true }); // shift+click on a header
        addToFilterInPlace(datasource, firstnameIsFirst3());

        expect(config.initialState).toEqual({ sorting: [{ attribute: 'firstname', ascending: true }], filter: ageOver15() });
    });

    it('expect no initialState to clear a sort, grouping and filter the datasource had', async () => {
        const { datasource } = await mountGrid();
        datasource.sort({ attribute: 'age', ascending: false });
        datasource.group([{ attribute: 'lastname', title: 'Last name' }]);
        datasource.filter(ageOver15());

        const other = new GridInterface(simpleConfig(), datasource);

        const state = other.getState();
        expect([state.sorting, state.grouping, state.expandedGroups, state.filter]).toEqual([[], [], [], null]);
        expect(datasource.getDataRows().map((row) => row.age)).toEqual([10, 20, 30, 40, 50]);
    });
});

describe('columns', () => {
    it('expect a field in the layout without a columns entry to get the defaults', async () => {
        const config = simpleConfig();
        // lastname and age have no entry
        config.columns = { firstname: { label: 'First', placeholderFilter: 'search first' } };
        const { element, datasource, gridInterface } = await mountGrid(config);

        expect(headerLabel(element, 'firstname')).toEqual('First');
        expect(headerLabel(element, 'lastname')).toEqual('Lastname');
        expect(headerFilterInput(element, 'lastname').placeholder).toEqual('Text');
        typeInHeaderFilter(element, 'lastname', 'last2');
        expect(datasource.getDataRows().map((row) => row.firstname)).toEqual(['first2']);
        // age is a number field: its header filter defaults to >=
        typeInHeaderFilter(element, 'age', '20');
        expect(gridInterface.getState().filter).toEqual(
            and(where('lastname', 'EQUAL', 'last2'), where('age', 'GREATER_THAN_OR_EQUAL_TO', 20))
        );
        expect(gridInterface.getHiddenFields()).toEqual([]);
    });

    it('expect a columns entry that is not in the layout to be offered by the column chooser', async () => {
        const config = simpleConfig();
        config.columns = { firstname: {}, extra: { label: 'Extra' } };
        const { gridInterface } = await mountGrid(config);

        expect(gridInterface.getHiddenFields()).toEqual(['extra']);
        expect(gridInterface.getLayoutFields()).toEqual(['firstname', 'lastname', 'age']);
    });

    it('expect the column operator to be the header filter default', async () => {
        const config = simpleConfig();
        config.columns = { age: { operator: 'LESS_THAN' } };
        const { element, gridInterface } = await mountGrid(config);

        typeInHeaderFilter(element, 'age', '30');

        expect(gridInterface.getState().filter).toEqual(and(where('age', 'LESS_THAN', 30)));
        // the config's operator is not state
        expect(gridInterface.getState().headerFilters).toEqual({ age: { value: 30 } });
    });

    it('expect placeholderFilter and placeholderRow on the inputs', async () => {
        const config = simpleConfig();
        config.columns = { lastname: { placeholderFilter: 'search', placeholderRow: 'type a name' } };
        config.placeholderRowCurrentEntityOnly = false;
        const { element } = await mountGrid(config);

        expect(headerFilterInput(element, 'lastname').placeholder).toEqual('search');
        const cell = element.querySelector('input[data-attribute="lastname"]') as HTMLInputElement;
        expect(cell.placeholder).toEqual('type a name');
    });

    it('expect the columns passed in not to be changed by the grid', async () => {
        const config = simpleConfig();
        config.columns = { lastname: { label: 'Last' } };
        const { element, gridInterface } = await mountGrid(config);
        gridInterface.on('filter-operator-change', (data) => {
            data.column.placeholderFilter = data.operator;
            data.rebuildHeader();
        });

        openFilterMenu(element, 'lastname');
        menuItem('Contains').click();

        // the grid's own copy changed, so the header shows it
        expect(headerFilterInput(element, 'lastname').placeholder).toEqual('CONTAINS');
        expect(config.columns).toEqual({ lastname: { label: 'Last' } });
    });
});
