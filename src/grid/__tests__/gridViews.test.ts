// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { where } from '../../datasource/filterExpression';
import type { GridConfig, GridState } from '../gridConfig';
import { viewNameProblem } from '../gridFunctions/viewsMenu';
import { GridInterface } from '../gridInterface';
import { assertViews, type GridView, newViewId, readStoredViews, startViews, viewStateText, writeStoredViews } from '../gridView';
import { mountGrid, renderedRows, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuEntry, openMenus } from './interactionTestHelpers';

/**
 * Named views (GridView, GridConfig.views): the list and the view shown, applying and saving them,
 * "modified", the default view, localStorage (viewsStorageKey), the views button at the footer's left
 * end and its menu
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

const KEY = 'test-grid-views';

/** the simple grid, with views on: the button shows */
const viewsConfig = (more: Partial<GridConfig> = {}): GridConfig => ({ ...simpleConfig(), views: [], ...more });

/** a filter on age, as the header filter makes it, with what the header shows */
const ageOver = (age: number): Partial<GridState> => ({
    filter: where('age', 'GREATER_THAN', age),
    headerFilters: { age: { value: age, operator: 'GREATER_THAN' } }
});

const button = (element: Element) => element.querySelector('.footer-views-button') as HTMLButtonElement | null;
const buttonText = (element: Element) => button(element)?.textContent?.replace(/\s+/g, ' ').trim();
const centerFields = (state: GridState) => state.layout.center.map((column) => column.fields[0]);
/** the entries of the open views menu, as `id:label` with ✓ and greyed out marked */
const menuLines = () =>
    Array.from(openMenus()[0]?.querySelectorAll<HTMLElement>('[data-menu-id]') ?? []).map((entry) => {
        const marks = `${entry.getAttribute('aria-checked') === 'true' ? '✓' : ''}${entry.getAttribute('aria-disabled') === 'true' ? '-' : ''}`;
        return `${marks}${entry.textContent?.replace(/\s+/g, ' ').trim()}`;
    });

