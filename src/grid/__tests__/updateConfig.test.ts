// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { where } from '../../datasource/filterExpression';
import type { GridConfig, GridLayout } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { GridInterface } from '../gridInterface';
import { visibleCenterAttributes } from './gridLifecycleHelpers';
import { mountGrid, renderedColumn, simpleConfig, simpleData, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, menuItem, openRowMenu, sleep } from './interactionTestHelpers';

/**
 * gridInterface.updateConfig(): changes options while the grid is shown, rebuilds once
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

const firstInput = (element: GridElement, field: string) =>
    element.querySelector(`input[data-attribute="${field}"]`) as HTMLInputElement;

const headerLabel = (element: GridElement, field: string) =>
    element.querySelector(`[data-attribute-header="${field}"]`)?.textContent?.trim();

const headerHeight = (element: GridElement) => (element.querySelector('.simple-html-grid-header') as HTMLElement).style.height;

const rowHeight = (element: GridElement) =>
    (element.querySelector('.simple-html-grid-body-row-container-pinned-middle .simple-html-grid-row') as HTMLElement).style
        .height;

/** age first, then firstname, lastname left out */
const otherLayout = (): GridLayout => ({
    center: [
        { fields: ['age'], width: 50 },
        { fields: ['firstname'], width: 80 }
    ]
});

