// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { where } from '../../datasource/filterExpression';
import { createGrid } from '../createGrid';
import type { GridConfig } from '../gridConfig';
import { GridElement } from '../gridElement';
import { GridInterface } from '../gridInterface';
import { installFakeResizeObserver } from './gridLifecycleHelpers';
import {
    footerText,
    mountGrid,
    renderedColumn,
    simpleConfig,
    simpleData,
    simpleFields,
    stubCanvas,
    stubElementSizes
} from './gridTestHelpers';

/**
 * createGrid() puts a grid in a container in one call, gridInterface.destroy() takes it off again
 */

let resizeObserver: ReturnType<typeof installFakeResizeObserver>;

beforeAll(() => {
    stubCanvas();
});

beforeEach(() => {
    stubElementSizes();
    resizeObserver = installFakeResizeObserver();
    document.body.innerHTML = '';
});

afterEach(() => {
    document.body.innerHTML = '';
    resizeObserver.restore();
    vi.restoreAllMocks();
});

/**
 * a host in the page and a grid made in it with createGrid
 */
function create(config: GridConfig = simpleConfig()) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const datasource = new Datasource(simpleFields());
    datasource.setData(simpleData());
    const gridInterface = createGrid(host, { config, datasource });
    return { host, datasource, gridInterface, element: gridElementIn(host) };
}

/**
 * the grid element createGrid added to the host, without a cast
 */
function gridElementIn(host: HTMLElement): GridElement {
    const element = host.querySelector('simple-html-grid');
    if (!(element instanceof GridElement)) {
        throw new Error('no grid element in the host');
    }
    return element;
}

/**
 * the grid inside the element, the tests check what it left behind
 */
function gridOf(element: GridElement) {
    return (element as any).grid;
}

describe('createGrid', () => {
    it('expect a grid element that fills the host and shows the rows', () => {
        const { host, element, datasource, gridInterface } = create();

        expect(host.children).toHaveLength(1);
        expect(element.style.width).toBe('100%');
        expect(element.style.height).toBe('100%');
        // the grid sets its own class, the css hangs on it
        expect(element.classList.contains('simple-html-grid')).toBe(true);
        expect(renderedColumn(element, 'firstname')).toEqual(['first1', 'first2', 'first3', 'first4', 'first5']);
        expect(footerText(element)).toContain('5/5');
        expect(gridInterface.getDatasource()).toBe(datasource);
    });

    it('expect the grid to be connected and follow its datasource', () => {
        const { element, datasource, gridInterface } = create();

        datasource.setData([{ firstname: 'replaced', lastname: 'x', age: 1 }]);

        expect(gridInterface.__isConnected()).toBe(true);
        expect(renderedColumn(element, 'firstname')).toEqual(['replaced']);
    });

    it('expect the element to be added after what the host has', () => {
        const host = document.createElement('div');
        host.appendChild(document.createElement('span'));
        document.body.appendChild(host);

        createGrid(host, { config: simpleConfig(), datasource: new Datasource() });

        expect(Array.from(host.children).map((child) => child.tagName.toLowerCase())).toEqual(['span', 'simple-html-grid']);
    });

    it('expect autoResizeColumns right after createGrid to size the columns', () => {
        const { gridInterface } = create();

        gridInterface.autoResizeColumns();

        // stubCanvas measures 7px a character: every column got a width from its text
        expect(gridInterface.getState().layout.center.map((column) => column.width)).not.toEqual([100, 100, 100]);
    });

    it('expect the hooks to reach the grid', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const datasource = new Datasource(simpleFields());
        datasource.setData(simpleData());

        createGrid(host, {
            config: { ...simpleConfig(), readonly: false },
            datasource,
            hooks: { isReadonly: (row) => row.age > 20, cellClass: () => ({ input: 'from-hook' }) }
        });

        const inputs = Array.from(host.querySelectorAll<HTMLInputElement>('input[data-attribute="age"]'));
        expect(inputs.map((input) => input.readOnly)).toEqual([false, false, true, true, true]);
        expect(inputs.every((input) => input.classList.contains('from-hook'))).toBe(true);
    });

    it('expect a hook in the config (plain js, or a v6 pre-release config) to throw, and nothing added', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        for (const hook of ['isReadonly', 'cellClass', 'menus']) {
            const config = simpleConfig();
            Reflect.set(config, hook, hook === 'menus' ? {} : () => null);

            expect(() => createGrid(host, { config, datasource: new Datasource() })).toThrow(
                new TypeError(
                    `GridConfig: '${hook}' is a hook, not part of the config: createGrid(host, { config, datasource, hooks: { ${hook} } }), or gridInterface.updateHooks({ ${hook} })`
                )
            );
        }
        expect(host.children).toHaveLength(0);
    });
});