describe('gridView - the helpers', () => {
    it('expect assertViews to take a list of views, and to throw a TypeError for anything else', () => {
        expect(() => assertViews([], 'x')).not.toThrow();
        expect(() => assertViews([{ id: 'a', name: 'A', state: {}, readonly: true, default: true }], 'x')).not.toThrow();

        expect(() => assertViews({}, 'GridConfig.views')).toThrow(/GridConfig.views is a list of views/);
        expect(() => assertViews([{ id: '', name: 'A', state: {} }], 'x')).toThrow(TypeError);
        expect(() => assertViews([{ id: 'a', name: 1, state: {} }], 'x')).toThrow(/x\[0\] is a view/);
        expect(() => assertViews([{ id: 'a', name: 'A', state: [] }], 'x')).toThrow(TypeError);
        expect(() => assertViews([{ id: 'a', name: 'A', state: {}, readonly: 'yes' }], 'x')).toThrow(TypeError);
        expect(() => assertViews([null], 'x')).toThrow(TypeError);
        expect(() =>
            assertViews(
                [
                    { id: 'a', name: 'A', state: {} },
                    { id: 'a', name: 'B', state: {} }
                ],
                'x'
            )
        ).toThrow(/two views have the id 'a'/);
        expect(() =>
            assertViews(
                [
                    { id: 'a', name: 'A', state: {}, default: true },
                    { id: 'b', name: 'B', state: {}, default: true }
                ],
                'x'
            )
        ).toThrow(/2 views are the default/);
    });

    it('expect a new id no view has', () => {
        const views: GridView[] = [{ id: 'a', name: 'A', state: {} }];
        const id = newViewId(views);
        expect(id).toMatch(/^view-/);
        expect(id).not.toEqual('a');
        expect(newViewId(views)).not.toEqual(id);
    });

    it('expect the state as text with its keys sorted, a Date as its ISO text, without the expanded groups and empty columns', () => {
        const date = new Date(Date.UTC(2026, 10, 22));
        const state = (
            headerFilters: GridState['headerFilters'],
            expandedGroups: string[],
            center: GridState['layout']['center']
        ) =>
            ({
                layout: { left: [], center, right: [] },
                sorting: [],
                grouping: [],
                expandedGroups,
                filter: null,
                headerFilters,
                aggregates: {},
                totalsRow: false,
                formats: {},
                detailForm: { show: false, fields: [] }
            }) as GridState;
        const column = { fields: ['name'], width: 100 };

        const a = viewStateText(state({ name: { value: 'a' }, born: { value: date } }, ['g1'], [column]));
        // another order of the header filters, other groups expanded, a column without fields
        const b = viewStateText(state({ born: { value: date }, name: { value: 'a' } }, [], [column, { fields: [], width: 50 }]));
        expect(a).toEqual(b);
        expect(a).toContain('"2026-11-22T00:00:00.000Z"');
        expect(viewStateText(state({ name: { value: 'b' } }, [], [column]))).not.toEqual(a);
    });

    it('expect the views stored and read back: not the readonly ones, the default by its id', () => {
        const views: GridView[] = [
            { id: 'shared', name: 'Shared', state: {}, readonly: true, default: true },
            { id: 'mine', name: 'Mine', state: ageOver(20) }
        ];
        writeStoredViews(KEY, views);

        expect(JSON.parse(localStorage.getItem(KEY) ?? '')).toEqual({
            views: [{ id: 'mine', name: 'Mine', state: JSON.parse(JSON.stringify(ageOver(20))) }],
            defaultView: 'shared'
        });
        expect(readStoredViews(KEY)?.views.map((view) => view.id)).toEqual(['mine']);
        expect(readStoredViews(KEY)?.defaultView).toEqual('shared');
    });

    it('expect nothing read when nothing is stored, it is no JSON, or no list of views - and a view that is none left out', () => {
        expect(readStoredViews(KEY)).toBeNull();
        localStorage.setItem(KEY, '{not json');
        expect(readStoredViews(KEY)).toBeNull();
        localStorage.setItem(KEY, JSON.stringify({ views: 'x' }));
        expect(readStoredViews(KEY)).toBeNull();
        localStorage.setItem(
            KEY,
            JSON.stringify({
                views: [{ id: 'a', name: 'A', state: {} }, { id: 'b' }, { id: 'a', name: 'again', state: {} }],
                defaultView: 3
            })
        );
        expect(readStoredViews(KEY)).toEqual({ views: [{ id: 'a', name: 'A', state: {} }], defaultView: null });
    });

    it('expect a storage that throws not to throw: nothing read, a warning when it can not write', () => {
        // a storage of its own: a spy on happy-dom's localStorage would be stored in it as an item
        vi.stubGlobal('localStorage', {
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('full');
            }
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            expect(readStoredViews(KEY)).toBeNull();
            expect(() => writeStoredViews(KEY, [])).not.toThrow();
            expect(warn).toHaveBeenCalledTimes(1);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it("expect the views to start with: the config's, then the readonly ones of the config and the stored ones", () => {
        const config: GridView[] = [
            { id: 'shared', name: 'Shared', state: {}, readonly: true },
            { id: 'start', name: 'Start', state: {}, default: true }
        ];
        expect(startViews(config, KEY)).toEqual(config);
        expect(startViews(undefined, undefined)).toEqual([]);

        // the user deleted Start and saved Mine, the default
        writeStoredViews(KEY, [config[0], { id: 'mine', name: 'Mine', state: {}, default: true }]);
        const views = startViews(config, KEY);
        expect(views.map((view) => `${view.id}${view.default ? '*' : ''}`)).toEqual(['shared', 'mine*']);
        // copies: the config is not changed
        expect(config[1].default).toBe(true);
    });

    it('expect a name of only spaces, or one another view has in any case, to be a problem - not the own name of the view renamed', () => {
        const views: GridView[] = [
            { id: 'a', name: 'Open orders', state: {} },
            { id: 'b', name: 'Late', state: {} }
        ];
        expect(viewNameProblem('  ', views, null)).toEqual('views.name.empty');
        expect(viewNameProblem(' open ORDERS ', views, null)).toEqual('views.name.taken');
        expect(viewNameProblem('Open orders', views, views[0])).toBeNull();
        expect(viewNameProblem('Late', views, views[0])).toEqual('views.name.taken');
        expect(viewNameProblem('New', views, null)).toBeNull();
    });
});

describe('grid views - the API', () => {
    it('expect a grid to start on Standard, not modified, without views', async () => {
        const { gridInterface } = await mountGrid();

        expect(gridInterface.getViews()).toEqual([]);
        expect(gridInterface.getCurrentView()).toBeNull();
        expect(gridInterface.isViewModified()).toBe(false);
    });

    it('expect saveViewAs() to make a view of the state, shown from then on, and to send views-change', async () => {
        const { gridInterface } = await mountGrid();
        const sent: GridView[][] = [];
        gridInterface.on('views-change', ({ views }) => sent.push(views));
        gridInterface.setState(ageOver(20));
        expect(gridInterface.isViewModified()).toBe(true);

        const view = gridInterface.saveViewAs('  Over 20 ');

        expect(view.name).toEqual('Over 20');
        expect(view.state).toEqual(gridInterface.getState());
        expect(gridInterface.getCurrentView()?.id).toEqual(view.id);
        expect(gridInterface.isViewModified()).toBe(false);
        expect(sent).toEqual([[view]]);
        // copies
        view.name = 'changed';
        expect(gridInterface.getViews()[0].name).toEqual('Over 20');
    });

    it('expect a change of the state to mark the view modified, and applyView() to take it back', async () => {
        const { gridInterface, element } = await mountGrid();
        gridInterface.setState(ageOver(20));
        const view = gridInterface.saveViewAs('Over 20');

        gridInterface.setState({ sorting: [{ attribute: 'firstname', ascending: false }] });
        expect(gridInterface.isViewModified()).toBe(true);
        gridInterface.applyView(view.id);
        expect(gridInterface.isViewModified()).toBe(false);
        expect(gridInterface.getState().sorting).toEqual([]);
        expect(renderedRows(element).map((row) => row.values.age)).toEqual(['30', '40', '50']);
    });

    it('expect two views of other filters and columns to switch, each all of its state', async () => {
        const { gridInterface, element } = await mountGrid();
        gridInterface.setState(ageOver(30));
        const over30 = gridInterface.saveViewAs('Over 30');
        gridInterface.applyView(null);
        // the columns moved, no filter
        gridInterface.setState({
            layout: {
                center: [
                    { fields: ['age'], width: 60 },
                    { fields: ['firstname'], width: 100 }
                ]
            }
        });
        const ageFirst = gridInterface.saveViewAs('Age first');

        gridInterface.applyView(over30.id);
        expect(centerFields(gridInterface.getState())).toEqual(['firstname', 'lastname', 'age']);
        expect(renderedRows(element)).toHaveLength(2);

        gridInterface.applyView(ageFirst.id);
        expect(centerFields(gridInterface.getState())).toEqual(['age', 'firstname']);
        expect(gridInterface.getState().filter).toBeNull();
        expect(renderedRows(element)).toHaveLength(5);
        expect(gridInterface.isViewModified()).toBe(false);
    });

    it("expect a view of a few parts to be the config's state with those parts", async () => {
        const config = viewsConfig({
            initialState: { sorting: [{ attribute: 'age', ascending: false }] },
            views: [{ id: 'f', name: 'Filtered', state: ageOver(30) }]
        });
        const { gridInterface } = await mountGrid(config);
        gridInterface.setState({ layout: { center: [{ fields: ['age'], width: 60 }] }, totalsRow: true });

        gridInterface.applyView('f');

        const state = gridInterface.getState();
        expect(centerFields(state)).toEqual(['firstname', 'lastname', 'age']);
        expect(state.sorting).toEqual([{ attribute: 'age', ascending: false }]);
        expect(state.totalsRow).toBe(false);
        expect(state.headerFilters).toEqual({ age: { value: 30, operator: 'GREATER_THAN' } });
    });

    it('expect a group opened or closed not to mark the view modified', async () => {
        const { gridInterface, datasource } = await mountGrid();
        gridInterface.setState({ grouping: [{ attribute: 'lastname', title: 'Last' }] });
        gridInterface.saveViewAs('Grouped');

        datasource.expandGroup('last1');

        expect(gridInterface.getState().expandedGroups.length).toBeGreaterThan(0);
        expect(gridInterface.isViewModified()).toBe(false);
    });

    it('expect saveView() to save over the view shown, and to throw on Standard and on a readonly view', async () => {
        const { gridInterface } = await mountGrid(
            viewsConfig({ views: [{ id: 'shared', name: 'Shared', state: {}, readonly: true }] })
        );
        expect(() => gridInterface.saveView()).toThrow(/no view is shown/);

        const view = gridInterface.saveViewAs('Mine');
        gridInterface.setState(ageOver(40));
        const sent = vi.fn();
        gridInterface.on('views-change', sent);
        const saved = gridInterface.saveView();
        expect(saved.id).toEqual(view.id);
        expect(saved.state.headerFilters).toEqual({ age: { value: 40, operator: 'GREATER_THAN' } });
        expect(gridInterface.isViewModified()).toBe(false);
        expect(sent).toHaveBeenCalledTimes(1);

        gridInterface.applyView('shared');
        expect(() => gridInterface.saveView()).toThrow(/the view 'Shared' is readonly/);
    });

    it('expect renameView() and deleteView() to change a view of the user, and to throw for a readonly one or an unknown id', async () => {
        const { gridInterface } = await mountGrid(
            viewsConfig({ views: [{ id: 'shared', name: 'Shared', state: {}, readonly: true }] })
        );
        const view = gridInterface.saveViewAs('Mine');
        const sent = vi.fn();
        gridInterface.on('views-change', sent);

        gridInterface.renameView(view.id, ' My orders ');
        expect(gridInterface.getCurrentView()?.name).toEqual('My orders');
        expect(() => gridInterface.renameView(view.id, '   ')).toThrow(/the name of a view is a text, not empty/);
        expect(() => gridInterface.renameView('shared', 'x')).toThrow(TypeError);
        expect(() => gridInterface.deleteView('shared')).toThrow(TypeError);
        expect(() => gridInterface.deleteView('nope')).toThrow(/no view has the id 'nope'/);
        expect(() => gridInterface.applyView('nope')).toThrow(TypeError);

        gridInterface.deleteView(view.id);
        expect(gridInterface.getViews().map((each) => each.id)).toEqual(['shared']);
        expect(sent).toHaveBeenCalledTimes(2);
    });

    it('expect the view shown deleted to leave the state as it is: Standard, modified, saved again as a new view', async () => {
        const { gridInterface } = await mountGrid();
        gridInterface.setState(ageOver(20));
        const view = gridInterface.saveViewAs('Over 20');

        gridInterface.deleteView(view.id);

        expect(gridInterface.getCurrentView()).toBeNull();
        expect(gridInterface.isViewModified()).toBe(true);
        expect(gridInterface.getState().headerFilters).toEqual({ age: { value: 20, operator: 'GREATER_THAN' } });
        gridInterface.saveViewAs('Over 20');
        expect(gridInterface.isViewModified()).toBe(false);
    });

    it('expect setDefaultView() to make one view the default, null none', async () => {
        const { gridInterface } = await mountGrid(
            viewsConfig({ views: [{ id: 'shared', name: 'Shared', state: {}, readonly: true }] })
        );
        const mine = gridInterface.saveViewAs('Mine');
        const defaults = () =>
            gridInterface
                .getViews()
                .filter((view) => view.default)
                .map((view) => view.id);

        gridInterface.setDefaultView(mine.id);
        expect(defaults()).toEqual([mine.id]);
        // a readonly view can be the default
        gridInterface.setDefaultView('shared');
        expect(defaults()).toEqual(['shared']);
        gridInterface.setDefaultView(null);
        expect(defaults()).toEqual([]);
        expect(() => gridInterface.setDefaultView('nope')).toThrow(TypeError);
    });

    it("expect the default view applied when the grid is made, on top of initialState - resetState() goes to the config's", async () => {
        const config = viewsConfig({
            initialState: { sorting: [{ attribute: 'age', ascending: false }] },
            views: [
                { id: 'a', name: 'A', state: {} },
                { id: 'over30', name: 'Over 30', state: ageOver(30), default: true }
            ]
        });
        const { gridInterface, element } = await mountGrid(config);

        expect(gridInterface.getCurrentView()?.id).toEqual('over30');
        expect(gridInterface.isViewModified()).toBe(false);
        expect(renderedRows(element).map((row) => row.values.age)).toEqual(['50', '40']);

        gridInterface.resetState();
        expect(gridInterface.getCurrentView()).toBeNull();
        expect(gridInterface.isViewModified()).toBe(false);
        expect(renderedRows(element)).toHaveLength(5);
    });

    it('expect a default view that can not be applied to be passed by with a warning: the grid starts all the same', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const config = viewsConfig({
            // sum on a text field: setState() throws for it
            views: [{ id: 'bad', name: 'Bad', state: { aggregates: { firstname: ['sum'] } }, default: true }]
        });
        const { gridInterface, element } = await mountGrid(config);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(gridInterface.getCurrentView()).toBeNull();
        expect(renderedRows(element)).toHaveLength(5);
        expect(() => gridInterface.applyView('bad')).toThrow(TypeError);
    });

    it('expect setViews() to replace the list without views-change, the view shown kept when it is still there', async () => {
        const { gridInterface } = await mountGrid();
        const sent = vi.fn();
        gridInterface.on('views-change', sent);
        gridInterface.setViews([{ id: 'a', name: 'A', state: ageOver(10) }]);
        gridInterface.applyView('a');

        const views: GridView[] = [
            { id: 'a', name: 'A again', state: ageOver(10) },
            { id: 'b', name: 'B', state: {} }
        ];
        gridInterface.setViews(views);
        expect(gridInterface.getCurrentView()?.name).toEqual('A again');
        expect(gridInterface.isViewModified()).toBe(false);
        // a copy
        views[0].name = 'changed';
        expect(gridInterface.getViews()[0].name).toEqual('A again');

        gridInterface.setViews([{ id: 'b', name: 'B', state: {} }]);
        expect(gridInterface.getCurrentView()).toBeNull();
        expect(gridInterface.isViewModified()).toBe(true);
        expect(sent).not.toHaveBeenCalled();
        expect(() => gridInterface.setViews([{ id: 'x' } as GridView])).toThrow(TypeError);
    });

    it('expect updateConfig() with a layout to keep Standard unmodified, and with views to make the list again', async () => {
        const { gridInterface } = await mountGrid(viewsConfig());
        gridInterface.updateConfig({ layout: { center: [{ fields: ['age'], width: 80 }] } });
        expect(gridInterface.isViewModified()).toBe(false);

        gridInterface.updateConfig({ views: [{ id: 'n', name: 'N', state: {} }] });
        expect(gridInterface.getViews().map((view) => view.id)).toEqual(['n']);
        expect(() => gridInterface.updateConfig({ views: 'x' as any })).toThrow(TypeError);
    });

    it('expect a TypeError for views that are none, and for a storage key that is no text', () => {
        const datasource = new Datasource({ fields: { age: 'number' } });
        expect(() => new GridInterface(viewsConfig({ views: [{ id: 'a' } as GridView] }), datasource)).toThrow(TypeError);
        expect(() => new GridInterface(viewsConfig({ viewsStorageKey: 3 as any }), datasource)).toThrow(
            /viewsStorageKey is the key of localStorage/
        );
    });
});

describe('grid views - localStorage (viewsStorageKey)', () => {
    it('expect the views saved, renamed and the default kept, and given to a new grid of the key', async () => {
        const config = viewsConfig({
            viewsStorageKey: KEY,
            views: [{ id: 'shared', name: 'Shared', state: ageOver(40), readonly: true }]
        });
        const first = await mountGrid(config);
        first.gridInterface.setState(ageOver(20));
        const mine = first.gridInterface.saveViewAs('Mine');
        first.gridInterface.setDefaultView(mine.id);
        first.element.remove();

        const second = await mountGrid(config);
        expect(second.gridInterface.getViews().map((view) => view.name)).toEqual(['Shared', 'Mine']);
        expect(second.gridInterface.getCurrentView()?.name).toEqual('Mine');
        expect(second.gridInterface.getState().headerFilters).toEqual({ age: { value: 20, operator: 'GREATER_THAN' } });
        expect(second.gridInterface.isViewModified()).toBe(false);
    });

    it('expect setViews() to write the storage too, and a view of the config the user deleted to stay deleted', async () => {
        const config = viewsConfig({ viewsStorageKey: KEY, views: [{ id: 'start', name: 'Start', state: {} }] });
        const first = await mountGrid(config);
        first.gridInterface.deleteView('start');
        first.element.remove();

        const second = await mountGrid(config);
        expect(second.gridInterface.getViews()).toEqual([]);
        second.gridInterface.setViews([{ id: 'x', name: 'X', state: {} }]);
        expect(readStoredViews(KEY)?.views.map((view) => view.id)).toEqual(['x']);
    });
});

describe('grid views - the button and its menu', () => {
    it('expect the button with views or a storage key, not without, nor with viewsButton false or a footer of no height', async () => {
        expect(button((await mountGrid()).element)).toBeNull();
        expect(button((await mountGrid(viewsConfig())).element)).not.toBeNull();
        expect(button((await mountGrid({ ...simpleConfig(), viewsStorageKey: KEY })).element)).not.toBeNull();
        expect(button((await mountGrid(viewsConfig({ viewsButton: false }))).element)).toBeNull();
        expect(button((await mountGrid(viewsConfig({ footerHeight: 0 }))).element)).toBeNull();
        expect(button((await mountGrid({ ...simpleConfig(), viewsButton: true })).element)).not.toBeNull();
    });

    it('expect the name of the view shown, a * when it changed, said in words for a screen reader', async () => {
        const { element, gridInterface } = await mountGrid(viewsConfig());
        expect(buttonText(element)).toEqual('Standard');
        expect(button(element)?.getAttribute('aria-label')).toEqual('View: Standard');
        expect(button(element)?.title).toEqual('View: Standard');
        expect(button(element)?.getAttribute('aria-haspopup')).toEqual('menu');
        expect(element.querySelector('.footer-inner')?.classList.contains('has-views')).toBe(true);

        gridInterface.setState(ageOver(20));
        expect(buttonText(element)).toEqual('Standard*');
        gridInterface.saveViewAs('Over 20');
        expect(buttonText(element)).toEqual('Over 20');

        gridInterface.setState({ sorting: [{ attribute: 'age', ascending: false }] });
        expect(buttonText(element)).toEqual('Over 20*');
        expect(button(element)?.getAttribute('aria-label')).toEqual('View: Over 20 (changed)');
    });

    it('expect the * without a rebuild: an operator picked, filter as you type turned on', async () => {
        const { element, gridInterface } = await mountGrid(viewsConfig());

        gridInterface.__setHeaderFilterOnType('firstname', true);

        expect(buttonText(element)).toEqual('Standard*');
    });

    it('expect the button to be the first stop of Tab in the footer, one element while the views change', async () => {
        const { element, gridInterface } = await mountGrid(viewsConfig());
        const first = button(element);
        const stops = Array.from(
            element.querySelectorAll('.simple-html-grid-footer button, .simple-html-grid-footer [tabindex="0"]')
        );
        expect(stops[0]).toBe(first);

        gridInterface.saveViewAs('Mine');
        expect(button(element)).toBe(first);
    });

    it('expect a click to open the menu: Standard and the views with a ✓ on the one shown, their hints, the commands', async () => {
        const { element, gridInterface } = await mountGrid(
            viewsConfig({ views: [{ id: 'shared', name: 'Shared', state: {}, readonly: true, default: true }] })
        );
        gridInterface.applyView(null);
        gridInterface.saveViewAs('Mine');

        button(element)?.click();

        expect(menuLines()).toEqual([
            'Standard',
            'Shared (default, shared)',
            '✓Mine',
            '',
            '-Save',
            'Save as new view…',
            '-Revert changes',
            '',
            'Rename…',
            'Delete',
            'Default view'
        ]);
        expect(openMenus()[0].getAttribute('aria-label')).toEqual('View: Mine');
        // a second click closes it
        button(element)?.click();
        expect(openMenus()).toHaveLength(0);
    });

    it("expect Save, Rename… and Delete greyed out on Standard and a readonly view, Default view checked on Standard's default", async () => {
        const { element, gridInterface } = await mountGrid(
            viewsConfig({ views: [{ id: 'shared', name: 'Shared', state: ageOver(40), readonly: true }] })
        );
        gridInterface.setState(ageOver(10));

        button(element)?.click();
        expect(menuLines()).toEqual([
            '✓Standard (default)',
            'Shared (shared)',
            '',
            '-Save',
            'Save as new view…',
            'Revert changes',
            '',
            '-Rename…',
            '-Delete',
            '✓-Default view'
        ]);
        menuEntry('views.view.shared').click();
        expect(gridInterface.getCurrentView()?.id).toEqual('shared');

        button(element)?.click();
        expect(menuLines().slice(3)).toEqual([
            '-Save',
            'Save as new view…',
            '-Revert changes',
            '',
            '-Rename…',
            '-Delete',
            'Default view'
        ]);
        menuEntry('views.setDefault').click();
        expect(gridInterface.getViews()[0].default).toBe(true);
    });

    it('expect the menu to apply, save, revert, delete and make the default', async () => {
        const { element, gridInterface } = await mountGrid(viewsConfig());
        const mine = gridInterface.saveViewAs('Mine');
        gridInterface.setState(ageOver(30));

        button(element)?.click();
        menuEntry('views.save').click();
        expect(gridInterface.getViews()[0].state.headerFilters).toEqual({ age: { value: 30, operator: 'GREATER_THAN' } });

        gridInterface.setState({ headerFilters: {}, filter: null });
        button(element)?.click();
        menuEntry('views.revert').click();
        expect(gridInterface.getState().headerFilters).toEqual({ age: { value: 30, operator: 'GREATER_THAN' } });

        button(element)?.click();
        menuEntry('views.setDefault').click();
        expect(gridInterface.getViews()[0].default).toBe(true);
        button(element)?.click();
        expect(menuLines()[1]).toEqual('✓Mine (default)');
        menuEntry('views.setDefault').click();
        expect(gridInterface.getViews()[0].default).toBeUndefined();

        button(element)?.click();
        menuEntry('views.standard').click();
        expect(gridInterface.getCurrentView()).toBeNull();
        button(element)?.click();
        menuEntry(`views.view.${mine.id}`).click();
        button(element)?.click();
        menuEntry('views.delete').click();
        expect(gridInterface.getViews()).toEqual([]);
        expect(buttonText(element)).toEqual('Standard*');
    });

    it('expect Save as new view… to ask for the name: the focus in it, a problem said, Enter saves', async () => {
        const { element, gridInterface } = await mountGrid(viewsConfig({ views: [{ id: 'a', name: 'Open orders', state: {} }] }));
        const sent = vi.fn();
        gridInterface.on('views-change', sent);
        button(element)?.focus();
        button(element)?.click();
        menuEntry('views.saveAs').click();

        const input = document.querySelector('.simple-html-grid-view-name-input') as HTMLInputElement;
        const problem = () => document.querySelector('.simple-html-grid-view-name-problem')?.textContent?.trim();
        const save = () =>
            document.querySelector('.simple-html-grid-view-name .simple-html-grid-button-primary') as HTMLButtonElement;
        expect(document.activeElement).toBe(input);
        expect(document.querySelector('.simple-html-grid-view-name-label')?.textContent?.trim()).toEqual('Name of the view');
        expect(problem()).toEqual('Give the view a name');
        expect(save().getAttribute('aria-disabled')).toEqual('true');
        expect(save().textContent?.trim()).toEqual('Save');

        const type = (text: string) => {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        };
        type('open orders');
        expect(problem()).toEqual('Another view has this name');
        expect(input.getAttribute('aria-invalid')).toEqual('true');
        // Save does nothing while the name is not fine
        save().click();
        expect(sent).not.toHaveBeenCalled();

        type('Late deliveries');
        expect(problem()).toEqual('');
        expect(save().hasAttribute('aria-disabled')).toBe(false);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(gridInterface.getViews().map((view) => view.name)).toEqual(['Open orders', 'Late deliveries']);
        expect(gridInterface.getCurrentView()?.name).toEqual('Late deliveries');
        expect(sent).toHaveBeenCalledTimes(1);
        expect(openMenus()).toHaveLength(0);
        // the focus back on the button
        expect(document.activeElement).toBe(button(element));
    });

    it('expect Rename… to ask with the name in it, Cancel to change nothing', async () => {
        const { element, gridInterface } = await mountGrid(viewsConfig());
        gridInterface.saveViewAs('Mine');

        button(element)?.click();
        menuEntry('views.rename').click();
        const input = document.querySelector('.simple-html-grid-view-name-input') as HTMLInputElement;
        expect(input.value).toEqual('Mine');
        const buttons = document.querySelectorAll<HTMLButtonElement>('.simple-html-grid-view-name .simple-html-grid-button');
        expect(buttons[1].textContent?.trim()).toEqual('Rename');
        buttons[0].click();
        expect(gridInterface.getCurrentView()?.name).toEqual('Mine');

        button(element)?.click();
        menuEntry('views.rename').click();
        const again = document.querySelector('.simple-html-grid-view-name-input') as HTMLInputElement;
        again.value = 'My orders';
        again.dispatchEvent(new Event('input', { bubbles: true }));
        (
            document.querySelectorAll<HTMLButtonElement>(
                '.simple-html-grid-view-name .simple-html-grid-button'
            )[1] as HTMLButtonElement
        ).click();
        expect(buttonText(element)).toEqual('My orders');
    });

    it("expect the grid's texts on the button and in the menu", async () => {
        const { element } = await mountGrid(
            viewsConfig({ texts: { 'views.standard': 'Alle', 'views.button': 'Visning: {name}' } })
        );
        expect(buttonText(element)).toEqual('Alle');
        expect(button(element)?.getAttribute('aria-label')).toEqual('Visning: Alle');
    });
});