describe('updateConfig - options', () => {
    it('expect an option to change and the grid to rebuild once', async () => {
        const { element, gridInterface } = await mountGrid(); // readonly by default
        expect(firstInput(element, 'firstname').readOnly).toBe(true);
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');

        gridInterface.updateConfig({ readonly: false });

        expect(rebuild).toHaveBeenCalledTimes(1);
        expect(firstInput(element, 'firstname').readOnly).toBe(false);
    });

    it('expect the options not given to stay as they are', async () => {
        const { element, gridInterface } = await mountGrid({ ...simpleConfig(), hideFilter: true, cellHeight: 30 });
        const height = headerHeight(element);

        gridInterface.updateConfig({ readonly: false });

        expect(headerHeight(element)).toBe(height);
        expect(rowHeight(element)).toBe('30px');
    });

    it('expect a new size to be applied, and the defaults that follow it', async () => {
        const { element, gridInterface } = await mountGrid();
        // a label row and a filter row of 22, the column selector row of 18
        expect(headerHeight(element)).toBe('62px');

        gridInterface.updateConfig({ cellHeight: 30 });

        // cellHeaderLabelHeight was not set: it follows cellHeight
        expect(headerHeight(element)).toBe('78px');
        expect(rowHeight(element)).toBe('30px');
    });

    it('expect an option given as undefined to go back to its default', async () => {
        const { element, gridInterface } = await mountGrid({ ...simpleConfig(), readonly: false });

        gridInterface.updateConfig({ readonly: undefined });

        expect(firstInput(element, 'firstname').readOnly).toBe(true);
    });

    it('expect the header to show the labels and filters asked for', async () => {
        const { element, gridInterface } = await mountGrid();

        gridInterface.updateConfig({ hideLabels: true, hideFilter: true });

        // only the column selector row is left
        expect(headerHeight(element)).toBe('18px');
    });

    it('expect the state to be kept', async () => {
        const { gridInterface } = await mountGrid();
        gridInterface.setState({
            layout: otherLayout(),
            sorting: [{ attribute: 'age', ascending: false }],
            filter: where('age', 'GREATER_THAN', 10),
            headerFilters: { age: { value: 10, operator: 'GREATER_THAN' } }
        });
        const state = gridInterface.getState();

        gridInterface.updateConfig({ readonly: false, cellHeight: 30, columns: { age: { label: 'Age' } } });

        expect(gridInterface.getState()).toEqual(state);
    });

    it('expect the handlers subscribed with on() to be kept', async () => {
        const { element, gridInterface } = await mountGrid();
        const clicked = vi.fn();
        gridInterface.on('cell-click', clicked);

        gridInterface.updateConfig({ readonly: false });
        firstInput(element, 'firstname').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(0); // sent in a setTimeout

        expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('expect the object passed in not to be changed', async () => {
        const { gridInterface } = await mountGrid();
        const update: Partial<GridConfig> = { readonly: false, columns: { age: { label: 'Age' } }, layout: otherLayout() };
        const copy = structuredClone(update);

        gridInterface.updateConfig(update);
        gridInterface.setState({ layout: { center: [{ fields: ['lastname'], width: 10 }] } });

        expect(update).toEqual(copy);
    });

    it('expect a change before the grid is on the page to be used when it is put there', async () => {
        await import('../gridElement');
        const datasource = new Datasource();
        datasource.setData(simpleData());
        const gridInterface = new GridInterface(simpleConfig(), datasource);
        const element = document.createElement('simple-html-grid') as GridElement;
        element.connectInterface(gridInterface);

        gridInterface.updateConfig({ readonly: false, layout: otherLayout() });
        document.body.appendChild(element);

        expect(firstInput(element, 'firstname').readOnly).toBe(false);
        expect(visibleCenterAttributes(element)).toEqual(['age', 'firstname']);
    });
});

describe('updateConfig - an option the user changes', () => {
    it('expect dimRepeatedValues turned on in the row menu to stay on after updateConfig', async () => {
        const rows = [
            { firstname: 'same', lastname: 'x', age: 1 },
            { firstname: 'same', lastname: 'y', age: 2 }
        ];
        const { element, gridInterface } = await mountGrid({ ...simpleConfig(), dimRepeatedValues: false }, rows);
        const dimmed = () => element.querySelectorAll('.simple-html-grid-repeated-value').length;
        expect(dimmed()).toBe(0);

        openRowMenu(element, 'firstname', 0);
        menuItem('Use dimmed values').click();
        expect(dimmed()).toBe(1);

        gridInterface.updateConfig({ readonly: false });

        expect(dimmed()).toBe(1);
    });
});

describe('updateConfig - columns', () => {
    it('expect columns to replace the options of every column', async () => {
        const config = simpleConfig();
        config.columns = { firstname: { label: 'First' }, lastname: { label: 'Last' } };
        const { element, gridInterface } = await mountGrid(config);
        expect(headerLabel(element, 'firstname')).toBe('First');

        gridInterface.updateConfig({ columns: { lastname: { label: 'Surname' } } });

        // firstname is left out: the defaults, the label made from the field name
        expect(headerLabel(element, 'firstname')).toBe('Firstname');
        expect(headerLabel(element, 'lastname')).toBe('Surname');
    });

    it('expect a column option to be applied to the cells', async () => {
        const { element, gridInterface } = await mountGrid({ ...simpleConfig(), readonly: false });

        gridInterface.updateConfig({ columns: { firstname: { readonly: true } } });

        expect(firstInput(element, 'firstname').readOnly).toBe(true);
        expect(firstInput(element, 'lastname').readOnly).toBe(false);
    });

    it('expect the columns not to change when they are not given', async () => {
        const config = simpleConfig();
        config.columns = { firstname: { label: 'First' } };
        const { element, gridInterface } = await mountGrid(config);

        gridInterface.updateConfig({ readonly: false });

        expect(headerLabel(element, 'firstname')).toBe('First');
    });
});

describe('updateConfig - layout and initialState', () => {
    it('expect a new layout to be shown right away, with one rebuild', async () => {
        const { element, gridInterface } = await mountGrid();
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');

        gridInterface.updateConfig({ layout: otherLayout() });

        expect(rebuild).toHaveBeenCalledTimes(1);
        expect(visibleCenterAttributes(element)).toEqual(['age', 'firstname']);
        expect(gridInterface.getState().layout.center).toEqual(otherLayout().center);
        // left out of the layout: the column chooser can add it back
        expect(gridInterface.getHiddenFields()).toEqual(['lastname']);
    });

    it('expect the new layout to be what resetState() goes back to', async () => {
        const { element, gridInterface } = await mountGrid();
        gridInterface.updateConfig({ layout: otherLayout() });
        gridInterface.setState({ layout: { center: [{ fields: ['lastname'], width: 100 }] } });

        gridInterface.resetState();

        expect(visibleCenterAttributes(element)).toEqual(['age', 'firstname']);
    });

    it('expect a new layout to keep the rest of the state', async () => {
        const { element, datasource, gridInterface } = await mountGrid();
        datasource.sort({ attribute: 'age', ascending: false });
        datasource.filter(where('age', 'GREATER_THAN', 20));

        gridInterface.updateConfig({ layout: otherLayout() });

        expect(renderedColumn(element, 'firstname')).toEqual(['first5', 'first4', 'first3']);
        expect(gridInterface.getState().sorting).toEqual([{ attribute: 'age', ascending: false }]);
    });

    it('expect initialState to change nothing now, and be what resetState() goes back to', async () => {
        const { element, gridInterface } = await mountGrid();

        gridInterface.updateConfig({ initialState: { sorting: [{ attribute: 'age', ascending: false }] } });

        expect(gridInterface.getState().sorting).toEqual([]);
        expect(renderedColumn(element, 'firstname')[0]).toBe('first1');

        gridInterface.resetState();

        expect(gridInterface.getState().sorting).toEqual([{ attribute: 'age', ascending: false }]);
        expect(renderedColumn(element, 'firstname')[0]).toBe('first5');
    });

    it('expect the layout of initialState to win over the layout on reset', async () => {
        const { element, gridInterface } = await mountGrid();

        gridInterface.updateConfig({
            layout: otherLayout(),
            initialState: { layout: { center: [{ fields: ['lastname'], width: 100 }] } }
        });
        expect(visibleCenterAttributes(element)).toEqual(['age', 'firstname']);

        gridInterface.resetState();

        expect(visibleCenterAttributes(element)).toEqual(['lastname']);
    });

    it('expect a hook given to it (plain js) to throw a TypeError and change nothing', async () => {
        const { element, gridInterface } = await mountGrid();
        const config: Partial<GridConfig> = { readonly: false };
        Reflect.set(config, 'cellClass', () => ({ input: 'x' }));

        expect(() => gridInterface.updateConfig(config)).toThrow(TypeError);
        expect(() => gridInterface.updateConfig(config)).toThrow('updateHooks({ cellClass })');

        expect(firstInput(element, 'firstname').readOnly).toBe(true);
    });

    it('expect initialState undefined to make resetState() clear everything', async () => {
        const config = simpleConfig();
        config.initialState = { sorting: [{ attribute: 'age', ascending: false }] };
        const { gridInterface } = await mountGrid(config);

        gridInterface.updateConfig({ initialState: undefined });
        gridInterface.resetState();

        expect(gridInterface.getState().sorting).toEqual([]);
    });
});