describe('a grid element placed by hand', () => {
    it('expect the grid to set its own class, nothing else is needed', async () => {
        await import('../gridElement');
        const datasource = new Datasource(simpleFields());
        datasource.setData(simpleData());
        const element = new GridElement();
        element.connectInterface(new GridInterface(simpleConfig(), datasource));
        document.body.appendChild(element);

        expect(element.classList.contains('simple-html-grid')).toBe(true);
        expect(renderedColumn(element, 'firstname')).toHaveLength(5);
    });
});

describe('gridInterface.destroy()', () => {
    it('expect the element to be removed and the host left empty', () => {
        const { host, element, gridInterface } = create();

        gridInterface.destroy();

        expect(host.children).toHaveLength(0);
        expect(element.isConnected).toBe(false);
    });

    it('expect no listener on the document and no resize observer left', () => {
        const add = vi.spyOn(document, 'addEventListener');
        const remove = vi.spyOn(document, 'removeEventListener');
        const { gridInterface } = create();
        const added = add.mock.calls.filter((call) => call[0] === 'click').map((call) => call[1]);

        gridInterface.destroy();

        const removed = remove.mock.calls.filter((call) => call[0] === 'click').map((call) => call[1]);
        expect(added.length).toBeGreaterThan(0);
        expect(added.every((listener) => removed.includes(listener))).toBe(true);
        expect(resizeObserver.current().disconnected).toBe(true);
    });

    it('expect the datasource events not to reach the grid any more', () => {
        const { element, datasource, gridInterface } = create();
        const grid = gridOf(element);
        const rebuild = vi.spyOn(grid, 'rebuild');

        gridInterface.destroy();
        datasource.setData([{ firstname: 'after', lastname: 'x', age: 1 }]);
        datasource.sort({ attribute: 'age', ascending: false });
        datasource.setRowAsCurrentEntity(0);

        expect(gridInterface.__isConnected()).toBe(false);
        expect(rebuild).not.toHaveBeenCalled();
    });

    it('expect the wheel listener on the element to be removed', () => {
        const { element, gridInterface } = create();
        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        scroller.scrollTop = 0;

        gridInterface.destroy();
        const wheel = new Event('wheel');
        (wheel as any).wheelDeltaY = -40;
        element.dispatchEvent(wheel);

        expect(scroller.scrollTop).toBe(0);
    });

    it('expect an open filter editor to be closed', () => {
        const { gridInterface } = create();
        gridInterface.openFilterEditor();
        expect(document.querySelector('.filter-editor-container')).not.toBeNull();

        gridInterface.destroy();

        expect(document.querySelector('.filter-editor-container')).toBeNull();
    });

    it('expect the handlers subscribed with on() to be dropped', () => {
        const { gridInterface } = create();
        const handler = vi.fn();
        gridInterface.on('grid-connected', handler);

        gridInterface.destroy();
        gridInterface.__callSubscribers('grid-connected', {});

        expect(handler).not.toHaveBeenCalled();
    });

    it('expect the datasource to keep its rows and filter', () => {
        const { datasource, gridInterface } = create();
        datasource.filter(where('age', 'GREATER_THAN', 20));

        gridInterface.destroy();

        expect(datasource.getAllData()).toHaveLength(5);
        expect(datasource.getRows()).toHaveLength(3);
        expect(datasource.getFilter()).toEqual(where('age', 'GREATER_THAN', 20));
    });

    it('expect the element to be removed also when the host left the page first', () => {
        const { host, gridInterface } = create();
        host.remove(); // the element is out of the dom, the grid disconnected already

        gridInterface.destroy();

        expect(host.children).toHaveLength(0);
    });

    it('expect an element placed by hand and never added to the page to be disconnected', async () => {
        await import('../gridElement');
        const datasource = new Datasource();
        datasource.setData(simpleData());
        const gridInterface = new GridInterface(simpleConfig(), datasource);
        const element = new GridElement();
        element.connectInterface(gridInterface);
        expect(gridInterface.__isConnected()).toBe(true);

        gridInterface.destroy();

        expect(gridInterface.__isConnected()).toBe(false);
        expect(() => datasource.setData(simpleData())).not.toThrow();
    });

    it('expect an element that shows another interface by now to be left alone', async () => {
        const { element, gridInterface: first } = await mountGrid();
        const datasource2 = new Datasource();
        datasource2.setData([{ firstname: 'second', lastname: 'x', age: 1 }]);
        const second = new GridInterface(simpleConfig(), datasource2);
        element.connectInterface(second);

        first.destroy();

        expect(element.isConnected).toBe(true);
        expect(second.__isConnected()).toBe(true);
        datasource2.setData([{ firstname: 'still shown', lastname: 'x', age: 1 }]);
        expect(renderedColumn(element, 'firstname')).toEqual(['still shown']);
    });

    it('expect destroy twice not to throw', () => {
        const { gridInterface } = create();
        gridInterface.destroy();
        expect(() => gridInterface.destroy()).not.toThrow();
    });
});
